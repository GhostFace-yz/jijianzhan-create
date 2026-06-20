import { describe, it, expect } from 'vitest';
import type { StoryboardNode } from '../../src/server/services/storyboard/types.js';
import {
  nodeHasDialogue,
  validatePrerequisites,
  determineTransition,
  buildSubtitleCues,
  buildAudioMixPlan,
} from '../../src/server/services/render/render-service.js';

function createBaseNode(overrides: Partial<StoryboardNode> = {}): StoryboardNode {
  return {
    node_id: 'ep01-n001',
    scene_id: 's1',
    scene_variant: '白天-晴',
    characters: [],
    shot_type: 'wide-shot',
    camera_move: 'static',
    visual_desc: '城市全景',
    dialogue: null,
    emotion_tag: '平静的',
    music_mood: '舒缓',
    duration_target: 6,
    transition_in: 'cut',
    transition_out: 'cut',
    status: 'completed',
    version_history: [],
    video_clip: {
      url: 'https://mock-cdn.example.com/video/1.mp4',
      duration: 6,
      camera_move: 'none',
      motion_description: 'static shot',
      generated_at: new Date().toISOString(),
      status: 'generated',
      quality_report: {
        actual_duration: 6,
        target_duration: 6,
        duration_ok: true,
        face_corruption_detected: false,
        motion_jump_detected: false,
        passed: true,
        details: ['ok'],
      },
      provider: 'mock-video',
      model: 'video-model',
      fallback_used: false,
    },
    ...overrides,
  };
}

