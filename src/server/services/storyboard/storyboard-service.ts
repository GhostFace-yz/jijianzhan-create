import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import type { AIModelInfo, SnapshotService } from '../snapshot/types.js';
import type {
  StoryboardService,
  StoryboardServiceOptions,
  StoryboardNode,
  StoryboardDialogue,
  StoryboardCharacter,
  EpisodesStoryboard,
  SplitResult,
  NodeSplitResult,
  UpdateNodesInput,
  ImpactHint,
  VersionHistoryEntry,
} from './types.js';

// ── Zod Schemas ─────────────────────────────────────────────────────

import { z } from 'zod';

const nodeCharacterSchema = z.object({
  char_id: z.string().min(1),
  costume_variant: z.string().min(1),
});

const nodeDialogueSchema = z.object({
  char_id: z.string().min(1),
  text: z.string().min(1),
  emotion: z.string().min(1),
});

const versionHistoryEntrySchema = z.object({
  version_id: z.string(),
  version_number: z.number(),
  created_at: z.string(),
  source: z.enum(['ai_generated', 'user_edited', 'ai_regenerated']),
});

const qualityReportSchema = z.object({
  actual_duration: z.number().min(0),
  target_duration: z.number().min(0),
  duration_ok: z.boolean(),
  face_corruption_detected: z.boolean(),
  motion_jump_detected: z.boolean(),
  passed: z.boolean(),
  details: z.array(z.string()),
});

const videoClipSchema = z.object({
  url: z.string().min(1),
  duration: z.number().min(0),
  camera_move: z.string().min(1),
  motion_description: z.string().min(1),
  generated_at: z.string().min(1),
  status: z.enum(['pending', 'generated', 'reviewed']),
  reviewed_at: z.string().optional(),
  review_comment: z.string().optional(),
  reviewed: z.boolean().optional(),
  quality_report: qualityReportSchema,
  provider: z.string().min(1),
  model: z.string().min(1),
  fallback_used: z.boolean(),
});

const audioClipSchema = z.object({
  url: z.string().min(1),
  duration: z.number().min(0),
  voice_id: z.string().min(1),
  emotion: z.string().min(1),
  speed: z.number().min(0.5).max(2.0),
  generated_at: z.string().min(1),
  status: z.enum(['pending', 'generated', 'reviewed']),
  reviewed_at: z.string().optional(),
  review_comment: z.string().optional(),
  reviewed: z.boolean().optional(),
});

const storyboardNodeSchema = z.object({
  node_id: z.string().regex(/^ep\d+-n\d+$/),
  scene_id: z.string().min(1),
  scene_variant: z.string().min(1),
  characters: z.array(nodeCharacterSchema).min(1),
  shot_type: z.enum(['close-up', 'medium-shot', 'wide-shot', 'over-shoulder', 'pov', 'aerial']),
  camera_move: z.enum([
    'static', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down',
    'zoom-in', 'zoom-out', 'dolly', 'tracking', 'handheld',
  ]),
  visual_desc: z.string().min(1),
  dialogue: nodeDialogueSchema.nullable(),
  emotion_tag: z.string().min(1),
  music_mood: z.string().min(1),
  duration_target: z.number().min(3).max(15),
  transition_in: z.enum(['cut', 'fade', 'dissolve', 'wipe']),
  transition_out: z.enum(['cut', 'fade', 'dissolve', 'wipe']),
  status: z.enum(['pending', 'generating', 'completed', 'needs_redo']).default('pending'),
  version_history: z.array(versionHistoryEntrySchema).default([]),
  audio_clip: audioClipSchema.nullable().optional(),
  video_clip: videoClipSchema.nullable().optional(),
});

const storyboardNodesSchema = z.array(storyboardNodeSchema);

// ── Script extract types ────────────────────────────────────────────

interface ScriptScene {
  scene_id: string;
  location_id: string;
  time_of_day: string;
  weather: string;
  characters_present: string[];
  scene_summary: string;
  beats: string[];
  dialogues: Array<{ char_id: string; text: string; emotion: string }>;
}

interface EpisodeScriptData {
  episode_title: string;
  scenes: ScriptScene[];
  end_state: unknown;
}

// ── Shot Type Options ───────────────────────────────────────────────

