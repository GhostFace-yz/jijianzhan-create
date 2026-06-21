import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { getTextProviderConfig } from '../../adapters/lib/provider-config.js';
import type { AIModelInfo, Snapshot, SnapshotService } from '../snapshot/types.js';
import type { AdapterPool } from '../../adapters/pool.js';
import type {
  EpisodeScript,
  HistoryResult,
  Scene,
  ScriptService,
  ScriptServiceOptions,
  UpdateScriptInput,
} from './types.js';
import type {
  OutlineData,
  OutlineEpisode,
} from '../outline/types.js';

// ── Zod Schemas ────────────────────────────────────────────────────

const dialogueSchema = z.object({
  char_id: z.string().min(1),
  text: z.string().min(1),
  emotion: z.string().min(1),
  note: z.string().nullable().optional(),
});

const sceneSchema = z.object({
  scene_id: z.string().min(1),
  location_id: z.string().min(1),
  time_of_day: z.string().min(1),
  weather: z.string().min(1),
  characters_present: z.array(z.string().min(1)).min(1),
  scene_summary: z.string().min(1),
  beats: z.array(z.string().min(1)).min(1),
  dialogues: z.array(dialogueSchema),
});

const endStateCharacterSchema = z.object({
  char_id: z.string().min(1),
  emotion: z.string().min(1),
  position: z.string().min(1),
});

const endStateSchema = z.object({
  characters: z.array(endStateCharacterSchema),
  unresolved_conflicts: z.array(z.string()),
  key_prop_states: z.record(z.string()),
});

const episodeScriptSchema = z.object({
  episode_title: z.string().min(1),
  scenes: z.array(sceneSchema).min(1),
  end_state: endStateSchema,
});

export const updateScriptSchema = z.object({
  episode_title: z.string().min(1).optional(),
  scenes: z.array(sceneSchema).min(1).optional(),
  end_state: endStateSchema.optional(),
});

// ── Helpers ────────────────────────────────────────────────────────

function scriptMetaKey(episodeNumber: number): string {
  return `script_ep-${episodeNumber}`;
}

function entityId(episodeNumber: number): string {
  return `ep-${episodeNumber}`;
}

function getOutlineFromProject(project: { outline: unknown }): OutlineData | null {
  if (!project.outline || typeof project.outline !== 'object') {
    return null;
  }
  return project.outline as OutlineData;
}

function getEpisodeOutline(outline: OutlineData, episodeNumber: number): OutlineEpisode {
  const episode = outline.episodes.find((e) => e.episode_number === episodeNumber);
  if (!episode) {
    throw new Error(`Episode ${episodeNumber} not found`);
  }
  return episode;
}

function parseAIScriptResponse(content: string): EpisodeScript | null {
  // Direct parse
  try {
    const parsed = JSON.parse(content);
    const result = episodeScriptSchema.safeParse(parsed);
    if (result.success) return result.data;
  } catch { /* continue */ }

  // Extract from markdown fences
  const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      const result = episodeScriptSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch { /* continue */ }
  }

  // Find outermost { } block
  const braceMatch = content.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      const parsed = JSON.parse(braceMatch[0]);
      const result = episodeScriptSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch { /* continue */ }
  }

  return null;
}

function buildScriptSystemPrompt(): string {
  return `You are a professional screenwriter for Chinese short drama series.

You MUST respond with ONLY valid JSON — no markdown formatting, no code fences, no explanations.

The JSON must have this exact structure:
{
  "episode_title": "本集标题",
  "scenes": [
    {
      "scene_id": "s1",
      "location_id": "场景名称（必须是已提供的场景之一）",
      "time_of_day": "清晨 | 上午 | 中午 | 下午 | 傍晚 | 夜晚 | 深夜 | 黎明",
      "weather": "晴天 | 多云 | 阴天 | 小雨 | 大雨 | 雪 | 雾 | 风 | 暴风雨",
      "characters_present": ["角色名1", "角色名2"],
      "scene_summary": "2-3句话概括本场戏",
      "beats": [" beat 1", "beat 2", "beat 3"],
      "dialogues": [
        { "char_id": "角色名", "text": "中文台词", "emotion": "neutral" }
      ]
    }
  ],
  "end_state": {
    "characters": [
      { "char_id": "角色名", "emotion": "neutral", "position": "本集结尾所在位置/状态" }
    ],
    "unresolved_conflicts": ["留给下集的冲突或悬念"],
    "key_prop_states": { "道具名": "状态" }
  }
}

CRITICAL RULES:
- 所有文本必须是中文。
- 每个场景至少包含 1 个 beat 和 1 段台词。
- 一集通常包含 3-6 个场景。
- 角色名和场景名必须严格来自提供的上下文。
- "characters_present" 与 "dialogues" 中的 "char_id" 必须一致。
- emotion 可选值：neutral, happy, sad, angry, surprised, fearful, disgusted, contemplative, anxious, excited, cold, gentle, sarcastic, nervous, proud, shy`;
}

