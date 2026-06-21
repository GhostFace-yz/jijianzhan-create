import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import type { AIModelInfo, SnapshotService } from '../snapshot/types.js';
import type {
  AudioMixPlan,
  AudioMixTrack,
  EpisodeRenderOutput,
  ProjectRenderOutput,
  RenderOptions,
  RenderPlan,
  RenderService,
  RenderServiceOptions,
  RenderStatus,
  SubtitleCue,
  TransitionRecord,
  RenderTransitionType,
} from './types.js';
import type { StoryboardNode } from '../storyboard/types.js';
import type { EpisodeMusicResult, MusicSegment } from '../music/types.js';

// ── Constants ───────────────────────────────────────────────────────

const DEFAULT_RESOLUTION = '1080x1920';
const DEFAULT_FPS = 30;
const DEFAULT_CODEC = 'h264';
const DEFAULT_DUCK_DIALOGUE = 0.3;
const DEFAULT_DUCK_NONDIALOGUE = 0.8;
const DISSOLVE_DURATION = 0.3;
const FADE_DURATION = 0.5;
const BLACK_FADE_DURATION = 0.3;
const WHITE_FLASH_DURATION = 0.1;

const STRONG_EMOTION_TAGS = ['flashback', 'dream', 'time_jump', '闪回', '梦境', '时间跳跃'];

// ── Validation ──────────────────────────────────────────────────────

function validateEpisodeId(episodeId: string): void {
  if (!/^ep-\d+$/.test(episodeId)) {
    throw new Error('Invalid episode ID format. Expected: ep-{number}');
  }
}

export function nodeHasDialogue(node: StoryboardNode): boolean {
  return !!(node.dialogue && node.dialogue.text && node.dialogue.text.trim().length > 0);
}

export function validatePrerequisites(nodes: StoryboardNode[]): void {
  if (nodes.length === 0) {
    throw new Error('No storyboard nodes found. Split the script into storyboard nodes first.');
  }

  const missingClips: string[] = [];
  const pendingClips: string[] = [];

  for (const node of nodes) {
    if (!node.video_clip) {
      missingClips.push(node.node_id);
      continue;
    }
    if (node.video_clip.status === 'pending') {
      pendingClips.push(node.node_id);
    }
  }

  if (missingClips.length > 0) {
    throw new Error(
      `Video clips have not been generated for nodes: ${missingClips.join(', ')}. Generate video first.`,
    );
  }

  if (pendingClips.length > 0) {
    throw new Error(
      `Video clips are still pending for nodes: ${pendingClips.join(', ')}. Wait for generation to complete.`,
    );
  }
}

// ── Transition Logic ────────────────────────────────────────────────

function hasStrongEmotionTransition(node: StoryboardNode): boolean {
  const text = `${node.emotion_tag || ''} ${node.visual_desc || ''}`.toLowerCase();
  return STRONG_EMOTION_TAGS.some((tag) => text.includes(tag.toLowerCase()));
}

/**
 * 启发式匹配帧判断（mock 阶段）。
 * 若 visual_desc 包含测试标记 `match_frame`，认为帧匹配度高，直接拼接。
 * 否则默认使用淡入淡出。
 */
function mockMatchFrameSimilarity(prev: StoryboardNode, next: StoryboardNode): boolean {
  const prevText = (prev.visual_desc || '').toLowerCase();
  const nextText = (next.visual_desc || '').toLowerCase();
  if (prevText.includes('match_frame') || nextText.includes('match_frame')) {
    return true;
  }
  return false;
}