const SHOT_TYPES = ['close-up', 'medium-shot', 'wide-shot', 'over-shoulder', 'pov', 'aerial'] as const;
const CAMERA_MOVES = ['static', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'zoom-in', 'zoom-out', 'dolly', 'tracking', 'handheld'] as const;
const TRANSITIONS = ['cut', 'fade', 'dissolve', 'wipe'] as const;
const EMOTION_TAGS = ['平静的', '开心的', '悲伤的', '紧张的', '愤怒的', '浪漫的', '悬疑的', '激动的', '沉思的', '恐惧的', '温柔的', '冷漠的'] as const;
const MUSIC_MOODS = ['舒缓', '激昂', '悲伤', '紧张', '浪漫', '悬疑', '轻快', '沉重', '温馨', '空灵'] as const;

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Duration Estimation ─────────────────────────────────────────────

function estimateDuration(dialogue: StoryboardDialogue | null, visualDesc: string): number {
  let duration = 2; // base minimum for any shot

  // Dialogue-based estimation (~3 chars/sec for Chinese)
  if (dialogue) {
    const charCount = dialogue.text.length;
    duration += Math.ceil(charCount / 3);
  }

  // Visual description adds time
  if (visualDesc.length > 50) {
    duration += 2;
  } else if (visualDesc.length > 20) {
    duration += 1;
  }

  // Clamp to 3-15s range
  return Math.max(3, Math.min(15, duration));
}

// ── AI Prompt Templates ─────────────────────────────────────────────

function buildSplitSystemPrompt(): string {
  return `You are a professional cinematographer and video editor specializing in short drama series.

Your task is to break down a script scene into storyboard nodes (shots), each 5-8 seconds long.

You MUST respond with ONLY valid JSON — no markdown formatting, no code fences, no explanations.

The JSON must be an array of storyboard nodes with this exact structure:
[
  {
    "node_id": "ep01-n001",
    "scene_id": "s1",
    "scene_variant": "下午-晴天",
    "characters": [{ "char_id": "角色名", "costume_variant": "服装描述" }],
    "shot_type": "close-up | medium-shot | wide-shot | over-shoulder | pov | aerial",
    "camera_move": "static | pan-left | pan-right | tilt-up | tilt-down | zoom-in | zoom-out | dolly | tracking | handheld",
    "visual_desc": "Detailed visual description of this shot in Chinese",
    "dialogue": { "char_id": "角色名", "text": "台词", "emotion": "情绪" } or null,
    "emotion_tag": "平静的 | 开心的 | 悲伤的 | 紧张的 | 愤怒的 | 浪漫的 | 悬疑的 | 激动的 | 沉思的 | 恐惧的 | 温柔的 | 冷漠的",
    "music_mood": "舒缓 | 激昂 | 悲伤 | 紧张 | 浪漫 | 悬疑 | 轻快 | 沉重 | 温馨 | 空灵",
    "duration_target": 6,
    "transition_in": "cut | fade | dissolve | wipe",
    "transition_out": "cut | fade | dissolve | wipe",
    "status": "pending"
  }
]

CRITICAL RULES:
- Each node_id must follow format ep{NUMBER}-n{NUMBER} (e.g., ep01-n001, ep01-n002)
- Each node duration_target must be between 5 and 8 seconds
- The total duration of all nodes should be approximately 60-90 seconds for a typical episode
- Every dialogue line should be captured in a node
- Vary shot_types and camera_moves for visual interest
- Assign appropriate emotion_tag and music_mood based on the scene content
- scene_variant should combine time_of_day and weather from the scene (e.g., "夜晚-雨")
- characters array should reference characters present in the scene
- Write all descriptions in Chinese`;
}

function buildSplitUserPrompt(script: EpisodeScriptData, episodeId: string): string {
  const parts: string[] = [];
  parts.push(`Break down the following episode script into storyboard nodes:\n`);
  parts.push(`**Episode**: ${script.episode_title}`);
  parts.push(`**Episode ID**: ${episodeId}\n`);

  for (const scene of script.scenes) {
    parts.push(`--- Scene: ${scene.scene_id} ---`);
    parts.push(`Location: ${scene.location_id}`);
    parts.push(`Time/Weather: ${scene.time_of_day} / ${scene.weather}`);
    parts.push(`Characters present: ${scene.characters_present.join(', ')}`);
    parts.push(`Summary: ${scene.scene_summary}`);
    parts.push(`Beats: ${scene.beats.join(' → ')}`);

    if (scene.dialogues.length > 0) {
      parts.push('Dialogues:');
      for (const d of scene.dialogues) {
        parts.push(`  [${d.char_id}] (${d.emotion}): ${d.text}`);
      }
    }
  }

  parts.push('\nGenerate storyboard nodes that cover all dialogue and key beats from every scene.');
  parts.push('Make each node 5-8 seconds. Use varied shot types and camera movements.');
  return parts.join('\n');
}

