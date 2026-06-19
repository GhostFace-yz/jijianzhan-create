import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import type { AIModelInfo, SnapshotService } from '../snapshot/types.js';
import type {
  OutlineData,
  OutlineEpisode,
  OutlineService,
  OutlineServiceOptions,
  OutlineValidationReport,
  CheckItem,
  UpdateOutlineInput,
} from './types.js';

// ── Outline JSON Schema (Zod) ──────────────────────────────────────

import { z } from 'zod';

const outlineCharacterSchema = z.object({
  name: z.string().min(1),
  role_type: z.enum(['protagonist', 'supporting', 'antagonist']),
  description: z.string().min(1),
});

const outlineLocationSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

const outlineEpisodeSchema = z.object({
  episode_number: z.number().int().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  key_events: z.array(z.string().min(1)).min(1),
  featured_characters: z.array(z.string().min(1)).min(1),
  featured_locations: z.array(z.string().min(1)).min(1),
});

const outlineDataSchema = z.object({
  world_setting: z.string().min(1),
  main_conflict: z.string().min(1),
  characters: z.array(outlineCharacterSchema).min(1),
  locations: z.array(outlineLocationSchema).min(1),
  episode_count: z.number().int().min(1),
  episodes: z.array(outlineEpisodeSchema).min(1),
});

// ── Prompt Templates ───────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a professional screenwriter and story architect specializing in short drama series.

Your task is to expand a creative idea into a structured story outline.

You MUST respond with ONLY valid JSON — no markdown formatting, no code fences, no explanations. The response must be pure, parseable JSON.

The JSON must have this exact structure:
{
  "world_setting": "Detailed description of the story world, time period, social context, and atmosphere",
  "main_conflict": "The central dramatic conflict that drives the entire story forward",
  "characters": [
    {
      "name": "Character name",
      "role_type": "protagonist | supporting | antagonist",
      "description": "Character background, personality, motivation, and role in the story"
    }
  ],
  "locations": [
    {
      "name": "Location name",
      "description": "Description of the location, its significance, and atmosphere"
    }
  ],
  "episode_count": <number of episodes>,
  "episodes": [
    {
      "episode_number": 1,
      "title": "Episode title",
      "summary": "What happens in this episode (2-4 sentences)",
      "key_events": ["Event 1", "Event 2", "Event 3"],
      "featured_characters": ["Character name appearing in this episode"],
      "featured_locations": ["Location name used in this episode"]
    }
  ]
}

