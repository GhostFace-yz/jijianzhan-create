import { prisma } from '../../lib/db.js';
import { getImageProviderConfig } from '../../adapters/lib/provider-config.js';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { StoryboardNode } from './types.js';
import type { StorageService } from '../storage/types.js';
import type {
  StoryboardImageService,
  StoryboardImageServiceOptions,
  StoryboardNodeWithImage,
  AssembledPrompt,
  NodeImageResult,
  BatchGenerateResult,
  ReviewNodeImageInput,
  GenerateNodeImageOptions,
  CharacterIPContext,
  SceneSeedContext,
  NodeRiskAssessment,
  EnforcementReport,
} from './storyboard-image-types.js';

// ── Constants ──────────────────────────────────────────────────────

const NEGATIVE_PROMPT_BASE =
  'multiple people, extra limbs, bad anatomy, blurry, watermark, text, logo, nsfw, low quality, distorted, deformed, ugly, cropped, out of frame';

const QUALITY_CONTROL_LAYER =
  'high quality, sharp focus, professional lighting, cinematic composition, 8k, masterpiece';

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 1024;

// 1x1 transparent PNG placeholder for mock providers that return non-downloadable URLs
const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// ── Local Persistence ──────────────────────────────────────────────

async function persistGeneratedImage(
  remoteUrl: string,
  storageKey: string,
  storage: StorageService | undefined,
  provider: string,
): Promise<string> {
  if (!storage) {
    return remoteUrl;
  }

  let buffer: Buffer;
  if (provider === 'mock-image') {
    // Mock provider returns a fake URL; persist a placeholder so local URL is valid
    buffer = Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64');
  } else {
    const res = await fetch(remoteUrl);
    if (!res.ok) {
      throw new Error(`Failed to download generated image: ${res.status} ${res.statusText}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'storyboard-'));
  const tmpPath = path.join(tmpDir, 'image.png');
  await writeFile(tmpPath, buffer);

  const saved = await storage.save(tmpPath, storageKey);
  return saved.url;
}

// ── Risk Assessment ────────────────────────────────────────────────

function assessNodeRisk(node: StoryboardNode): NodeRiskAssessment {
  const reasons: string[] = [];

  // High risk: close-up shot type
  if (node.shot_type === 'close-up') {
    reasons.push('close-up shot requires precise facial details');
  }

  // High risk: multiple characters
  if (node.characters.length > 1) {
    reasons.push('multiple characters in frame increases composition complexity');
  }

  // High risk: complex camera moves
  const complexMoves = ['tracking', 'handheld', 'dolly'];
  if (complexMoves.includes(node.camera_move)) {
    reasons.push(`complex camera move: ${node.camera_move}`);
  }

  const riskScore = reasons.length;
  let riskLevel: 'low' | 'medium' | 'high';
  if (riskScore >= 2) riskLevel = 'high';
  else if (riskScore === 1) riskLevel = 'medium';
  else riskLevel = 'low';

  return {
    risk_level: riskLevel,
    is_high_risk: riskLevel === 'high',
    reasons,
    max_refinement_iterations: riskLevel === 'high' ? 3 : riskLevel === 'medium' ? 1 : 0,
  };
}

// ── Character IP-Adapter Resolution ────────────────────────────────

async function resolveCharacterIPContext(
  projectId: string,
  node: StoryboardNode,
): Promise<CharacterIPContext[]> {
  const contexts: CharacterIPContext[] = [];

  for (const nc of node.characters) {
    // Look up character by name in this project
    const character = await prisma.character.findFirst({
      where: {
        project_id: projectId,
        name: nc.char_id,
      },
    });

    if (character) {
      // Parse ref_images from JSON
      const refImages: Array<{ view: string; url: string; seed: number }> =
        (character.ref_images as Array<{ view: string; url: string; seed: number }>) || [];

      const frontView = refImages.find((img) => img.view === 'front');
      const refUrls = frontView ? [frontView.url] : refImages.slice(0, 1).map((img) => img.url);

      contexts.push({
        char_id: nc.char_id,
        ip_adapter_id: character.ip_adapter_id,
        ref_image_urls: refUrls,
        costume_variant: nc.costume_variant,
      });
    } else {
      contexts.push({
        char_id: nc.char_id,
        ip_adapter_id: null,
        ref_image_urls: [],
        costume_variant: nc.costume_variant,
      });
    }
  }

  return contexts;
}

// ── Scene Seed Resolution ──────────────────────────────────────────

async function resolveSceneSeedContext(
  projectId: string,
  node: StoryboardNode,
): Promise<SceneSeedContext | null> {
  // The scene_variant is like "下午-晴天", extract time_of_day and weather
  const variantKey = node.scene_variant;

  // Look up location by scene_id mapping via script
  // First, get the project to find the script
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !project.meta) return null;

  const meta = project.meta as Record<string, unknown>;
  // Search all script_ep-* keys for the scene
  let locationId: string | null = null;
  for (const [key, value] of Object.entries(meta)) {
    if (key.startsWith('script_') && typeof value === 'object' && value !== null) {
      const script = value as { scenes?: Array<{ scene_id: string; location_id: string }> };
      if (script.scenes) {
        const scene = script.scenes.find((s) => s.scene_id === node.scene_id);
        if (scene) {
          locationId = scene.location_id;
          break;
        }
      }
    }
  }

  if (!locationId) {
    // Try looking up location by name matching scene_variant location
    // Fallback: find any confirmed location
    const anyLocation = await prisma.location.findFirst({
      where: {
        project_id: projectId,
        status: 'confirmed',
        base_seed: { not: null },
      },
      orderBy: { updated_at: 'desc' },
    });
    if (!anyLocation) return null;
    return {
      scene_id: node.scene_id,
      scene_variant_key: variantKey,
      base_seed: anyLocation.base_seed!,
      base_image_url: anyLocation.base_image_url,
    };
  }

  // Try to find location by name first, then by id
  let location = await prisma.location.findFirst({
    where: { project_id: projectId, name: locationId },
  });

  if (!location) {
    location = await prisma.location.findFirst({
      where: { project_id: projectId, id: locationId },
    });
  }

  if (!location || location.base_seed === null) {
    return null;
  }

  // Check if there's a matching variant
  const variants = (location.variants as Record<string, { image_url: string; seed: number }>) || {};
  const variant = variants[variantKey];

  return {
    scene_id: node.scene_id,
    scene_variant_key: variantKey,
    base_seed: location.base_seed,
    base_image_url: location.base_image_url,
    variant_image_url: variant?.image_url,
  };
}

// ── Prompt Assembly ────────────────────────────────────────────────

async function assemblePrompt(
  projectId: string,
  node: StoryboardNode,
  ipContexts: CharacterIPContext[],
  sceneContext: SceneSeedContext | null,
): Promise<AssembledPrompt> {
  // Layer 1: Shot description
  const shotDescParts = [
    `A cinematic ${node.shot_type} shot`,
    node.camera_move !== 'static' ? `with ${node.camera_move} camera movement` : '',
    node.visual_desc,
  ];
  const shotDescription = shotDescParts.filter(Boolean).join(', ');

  // Layer 2: Character conditioning
  const charParts = node.characters.map((nc) => {
    const ctx = ipContexts.find((c) => c.char_id === nc.char_id);
    const ipInfo = ctx?.ip_adapter_id ? `[IP-Adapter: ${ctx.ip_adapter_id}]` : '';
    return `${nc.char_id} wearing ${nc.costume_variant} ${ipInfo}`;
  });
  const characterConditioning = charParts.join('; ');

  // Layer 3: Scene conditioning
  const sceneParts = [
    `Scene: ${node.scene_id}`,
    `Environment: ${node.scene_variant}`,
    sceneContext ? `[Seed: ${sceneContext.base_seed}]` : '',
    node.emotion_tag ? `Mood: ${node.emotion_tag}` : '',
  ];
  const sceneConditioning = sceneParts.filter(Boolean).join(', ');

  // Layer 4: Style unification
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const meta = (project?.meta as Record<string, unknown>) || {};
  const styleTags: string[] = Array.isArray(meta.style_tags) ? meta.style_tags as string[] : [];
  const genre = typeof meta.genre === 'string' ? meta.genre : '';
  const styleLayer = [
    'Chinese short drama series style',
    genre ? `genre: ${genre}` : '',
    ...styleTags.map((t) => `style: ${t}`),
    'consistent visual identity',
  ].filter(Boolean).join(', ');

  // Layer 5: Quality control
  const qualityLayer = QUALITY_CONTROL_LAYER;

  // Full positive prompt
  const positive = [
    shotDescription,
    characterConditioning,
    sceneConditioning,
    styleLayer,
    qualityLayer,
  ].join('. ');

  // Layer 6: Negative prompt
  const negativeParts = [NEGATIVE_PROMPT_BASE];
  if (node.shot_type === 'close-up') {
    negativeParts.push('distorted face, asymmetric eyes, bad facial proportions');
  }
  if (node.characters.length > 1) {
    negativeParts.push('character blending, merged bodies, overlapping faces');
  }
  const negative = negativeParts.join(', ');

  return {
    positive,
    negative,
    layers: {
      shot_description: shotDescription,
      character_conditioning: characterConditioning,
      scene_conditioning: sceneConditioning,
      style_unification: styleLayer,
      quality_control: qualityLayer,
    },
  };
}

// ── Enforcement Verification ──────────────────────────────────────

async function verifyEnforcement(
  projectId: string,
  node: StoryboardNode,
): Promise<EnforcementReport> {
  const ipContexts = await resolveCharacterIPContext(projectId, node);
  const totalChars = ipContexts.length;
  const withIP = ipContexts.filter((c) => c.ip_adapter_id !== null).length;
  const missingIP = ipContexts.filter((c) => c.ip_adapter_id === null).map((c) => c.char_id);

  const sceneContext = await resolveSceneSeedContext(projectId, node);
  const seedLocked = sceneContext !== null && sceneContext.base_seed !== undefined;

  return {
    ip_adapter_injected: missingIP.length === 0,
    scene_seed_locked: seedLocked,
    ip_adapter_details: {
      total_characters: totalChars,
      with_ip_adapter: withIP,
      missing_ip_adapter: missingIP,
    },
    scene_seed_details: {
      scene_id: node.scene_id,
      seed_locked: seedLocked,
      reason: seedLocked ? undefined : 'No confirmed location with base_seed found for this scene',
    },
  };
}

// ── Service Factory ────────────────────────────────────────────────

export function createStoryboardImageService(
  options: StoryboardImageServiceOptions = {},
): StoryboardImageService {
  const db = options.prisma ?? prisma;
  const adapterPool = options.adapterPool;
  const storage = options.storage;
  const maxRefinementIterations = options.maxRefinementIterations ?? 3;

  async function ensureProject(projectId: string) {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');
    return project;
  }

  function getStoryboardNodes(project: { storyboard_nodes: unknown }, episodeId: string): StoryboardNodeWithImage[] {
    if (!project.storyboard_nodes) return [];
    const data = project.storyboard_nodes as Record<string, StoryboardNodeWithImage[]>;
    return data[episodeId] ?? [];
  }

  async function saveStoryboardNodes(
    projectId: string,
    episodeId: string,
    nodes: StoryboardNodeWithImage[],
  ): Promise<void> {
    const project = await ensureProject(projectId);
    const current = (project.storyboard_nodes as Record<string, unknown>) ?? {};
    const updated = { ...current, [episodeId]: nodes };
    await db.project.update({
      where: { id: projectId },
      data: { storyboard_nodes: updated as any, updated_at: new Date() },
    });
  }

  function validateEpisodeId(episodeId: string): void {
    if (!/^ep-\d+$/.test(episodeId)) {
      throw new Error('Invalid episode ID format. Expected: ep-{number}');
    }
  }

  // ── Generate single node image ──────────────────────────────────

  async function generateNodeImage(
    projectId: string,
    episodeId: string,
    nodeId: string,
    options: GenerateNodeImageOptions = {},
  ): Promise<NodeImageResult> {
    validateEpisodeId(episodeId);
    const project = await ensureProject(projectId);
    const nodes = getStoryboardNodes(project, episodeId);

    const nodeIndex = nodes.findIndex((n) => n.node_id === nodeId);
    if (nodeIndex === -1) {
      throw new Error(`Node ${nodeId} not found`);
    }

    let node = { ...nodes[nodeIndex] };

    // Skip if already completed unless force=true
    if (node.image_status === 'completed' && !options.force) {
      return {
        node_id: node.node_id,
        image_url: node.image_url || '',
        image_seed: node.image_seed || 0,
        image_prompt: node.image_prompt || '',
        image_negative_prompt: node.image_negative_prompt || '',
        refinement_iterations: node.refinement_iterations || 0,
        status: 'completed',
        latency_ms: 0,
      };
    }

    // Resolve contexts
    const ipContexts = await resolveCharacterIPContext(projectId, node);
    const sceneContext = await resolveSceneSeedContext(projectId, node);

    // Assemble prompt
    const prompt = await assemblePrompt(projectId, node, ipContexts, sceneContext);

    // Risk assessment
    const risk = assessNodeRisk(node);
    const maxRefinements = Math.min(risk.max_refinement_iterations, maxRefinementIterations);

    // Collect reference images from IP-Adapter contexts
    const referenceImages: string[] = [];
    for (const ctx of ipContexts) {
      referenceImages.push(...ctx.ref_image_urls);
    }

    // Determine seed
    const seed = sceneContext?.base_seed ?? 42;

    // Generate image (with refinement loop for high-risk nodes)
    const startTime = Date.now();
    let imageUrl = '';
    let imageSeed = seed;
    let iterations = 0;
    let finalStatus: 'completed' | 'needs_redo' = 'completed';

    if (adapterPool) {
      const imageConfig = getImageProviderConfig();
      const adapter = adapterPool.getImage(imageConfig.provider);

      for (let i = 0; i <= maxRefinements; i++) {
        iterations = i;
        try {
          const refinedPrompt = i === 0
            ? prompt.positive
            : `${prompt.positive}. [REFINEMENT PASS ${i}] Improve facial details, enhance composition, ensure character consistency.`;

          const result = await adapter.generateImage(
            {
              prompt: refinedPrompt,
              negativePrompt: prompt.negative,
              referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
              seed: seed + i,
              width: options.width ?? DEFAULT_WIDTH,
              height: options.height ?? DEFAULT_HEIGHT,
              stylePreset: options.style_preset,
            },
            imageConfig,
          );

          const storageKey = `storyboards/${projectId}/${episodeId}/${nodeId}-${Date.now()}.png`;
          imageUrl = await persistGeneratedImage(result.data.url, storageKey, storage, adapter.provider);
          imageSeed = result.data.seed;
          finalStatus = 'completed';
          break;
        } catch {
          if (i === maxRefinements) {
            finalStatus = 'needs_redo';
          }
        }
      }
    } else {
      // Fallback: mock result
      imageUrl = `https://mock-cdn.example.com/storyboard/${nodeId}-${seed}.png`;
      imageSeed = seed;
    }

    const latencyMs = Date.now() - startTime;

    // Update node with image data
    node = {
      ...node,
      image_url: imageUrl,
      image_seed: imageSeed,
      image_prompt: prompt.positive,
      image_negative_prompt: prompt.negative,
      image_status: finalStatus,
      refinement_iterations: iterations,
    } as StoryboardNodeWithImage;

    nodes[nodeIndex] = node;
    await saveStoryboardNodes(projectId, episodeId, nodes);

    return {
      node_id: node.node_id,
      image_url: imageUrl,
      image_seed: imageSeed,
      image_prompt: prompt.positive,
      image_negative_prompt: prompt.negative,
      refinement_iterations: iterations,
      status: finalStatus,
      latency_ms: latencyMs,
    };
  }

  // ── Batch generate ──────────────────────────────────────────────

  async function generateBatchImages(
    projectId: string,
    episodeId: string,
    options: GenerateNodeImageOptions = {},
  ): Promise<BatchGenerateResult> {
    validateEpisodeId(episodeId);
    const project = await ensureProject(projectId);
    const nodes = getStoryboardNodes(project, episodeId);

    if (nodes.length === 0) {
      throw new Error('No storyboard nodes found for this episode');
    }

    const results: NodeImageResult[] = [];
    let ipAdapterChecks = 0;
    let ipAdapterPasses = 0;
    let seedLockChecks = 0;
    let seedLockPasses = 0;

    for (const node of nodes) {
      try {
        // Track enforcement before generation
        const enforcement = await verifyEnforcement(projectId, node);
        ipAdapterChecks++;
        if (enforcement.ip_adapter_injected) ipAdapterPasses++;
        seedLockChecks++;
        if (enforcement.scene_seed_locked) seedLockPasses++;

        const result = await generateNodeImage(projectId, episodeId, node.node_id, options);
        results.push(result);
      } catch (err) {
        results.push({
          node_id: node.node_id,
          image_url: '',
          image_seed: 0,
          image_prompt: '',
          image_negative_prompt: '',
          refinement_iterations: 0,
          status: 'needs_redo',
          latency_ms: 0,
        });
      }
    }

    const completed = results.filter((r) => r.status === 'completed').length;
    const needsRedo = results.filter((r) => r.status === 'needs_redo').length;
    const failed = results.filter((r) => !r.image_url).length;

    return {
      results,
      summary: {
        total: results.length,
        completed,
        needs_redo: needsRedo,
        failed,
        ip_adapter_injection_rate: ipAdapterChecks > 0 ? Math.round((ipAdapterPasses / ipAdapterChecks) * 100) : 0,
        scene_seed_lock_rate: seedLockChecks > 0 ? Math.round((seedLockPasses / seedLockChecks) * 100) : 0,
      },
    };
  }

  // ── Review node image ───────────────────────────────────────────

  async function reviewNodeImage(
    projectId: string,
    episodeId: string,
    nodeId: string,
    input: ReviewNodeImageInput,
  ): Promise<StoryboardNodeWithImage> {
    validateEpisodeId(episodeId);
    const project = await ensureProject(projectId);
    const nodes = getStoryboardNodes(project, episodeId);

    const nodeIndex = nodes.findIndex((n) => n.node_id === nodeId);
    if (nodeIndex === -1) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const node = nodes[nodeIndex];

    if (!node.image_url || node.image_status === 'pending') {
      throw new Error('Node image has not been generated yet');
    }

    const review = {
      approved: input.approved,
      comment: input.comment,
      reviewed_at: new Date().toISOString(),
    };

    const updatedNode: StoryboardNodeWithImage = {
      ...node,
      image_review: review,
      image_status: input.approved ? 'completed' : 'needs_redo',
    };

    nodes[nodeIndex] = updatedNode;
    await saveStoryboardNodes(projectId, episodeId, nodes);

    return updatedNode;
  }

  return {
    generateNodeImage,
    generateBatchImages,
    reviewNodeImage,
    assemblePrompt: (projectId, node) =>
      resolveCharacterIPContext(projectId, node).then((ipContexts) =>
        resolveSceneSeedContext(projectId, node).then((sceneContext) =>
          assemblePrompt(projectId, node, ipContexts, sceneContext),
        ),
      ),
    assessNodeRisk,
    verifyEnforcement,
  };
}