function buildScriptUserPrompt(
  project: { meta: unknown },
  outline: OutlineData,
  episode: OutlineEpisode,
): string {
  const meta = (project.meta ?? {}) as Record<string, unknown>;
  const title = typeof meta.title === 'string' ? meta.title : 'Untitled';
  const genre = typeof meta.genre === 'string' ? meta.genre : '';
  const styleTags = Array.isArray(meta.style_tags) ? meta.style_tags.join(', ') : '';
  const durationGoal = typeof meta.duration_goal === 'string' ? meta.duration_goal : '';

  const parts: string[] = [];
  parts.push(`项目标题：${title}`);
  if (genre) parts.push(`类型：${genre}`);
  if (styleTags) parts.push(`风格标签：${styleTags}`);
  if (durationGoal) parts.push(`目标时长：${durationGoal}`);
  parts.push('');

  parts.push('世界观设定：');
  parts.push(outline.world_setting);
  parts.push('');

  parts.push('核心冲突：');
  parts.push(outline.main_conflict);
  parts.push('');

  parts.push('角色列表：');
  for (const c of outline.characters) {
    parts.push(`- ${c.name}（${c.role_type}）：${c.description}`);
  }
  parts.push('');

  parts.push('场景/地点列表：');
  for (const l of outline.locations) {
    parts.push(`- ${l.name}：${l.description}`);
  }
  parts.push('');

  parts.push(`本集信息：第 ${episode.episode_number} 集《${episode.title}》`);
  parts.push(`本集概要：${episode.summary}`);
  parts.push('关键事件：');
  for (const ev of episode.key_events) {
    parts.push(`- ${ev}`);
  }
  parts.push(`出场角色：${episode.featured_characters.join('、')}`);
  parts.push(`出场场景：${episode.featured_locations.join('、')}`);
  parts.push('');

  parts.push('请根据以上信息生成本集完整脚本（EpisodeScript JSON）。');

  return parts.join('\n');
}

function buildSceneRegenerationPrompt(
  project: { meta: unknown },
  outline: OutlineData,
  episode: OutlineEpisode,
  script: EpisodeScript,
  targetScene: Scene,
): string {
  const meta = (project.meta ?? {}) as Record<string, unknown>;
  const title = typeof meta.title === 'string' ? meta.title : 'Untitled';

  const sceneIndex = script.scenes.findIndex((s) => s.scene_id === targetScene.scene_id);
  const prevScene = sceneIndex > 0 ? script.scenes[sceneIndex - 1] : null;
  const nextScene = sceneIndex < script.scenes.length - 1 ? script.scenes[sceneIndex + 1] : null;

  const parts: string[] = [];
  parts.push(`项目标题：${title}`);
  parts.push(`第 ${episode.episode_number} 集《${episode.title}》`);
  parts.push(`本集概要：${episode.summary}`);
  parts.push('');

  parts.push('需要重新生成的场景：');
  parts.push(JSON.stringify(targetScene, null, 2));
  parts.push('');

  if (prevScene) {
    parts.push('前一个场景（保持衔接）：');
    parts.push(JSON.stringify(prevScene, null, 2));
    parts.push('');
  }

  if (nextScene) {
    parts.push('后一个场景（保持衔接）：');
    parts.push(JSON.stringify(nextScene, null, 2));
    parts.push('');
  }

  parts.push('本集结尾状态：');
  parts.push(JSON.stringify(script.end_state, null, 2));
  parts.push('');

  parts.push('请只重新生成上面指定的那个场景，保持 scene_id 不变，输出单个 Scene 对象的 JSON。');

  return parts.join('\n');
}

