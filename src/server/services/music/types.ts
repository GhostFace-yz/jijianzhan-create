import type { StoryboardService } from '../storyboard/types.js';
import type { AdapterPool } from '../../adapters/pool.js';
import type { SnapshotService } from '../snapshot/types.js';

// ── Music Data Shapes ───────────────────────────────────────────────

export interface MusicSegment {
  node_id: string;
  start_time: number;
  duration: number;
  url: string;
  volume: number;
  ducked: boolean;
  crossfade_in: number;
  crossfade_out: number;
}

export interface EmotionTransitionWarning {
  type: 'emotion_transition';
  from_node: string;
  to_node: string;
  from_mood: string;
  to_mood: string;
  message: string;
}

export interface EpisodeMusic {
  original_url: string;
  duration: number;
  segments: MusicSegment[];
  generated_at: string;
  provider: string;
  model: string;
  warnings?: EmotionTransitionWarning[];
}

/**
 * Keyed by episode identifier (e.g. "ep-1"), each value is the episode music data.
 */
export type ProjectMusic = Record<string, EpisodeMusic>;

// ── Service Input / Output ─────────────────────────────────────────

export interface MusicGenerateOptions {
  provider?: string;
  style_tags?: string[];
  crossfade_duration?: number;  // default 0.4s
}

export interface MusicUploadInput {
  url: string;
  duration: number;
}

export interface EpisodeMusicResult {
  episode_id: string;
  original_url: string;
  duration: number;
  segments: MusicSegment[];
  generated_at: string;
  provider: string;
  model: string;
  warnings?: EmotionTransitionWarning[];
}

// ── Service Interface ──────────────────────────────────────────────

export interface MusicService {
  generateMusic(
    projectId: string,
    episodeId: string,
    options?: MusicGenerateOptions,
  ): Promise<EpisodeMusicResult>;

  uploadMusic(
    projectId: string,
    episodeId: string,
    input: MusicUploadInput,
  ): Promise<EpisodeMusicResult>;

  getMusic(projectId: string, episodeId: string): Promise<EpisodeMusicResult | null>;
}

// ── Service Options ────────────────────────────────────────────────

export interface MusicServiceOptions {
  storyboardService: StoryboardService;
  adapterPool?: AdapterPool;
  snapshotService?: SnapshotService;
  prisma?: typeof import('../../lib/db.js').prisma;
  maxRetries?: number;
}