CRITICAL RULES:
- episodes array length MUST equal episode_count
- episode_number MUST be sequential starting from 1
- Each episode MUST have at least 2 key_events
- Each episode MUST have at least 1 featured_character and 1 featured_location
- Be creative and detailed — every description should be at least 2-3 sentences
- Write in Chinese if the project title/description is in Chinese`;
}

function buildUserPrompt(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push('Create a structured outline for the following short drama project:\n');

  parts.push(`**Title**: ${meta.title || 'Untitled'}`);
  parts.push(`**Genre**: ${meta.genre || 'other'}`);
  parts.push(`**Creative Concept**: ${meta.description || 'No description provided'}`);

  if (meta.target_episodes) {
    parts.push(`**Target Episode Count**: ${meta.target_episodes}`);
  }
  if (meta.duration_goal) {
    parts.push(`**Episode Duration Goal**: ${meta.duration_goal}`);
  }
  if (Array.isArray(meta.style_tags) && meta.style_tags.length > 0) {
    parts.push(`**Visual Style**: ${(meta.style_tags as string[]).join(', ')}`);
  }
  if (meta.notes) {
    parts.push(`**Additional Notes**: ${meta.notes}`);
  }

  parts.push('\nGenerate a compelling, well-structured outline that a production team can use to start creating episodes.');
  return parts.join('\n');
}

// ── Response Parsing ───────────────────────────────────────────────

function parseAIResponse(content: string): OutlineData | null {
  // Try direct parse first
  try {
    const parsed = JSON.parse(content);
    const result = outlineDataSchema.safeParse(parsed);
    if (result.success) return result.data;
  } catch {
    // Not valid JSON — continue to extraction
  }

  // Try to extract JSON from markdown code fences
  const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      const result = outlineDataSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // Still invalid
    }
  }

  // Try to find outermost { } block
  const braceMatch = content.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      const parsed = JSON.parse(braceMatch[0]);
      const result = outlineDataSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // Last attempt failed
    }
  }

  return null;
}

// ── Fallback Outline ───────────────────────────────────────────────

function createFallbackOutline(meta: Record<string, unknown>): OutlineData {
  const title = String(meta.title || 'Untitled Project');
  const description = String(meta.description || '');
  const episodeCount =
    typeof meta.target_episodes === 'number'
      ? meta.target_episodes
      : 6;
  const genre = String(meta.genre || 'other');

  const genreAtmosphere: Record<string, string> = {
    urban_romance:
      '繁华的现代都市，高楼林立，霓虹闪烁。人们在这座不夜城中追逐梦想、邂逅爱情，每个人的故事都值得被讲述。',
    ancient_costume:
      '一个礼仪森严、风景如画的古代王朝。亭台楼阁、古街小巷，处处散发着历史的厚重与诗意。',
    suspense:
      '表面平静的小镇暗流涌动，每个转角都藏着不为人知的秘密。当真相一步步揭开，所有人都将面临考验。',
    comedy:
      '一个充满欢笑与误会的有趣世界，这里的每个人都有独特的幽默感，生活中的小事也能变成令人捧腹的闹剧。',
    sci_fi:
      '科技高度发达的未来世界，人工智能与人类共存。新技术的出现不断挑战着人类的认知边界和道德底线。',
    other:
      '一个独特而引人入胜的世界，在这里现实与想象交织，充满无限可能。',
  };

  return {
    world_setting: `${title}的故事发生在${genreAtmosphere[genre] || genreAtmosphere.other}\n\n${description}`,
    main_conflict: `故事围绕主角的成长与抉择展开。${description}`,
    characters: [
      {
        name: '主角',
        role_type: 'protagonist',
        description: `《${title}》的核心人物。性格鲜明，有着不为人知的过去和坚定的目标。${description}`,
      },
      {
        name: '重要配角',
        role_type: 'supporting',
        description: '在主角的旅程中扮演关键角色，与主角的关系推动着剧情发展。',
      },
    ],
    locations: [
      {
        name: '主要场景',
        description: '故事的主要发生地，承载了大部分重要剧情。',
      },
    ],
    episode_count: episodeCount,
    episodes: Array.from({ length: episodeCount }, (_, i) => ({
      episode_number: i + 1,
      title: `第${i + 1}集`,
      summary: `《${title}》第${i + 1}集。剧情逐步展开，角色关系深化。`,
      key_events: ['开场事件', '核心冲突', '悬念收尾'],
      featured_characters: ['主角'],
      featured_locations: ['主要场景'],
    })),
  };
}

// ── Script Doctor (自洽性检查) ─────────────────────────────────────

const EMOTION_KEYWORDS = {
  positive: ['开心', '幸福', '甜蜜', '成功', '胜利', '团圆', '惊喜', '温暖', '感动', '欢笑', '喜悦', '爱', 'happy', 'joy', 'love'],
  negative: ['悲伤', '愤怒', '恐惧', '绝望', '失败', '背叛', '失去', '痛苦', '哭泣', '仇恨', '孤独', 'sad', 'angry', 'fear', 'pain'],
  tense: ['紧张', '危机', '危险', '悬疑', '对决', '冲突', '挣扎', '逃亡', '秘密', '揭露', 'tense', 'crisis', 'danger', 'conflict'],
};

function detectEmotion(text: string): string[] {
  const found: string[] = [];
  for (const [category, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        found.push(category);
        break;
      }
    }
  }
  return found;
}

function validateOutlineInternal(outline: OutlineData): OutlineValidationReport {
  const errors: CheckItem[] = [];
  const warnings: CheckItem[] = [];
  const passes: CheckItem[] = [];

  // Check 1: Character location contradiction
  // For each episode, if a character appears in >1 location, verify key_events
  // justify the movement
  for (const episode of outline.episodes) {
    for (const charName of episode.featured_characters) {
      const charLocations = episode.featured_locations.filter(() =>
        episode.featured_characters.includes(charName)
      );
      if (episode.featured_locations.length > 1) {
        // Multiple locations in one episode — check if key_events explain transitions
        const hasSceneTransition = episode.key_events.some(
          (e) =>
            e.includes('前往') ||
            e.includes('离开') ||
            e.includes('来到') ||
            e.includes('转移') ||
            e.includes('赶到') ||
            e.includes('出发') ||
            e.includes('移动') ||
            e.includes('离开') ||
            e.includes('回到')
        );
        if (!hasSceneTransition && episode.featured_locations.length >= 3) {
          errors.push({
            severity: 'error',
            type: '角色位置矛盾',
            message: `第${episode.episode_number}集「${episode.title}」：多处场景切换但关键事件中未说明角色移动`,
            details: `角色：${episode.featured_characters.join('、')}；场景：${episode.featured_locations.join('、')}`,
          });
        }
      }
    }
  }

  // Check 2: Prop state tracking
  // Scan key_events for status-changing keywords
  const propStateMap = new Map<string, { episode: number; status: string }>();
  const damageKeywords = ['损坏', '破碎', '毁坏', '消失了', '丢失', '断裂', '熄灭', 'broken', 'destroyed', 'lost'];
  const repairKeywords = ['修复', '修好', '找回', '重铸', '复原', 'fixed', 'repaired', 'found', 'restored'];

  for (const episode of outline.episodes) {
    for (const event of episode.key_events) {
      for (const kw of damageKeywords) {
        if (event.includes(kw)) {
          // Extract potential prop name from event
          const propName = event.replace(kw, '').trim().slice(0, 20) || '道具';
          propStateMap.set(propName, { episode: episode.episode_number, status: 'damaged' });
        }
      }
      for (const kw of repairKeywords) {
        if (event.includes(kw)) {
          const propName = event.replace(kw, '').trim().slice(0, 20) || '道具';
          const prev = propStateMap.get(propName);
          if (prev && prev.status === 'damaged') {
            propStateMap.set(propName, { episode: episode.episode_number, status: 'repaired' });
          }
        }
      }
    }
  }

  // Check for damaged props that appear intact later without repair
  for (const [propName, state] of propStateMap) {
    if (state.status === 'damaged') {
      // Check if later episodes reference this prop in normal state
      for (const episode of outline.episodes) {
        if (episode.episode_number > state.episode) {
          const refsNormal = episode.key_events.some(
            (e) => e.includes(propName) && !damageKeywords.some((kw) => e.includes(kw))
          );
          if (refsNormal) {
            warnings.push({
              severity: 'warning',
              type: '道具状态追踪',
              message: `「${propName}」在第${state.episode}集损坏，但在第${episode.episode_number}集中似乎正常出现，未提及修复过程`,
            });
            break;
          }
        }
      }
    }
  }

  // Check 3: Emotion curve — no ≥5 consecutive episodes without emotional variety
  const emotionMap = outline.episodes.map((ep) => {
    const allText = [ep.summary, ...ep.key_events].join(' ');
    return detectEmotion(allText);
  });

  let flatStreak = 0;
  let flatStart = 0;
  for (let i = 0; i < emotionMap.length; i++) {
    if (emotionMap[i].length === 0) {
      if (flatStreak === 0) flatStart = i + 1;
      flatStreak++;
      if (flatStreak >= 5) {
        warnings.push({
          severity: 'warning',
          type: '情绪曲线合理性',
          message: `第${flatStart}集到第${i + 1}集（连续${flatStreak}集）未检测到明显的情绪起伏标记`,
          details: '建议在关键事件中加入情绪变化，如冲突、转折、情感高潮等',
        });
      }
    } else {
      flatStreak = 0;
    }
  }

  // Check 4: Costume continuity — pass (outline data doesn't track costumes per scene)
  passes.push({
    severity: 'pass',
    type: '服装连续性',
    message: '大纲数据层面未发现服装连续性矛盾（详细检查需在脚本/分镜阶段进行）',
  });

  // If no errors or warnings, add general pass
  if (errors.length === 0 && warnings.length === 0) {
    passes.unshift({
      severity: 'pass',
      type: '整体一致性',
      message: '大纲自洽性检查通过，未发现明显逻辑矛盾',
    });
  }

  return {
    errors,
    warnings,
    passes,
    passed: errors.length === 0,
  };
}

// ── Service Factory ─────────────────────────────────────────────────

export function createOutlineService(options: OutlineServiceOptions = {}): OutlineService {
  const db = options.prisma ?? prisma;
  const snapshotService = options.snapshotService;
  const adapterPool = options.adapterPool;
  const maxRetries = options.maxRetries ?? 3;

  async function ensureProject(projectId: string) {
    const project = await db.projects.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');
    return project;
  }

  function getOutline(project: { outline: unknown }): OutlineData | null {
    if (!project.outline) return null;
    const parsed = outlineDataSchema.safeParse(project.outline);
    return parsed.success ? parsed.data : null;
  }

  async function snapshotOutline(
    projectId: string,
    outline: OutlineData,
    source: 'ai_generated' | 'user_edited' | 'ai_regenerated' | 'locked',
    extras?: {
      editedBy?: string;
      aiModel?: AIModelInfo;
      promptOverride?: string;
    }
  ): Promise<void> {
    if (!snapshotService) return;
    await snapshotService.createSnapshot({
      entity: { projectId, entityType: 'outline', entityId: projectId },
      source,
      content: outline as unknown as Record<string, unknown>,
      editedBy: extras?.editedBy,
      aiModel: extras?.aiModel,
      promptOverride: extras?.promptOverride,
    });
  }

  async function generateWithRetry(
    meta: Record<string, unknown>
  ): Promise<{ outline: OutlineData; modelInfo: AIModelInfo }> {
    if (!adapterPool) {
      return {
        outline: createFallbackOutline(meta),
        modelInfo: { provider: 'fallback', model: 'template' },
      };
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(meta);
    const adapter = adapterPool.getText('mock-text');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const prompt =
          attempt === 0
            ? userPrompt
            : `${userPrompt}\n\n[SYSTEM REMINDER] Your previous response was not valid JSON matching the required schema. You MUST output ONLY valid JSON — no markdown, no explanations, no extra text. Return pure JSON only.`;

        const result = await adapter.generateText(prompt, systemPrompt, undefined, {
          provider: 'mock-text',
          model: 'mock-model',
        });

        const outline = parseAIResponse(result.data.content);
        if (outline) {
          return {
            outline,
            modelInfo: { provider: result.provider, model: result.model },
          };
        }
      } catch {
        // Adapter call failed — retry if attempts remain
      }
    }

    // All retries exhausted — use fallback
    return {
      outline: createFallbackOutline(meta),
      modelInfo: { provider: 'fallback', model: 'template' },
    };
  }

  async function generateEpisodeWithAI(
    meta: Record<string, unknown>,
    episodeNumber: number,
    existingOutline: OutlineData
  ): Promise<OutlineEpisode> {
    if (!adapterPool) {
      return createFallbackEpisode(episodeNumber, meta);
    }

    const systemPrompt = `You are a professional screenwriter. Generate ONE episode of a short drama series as JSON.