function buildSplitNodePrompt(node: StoryboardNode, splitPoint?: number): string {
  const parts: string[] = [];
  parts.push(`Split the following storyboard node into two nodes:\n`);
  parts.push(`Current node: ${node.node_id}`);
  parts.push(`Scene: ${node.scene_id}, Variant: ${node.scene_variant}`);
  parts.push(`Shot type: ${node.shot_type}, Camera: ${node.camera_move}`);
  parts.push(`Visual: ${node.visual_desc}`);
  parts.push(`Emotion: ${node.emotion_tag}, Music: ${node.music_mood}`);
  parts.push(`Duration: ${node.duration_target}s`);
  if (node.dialogue) {
    parts.push(`Dialogue: [${node.dialogue.char_id}] (${node.dialogue.emotion}): ${node.dialogue.text}`);
  }
  parts.push(`Characters: ${node.characters.map((c) => `${c.char_id}(${c.costume_variant})`).join(', ')}`);

  if (splitPoint) {
    parts.push(`\nSplit at approximately ${splitPoint} seconds.`);
  } else {
    parts.push(`\nSplit at a natural breaking point (e.g., mid-dialogue pause, action beat change).`);
  }

  parts.push('\nRespond with ONLY a JSON array of exactly 2 nodes following the same structure.');
  parts.push('The sum of the two node durations should equal the original duration.');
  parts.push('Assign new sequential node_ids.');
  return parts.join('\n');
}

// ── Response Parsing ───────────────────────────────────────────────

function parseAISplitResponse(content: string): StoryboardNode[] | null {
  // Try direct parse
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      const result = storyboardNodesSchema.safeParse(parsed);
      if (result.success) return result.data;
    }
  } catch { /* continue */ }

  // Try to extract JSON from markdown code fences
  const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (Array.isArray(parsed)) {
        const result = storyboardNodesSchema.safeParse(parsed);
        if (result.success) return result.data;
      }
    } catch { /* continue */ }
  }

  // Try to find outermost [ ] block
  const bracketMatch = content.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    try {
      const parsed = JSON.parse(bracketMatch[0]);
      if (Array.isArray(parsed)) {
        const result = storyboardNodesSchema.safeParse(parsed);
        if (result.success) return result.data;
      }
    } catch { /* continue */ }
  }

  return null;
}

function parseAINodeSplitResponse(content: string): StoryboardNode[] | null {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length === 2) {
      const result = storyboardNodesSchema.safeParse(parsed);
      if (result.success) return result.data;
    }
  } catch { /* continue */ }

  const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (Array.isArray(parsed) && parsed.length === 2) {
        const result = storyboardNodesSchema.safeParse(parsed);
        if (result.success) return result.data;
      }
    } catch { /* continue */ }
  }

  const bracketMatch = content.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    try {
      const parsed = JSON.parse(bracketMatch[0]);
      if (Array.isArray(parsed) && parsed.length === 2) {
        const result = storyboardNodesSchema.safeParse(parsed);
        if (result.success) return result.data;
      }
    } catch { /* continue */ }
  }

  return null;
}

// ── Fallback Node Generation ────────────────────────────────────────