export function determineTransition(
  prev: StoryboardNode,
  next: StoryboardNode,
  options: RenderOptions,
): TransitionRecord {
  const fromNodeId = prev.node_id;
  const toNodeId = next.node_id;

  // 情绪强转场
  if (
    options.strong_emotion_transition &&
    (hasStrongEmotionTransition(prev) || hasStrongEmotionTransition(next))
  ) {
    const type: RenderTransitionType =
      options.strong_emotion_transition === 'white_flash' ? 'white_flash' : 'black_fade';
    return {
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      transition_type: type,
      duration: type === 'white_flash' ? WHITE_FLASH_DURATION : BLACK_FADE_DURATION,
    };
  }

  // 同场景
  if (prev.scene_id === next.scene_id) {
    if (prev.scene_variant === next.scene_variant) {
      return {
        from_node_id: fromNodeId,
        to_node_id: toNodeId,
        transition_type: 'cut',
        duration: 0,
      };
    }
    // 同场景不同时间段（用 scene_variant 区分）
    return {
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      transition_type: 'dissolve',
      duration: DISSOLVE_DURATION,
    };
  }

  // 不同场景：匹配帧过渡
  if (mockMatchFrameSimilarity(prev, next)) {
    return {
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      transition_type: 'cut',
      duration: 0,
    };
  }

  return {
    from_node_id: fromNodeId,
    to_node_id: toNodeId,
    transition_type: 'fade',
    duration: FADE_DURATION,
  };
}

function buildTransitions(
  nodes: StoryboardNode[],
  options: RenderOptions,
): TransitionRecord[] {
  const transitions: TransitionRecord[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    transitions.push(determineTransition(nodes[i], nodes[i + 1], options));
  }
  return transitions;
}

// ── Subtitle Logic ──────────────────────────────────────────────────

export function buildSubtitleCues(nodes: StoryboardNode[]): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  let currentTime = 0;

  for (const node of nodes) {
    if (nodeHasDialogue(node)) {
      const audioDuration = node.audio_clip?.duration ?? node.video_clip?.duration ?? node.duration_target;
      const startTime = Math.round(currentTime * 100) / 100;
      const endTime = Math.round((currentTime + audioDuration) * 100) / 100;
      cues.push({
        node_id: node.node_id,
        text: node.dialogue!.text,
        start_time: startTime,
        end_time: endTime,
      });
    }
    currentTime += node.video_clip?.duration ?? node.duration_target;
  }

  return cues;
}

// ── Audio Mix Logic ─────────────────────────────────────────────────

export function buildAudioMixPlan(
  nodes: StoryboardNode[],
  musicSegments: MusicSegment[],
  options: RenderOptions,
): AudioMixPlan {
  const dialogueVolume = clamp(
    options.music_duck_dialogue ?? DEFAULT_DUCK_DIALOGUE,
    0.2,
    0.4,
  );
  const nonDialogueVolume = clamp(
    options.music_duck_nondialogue ?? DEFAULT_DUCK_NONDIALOGUE,
    0.6,
    0.9,
  );

  const dialogueTracks: AudioMixTrack[] = [];
  const musicTracks: AudioMixTrack[] = [];

  let currentTime = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodeDuration = node.video_clip?.duration ?? node.duration_target;

    if (nodeHasDialogue(node) && node.audio_clip) {
      dialogueTracks.push({
        url: node.audio_clip.url,
        start_time: Math.round(currentTime * 100) / 100,
        duration: node.audio_clip.duration,
        volume: 1.0,
      });
    }

    const segment = musicSegments[i];
    if (segment) {
      musicTracks.push({
        url: segment.url,
        start_time: Math.round(segment.start_time * 100) / 100,
        duration: Math.round(segment.duration * 100) / 100,
        volume: nodeHasDialogue(node) ? dialogueVolume : nonDialogueVolume,
      });
    }

    currentTime += nodeDuration;
  }

  return { dialogueTracks, musicTracks };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Render Plan ─────────────────────────────────────────────────────

