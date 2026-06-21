import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import type {
  MusicService,
  MusicServiceOptions,
  MusicGenerateOptions,
  MusicUploadInput,
  EpisodeMusicResult,
  EpisodeMusic,
  MusicSegment,
  EmotionTransitionWarning,
  ProjectMusic,
} from './types.js';
import type { StoryboardNode } from '../storyboard/types.js';

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_CROSSFADE_DURATION = 0.4;
const DUCK_DIALOGUE_VOLUME = 0.25;
const DUCK_NON_DIALOGUE_VOLUME = 0.9;
const DEFAULT_DURATION_PER_NODE = 6.5;

// ── Emotion Contrast Matrix ────────────────────────────────────────

/**
 * Pairs of music moods that represent large emotional contrasts.
 * When adjacent nodes have moods from a contrast pair, a warning is emitted.
 */
const EMOTION_CONTRAST_PAIRS: Array<[string, string]> = [
  ['激昂', '悲伤'],
  ['轻快', '沉重'],
  ['浪漫', '悬疑'],
  ['温馨', '空灵'],
  ['舒缓', '紧张'],
  ['激昂', '空灵'],
  ['轻快', '悲伤'],
];

function isContrast(mood1: string, mood2: string): boolean {
  return EMOTION_CONTRAST_PAIRS.some(
    ([a, b]) =>
      (mood1 === a && mood2 === b) || (mood1 === b && mood2 === a),
  );
}

// ── Helper: Convert File URL to Mock URL ───────────────────────────

/**
 * For mock adapters, the returned URL is relative to the mock CDN.
 * This converts it to a consistent format for storage.
 */
function normalizeUrl(url: string): string {
  return url;
}

// ── Service Factory ────────────────────────────────────────────────