function createFallbackNodes(script: EpisodeScriptData, episodeId: string): StoryboardNode[] {
  const nodes: StoryboardNode[] = [];
  let nodeCounter = 0;
  const episodeNum = episodeId.replace('ep-', '');

  for (const scene of script.scenes) {
    // One node per dialogue + one for visual-only beats
    let dialogueNodes = 0;

    for (const dialogue of scene.dialogues) {
      nodeCounter++;
      const nodeId = `ep${episodeNum.padStart(2, '0')}-n${String(nodeCounter).padStart(3, '0')}`;
      const duration = Math.min(8, Math.max(5, Math.ceil(dialogue.text.length / 3) + 2));

      nodes.push({
        node_id: nodeId,
        scene_id: scene.scene_id,
        scene_variant: `${scene.time_of_day}-${scene.weather}`,
        characters: scene.characters_present.map((name) => ({
          char_id: name,
          costume_variant: '默认服装',
        })),
        shot_type: dialogueNodes % 2 === 0 ? 'medium-shot' : 'close-up',
        camera_move: dialogueNodes === 0 ? 'static' : pickRandom(['pan-left', 'pan-right'] as const),
        visual_desc: `${scene.scene_summary.slice(0, 80)} — ${dialogue.char_id}的镜头`,
        dialogue: {
          char_id: dialogue.char_id,
          text: dialogue.text,
          emotion: dialogue.emotion,
        },
        emotion_tag: dialogue.emotion || '平静的',
        music_mood: scene.time_of_day === '夜晚' ? '舒缓' : '轻快',
        duration_target: duration,
        transition_in: dialogueNodes === 0 ? 'fade' : 'cut',
        transition_out: 'cut',
        status: 'pending',
        version_history: [],
      });
      dialogueNodes++;
    }

    // Add a visual-only node if scene has beats without dialogue
    const visualBeats = scene.beats.filter((b) => !scene.dialogues.some((d) => b.includes(d.text.slice(0, 5))));
    if (visualBeats.length > 0 || dialogueNodes === 0) {
      nodeCounter++;
      const nodeId = `ep${episodeNum.padStart(2, '0')}-n${String(nodeCounter).padStart(3, '0')}`;

      nodes.push({
        node_id: nodeId,
        scene_id: scene.scene_id,
        scene_variant: `${scene.time_of_day}-${scene.weather}`,
        characters: scene.characters_present.map((name) => ({
          char_id: name,
          costume_variant: '默认服装',
        })),
        shot_type: 'wide-shot',
        camera_move: pickRandom(['static', 'pan-right'] as const),
        visual_desc: scene.scene_summary,
        dialogue: null,
        emotion_tag: pickRandom(EMOTION_TAGS),
        music_mood: pickRandom(MUSIC_MOODS),
        duration_target: 6,
        transition_in: dialogueNodes > 0 ? 'cut' : 'fade',
        transition_out: 'cut',
        status: 'pending',
        version_history: [],
      });
    }
  }

  return nodes;
}

// ── Script Retrieval ────────────────────────────────────────────────

function getScriptFromProject(project: { meta: unknown }, episodeId: string): EpisodeScriptData | null {
  const meta = project.meta as Record<string, unknown> | null;
  if (!meta) return null;
  const scriptKey = `script_${episodeId}`;
  const scriptData = meta[scriptKey];
  if (!scriptData || typeof scriptData !== 'object') return null;
  return scriptData as EpisodeScriptData;
}

// ── Impact Analysis ─────────────────────────────────────────────────

const IMPACT_LEVELS: Record<string, 'light' | 'medium' | 'deep'> = {
  dialogue: 'light',
  emotion_tag: 'light',
  music_mood: 'light',
  duration_target: 'light',
  transition_in: 'light',
  transition_out: 'light',
  shot_type: 'medium',
  camera_move: 'medium',
  scene_variant: 'medium',
  characters: 'deep',
  visual_desc: 'deep',
  scene_id: 'deep',
};

const IMPACT_AFFECTED_ASSETS: Record<string, string[]> = {
  light: ['配音', '配乐'],
  medium: ['分镜图', '视频片段'],
  deep: ['分镜图', '视频片段', '配音', '配乐', '角色参考图'],
};

function computeChangedFields(oldNode: StoryboardNode, newNode: StoryboardNode): string[] {
  const changed: string[] = [];
  const keys: (keyof StoryboardNode)[] = [
    'node_id', 'scene_id', 'scene_variant', 'shot_type', 'camera_move',
    'visual_desc', 'emotion_tag', 'music_mood', 'duration_target',
    'transition_in', 'transition_out', 'status',
  ];

  for (const key of keys) {
    if (JSON.stringify(oldNode[key]) !== JSON.stringify(newNode[key])) {
      changed.push(key);
    }
  }

  // Deep compare dialogue
  if (JSON.stringify(oldNode.dialogue) !== JSON.stringify(newNode.dialogue)) {
    changed.push('dialogue');
  }

  // Deep compare characters
  if (JSON.stringify(oldNode.characters) !== JSON.stringify(newNode.characters)) {
    changed.push('characters');
  }

  return changed;
}

// ── Service Factory ─────────────────────────────────────────────────