function createFallbackScript(
  project: { meta: unknown },
  outline: OutlineData,
  episode: OutlineEpisode,
): EpisodeScript {
  const meta = (project.meta ?? {}) as Record<string, unknown>;
  const title = typeof meta.title === 'string' ? meta.title : 'Untitled';

  const location = episode.featured_locations[0] ?? outline.locations[0]?.name ?? '默认场景';
  const char1 = episode.featured_characters[0] ?? outline.characters[0]?.name ?? '主角';
  const char2 = episode.featured_characters[1] ?? outline.characters[1]?.name ?? char1;

  const scenes: Scene[] = [
    {
      scene_id: 's1',
      location_id: location,
      time_of_day: '白天',
      weather: '晴天',
      characters_present: [char1, char2].filter(Boolean),
      scene_summary: `${char1}与${char2}在${location}相遇，为后续情节铺垫。`,
      beats: [`${char1}出现在${location}`, `${char2}进入画面`, '两人简短交流'],
      dialogues: [
        { char_id: char1, text: '你来了。', emotion: 'neutral' },
        { char_id: char2, text: '我来了。', emotion: 'neutral' },
      ],
    },
    {
      scene_id: 's2',
      location_id: location,
      time_of_day: '傍晚',
      weather: '多云',
      characters_present: [char1, char2].filter(Boolean),
      scene_summary: '冲突升级，双方围绕本集核心事件产生张力。',
      beats: ['气氛变得紧张', '关键矛盾被揭开', '两人对峙'],
      dialogues: [
        { char_id: char1, text: '事情不应该是这样的。', emotion: 'angry' },
        { char_id: char2, text: '可现实就是这样。', emotion: 'cold' },
      ],
    },
    {
      scene_id: 's3',
      location_id: location,
      time_of_day: '夜晚',
      weather: '阴天',
      characters_present: [char1, char2].filter(Boolean),
      scene_summary: '场景收束，留下悬念。',
      beats: ['情绪回落', '一方离开', '留下未解问题'],
      dialogues: [
        { char_id: char1, text: '我们还会再见的。', emotion: 'contemplative' },
      ],
    },
  ];

  return {
    episode_title: episode.title,
    scenes,
    end_state: {
      characters: [
        { char_id: char1, emotion: 'contemplative', position: `${location}内` },
        ...(char2 !== char1 ? [{ char_id: char2, emotion: 'neutral', position: '离开画面' }] : []),
      ],
      unresolved_conflicts: [episode.summary],
      key_prop_states: {},
    },
  };
}

// ── Service Factory ────────────────────────────────────────────────

