import type { StoryboardNode, ShotType, CameraMove } from './types.js';
import type { AdapterPool } from '../../adapters/pool.js';

// ── Image-Specific Node Fields ─────────────────────────────────────

export interface StoryboardImageMeta {
  image_url?: string;
  image_seed?: number;
  image_prompt?: string;
  image_negative_prompt?: string;
  image_status: ImageGenerationStatus;
  image_review?: ImageReview;
  refinement_iterations?: number;
}

export type ImageGenerationStatus = 'pending' | 'generating' | 'completed' | 'needs_redo';

export interface ImageReview {
  approved: boolean;
  comment?: string;
  reviewed_at: string;
}

/** StoryboardNode augmented with image generation metadata */
export type StoryboardNodeWithImage = StoryboardNode & Partial<StoryboardImageMeta>;

// ── Prompt Layers ──────────────────────────────────────────────────

export interface AssembledPrompt {
  /** Full positive prompt string */
  positive: string;
  /** Negative prompt string */
  negative: string;
  /** Layer-by-layer breakdown for debugging */
  layers: PromptLayers;
}

export interface PromptLayers {
  shot_description: string;
  character_conditioning: string;
  scene_conditioning: string;
  style_unification: string;
  quality_control: string;
}

// ── Character IP-Adapter Context ───────────────────────────────────

export interface CharacterIPContext {
  char_id: string;
  ip_adapter_id: string | null;
  ref_image_urls: string[];
  costume_variant: string;
}

// ── Scene Seed Context ─────────────────────────────────────────────

export interface SceneSeedContext {
  scene_id: string;
  scene_variant_key: string;
  base_seed: number;
  base_image_url: string | null;
  variant_image_url?: string;
}

// ── Generate Options ───────────────────────────────────────────────

export interface GenerateNodeImageOptions {
  /** Override width (default 1024) */
  width?: number;
  /** Override height (default 1024) */
  height?: number;
  /** Style preset for the image adapter */
  style_preset?: string;
  /** Force regeneration even if image already exists */
  force?: boolean;
}

// ── Generate Results ───────────────────────────────────────────────

export interface NodeImageResult {
  node_id: string;
  image_url: string;
  image_seed: number;
  image_prompt: string;
  image_negative_prompt: string;
  refinement_iterations: number;
  status: 'completed' | 'needs_redo';
  latency_ms: number;
}

export interface BatchGenerateResult {
  results: NodeImageResult[];
  summary: {
    total: number;
    completed: number;
    needs_redo: number;
    failed: number;
    ip_adapter_injection_rate: number;
    scene_seed_lock_rate: number;
  };
}

// ── Review Input ───────────────────────────────────────────────────

export interface ReviewNodeImageInput {
  approved: boolean;
  comment?: string;
}

// ── Enforcement Context ────────────────────────────────────────────

export interface EnforcementReport {
  ip_adapter_injected: boolean;
  scene_seed_locked: boolean;
  ip_adapter_details: {
    total_characters: number;
    with_ip_adapter: number;
    missing_ip_adapter: string[];
  };
  scene_seed_details: {
    scene_id: string;
    seed_locked: boolean;
    reason?: string;
  };
}

// ── Risk Assessment ────────────────────────────────────────────────

export type NodeRiskLevel = 'low' | 'medium' | 'high';

export interface NodeRiskAssessment {
  risk_level: NodeRiskLevel;
  is_high_risk: boolean;
  reasons: string[];
  max_refinement_iterations: number;
}

// ── Service Interface ──────────────────────────────────────────────

export interface StoryboardImageService {
  /** Generate image for a single storyboard node */
  generateNodeImage(
    projectId: string,
    episodeId: string,
    nodeId: string,
    options?: GenerateNodeImageOptions,
  ): Promise<NodeImageResult>;

  /** Batch generate images for all nodes in an episode */
  generateBatchImages(
    projectId: string,
    episodeId: string,
    options?: GenerateNodeImageOptions,
  ): Promise<BatchGenerateResult>;

  /** Review a generated node image */
  reviewNodeImage(
    projectId: string,
    episodeId: string,
    nodeId: string,
    input: ReviewNodeImageInput,
  ): Promise<StoryboardNodeWithImage>;

  /** Assemble the 6-layer prompt for a node */
  assemblePrompt(
    projectId: string,
    node: StoryboardNode,
  ): Promise<AssembledPrompt>;

  /** Assess risk level for a node */
  assessNodeRisk(node: StoryboardNode): NodeRiskAssessment;

  /** Verify enforcement: IP-Adapter + Seed lock */
  verifyEnforcement(
    projectId: string,
    node: StoryboardNode,
  ): Promise<EnforcementReport>;
}

// ── Service Options ────────────────────────────────────────────────

export interface StoryboardImageServiceOptions {
  prisma?: typeof import('../../lib/db.js').prisma;
  adapterPool?: AdapterPool;
  /** Max refinement iterations for high-risk nodes (default 3) */
  maxRefinementIterations?: number;
}