Respond with ONLY valid JSON matching this structure:
{
  "episode_number": ${episodeNumber},
  "title": "Episode title",
  "summary": "What happens in this episode (2-4 sentences)",
  "key_events": ["Event 1", "Event 2", "Event 3"],
  "featured_characters": ["Character name"],
  "featured_locations": ["Location name"]
}

Context: The episode must fit into the existing story world. Use existing characters and locations where possible.`;

    const userPrompt = [
      `Story: ${meta.title || 'Untitled'}`,
      `World: ${existingOutline.world_setting.slice(0, 200)}`,
      `Characters: ${existingOutline.characters.map((c) => c.name).join(', ')}`,
      `Locations: ${existingOutline.locations.map((l) => l.name).join(', ')}`,
      `\nGenerate episode ${episodeNumber}.`,
    ].join('\n');

    const adapter = adapterPool.getText('mock-text');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await adapter.generateText(userPrompt, systemPrompt, undefined, {
          provider: 'mock-text',
          model: 'mock-model',
        });

        try {
          const parsed = JSON.parse(result.data.content);
          if (
            typeof parsed.episode_number === 'number' &&
            typeof parsed.title === 'string' &&
            Array.isArray(parsed.key_events)
          ) {
            return parsed as OutlineEpisode;
          }
        } catch {
          // Parse failed — retry
        }
      } catch {
        // Adapter call failed — retry
      }
    }

    return createFallbackEpisode(episodeNumber, meta);
  }

  function createFallbackEpisode(episodeNumber: number, meta: Record<string, unknown>): OutlineEpisode {
    const title = String(meta.title || 'Untitled');
    return {
      episode_number: episodeNumber,
      title: `第${episodeNumber}集`,
      summary: `《${title}》第${episodeNumber}集。剧情持续发展，角色面临新的挑战。`,
      key_events: ['开场事件', '冲突升级', '悬念铺垫'],
      featured_characters: ['主角'],
      featured_locations: ['主要场景'],
    };
  }

  // ── Public API ───────────────────────────────────────────────────

  return {
    async generateOutline(projectId: string): Promise<OutlineData> {
      const project = await ensureProject(projectId);
      const meta = project.meta as Record<string, unknown>;

      const { outline, modelInfo } = await generateWithRetry(meta);

      await db.projects.update({
        where: { id: projectId },
        data: {
          outline: outline as unknown as Prisma.InputJsonValue,
          status: 'outlining',
          updated_at: new Date(),
        },
      });

      await snapshotOutline(projectId, outline, 'ai_generated', { aiModel: modelInfo });

      return outline;
    },

    async getOutline(projectId: string): Promise<OutlineData | null> {
      const project = await ensureProject(projectId);
      return getOutline(project);
    },

    async updateOutline(projectId: string, data: UpdateOutlineInput): Promise<OutlineData> {
      const project = await ensureProject(projectId);
      const existing = getOutline(project);

      if (!existing) {
        throw new Error('No existing outline to update. Generate one first.');
      }

      const merged: OutlineData = {
        world_setting: data.world_setting ?? existing.world_setting,
        main_conflict: data.main_conflict ?? existing.main_conflict,
        characters: data.characters ?? existing.characters,
        locations: data.locations ?? existing.locations,
        episode_count: data.episode_count ?? existing.episode_count,
        episodes: data.episodes ?? existing.episodes,
      };

      // Validate merged data
      const parsed = outlineDataSchema.safeParse(merged);
      if (!parsed.success) {
        throw new Error(`Invalid outline data: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
      }

      await db.projects.update({
        where: { id: projectId },
        data: {
          outline: parsed.data as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });

      await snapshotOutline(projectId, parsed.data, 'user_edited');

      return parsed.data;
    },

    async regenerateEpisode(projectId: string, episodeNumber: number): Promise<OutlineData> {
      const project = await ensureProject(projectId);
      const existing = getOutline(project);

      if (!existing) {
        throw new Error('No existing outline. Generate one first.');
      }

      const idx = existing.episodes.findIndex((e) => e.episode_number === episodeNumber);
      if (idx === -1) {
        throw new Error(`Episode ${episodeNumber} not found in outline`);
      }

      const meta = project.meta as Record<string, unknown>;
      const newEpisode = await generateEpisodeWithAI(meta, episodeNumber, existing);

      const updatedEpisodes = [...existing.episodes];
      updatedEpisodes[idx] = newEpisode;

      const updated: OutlineData = {
        ...existing,
        episodes: updatedEpisodes,
      };

      await db.projects.update({
        where: { id: projectId },
        data: {
          outline: updated as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });

      await snapshotOutline(projectId, updated, 'ai_regenerated', {
        aiModel: { provider: 'mock-text', model: 'mock-model' },
      });

      return updated;
    },

    async validateOutline(projectId: string): Promise<OutlineValidationReport> {
      const project = await ensureProject(projectId);
      const outline = getOutline(project);

      if (!outline) {
        throw new Error('No outline to validate');
      }

      return validateOutlineInternal(outline);
    },

    async confirmOutline(projectId: string): Promise<OutlineData> {
      const project = await ensureProject(projectId);
      const outline = getOutline(project);

      if (!outline) {
        throw new Error('No outline to confirm');
      }

      // Run validation first
      const report = validateOutlineInternal(outline);
      if (!report.passed) {
        const errorMessages = report.errors.map((e) => e.message).join('; ');
        throw new Error(`Cannot confirm outline with unresolved errors: ${errorMessages}`);
      }

      await db.projects.update({
        where: { id: projectId },
        data: {
          outline_locked: true,
          status: 'asset_prep',
          updated_at: new Date(),
        },
      });

      await snapshotOutline(projectId, outline, 'locked');

      return outline;
    },
  };
}
