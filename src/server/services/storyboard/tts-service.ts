import { prisma } from '../../lib/db.js';
import type { AIModelInfo, SnapshotService } from '../snapshot/types.js';
import type {
  TtsService,
  TtsServiceOptions,
  TtsBatchResult,
  TtsNodeResult,
  TtsGenerateOptions,
  TtsReviewInput,
  StoryboardNode,
  AudioClip,
} from './types.js';

// ── Emotion Mapping ──────────────────────────────────────────────────

/**
 * Map Chinese emotion tags to English TTS emotion parameters.
 */
const EMOTION_MAP: Record<string, string> = {
  '开心的': 'happy',
  '悲伤的': 'sad',
  '愤怒的': 'angry',
  '平静的': 'neutral',
  '紧张的': 'nervous',
  '浪漫的': 'romantic',
  '悬疑的': 'suspenseful',
  '激动的': 'excited',
  '沉思的': 'contemplative',
  '恐惧的': 'fearful',
  '温柔的': 'gentle',
  '冷漠的': 'cold',
  // English short forms
  'happy': 'happy',
  'sad': 'sad',
  'angry': 'angry',
  'neutral': 'neutral',
  'nervous': 'nervous',
  'calm': 'neutral',
  'gentle': 'gentle',
  'contemplative': 'contemplative',
  'excited': 'excited',
  'romantic': 'romantic',
  'suspenseful': 'suspenseful',
  'fearful': 'fearful',
  'cold': 'cold',
};

// ── Speed Mapping ────────────────────────────────────────────────────

const SPEED_MAP: Record<string, number> = {
  normal: 1.0,
  fast: 1.15,
  slow: 0.85,
};

// ── Helper Functions ─────────────────────────────────────────────────

function mapEmotionToTts(emotionTag: string): string {
  return EMOTION_MAP[emotionTag] || EMOTION_MAP[emotionTag.replace('的', '')] || 'neutral';
}

function mapSpeedToTts(speed?: string | number): number {
  if (typeof speed === 'number') {
    return Math.max(0.8, Math.min(1.2, speed));
  }
  if (typeof speed === 'string') {
    return SPEED_MAP[speed.toLowerCase()] ?? 1.0;
  }
  return 1.0;
}

/**
 * Check if a node has dialogue that can be voiced.
 */
function nodeHasDialogue(node: StoryboardNode): boolean {
  return !!(node.dialogue && node.dialogue.text && node.dialogue.text.trim().length > 0);
}

// ── Service Factory ──────────────────────────────────────────────────