describe('render service helpers', () => {
  // ── nodeHasDialogue ───────────────────────────────────────────────

  describe('nodeHasDialogue', () => {
    it('returns true when dialogue text is present', () => {
      const node = createBaseNode({
        dialogue: { char_id: '主角', text: '你好', emotion: '开心的' },
      });
      expect(nodeHasDialogue(node)).toBe(true);
    });

    it('returns false when dialogue is null', () => {
      const node = createBaseNode({ dialogue: null });
      expect(nodeHasDialogue(node)).toBe(false);
    });

    it('returns false when dialogue text is empty', () => {
      const node = createBaseNode({
        dialogue: { char_id: '主角', text: '   ', emotion: '开心的' },
      });
      expect(nodeHasDialogue(node)).toBe(false);
    });
  });

  // ── validatePrerequisites ─────────────────────────────────────────

  describe('validatePrerequisites', () => {
    it('passes when all nodes have generated video clips', () => {
      const nodes = [createBaseNode()];
      expect(() => validatePrerequisites(nodes)).not.toThrow();
    });

    it('throws when nodes array is empty', () => {
      expect(() => validatePrerequisites([])).toThrow('No storyboard nodes');
    });

    it('throws when a node is missing video clip', () => {
      const node = createBaseNode({ video_clip: undefined });
      expect(() => validatePrerequisites([node])).toThrow('Video clips have not been generated');
    });

    it('throws when a node video clip is pending', () => {
      const node = createBaseNode({
        video_clip: {
          ...createBaseNode().video_clip!,
          status: 'pending',
        },
      });
      expect(() => validatePrerequisites([node])).toThrow('still pending');
    });
  });

  // ── determineTransition ───────────────────────────────────────────

  describe('determineTransition', () => {
    it('uses cut for same scene and same variant', () => {
      const prev = createBaseNode({ node_id: 'n1', scene_id: 's1', scene_variant: 'v1' });
      const next = createBaseNode({ node_id: 'n2', scene_id: 's1', scene_variant: 'v1' });
      const result = determineTransition(prev, next, {});
      expect(result.transition_type).toBe('cut');
      expect(result.duration).toBe(0);
    });

    it('uses dissolve for same scene but different variant', () => {
      const prev = createBaseNode({ node_id: 'n1', scene_id: 's1', scene_variant: 'v1' });
      const next = createBaseNode({ node_id: 'n2', scene_id: 's1', scene_variant: 'v2' });
      const result = determineTransition(prev, next, {});
      expect(result.transition_type).toBe('dissolve');
      expect(result.duration).toBe(0.3);
    });

    it('uses fade for different scenes by default', () => {
      const prev = createBaseNode({ node_id: 'n1', scene_id: 's1' });
      const next = createBaseNode({ node_id: 'n2', scene_id: 's2' });
      const result = determineTransition(prev, next, {});
      expect(result.transition_type).toBe('fade');
      expect(result.duration).toBe(0.5);
    });

    it('uses cut for different scenes when match_frame marker present', () => {
      const prev = createBaseNode({ node_id: 'n1', scene_id: 's1', visual_desc: 'match_frame city' });
      const next = createBaseNode({ node_id: 'n2', scene_id: 's2' });
      const result = determineTransition(prev, next, {});
      expect(result.transition_type).toBe('cut');
    });

    it('uses white_flash for strong emotion transition when specified', () => {
      const prev = createBaseNode({
        node_id: 'n1',
        emotion_tag: 'flashback',
        scene_id: 's1',
        scene_variant: 'v1',
      });
      const next = createBaseNode({ node_id: 'n2', scene_id: 's1', scene_variant: 'v1' });
      const result = determineTransition(prev, next, { strong_emotion_transition: 'white_flash' });
      expect(result.transition_type).toBe('white_flash');
      expect(result.duration).toBe(0.1);
    });

    it('uses black_fade for strong emotion transition when specified', () => {
      const prev = createBaseNode({
        node_id: 'n1',
        visual_desc: 'time_jump scene',
        scene_id: 's1',
        scene_variant: 'v1',
      });
      const next = createBaseNode({ node_id: 'n2', scene_id: 's1', scene_variant: 'v1' });
      const result = determineTransition(prev, next, { strong_emotion_transition: 'black_fade' });
      expect(result.transition_type).toBe('black_fade');
      expect(result.duration).toBe(0.3);
    });
  });

  // ── buildSubtitleCues ─────────────────────────────────────────────

  describe('buildSubtitleCues', () => {
    it('creates cues aligned with audio clip duration', () => {
      const nodes: StoryboardNode[] = [
        createBaseNode({
          node_id: 'n1',
          dialogue: { char_id: '主角', text: '第一句', emotion: '开心的' },
          audio_clip: {
            url: 'https://mock-cdn.example.com/tts/1.mp3',
            duration: 2.5,
            voice_id: 'voice-1',
            emotion: 'happy',
            speed: 1,
            generated_at: new Date().toISOString(),
            status: 'generated',
          },
          video_clip: { ...createBaseNode().video_clip!, duration: 6 },
        }),
        createBaseNode({
          node_id: 'n2',
          dialogue: { char_id: '主角', text: '第二句', emotion: '平静的' },
          audio_clip: {
            url: 'https://mock-cdn.example.com/tts/2.mp3',
            duration: 3.0,
            voice_id: 'voice-1',
            emotion: 'neutral',
            speed: 1,
            generated_at: new Date().toISOString(),
            status: 'generated',
          },
          video_clip: { ...createBaseNode().video_clip!, duration: 5 },
        }),
      ];

      const cues = buildSubtitleCues(nodes);
      expect(cues).toHaveLength(2);
      expect(cues[0].start_time).toBe(0);
      expect(cues[0].end_time).toBe(2.5);
      expect(cues[0].text).toBe('第一句');
      expect(cues[1].start_time).toBe(6);
      expect(cues[1].end_time).toBe(9);
      expect(cues[1].text).toBe('第二句');
    });

    it('aligns subtitle error within 0.3 seconds', () => {
      const nodes: StoryboardNode[] = [
        createBaseNode({
          node_id: 'n1',
          dialogue: { char_id: '主角', text: '短', emotion: '开心的' },
          audio_clip: {
            url: 'https://mock-cdn.example.com/tts/1.mp3',
            duration: 1.23,
            voice_id: 'voice-1',
            emotion: 'happy',
            speed: 1,
            generated_at: new Date().toISOString(),
            status: 'generated',
          },
        }),
      ];

      const cues = buildSubtitleCues(nodes);
      expect(cues[0].end_time - cues[0].start_time).toBe(1.23);
      expect(cues[0].end_time - cues[0].start_time).toBeLessThanOrEqual(1.53);
    });

    it('skips nodes without dialogue', () => {
      const nodes: StoryboardNode[] = [
        createBaseNode({ node_id: 'n1', dialogue: null }),
        createBaseNode({
          node_id: 'n2',
          dialogue: { char_id: '主角', text: '台词', emotion: '开心的' },
          audio_clip: {
            url: 'https://mock-cdn.example.com/tts/1.mp3',
            duration: 2,
            voice_id: 'voice-1',
            emotion: 'happy',
            speed: 1,
            generated_at: new Date().toISOString(),
            status: 'generated',
          },
        }),
      ];

      const cues = buildSubtitleCues(nodes);
      expect(cues).toHaveLength(1);
      expect(cues[0].node_id).toBe('n2');
    });
  });

  // ── buildAudioMixPlan ─────────────────────────────────────────────

  describe('buildAudioMixPlan', () => {
    it('ducks music during dialogue nodes', () => {
      const nodes: StoryboardNode[] = [
        createBaseNode({
          node_id: 'n1',
          dialogue: { char_id: '主角', text: '你好', emotion: '开心的' },
          duration_target: 6,
        }),
      ];
      const segments = [
        {
          node_id: 'n1',
          start_time: 0,
          duration: 6,
          url: 'https://mock-cdn.example.com/music/1.mp3',
          volume: 0.25,
          ducked: true,
          crossfade_in: 0,
          crossfade_out: 0,
        },
      ];

      const plan = buildAudioMixPlan(nodes, segments, {});
      expect(plan.musicTracks[0].volume).toBe(0.3);
      expect(plan.dialogueTracks).toHaveLength(0); // no audio_clip in node
    });

    it('raises music volume for non-dialogue nodes', () => {
      const nodes: StoryboardNode[] = [
        createBaseNode({ node_id: 'n1', dialogue: null, duration_target: 5 }),
      ];
      const segments = [
        {
          node_id: 'n1',
          start_time: 0,
          duration: 5,
          url: 'https://mock-cdn.example.com/music/1.mp3',
          volume: 0.9,
          ducked: false,
          crossfade_in: 0,
          crossfade_out: 0,
        },
      ];

      const plan = buildAudioMixPlan(nodes, segments, {});
      expect(plan.musicTracks[0].volume).toBe(0.8);
    });

    it('uses custom duck values when provided', () => {
      const nodes: StoryboardNode[] = [
        createBaseNode({
          node_id: 'n1',
          dialogue: { char_id: '主角', text: '你好', emotion: '开心的' },
          duration_target: 6,
        }),
        createBaseNode({ node_id: 'n2', dialogue: null, duration_target: 5 }),
      ];
      const segments = [
        {
          node_id: 'n1',
          start_time: 0,
          duration: 6,
          url: 'https://mock-cdn.example.com/music/1.mp3',
          volume: 0.25,
          ducked: true,
          crossfade_in: 0,
          crossfade_out: 0,
        },
        {
          node_id: 'n2',
          start_time: 6,
          duration: 5,
          url: 'https://mock-cdn.example.com/music/1.mp3',
          volume: 0.9,
          ducked: false,
          crossfade_in: 0,
          crossfade_out: 0,
        },
      ];

      const plan = buildAudioMixPlan(nodes, segments, {
        music_duck_dialogue: 0.25,
        music_duck_nondialogue: 0.85,
      });
      expect(plan.musicTracks[0].volume).toBe(0.25);
      expect(plan.musicTracks[1].volume).toBe(0.85);
    });
  });
});
