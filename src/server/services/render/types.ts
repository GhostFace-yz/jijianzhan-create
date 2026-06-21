import type { SnapshotService } from '../snapshot/types.js';
import type { StoryboardNode, StoryboardService } from '../storyboard/types.js';
import type { AdapterPool } from '../../adapters/pool.js';
import type { MusicService } from '../music/types.js';

// ── Render Status ───────────────────────────────────────────────────

export type RenderStatus =
  | 'pending'
  | 'queued'
  | 'concatenating'
  | 'mixing'
  | 'burning_subtitles'
  | 'encoding'
  | 'completed'
  | 'failed';

// ── Transition Types ────────────────────────────────────────────────

export type RenderTransitionType = 'cut' | 'dissolve' | 'fade' | 'white_flash' | 'black_fade';

export interface TransitionRecord {
  from_node_id: string;
  to_node_id: string;
  transition_type: RenderTransitionType;
  duration: number;
}

// ── Subtitle Types ──────────────────────────────────────────────────

export interface SubtitleCue {
  start_time: number;
  end_time: number;
  text: string;
  node_id: string;
}

// ── Render Output ───────────────────────────────────────────────────

export interface EpisodeRenderOutput {
  episode_id: string;
  status: RenderStatus;
  progress_percent: number;
  output_url: string | null;
  output_duration: number | null;
  resolution: string;
  fps: number;
  codec: string;
  subtitle_cues: SubtitleCue[];
  transitions: TransitionRecord[];
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  job_id?: string | null;
  queued_at?: string | null;
}

export type ProjectRenderOutput = Record<string, EpisodeRenderOutput>;

// ── Render Options ──────────────────────────────────────────────────

export interface RenderOptions {
  provider?: string;
  resolution?: '1080x1920' | '1920x1080';
  fps?: 24 | 30;
  codec?: 'h264' | 'h265';
  subtitles_enabled?: boolean;
  subtitle_style?: 'white_with_black_border' | 'white' | 'black';
  subtitle_position?: 'bottom' | 'top';
  subtitle_size?: 'small' | 'medium' | 'large';
  music_duck_dialogue?: number;
  music_duck_nondialogue?: number;
  strong_emotion_transition?: 'white_flash' | 'black_fade';
  extra_params?: Record<string, unknown>;
}

// ── Audio Mix Plan ──────────────────────────────────────────────────

export interface AudioMixTrack {
  url: string;
  start_time: number;
  duration: number;
  volume: number;
}

export interface AudioMixPlan {
  dialogueTracks: AudioMixTrack[];
  musicTracks: AudioMixTrack[];
}

// ── Service Interfaces ──────────────────────────────────────────────

export interface RenderService {
  startRender(
    projectId: string,
    episodeId: string,
    options?: RenderOptions,
  ): Promise<EpisodeRenderOutput>;

  processRenderJob(
    projectId: string,
    episodeId: string,
    options: RenderOptions,
    plan: RenderPlan,
    callbacks?: { onProgress?: (progress: number) => void | Promise<void> },
  ): Promise<EpisodeRenderOutput>;

  getProgress(projectId: string, episodeId: string): Promise<EpisodeRenderOutput | null>;

  getDownloadUrl(projectId: string, episodeId: string): Promise<string | null>;
}

export interface RenderServiceOptions {
  storyboardService: StoryboardService;
  musicService: MusicService;
  adapterPool?: AdapterPool;
  prisma?: typeof import('../../lib/db.js').prisma;
  snapshotService?: SnapshotService;
  maxRetries?: number;
  queue?: QueueLike;
}

export interface QueueLike {
  add(name: string, data: unknown): Promise<{ id?: string }>;
}

// ── Internal Plan ───────────────────────────────────────────────────

export interface RenderPlan {
  nodes: StoryboardNode[];
  videoClips: Array<{ url: string; duration: number; freezeExtend?: number }>;
  audioClips: Array<{ url: string; duration: number; startTime: number }>;
  musicSegments: AudioMixTrack[];
  transitions: TransitionRecord[];
  subtitleCues: SubtitleCue[];
  resolution: string;
  fps: number;
  codec: string;
  totalDuration: number;
}