export function createTtsService(options: TtsServiceOptions): TtsService {
  const db = options.storyboardService;
  const characterService = options.characterService;
  const adapterPool = options.adapterPool;
  const snapshotService = options.snapshotService;
  const maxRetries = options.maxRetries ?? 2;

  /**
   * Resolve voice_id for a character by looking up the character bible.
   * Uses character name (char_id) to find matching character and derive voice_id.
   *
   * Guarantees: same character across the entire drama always uses the
   * same voice_id (100% compliance).
   */
  async function resolveVoiceId(
    projectId: string,
    charId: string,
    overrideVoiceId?: string,
  ): Promise<string> {
    // If explicitly provided, use it
    if (overrideVoiceId) return overrideVoiceId;

    // Try to find character in the character bible by name
    const { characters } = await characterService.listCharacters(projectId);

    // Match by exact name first
    const matched = characters.find((c) => c.name === charId);
    if (matched) {
      // Generate deterministic voice_id from character id (ensures consistency)
      return `voice-${matched.id}`;
    }

    // Fallback: generate deterministic voice from char name
    // Using a simple hash ensures same name → same voice_id
    let hash = 0;
    for (let i = 0; i < charId.length; i++) {
      hash = (hash << 5) - hash + charId.charCodeAt(i);
      hash |= 0;
    }
    return `voice-gen-${Math.abs(hash) % 10000}`;
  }

  function validateEpisodeId(episodeId: string): void {
    if (!/^ep-\d+$/.test(episodeId)) {
      throw new Error('Invalid episode ID format. Expected: ep-{number}');
    }
  }

  /**
   * Generate TTS audio for a single dialogue line.
   */
  async function generateTtsForDialogue(
    projectId: string,
    charId: string,
    text: string,
    emotionTag: string,
    options?: TtsGenerateOptions,
  ): Promise<{ url: string; duration: number; voiceId: string; emotion: string } | null> {
    const voiceId = await resolveVoiceId(projectId, charId, options?.voice_id);
    const emotion = options?.emotion ? mapEmotionToTts(options.emotion) : mapEmotionToTts(emotionTag);
    const speed = mapSpeedToTts(options?.speed);

    if (!adapterPool) {
      // Mock fallback when no adapter is configured
      return {
        url: `https://mock-cdn.example.com/tts/${voiceId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`,
        duration: Math.max(1, Math.ceil(text.length / 5)),
        voiceId,
        emotion,
      };
    }

    const adapter = adapterPool.getTTS(options?.provider ?? 'mock-tts');
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await adapter.generateSpeech(
          { text, voiceId, emotion, speed },
          { provider: options?.provider ?? 'mock-tts', model: 'tts-model' },
        );
        return {
          url: result.data.url,
          duration: result.data.duration,
          voiceId,
          emotion,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Continue to retry
      }
    }

    throw lastError ?? new Error('TTS generation failed after retries');
  }

  /**
   * Create a version snapshot for a node with audio clip.
   */
  async function snapshotNodeAudio(
    projectId: string,
    nodeId: string,
    node: StoryboardNode,
    aiModel?: AIModelInfo,
  ): Promise<void> {
    if (!snapshotService) return;
    await snapshotService.createSnapshot({
      entity: { projectId, entityType: 'node', entityId: nodeId },
      source: 'ai_generated',
      content: node as unknown as Record<string, unknown>,
      aiModel,
    });
  }

  // ── Public API ───────────────────────────────────────────────────

  return {
    async generateBatchTts(
      projectId: string,
      episodeId: string,
      options?: TtsGenerateOptions,
    ): Promise<TtsBatchResult> {
      validateEpisodeId(episodeId);
      const nodes = await db.getNodes(projectId, episodeId);

      if (nodes.length === 0) {
        throw new Error(`No storyboard nodes found for episode ${episodeId}. Split the script first.`);
      }

      const nodesWithDialogue: StoryboardNode[] = [];
      const nodesWithoutDialogue: TtsNodeResult[] = [];

      for (const node of nodes) {
        if (nodeHasDialogue(node)) {
          nodesWithDialogue.push(node);
        } else {
          nodesWithoutDialogue.push({
            node_id: node.node_id,
            audio_clip: null,
            skipped: true,
            skip_reason: 'No dialogue text in this node',
          });
        }
      }

      const results: TtsNodeResult[] = [...nodesWithoutDialogue];
      let nodesGenerated = 0;
      let nodesFailed = 0;

      const modelInfo: AIModelInfo = {
        provider: options?.provider ?? 'mock-tts',
        model: 'tts-model',
      };

      for (const node of nodesWithDialogue) {
        try {
          const dialogue = node.dialogue!;
          const generated = await generateTtsForDialogue(
            projectId,
            dialogue.char_id,
            dialogue.text,
            node.emotion_tag,
            options,
          );

          if (generated) {
            const audioClip: AudioClip = {
              url: generated.url,
              duration: generated.duration,
              voice_id: generated.voiceId,
              emotion: generated.emotion,
              speed: mapSpeedToTts(options?.speed),
              generated_at: new Date().toISOString(),
              status: 'generated',
            };

            // Update node with audio clip
            const updatedNode: StoryboardNode = {
              ...node,
              audio_clip: audioClip,
            };

            // Save
            const allNodes = await db.getNodes(projectId, episodeId);
            const nodeIndex = allNodes.findIndex((n) => n.node_id === node.node_id);
            if (nodeIndex >= 0) {
              allNodes[nodeIndex] = updatedNode;
              await db.updateNodes(projectId, episodeId, { nodes: allNodes });
            }

            // Create snapshot
            await snapshotNodeAudio(projectId, node.node_id, updatedNode, modelInfo);

            results.push({
              node_id: node.node_id,
              audio_clip: audioClip,
              skipped: false,
            });
            nodesGenerated++;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          results.push({
            node_id: node.node_id,
            audio_clip: null,
            skipped: false,
            error: errorMsg,
          });
          nodesFailed++;
        }
      }

      const totalNodes = nodes.length;
      const nodesWithDialogueCount = nodesWithDialogue.length;
      const nodesSkipped = nodesWithoutDialogue.length;
      const successRate = nodesWithDialogueCount > 0
        ? nodesGenerated / nodesWithDialogueCount
        : 1.0;

      return {
        episode_id: episodeId,
        total_nodes: totalNodes,
        nodes_with_dialogue: nodesWithDialogueCount,
        nodes_generated: nodesGenerated,
        nodes_skipped: nodesSkipped,
        nodes_failed: nodesFailed,
        success_rate: Math.round(successRate * 100) / 100,
        results,
      };
    },

    async generateNodeTts(
      projectId: string,
      episodeId: string,
      nodeId: string,
      options?: TtsGenerateOptions,
    ): Promise<TtsNodeResult> {
      validateEpisodeId(episodeId);
      const nodes = await db.getNodes(projectId, episodeId);
      const node = nodes.find((n) => n.node_id === nodeId);

      if (!node) {
        throw new Error(`Node ${nodeId} not found in episode ${episodeId}`);
      }

      if (!nodeHasDialogue(node)) {
        return {
          node_id: nodeId,
          audio_clip: null,
          skipped: true,
          skip_reason: 'No dialogue text in this node',
        };
      }

      const dialogue = node.dialogue!;
      const generated = await generateTtsForDialogue(
        projectId,
        dialogue.char_id,
        dialogue.text,
        node.emotion_tag,
        options,
      );

      if (!generated) {
        throw new Error('TTS generation returned no result');
      }

      const audioClip: AudioClip = {
        url: generated.url,
        duration: generated.duration,
        voice_id: generated.voiceId,
        emotion: generated.emotion,
        speed: mapSpeedToTts(options?.speed),
        generated_at: new Date().toISOString(),
        status: 'generated',
      };

      // Update node with audio clip
      const updatedNode: StoryboardNode = {
        ...node,
        audio_clip: audioClip,
      };

      const allNodes = await db.getNodes(projectId, episodeId);
      const nodeIndex = allNodes.findIndex((n) => n.node_id === nodeId);
      if (nodeIndex >= 0) {
        allNodes[nodeIndex] = updatedNode;
        await db.updateNodes(projectId, episodeId, { nodes: allNodes });
      }

      // Create snapshot
      const modelInfo: AIModelInfo = {
        provider: options?.provider ?? 'mock-tts',
        model: 'tts-model',
      };
      await snapshotNodeAudio(projectId, nodeId, updatedNode, modelInfo);

      return {
        node_id: nodeId,
        audio_clip: audioClip,
        skipped: false,
      };
    },

    async reviewNodeTts(
      projectId: string,
      episodeId: string,
      nodeId: string,
      input: TtsReviewInput,
    ): Promise<AudioClip> {
      validateEpisodeId(episodeId);
      const nodes = await db.getNodes(projectId, episodeId);
      const node = nodes.find((n) => n.node_id === nodeId);

      if (!node) {
        throw new Error(`Node ${nodeId} not found in episode ${episodeId}`);
      }

      if (!node.audio_clip || node.audio_clip.status === 'pending') {
        throw new Error(
          `Audio has not been generated for node ${nodeId}. Generate TTS first.`,
        );
      }

      const reviewedClip: AudioClip = {
        ...node.audio_clip,
        status: 'reviewed',
        reviewed: input.approved,
        reviewed_at: new Date().toISOString(),
        review_comment: input.comment,
      };

      // Update node with reviewed audio clip
      const updatedNode: StoryboardNode = {
        ...node,
        audio_clip: reviewedClip,
      };

      const allNodes = await db.getNodes(projectId, episodeId);
      const nodeIndex = allNodes.findIndex((n) => n.node_id === nodeId);
      if (nodeIndex >= 0) {
        allNodes[nodeIndex] = updatedNode;
        await db.updateNodes(projectId, episodeId, { nodes: allNodes });
      }

      return reviewedClip;
    },

    async uploadNodeTts(
      projectId: string,
      episodeId: string,
      nodeId: string,
      input: { url: string; duration: number },
    ): Promise<AudioClip> {
      validateEpisodeId(episodeId);
      const nodes = await db.getNodes(projectId, episodeId);
      const node = nodes.find((n) => n.node_id === nodeId);

      if (!node) {
        throw new Error(`Node ${nodeId} not found in episode ${episodeId}`);
      }

      const uploadedClip: AudioClip = {
        url: input.url,
        duration: input.duration,
        voice_id: 'user-uploaded',
        emotion: node.emotion_tag || 'neutral',
        speed: 1.0,
        generated_at: new Date().toISOString(),
        status: 'reviewed',
        reviewed: true,
        reviewed_at: new Date().toISOString(),
        review_comment: '手动上传录音文件',
      };

      const updatedNode: StoryboardNode = {
        ...node,
        audio_clip: uploadedClip,
      };

      const allNodes = await db.getNodes(projectId, episodeId);
      const nodeIndex = allNodes.findIndex((n) => n.node_id === nodeId);
      if (nodeIndex >= 0) {
        allNodes[nodeIndex] = updatedNode;
        await db.updateNodes(projectId, episodeId, { nodes: allNodes });
      }

      // Snapshot the user-edited replacement
      if (snapshotService) {
        await snapshotService.createSnapshot({
          entity: { projectId, entityType: 'node', entityId: nodeId },
          source: 'user_edited',
          content: updatedNode as unknown as Record<string, unknown>,
        });
      }

      return uploadedClip;
    },
  };
}