function buildRenderPlan(
  nodes: StoryboardNode[],
  music: EpisodeMusicResult,
  options: RenderOptions,
): RenderPlan {
  const resolution = options.resolution ?? DEFAULT_RESOLUTION;
  const fps = options.fps ?? DEFAULT_FPS;
  const codec = options.codec ?? DEFAULT_CODEC;

  const transitions = buildTransitions(nodes, options);
  const subtitleCues = options.subtitles_enabled !== false ? buildSubtitleCues(nodes) : [];
  const { dialogueTracks, musicTracks } = buildAudioMixPlan(
    nodes,
    music.segments,
    options,
  );

  const videoClips = nodes.map((node) => {
    const videoDuration = node.video_clip!.duration;
    const audioDuration = node.audio_clip?.duration;
    let freezeExtend: number | undefined;

    if (audioDuration && audioDuration > videoDuration) {
      freezeExtend = Math.round((audioDuration - videoDuration) * 100) / 100;
    }

    return {
      url: node.video_clip!.url,
      duration: videoDuration,
      freezeExtend,
    };
  });

  const totalDuration = videoClips.reduce(
    (sum, clip) => sum + clip.duration + (clip.freezeExtend ?? 0),
    0,
  );

  return {
    nodes,
    videoClips,
    audioClips: dialogueTracks.map((t) => ({
      url: t.url,
      duration: t.duration,
      startTime: t.start_time,
    })),
    musicSegments: musicTracks,
    transitions,
    subtitleCues,
    resolution,
    fps,
    codec,
    totalDuration: Math.round(totalDuration * 100) / 100,
  };
}

// ── Persistence ─────────────────────────────────────────────────────

function getRenderData(project: { render_output: unknown }): ProjectRenderOutput | null {
  if (!project.render_output) return null;
  return project.render_output as ProjectRenderOutput;
}

async function persistRenderOutput(
  db: typeof prisma,
  projectId: string,
  output: EpisodeRenderOutput,
): Promise<void> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  const current = getRenderData(project) ?? {};
  const updated: ProjectRenderOutput = { ...current, [output.episode_id]: output };

  await db.project.update({
    where: { id: projectId },
    data: {
      render_output: updated as unknown as Prisma.InputJsonValue,
      updated_at: new Date(),
    },
  });
}

// ── Service Factory ─────────────────────────────────────────────────

