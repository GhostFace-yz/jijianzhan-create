import type { StoryboardNode } from '../storyboard/types.js';
import type { AdapterPool } from '../../adapters/pool.js';
import type { CharacterService } from '../character/types.js';
import type { SceneBibleService } from '../scene-bible/types.js';
import type { SnapshotService } from '../snapshot/types.js';

// ── Video Clip Data Shape ───────────────────────────────────────────

export interface QualityReport {
  /** 实际返回时长（秒） */
  actual_duration: number;
  /** 目标时长（秒） */
  target_duration: number;
  /** 时长误差是否在允许范围内（≤1s） */
  duration_ok: boolean;
  /** 是否检测到人脸崩坏（mock/启发式） */
  face_corruption_detected: boolean;
  /** 是否检测到动作跳变（mock/启发式） */
  motion_jump_detected: boolean;
  /** 是否通过全部质量检测 */
  passed: boolean;
  /** 检测详情说明 */
  details: string[];
}

export interface VideoClip {
  url: string;
  duration: number;
  camera_move: string;
  motion_description: string;
  generated_at: string;
  status: 'pending' | 'generated' | 'reviewed';
  reviewed?: boolean;
  reviewed_at?: string;
  review_comment?: string;
  quality_report: QualityReport;
  provider: string;
  model: string;
  fallback_used: boolean;
}

// ── Service Options ─────────────────────────────────────────────────

export interface VideoGenerateOptions {
  /** 指定主模型 provider，默认 mock-video */
  provider?: string;
  /** 指定 fallback provider，默认 mock-video-fallback */
  fallback_provider?: string;
  /** 是否强制重新生成 */
  force?: boolean;
  /** 并发数（仅影响 in-process 队列），默认 3 */
  concurrency?: number;
  /** 视频生成时长覆盖，未指定则使用 node.duration_target */
  duration?: number;
  /** 是否开启人脸增强 */
  face_enhancement?: boolean;
}

export interface VideoReviewInput {
  approved: boolean;
  comment?: string;
}

export interface VideoUploadInput {
  /** 上传视频片段的可访问 URL */
  url: string;
  /** 上传视频片段时长（秒），未提供时使用节点 duration_target */
  duration?: number;
  /** 可选：覆盖节点默认运镜指令 */
  camera_move?: string;
  /** 可选：覆盖节点默认动作描述 */
  motion_description?: string;
}

// ── Service Results ─────────────────────────────────────────────────

export interface VideoNodeResult {
  node_id: string;
  video_clip: VideoClip | null;
  skipped: boolean;
  skip_reason?: string;
  error?: string;
}

export interface VideoBatchResult {
  episode_id: string;
  total_nodes: number;
  nodes_generated: number;
  nodes_skipped: number;
  nodes_failed: number;
  success_rate: number;
  fallback_used_count: number;
  quality_passed_count: number;
  results: VideoNodeResult[];
}

// ── Service Interface ───────────────────────────────────────────────

export interface VideoService {
  generateBatchVideo(
    projectId: string,
    episodeId: string,
    options?: VideoGenerateOptions,
  ): Promise<VideoBatchResult>;

  generateNodeVideo(
    projectId: string,
    episodeId: string,
    nodeId: string,
    options?: VideoGenerateOptions,
  ): Promise<VideoNodeResult>;

  reviewNodeVideo(
    projectId: string,
    episodeId: string,
    nodeId: string,
    input: VideoReviewInput,
  ): Promise<VideoClip>;

  uploadNodeVideo(
    projectId: string,
    episodeId: string,
    nodeId: string,
    input: VideoUploadInput,
  ): Promise<VideoClip>;
}

export interface VideoServiceOptions {
  storyboardService: {
    getNodes(projectId: string, episodeId: string): Promise<StoryboardNode[]>;
    updateNodes(projectId: string, episodeId: string, input: { nodes: StoryboardNode[] }): Promise<StoryboardNode[]>;
  };
  characterService: CharacterService;
  sceneBibleService: SceneBibleService;
  adapterPool: AdapterPool;
  snapshotService?: SnapshotService;
  /** 最大重试次数，默认 1 */
  maxRetries?: number;
}
