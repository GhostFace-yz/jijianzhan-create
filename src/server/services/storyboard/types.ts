import type { SnapshotService } from '../snapshot/types.js';
import type { AdapterPool } from '../../adapters/pool.js';
import type { VideoClip } from '../video/types.js';

// ── Storyboard Node Data Shapes ─────────────────────────────────────

export type ShotType = 'close-up' | 'medium-shot' | 'wide-shot' | 'over-shoulder' | 'pov' | 'aerial';

export type CameraMove =
  | 'static'
  | 'pan-left'
  | 'pan-right'
  | 'tilt-up'
  | 'tilt-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'dolly'
  | 'tracking'
  | 'handheld';

export type TransitionType = 'cut' | 'fade' | 'dissolve' | 'wipe';

export type NodeStatus = 'pending' | 'generating' | 'completed' | 'needs_redo';

export type NodeEditImpact = 'light' | 'medium' | 'deep';

export interface StoryboardCharacter {
  char_id: string;
  costume_variant: string;
}

export interface StoryboardDialogue {
  char_id: string;
  text: string;
  emotion: string;
}

export interface VersionHistoryEntry {
  version_id: string;
  version_number: number;
  created_at: string;
  source: 'ai_generated' | 'user_edited' | 'ai_regenerated';
}

export interface AudioClip {
  url: string;
  duration: number;
  voice_id: string;
  emotion: string;
  speed: number;
  generated_at: string;
  status: 'pending' | 'generated' | 'reviewed';
  reviewed_at?: string;
  review_comment?: string;
  reviewed?: boolean;
}

export interface StoryboardNode {
  node_id: string;
  scene_id: string;
  scene_variant: string;
  characters: StoryboardCharacter[];
  shot_type: ShotType;
  camera_move: CameraMove;
  visual_desc: string;
  dialogue: StoryboardDialogue | null;
  emotion_tag: string;
  music_mood: string;
  duration_target: number;
  transition_in: TransitionType;
  transition_out: TransitionType;
  status: NodeStatus;
  version_history: VersionHistoryEntry[];
  audio_clip?: AudioClip | null;
  video_clip?: VideoClip | null;
}

// ── Episodes Storyboard Map ─────────────────────────────────────────

/**
 * Keyed by episode identifier (e.g. "ep-1"), each value is an array of nodes.
 */
export type EpisodesStoryboard = Record<string, StoryboardNode[]>;

// ── Split Result ────────────────────────────────────────────────────

export interface SplitResult {
  nodes: StoryboardNode[];
  total_duration: number;
  node_count: number;
}

export interface NodeSplitResult {
  original: StoryboardNode;
  new_nodes: [StoryboardNode, StoryboardNode];
}

// ── Impact Analysis ─────────────────────────────────────────────────

export interface ImpactHint {
  field: string;
  impact: NodeEditImpact;
  affected_assets: string[];
  message: string;
}

// ── Service Input / Output ──────────────────────────────────────────

export interface UpdateNodesInput {
  nodes: StoryboardNode[];
}

export interface SplitNodeInput {
  split_point_seconds?: number;
}

// ── Service Interface ───────────────────────────────────────────────

export interface StoryboardService {
  /** AI auto-split script into storyboard nodes */
  splitScript(projectId: string, episodeId: string): Promise<SplitResult>;

  /** Get all nodes for an episode */
  getNodes(projectId: string, episodeId: string): Promise<StoryboardNode[]>;

  /** Batch update nodes (replaces all nodes for the episode) */
  updateNodes(projectId: string, episodeId: string, input: UpdateNodesInput): Promise<StoryboardNode[]>;

  /** Split a single node into two */
  splitNode(
    projectId: string,
    episodeId: string,
    nodeId: string,
    input?: SplitNodeInput,
  ): Promise<NodeSplitResult>;

  /** Analyze edit impact for a field change on a node */
  analyzeEditImpact(node: StoryboardNode, changedFields: string[]): ImpactHint[];
}

// ── TTS Types ────────────────────────────────────────────────────────

export interface TtsGenerateOptions {
  speed?: number;
  emotion?: string;
  voice_id?: string;
  force?: boolean;
  provider?: string;
}

export interface TtsReviewInput {
  approved: boolean;
  comment?: string;
}

export interface TtsUploadInput {
  url: string;
  duration: number;
}

export interface TtsNodeResult {
  node_id: string;
  audio_clip: AudioClip | null;
  skipped: boolean;
  skip_reason?: string;
  error?: string;
}

export interface TtsBatchResult {
  episode_id: string;
  total_nodes: number;
  nodes_with_dialogue: number;
  nodes_generated: number;
  nodes_skipped: number;
  nodes_failed: number;
  success_rate: number;
  results: TtsNodeResult[];
}

export interface TtsService {
  generateBatchTts(
    projectId: string,
    episodeId: string,
    options?: TtsGenerateOptions,
  ): Promise<TtsBatchResult>;

  generateNodeTts(
    projectId: string,
    episodeId: string,
    nodeId: string,
    options?: TtsGenerateOptions,
  ): Promise<TtsNodeResult>;

  reviewNodeTts(
    projectId: string,
    episodeId: string,
    nodeId: string,
    input: TtsReviewInput,
  ): Promise<AudioClip>;

  uploadNodeTts(
    projectId: string,
    episodeId: string,
    nodeId: string,
    input: TtsUploadInput,
  ): Promise<AudioClip>;
}

// ── Service Options ─────────────────────────────────────────────────

export interface StoryboardServiceOptions {
  prisma?: typeof import('../../lib/db.js').prisma;
  snapshotService?: SnapshotService;
  adapterPool?: AdapterPool;
  maxRetries?: number;
}

export interface TtsServiceOptions {
  storyboardService: StoryboardService;
  characterService: import('../character/types.js').CharacterService;
  adapterPool?: AdapterPool;
  snapshotService?: SnapshotService;
  maxRetries?: number;
}