export function createStoryboardService(options: StoryboardServiceOptions = {}): StoryboardService {
  const db = options.prisma ?? prisma;
  const snapshotService = options.snapshotService;
  const adapterPool = options.adapterPool;
  const maxRetries = options.maxRetries ?? 2;

  async function ensureProject(projectId: string) {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');
    return project;
  }

  function getStoryboardData(project: { storyboard_nodes: unknown }): EpisodesStoryboard | null {
    if (!project.storyboard_nodes) return null;
    const parsed = project.storyboard_nodes as EpisodesStoryboard;
    return parsed;
  }

  async function snapshotNode(
    projectId: string,
    nodeId: string,
    node: StoryboardNode,
    source: 'ai_generated' | 'user_edited' | 'ai_regenerated',
    extras?: { editedBy?: string; aiModel?: AIModelInfo },
  ): Promise<void> {
    if (!snapshotService) return;
    await snapshotService.createSnapshot({
      entity: { projectId, entityType: 'node', entityId: nodeId },
      source,
      content: node as unknown as Record<string, unknown>,
      editedBy: extras?.editedBy,
      aiModel: extras?.aiModel,
    });
  }

  function validateEpisodeId(episodeId: string): void {
    if (!/^ep-\d+$/.test(episodeId)) {
      throw new Error('Invalid episode ID format. Expected: ep-{number}');
    }
  }

  async function saveStoryboardNodes(
    projectId: string,
    episodeId: string,
    nodes: StoryboardNode[],
  ): Promise<void> {
    const project = await ensureProject(projectId);
    const current = getStoryboardData(project) ?? {};

    const updated: EpisodesStoryboard = {
      ...current,
      [episodeId]: nodes,
    };

    await db.project.update({
      where: { id: projectId },
      data: {
        storyboard_nodes: updated as unknown as Prisma.InputJsonValue,
        updated_at: new Date(),
      },
    });
  }

  // ── Public API ───────────────────────────────────────────────────

  return {
    async splitScript(projectId: string, episodeId: string): Promise<SplitResult> {
      validateEpisodeId(episodeId);
      const project = await ensureProject(projectId);

      const script = getScriptFromProject(project, episodeId);
      if (!script) {
        throw new Error(`No script found for episode ${episodeId}. Generate a script first.`);
      }

      let nodes: StoryboardNode[] | null = null;
      let modelInfo: AIModelInfo = { provider: 'fallback', model: 'template' };

      if (adapterPool) {
        const systemPrompt = buildSplitSystemPrompt();
        const userPrompt = buildSplitUserPrompt(script, episodeId);
        const adapter = adapterPool.getText('mock-text');

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const prompt = attempt === 0
              ? userPrompt
              : `${userPrompt}\n\n[SYSTEM REMINDER] Previous response was invalid. You MUST output ONLY a valid JSON array of storyboard nodes. No markdown, no explanations.`;

            const result = await adapter.generateText(prompt, systemPrompt, undefined, {
              provider: 'mock-text',
              model: 'mock-model',
            });

            const parsed = parseAISplitResponse(result.data.content);
            if (parsed && parsed.length > 0) {
              nodes = parsed;
              modelInfo = { provider: result.provider, model: result.model };
              break;
            }
          } catch {
            // Retry
          }
        }
      }

      // Fallback if AI failed
      if (!nodes || nodes.length === 0) {
        nodes = createFallbackNodes(script, episodeId);
      }

      // Ensure node IDs follow the correct format
      const episodeNum = episodeId.replace('ep-', '');
      nodes = nodes.map((n, i) => ({
        ...n,
        node_id: n.node_id.match(/^ep\d+-n\d+$/)
          ? n.node_id
          : `ep${episodeNum.padStart(2, '0')}-n${String(i + 1).padStart(3, '0')}`,
      }));

      // Save nodes
      await saveStoryboardNodes(projectId, episodeId, nodes);

      // Create version snapshots for each node
      for (const node of nodes) {
        await snapshotNode(projectId, node.node_id, node, 'ai_generated', { aiModel: modelInfo });
      }

      const totalDuration = nodes.reduce((sum, n) => sum + n.duration_target, 0);
      return {
        nodes,
        total_duration: totalDuration,
        node_count: nodes.length,
      };
    },

    async getNodes(projectId: string, episodeId: string): Promise<StoryboardNode[]> {
      validateEpisodeId(episodeId);
      const project = await ensureProject(projectId);
      const data = getStoryboardData(project);
      return data?.[episodeId] ?? [];
    },

    async updateNodes(
      projectId: string,
      episodeId: string,
      input: UpdateNodesInput,
    ): Promise<StoryboardNode[]> {
      validateEpisodeId(episodeId);
      const project = await ensureProject(projectId);
      const existing = await this.getNodes(projectId, episodeId);

      const nodes = input.nodes;

      // Validate all nodes
      for (const node of nodes) {
        const parsed = storyboardNodeSchema.safeParse(node);
        if (!parsed.success) {
          throw new Error(
            `Invalid node data: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          );
        }
      }

      // Detect changed nodes and create snapshots
      const existingMap = new Map(existing.map((n) => [n.node_id, n]));
      for (const node of nodes) {
        const prev = existingMap.get(node.node_id);
        if (prev) {
          const changedFields = computeChangedFields(prev, node);
          if (changedFields.length > 0) {
            await snapshotNode(projectId, node.node_id, node, 'user_edited');
          }
        } else {
          // New node
          await snapshotNode(projectId, node.node_id, node, 'ai_generated');
        }
      }

      await saveStoryboardNodes(projectId, episodeId, nodes);
      return nodes;
    },

    async splitNode(
      projectId: string,
      episodeId: string,
      nodeId: string,
      input?: { split_point_seconds?: number },
    ): Promise<NodeSplitResult> {
      validateEpisodeId(episodeId);
      const nodes = await this.getNodes(projectId, episodeId);
      const nodeIndex = nodes.findIndex((n) => n.node_id === nodeId);

      if (nodeIndex === -1) {
        throw new Error(`Node ${nodeId} not found`);
      }

      const original = nodes[nodeIndex];
      let newNodes: StoryboardNode[] | null = null;

      if (adapterPool) {
        const systemPrompt = `You are a cinematographer. Split a storyboard node into two. Respond with ONLY a JSON array of 2 nodes.`;
        const userPrompt = buildSplitNodePrompt(original, input?.split_point_seconds);
        const adapter = adapterPool.getText('mock-text');

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await adapter.generateText(userPrompt, systemPrompt, undefined, {
              provider: 'mock-text',
              model: 'mock-model',
            });
            const parsed = parseAINodeSplitResponse(result.data.content);
            if (parsed && parsed.length === 2) {
              newNodes = parsed;
              break;
            }
          } catch {
            // Retry
          }
        }
      }

      // Fallback: manual split
      if (!newNodes || newNodes.length !== 2) {
        const splitDuration = input?.split_point_seconds ?? Math.floor(original.duration_target / 2);
        const node1Duration = Math.max(3, splitDuration);
        const node2Duration = Math.max(3, original.duration_target - node1Duration);

        const episodeNum = episodeId.replace('ep-', '');
        const maxNodeNum = Math.max(
          ...nodes.map((n) => {
            const m = n.node_id.match(/n(\d+)$/);
            return m ? parseInt(m[1], 10) : 0;
          }),
          0,
        );

        const node1: StoryboardNode = {
          ...original,
          node_id: `ep${episodeNum.padStart(2, '0')}-n${String(maxNodeNum + 1).padStart(3, '0')}`,
          duration_target: node1Duration,
          visual_desc: `${original.visual_desc} (前半部分)`,
          transition_out: 'cut',
        };

        const node2: StoryboardNode = {
          ...original,
          node_id: `ep${episodeNum.padStart(2, '0')}-n${String(maxNodeNum + 2).padStart(3, '0')}`,
          duration_target: node2Duration,
          visual_desc: `${original.visual_desc} (后半部分)`,
          transition_in: 'cut',
        };

        newNodes = [node1, node2];
      }

      // Replace the original node with the two new nodes
      const updatedNodes = [
        ...nodes.slice(0, nodeIndex),
        ...newNodes,
        ...nodes.slice(nodeIndex + 1),
      ];

      await saveStoryboardNodes(projectId, episodeId, updatedNodes);

      // Create snapshots for new nodes
      for (const node of newNodes) {
        await snapshotNode(projectId, node.node_id, node, 'ai_regenerated');
      }

      return {
        original,
        new_nodes: newNodes as [StoryboardNode, StoryboardNode],
      };
    },

    analyzeEditImpact(node: StoryboardNode, changedFields: string[]): ImpactHint[] {
      return changedFields.map((field) => {
        const impact = IMPACT_LEVELS[field] || 'light';
        const affectedAssets = IMPACT_AFFECTED_ASSETS[impact] || [];
        return {
          field,
          impact,
          affected_assets: affectedAssets,
          message: impact === 'deep'
            ? `修改 ${field} 会影响全链路生成资产：${affectedAssets.join('、')}`
            : impact === 'medium'
              ? `修改 ${field} 会影响分镜图和视频生成：${affectedAssets.join('、')}`
              : `修改 ${field} 仅影响配音和配乐：${affectedAssets.join('、')}`,
        };
      });
    },
  };
}