export function createMusicService(options: MusicServiceOptions): MusicService {
  const db = options.prisma ?? prisma;
  const storyboardService = options.storyboardService;
  const adapterPool = options.adapterPool;
  const maxRetries = options.maxRetries ?? 2;

  async function ensureProject(projectId: string) {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');
    return project;
  }

  function validateEpisodeId(episodeId: string): void {
    if (!/^ep-\d+$/.test(episodeId)) {
      throw new Error('Invalid episode ID format. Expected: ep-{number}');
    }
  }

  function getMusicData(project: { music: unknown }): ProjectMusic | null {
    if (!project.music) return null;
    const parsed = project.music as ProjectMusic;
    return parsed;
  }

  /**
   * Check if a node has dialogue text.
   */
  function nodeHasDialogue(node: StoryboardNode): boolean {
    return !!(node.dialogue && node.dialogue.text && node.dialogue.text.trim().length > 0);
  }

  /**
   * Extract emotion sequence from nodes' music_mood fields.
   * Empty/invalid moods default to "舒缓".
   */
  function extractEmotionSequence(nodes: StoryboardNode[]): string[] {
    const VALID_MOODS = ['舒缓', '激昂', '悲伤', '紧张', '浪漫', '悬疑', '轻快', '沉重', '温馨', '空灵'];
    return nodes.map((n) => {
      const mood = (n.music_mood || '').trim();
      return VALID_MOODS.includes(mood) ? mood : '舒缓';
    });
  }

  /**
   * Calculate total BGM duration from nodes.
   * Uses sum of duration_target as primary, falls back to node_count * 6.5s.
   */
  function calculateTotalDuration(nodes: StoryboardNode[]): number {
    if (nodes.length === 0) return 0;
    const sum = nodes.reduce((acc, n) => acc + (n.duration_target || DEFAULT_DURATION_PER_NODE), 0);
    return sum > 0 ? sum : nodes.length * DEFAULT_DURATION_PER_NODE;
  }

  /**
   * Cut full BGM into per-node segments with crossfade.
   */
  function cutSegments(
    nodes: StoryboardNode[],
    totalDuration: number,
    originalUrl: string,
    crossfadeDuration: number,
  ): MusicSegment[] {
    const segments: MusicSegment[] = [];
    let currentTime = 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const nodeDuration = node.duration_target || DEFAULT_DURATION_PER_NODE;
      const hasDialogue = nodeHasDialogue(node);

      // Crossfade: overlap previous segment by crossfadeDuration
      const crossfadeIn = i > 0 ? crossfadeDuration : 0;
      const crossfadeOut = i < nodes.length - 1 ? crossfadeDuration : 0;

      // Start time adjusted for crossfade overlap
      const startTime = i === 0 ? 0 : currentTime - crossfadeDuration;
      const segmentDuration = nodeDuration + crossfadeIn + crossfadeOut;

      segments.push({
        node_id: node.node_id,
        start_time: Math.round(startTime * 100) / 100,
        duration: Math.round(segmentDuration * 100) / 100,
        url: originalUrl,
        volume: hasDialogue ? DUCK_DIALOGUE_VOLUME : DUCK_NON_DIALOGUE_VOLUME,
        ducked: hasDialogue,
        crossfade_in: crossfadeIn,
        crossfade_out: crossfadeOut,
      });

      currentTime = startTime + segmentDuration - crossfadeOut;
    }

    return segments;
  }

  /**
   * Detect emotion contrast warnings between adjacent nodes.
   */
  function detectEmotionTransitions(nodes: StoryboardNode[]): EmotionTransitionWarning[] {
    const warnings: EmotionTransitionWarning[] = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      const current = nodes[i];
      const next = nodes[i + 1];
      const currentMood = (current.music_mood || '舒缓').trim();
      const nextMood = (next.music_mood || '舒缓').trim();

      if (isContrast(currentMood, nextMood)) {
        warnings.push({
          type: 'emotion_transition',
          from_node: current.node_id,
          to_node: next.node_id,
          from_mood: currentMood,
          to_mood: nextMood,
          message: `节点 ${current.node_id} (${currentMood}) 到 ${next.node_id} (${nextMood})：情绪差异较大，建议插入过渡节点`,
        });
      }
    }

    return warnings;
  }

  // ── Public API ───────────────────────────────────────────────────

  return {
    async generateMusic(
      projectId: string,
      episodeId: string,
      options?: MusicGenerateOptions,
    ): Promise<EpisodeMusicResult> {
      validateEpisodeId(episodeId);
      await ensureProject(projectId);

      // 1. Get nodes from storyboard
      const nodes = await storyboardService.getNodes(projectId, episodeId);

      if (nodes.length === 0) {
        throw new Error(
          `No storyboard nodes found for episode ${episodeId}. Split the script into storyboard nodes first.`,
        );
      }

      // 2. Extract emotion sequence and style tags
      const emotionSequence = extractEmotionSequence(nodes);
      const project = await ensureProject(projectId);
      const meta = project.meta as Record<string, unknown> | null;
      const styleTags: string[] = options?.style_tags ??
        (Array.isArray(meta?.style_tags) ? meta.style_tags as string[] : []) ??
        [];
      const crossfadeDuration = options?.crossfade_duration ?? DEFAULT_CROSSFADE_DURATION;
      const totalDuration = calculateTotalDuration(nodes);

      // 3. Generate BGM via adapter
      let generatedUrl: string;
      let provider = 'mock-music';
      let model = 'mock-model';

      if (adapterPool) {
        const musicAdapter = adapterPool.getMusic(options?.provider ?? 'mock-music');
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await musicAdapter.generateMusic(
              {
                styleTags: styleTags.length > 0 ? styleTags : ['舒缓'],
                emotionSequence,
                duration: totalDuration,
              },
              {
                provider: options?.provider ?? 'mock-music',
                model: 'music-model',
              },
            );
            generatedUrl = normalizeUrl(result.data.url);
            provider = result.provider;
            model = result.model;
            lastError = null;
            break;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
          }
        }

        if (lastError) {
          throw new Error(`Music generation failed after ${maxRetries + 1} attempts: ${lastError.message}`);
        }
      } else {
        // Fallback without adapter
        generatedUrl = `https://mock-cdn.example.com/music/fallback-${episodeId}-${Date.now()}.mp3`;
      }

      // 4. Cut into segments
      const segments = cutSegments(nodes, totalDuration, generatedUrl!, crossfadeDuration);

      // 5. Detect emotion transitions
      const warnings = detectEmotionTransitions(nodes);

      // 6. Store in database
      const episodeMusic: EpisodeMusic = {
        original_url: generatedUrl!,
        duration: Math.round(totalDuration * 100) / 100,
        segments,
        generated_at: new Date().toISOString(),
        provider,
        model,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      const currentMusic = getMusicData(project) ?? {};
      const updatedMusic: ProjectMusic = {
        ...currentMusic,
        [episodeId]: episodeMusic,
      };

      await db.project.update({
        where: { id: projectId },
        data: {
          music: updatedMusic as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });

      return {
        episode_id: episodeId,
        original_url: episodeMusic.original_url,
        duration: episodeMusic.duration,
        segments: episodeMusic.segments,
        generated_at: episodeMusic.generated_at,
        provider: episodeMusic.provider,
        model: episodeMusic.model,
        warnings: episodeMusic.warnings,
      };
    },

    async uploadMusic(
      projectId: string,
      episodeId: string,
      input: MusicUploadInput,
    ): Promise<EpisodeMusicResult> {
      validateEpisodeId(episodeId);
      const project = await ensureProject(projectId);

      if (!input.url || !input.url.startsWith('http')) {
        throw new Error('Invalid URL. Must start with http:// or https://');
      }
      if (typeof input.duration !== 'number' || input.duration <= 0) {
        throw new Error('Duration must be a positive number');
      }

      const episodeMusic: EpisodeMusic = {
        original_url: input.url,
        duration: input.duration,
        segments: [],
        generated_at: new Date().toISOString(),
        provider: 'manual_upload',
        model: 'manual',
      };

      const currentMusic = getMusicData(project) ?? {};
      const updatedMusic: ProjectMusic = {
        ...currentMusic,
        [episodeId]: episodeMusic,
      };

      await db.project.update({
        where: { id: projectId },
        data: {
          music: updatedMusic as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });

      return {
        episode_id: episodeId,
        ...episodeMusic,
      };
    },

    async getMusic(
      projectId: string,
      episodeId: string,
    ): Promise<EpisodeMusicResult | null> {
      validateEpisodeId(episodeId);
      const project = await ensureProject(projectId);
      const musicData = getMusicData(project);
      const episodeMusic = musicData?.[episodeId];

      if (!episodeMusic) return null;

      return {
        episode_id: episodeId,
        ...episodeMusic,
      };
    },
  };
}