export function createScriptService(options: ScriptServiceOptions = {}): ScriptService {
  const db = options.prisma ?? prisma;
  const snapshotService = options.snapshotService;
  const adapterPool = options.adapterPool;
  const maxRetries = options.maxRetries ?? 2;

  async function ensureProject(projectId: string) {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new Error('Project not found');
    }
    return project;
  }

  function getScriptFromMeta(
    project: { meta: unknown },
    episodeNumber: number,
  ): EpisodeScript | null {
    const meta = (project.meta ?? {}) as Record<string, unknown>;
    const raw = meta[scriptMetaKey(episodeNumber)];
    if (!raw || typeof raw !== 'object') return null;
    const result = episodeScriptSchema.safeParse(raw);
    return result.success ? result.data : null;
  }

  async function saveScript(
    projectId: string,
    episodeNumber: number,
    script: EpisodeScript,
  ): Promise<void> {
    const project = await ensureProject(projectId);
    const meta = { ...(project.meta as Record<string, unknown> ?? {}) };
    meta[scriptMetaKey(episodeNumber)] = script;

    await db.project.update({
      where: { id: projectId },
      data: {
        meta: meta as unknown as Prisma.InputJsonValue,
        updated_at: new Date(),
      },
    });
  }

  async function snapshotScript(
    projectId: string,
    episodeNumber: number,
    script: EpisodeScript,
    source: 'ai_generated' | 'user_edited' | 'ai_regenerated',
    aiModel?: AIModelInfo,
  ): Promise<void> {
    if (!snapshotService) return;
    await snapshotService.createSnapshot({
      entity: {
        projectId,
        entityType: 'script',
        entityId: entityId(episodeNumber),
      },
      source,
      content: script as unknown as Record<string, unknown>,
      aiModel,
    });
  }

  async function generateScriptViaAI(
    project: { meta: unknown },
    outline: OutlineData,
    episode: OutlineEpisode,
  ): Promise<{ script: EpisodeScript; aiModel: AIModelInfo }> {
    const systemPrompt = buildScriptSystemPrompt();
    const userPrompt = buildScriptUserPrompt(project, outline, episode);

    if (!adapterPool) {
      return {
        script: createFallbackScript(project, outline, episode),
        aiModel: { provider: 'fallback', model: 'template' },
      };
    }

    const textConfig = getTextProviderConfig();
    const adapter = adapterPool.getText(textConfig.provider);
    const isMock = textConfig.provider === 'mock-text';

    if (isMock) {
      return {
        script: createFallbackScript(project, outline, episode),
        aiModel: { provider: textConfig.provider, model: textConfig.model },
      };
    }

    let script: EpisodeScript | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const prompt = attempt === 0
          ? userPrompt
          : `${userPrompt}\n\n[SYSTEM REMINDER] 上一次返回格式不正确。请严格返回符合 schema 的单一 JSON 对象，不要 markdown，不要解释。`;

        const result = await adapter.generateText(prompt, systemPrompt, undefined, textConfig);
        script = parseAIScriptResponse(result.data.content);
        if (script) {
          return {
            script,
            aiModel: { provider: result.provider, model: result.model },
          };
        }
      } catch {
        // Retry
      }
    }

    return {
      script: createFallbackScript(project, outline, episode),
      aiModel: { provider: textConfig.provider, model: `${textConfig.model}-fallback` },
    };
  }

  async function regenerateSceneViaAI(
    project: { meta: unknown },
    outline: OutlineData,
    episode: OutlineEpisode,
    script: EpisodeScript,
    targetScene: Scene,
  ): Promise<{ scene: Scene; aiModel: AIModelInfo }> {
    const systemPrompt = `${buildScriptSystemPrompt()}\n\n注意：本次只需要输出单个 Scene 对象的 JSON，不要输出 EpisodeScript 外层结构。`;
    const userPrompt = buildSceneRegenerationPrompt(project, outline, episode, script, targetScene);

    if (!adapterPool) {
      return {
        scene: { ...targetScene },
        aiModel: { provider: 'fallback', model: 'template' },
      };
    }

    const textConfig = getTextProviderConfig();
    const adapter = adapterPool.getText(textConfig.provider);
    const isMock = textConfig.provider === 'mock-text';

    if (isMock) {
      return {
        scene: {
          ...targetScene,
          scene_summary: `${targetScene.scene_summary}（已重新生成）`,
        },
        aiModel: { provider: textConfig.provider, model: textConfig.model },
      };
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const prompt = attempt === 0
          ? userPrompt
          : `${userPrompt}\n\n[SYSTEM REMINDER] 请只返回单个 Scene 对象的 JSON。`;

        const result = await adapter.generateText(prompt, systemPrompt, undefined, textConfig);
        const parsed = parseAISceneResponse(result.data.content, targetScene.scene_id);
        if (parsed) {
          return {
            scene: parsed,
            aiModel: { provider: result.provider, model: result.model },
          };
        }
      } catch {
        // Retry
      }
    }

    return {
      scene: {
        ...targetScene,
        scene_summary: `${targetScene.scene_summary}（已重新生成）`,
      },
      aiModel: { provider: textConfig.provider, model: `${textConfig.model}-fallback` },
    };
  }

  function parseAISceneResponse(content: string, expectedSceneId: string): Scene | null {
    const sceneSchemaOnly = sceneSchema.extend({
      scene_id: z.string().min(1).default(expectedSceneId),
    });

    const tryParse = (text: string): Scene | null => {
      try {
        const parsed = JSON.parse(text);
        // If AI wrapped scene inside { scene: ... }, unwrap
        const target = parsed.scene ?? parsed;
        const result = sceneSchemaOnly.safeParse(target);
        if (result.success) return result.data;
      } catch { /* continue */ }
      return null;
    };

    const direct = tryParse(content);
    if (direct) return direct;

    const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      const fenced = tryParse(fenceMatch[1].trim());
      if (fenced) return fenced;
    }

    const braceMatch = content.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      const braced = tryParse(braceMatch[0]);
      if (braced) return braced;
    }

    return null;
  }

  // ── Public API ────────────────────────────────────────────────────

  return {
    async generateScript(projectId: string, episodeNumber: number): Promise<EpisodeScript> {
      const project = await ensureProject(projectId);
      const outline = getOutlineFromProject(project);
      if (!outline) {
        throw new Error('No outline found');
      }
      const episode = getEpisodeOutline(outline, episodeNumber);

      const { script, aiModel } = await generateScriptViaAI(project, outline, episode);
      await saveScript(projectId, episodeNumber, script);
      await snapshotScript(projectId, episodeNumber, script, 'ai_generated', aiModel);

      return script;
    },

    async getScript(projectId: string, episodeNumber: number): Promise<EpisodeScript | null> {
      const project = await ensureProject(projectId);
      return getScriptFromMeta(project, episodeNumber);
    },

    async updateScript(
      projectId: string,
      episodeNumber: number,
      input: UpdateScriptInput,
    ): Promise<EpisodeScript> {
      const project = await ensureProject(projectId);
      const existing = getScriptFromMeta(project, episodeNumber);
      if (!existing) {
        throw new Error(`Script not found for episode ${episodeNumber}`);
      }

      const updated: EpisodeScript = {
        episode_title: input.episode_title ?? existing.episode_title,
        scenes: input.scenes ?? existing.scenes,
        end_state: input.end_state ?? existing.end_state,
      };

      await saveScript(projectId, episodeNumber, updated);
      await snapshotScript(projectId, episodeNumber, updated, 'user_edited');

      return updated;
    },

    async regenerateScene(
      projectId: string,
      episodeNumber: number,
      sceneId: string,
    ): Promise<Scene> {
      const project = await ensureProject(projectId);
      const outline = getOutlineFromProject(project);
      if (!outline) {
        throw new Error('No outline found');
      }
      const episode = getEpisodeOutline(outline, episodeNumber);

      const existingScript = getScriptFromMeta(project, episodeNumber);
      if (!existingScript) {
        throw new Error(`Script not found for episode ${episodeNumber}`);
      }

      const sceneIndex = existingScript.scenes.findIndex((s) => s.scene_id === sceneId);
      if (sceneIndex === -1) {
        throw new Error(`Scene ${sceneId} not found`);
      }
      const targetScene = existingScript.scenes[sceneIndex];

      const { scene, aiModel } = await regenerateSceneViaAI(
        project,
        outline,
        episode,
        existingScript,
        targetScene,
      );

      const newScenes = [...existingScript.scenes];
      newScenes[sceneIndex] = scene;
      const updatedScript: EpisodeScript = {
        ...existingScript,
        scenes: newScenes,
      };

      await saveScript(projectId, episodeNumber, updatedScript);
      await snapshotScript(projectId, episodeNumber, updatedScript, 'ai_regenerated', aiModel);

      return scene;
    },

    async listVersions(projectId: string, episodeNumber: number): Promise<HistoryResult> {
      if (!snapshotService) {
        throw new Error('Snapshot service not configured');
      }
      return snapshotService.getHistory({
        projectId,
        entityType: 'script',
        entityId: entityId(episodeNumber),
      });
    },

    async getVersion(
      projectId: string,
      episodeNumber: number,
      versionId: string,
    ): Promise<Snapshot | null> {
      if (!snapshotService) {
        throw new Error('Snapshot service not configured');
      }
      return snapshotService.getSnapshot(
        {
          projectId,
          entityType: 'script',
          entityId: entityId(episodeNumber),
        },
        versionId,
      );
    },

    async rollbackVersion(
      projectId: string,
      episodeNumber: number,
      versionId: string,
    ): Promise<Snapshot> {
      if (!snapshotService) {
        throw new Error('Snapshot service not configured');
      }
      const snapshot = await snapshotService.rollback({
        entity: {
          projectId,
          entityType: 'script',
          entityId: entityId(episodeNumber),
        },
        versionId,
      });

      const content = snapshot.content as unknown as EpisodeScript;
      await saveScript(projectId, episodeNumber, content);
      return snapshot;
    },
  };
}