export function createRenderService(options: RenderServiceOptions): RenderService {
  const db = options.prisma ?? prisma;
  const storyboardService = options.storyboardService;
  const musicService = options.musicService;
  const adapterPool = options.adapterPool;
  const snapshotService = options.snapshotService;
  const maxRetries = options.maxRetries ?? 1;
  const queue = options.queue;

  async function ensureProject(projectId: string) {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');
    return project;
  }

  function buildProgressOutput(
    episodeId: string,
    status: RenderStatus,
    progressPercent: number,
    plan: RenderPlan,
    startedAt: string,
  ): EpisodeRenderOutput {
    return {
      episode_id: episodeId,
      status,
      progress_percent: progressPercent,
      output_url: null,
      output_duration: null,
      resolution: plan.resolution,
      fps: plan.fps,
      codec: plan.codec,
      subtitle_cues: plan.subtitleCues,
      transitions: plan.transitions,
      started_at: startedAt,
      completed_at: null,
      error_message: null,
    };
  }

  async function processRenderJob(
    projectId: string,
    episodeId: string,
    options: RenderOptions,
    plan: RenderPlan,
    callbacks?: { onProgress?: (progress: number) => void | Promise<void> },
  ): Promise<EpisodeRenderOutput> {
    validateEpisodeId(episodeId);
    await ensureProject(projectId);

    const startedAt = new Date().toISOString();
    const updateProgress = async (status: RenderStatus, progressPercent: number) => {
      const output = buildProgressOutput(episodeId, status, progressPercent, plan, startedAt);
      await persistRenderOutput(db, projectId, output);
      if (callbacks?.onProgress) {
        await callbacks.onProgress(progressPercent);
      }
    };

    await updateProgress('concatenating', 20);
    await updateProgress('mixing', 45);
    await updateProgress('burning_subtitles', 70);
    await updateProgress('encoding', 85);

    let renderResult: {
      url: string;
      duration: number;
      resolution: string;
      fps: number;
      codec: string;
    } | null = null;
    let lastError: Error | null = null;
    let provider = options.provider ?? 'mock-render';
    let model = 'render-model';

    if (adapterPool) {
      const renderAdapter = adapterPool.getRender(options.provider ?? 'mock-render');

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await renderAdapter.composeEpisode(
            {
              videoClips: plan.videoClips,
              audioClips: plan.audioClips,
              musicSegments: plan.musicSegments,
              transitions: plan.transitions,
              subtitleCues: plan.subtitleCues,
              resolution: plan.resolution,
              fps: plan.fps,
              codec: plan.codec,
            },
            {
              provider: options.provider ?? 'mock-render',
              model: 'render-model',
              extraParams: options.extra_params,
            },
          );
          renderResult = result.data;
          provider = result.provider;
          model = result.model;
          lastError = null;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < maxRetries) continue;
        }
      }
    }

    if (!renderResult) {
      const errorMessage = lastError?.message ?? 'Render failed after retries';
      const failedOutput: EpisodeRenderOutput = {
        ...buildProgressOutput(episodeId, 'failed', 100, plan, startedAt),
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      };
      await persistRenderOutput(db, projectId, failedOutput);
      throw new Error(errorMessage);
    }

    const completedOutput: EpisodeRenderOutput = {
      ...buildProgressOutput(episodeId, 'completed', 100, plan, startedAt),
      output_url: renderResult.url,
      output_duration: renderResult.duration,
      completed_at: new Date().toISOString(),
    };
    await persistRenderOutput(db, projectId, completedOutput);

    if (snapshotService) {
      const aiModel: AIModelInfo = { provider, model };
      await snapshotService.createSnapshot({
        entity: { projectId, entityType: 'generation_result', entityId: episodeId },
        source: 'ai_generated',
        content: completedOutput as unknown as Record<string, unknown>,
        aiModel,
      });
    }

    return completedOutput;
  }

  return {
    async startRender(
      projectId: string,
      episodeId: string,
      options: RenderOptions = {},
    ): Promise<EpisodeRenderOutput> {
      validateEpisodeId(episodeId);
      await ensureProject(projectId);

      const nodes = await storyboardService.getNodes(projectId, episodeId);
      validatePrerequisites(nodes);

      const music = await musicService.getMusic(projectId, episodeId);
      if (!music) {
        throw new Error(`Music has not been generated for episode ${episodeId}. Generate music first.`);
      }

      const plan = buildRenderPlan(nodes, music, options);
      const startedAt = new Date().toISOString();
      const queuedAt = new Date().toISOString();

      // 默认返回 queued 状态；无队列时同步执行（兼容测试与降级场景）
      let output = buildProgressOutput(episodeId, 'queued', 5, plan, startedAt);
      output = { ...output, queued_at: queuedAt };
      await persistRenderOutput(db, projectId, output);

      if (queue) {
        const job = await queue.add('compose', {
          projectId,
          episodeId,
          options,
          plan,
        });
        if (job.id) {
          output = { ...output, job_id: job.id };
          await persistRenderOutput(db, projectId, output);
        }
        return output;
      }

      // 同步执行路径（测试/降级）
      return processRenderJob(projectId, episodeId, options, plan);
    },

    processRenderJob,

    async getProgress(projectId: string, episodeId: string): Promise<EpisodeRenderOutput | null> {
      validateEpisodeId(episodeId);
      const project = await ensureProject(projectId);
      const data = getRenderData(project);
      return data?.[episodeId] ?? null;
    },

    async getDownloadUrl(projectId: string, episodeId: string): Promise<string | null> {
      validateEpisodeId(episodeId);
      const project = await ensureProject(projectId);
      const data = getRenderData(project);
      const episode = data?.[episodeId];
      if (!episode || episode.status !== 'completed' || !episode.output_url) {
        return null;
      }
      return episode.output_url;
    },
  };
}
