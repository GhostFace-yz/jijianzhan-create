import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildAssSubtitles } from '../../src/server/adapters/providers/ffmpeg/subtitle-builder.js';
import {
  buildAudioFilterComplex,
  buildSegmentFilter,
  buildTransitionFilter,
  buildVideoFilterComplex,
  computeTotalDuration,
  parseResolution,
} from '../../src/server/adapters/providers/ffmpeg/command-builder.js';

describe('ffmpeg command builders', () => {
  describe('parseResolution', () => {
    it('parses 1080x1920', () => {
      expect(parseResolution('1080x1920')).toEqual({ width: 1080, height: 1920 });
    });

    it('parses 1920x1080', () => {
      expect(parseResolution('1920x1080')).toEqual({ width: 1920, height: 1080 });
    });
  });

  describe('computeTotalDuration', () => {
    it('sums duration and freeze extend', () => {
      const segments = [
        { url: 'a.mp4', duration: 6 },
        { url: 'b.mp4', duration: 4, freezeExtend: 1 },
      ];
      expect(computeTotalDuration(segments)).toBe(11);
    });
  });

  describe('buildSegmentFilter', () => {
    it('builds basic filter without freeze', () => {
      const filter = buildSegmentFilter({ url: 'a.mp4', duration: 6 }, { width: 1080, height: 1920 }, 30);
      expect(filter).toContain('fps=30');
      expect(filter).toContain('scale=1080:1920');
      expect(filter).toContain('pad=1080:1920');
      expect(filter).not.toContain('loop=');
    });

    it('adds loop filter for freeze extend', () => {
      const filter = buildSegmentFilter(
        { url: 'a.mp4', duration: 4, freezeExtend: 1 },
        { width: 1080, height: 1920 },
        30,
      );
      expect(filter).toContain('loop=');
      expect(filter).toContain('loop=30');
    });
  });

  describe('buildTransitionFilter', () => {
    it('returns empty for cut transitions', () => {
      const filter = buildTransitionFilter(
        [{ from_node_id: 'n1', to_node_id: 'n2', transition_type: 'cut', duration: 0 }],
        [6, 5],
      );
      expect(filter).toBe('');
    });

    it('builds dissolve xfade filter', () => {
      const filter = buildTransitionFilter(
        [{ from_node_id: 'n1', to_node_id: 'n2', transition_type: 'dissolve', duration: 0.3 }],
        [6, 5],
      );
      expect(filter).toContain('xfade=transition=fade');
      expect(filter).toContain('duration=0.3');
      expect(filter).toContain('offset=5.7');
    });

    it('builds white_flash xfade filter', () => {
      const filter = buildTransitionFilter(
        [{ from_node_id: 'n1', to_node_id: 'n2', transition_type: 'white_flash', duration: 0.1 }],
        [6, 5],
      );
      expect(filter).toContain('xfade=transition=fadewhite');
    });

    it('builds black_fade xfade filter', () => {
      const filter = buildTransitionFilter(
        [{ from_node_id: 'n1', to_node_id: 'n2', transition_type: 'black_fade', duration: 0.3 }],
        [6, 5],
      );
      expect(filter).toContain('xfade=transition=fadeblack');
    });
  });

  describe('buildVideoFilterComplex', () => {
    it('builds concat filter for segments without transitions', () => {
      const filter = buildVideoFilterComplex(
        [
          { url: 'a.mp4', duration: 6 },
          { url: 'b.mp4', duration: 5 },
        ],
        [],
        { width: 1080, height: 1920 },
        30,
      );
      expect(filter).toContain('[v0]');
      expect(filter).toContain('[v1]');
      expect(filter).toContain('concat=n=2:v=1:a=0[video]');
    });

    it('builds transition pipeline', () => {
      const filter = buildVideoFilterComplex(
        [
          { url: 'a.mp4', duration: 6 },
          { url: 'b.mp4', duration: 5 },
        ],
        [{ from_node_id: 'n1', to_node_id: 'n2', transition_type: 'dissolve', duration: 0.3 }],
        { width: 1080, height: 1920 },
        30,
      );
      expect(filter).toContain('[v0][v1]xfade');
      expect(filter).toContain('[vt0]format=yuv420p[video]');
    });
  });

  describe('buildAudioFilterComplex', () => {
    it('builds single dialogue track filter', () => {
      const filter = buildAudioFilterComplex(
        [{ url: 'd.mp3', duration: 2, startTime: 0 }],
        [],
      );
      expect(filter).toContain('[0:a]volume=1');
      expect(filter).toContain('asetpts=PTS-STARTPTS[audio]');
    });

    it('builds mix with ducking', () => {
      const filter = buildAudioFilterComplex(
        [{ url: 'd.mp3', duration: 2, startTime: 0 }],
        [{ url: 'm.mp3', start_time: 0, duration: 5, volume: 0.3 }],
      );
      expect(filter).toContain('[0:a]volume=1');
      expect(filter).toContain('[1:a]volume=0.3');
      expect(filter).toContain('amix=inputs=2');
    });

    it('applies adelay for staggered tracks', () => {
      const filter = buildAudioFilterComplex(
        [{ url: 'd.mp3', duration: 2, startTime: 1 }],
        [{ url: 'm.mp3', start_time: 0, duration: 5, volume: 0.3 }],
      );
      expect(filter).toContain('adelay=delays=1000');
    });
  });

  describe('buildAssSubtitles', () => {
    it('generates valid ASS header', () => {
      const ass = buildAssSubtitles(
        [{ start_time: 0, end_time: 2, text: '你好', node_id: 'n1' }],
        '1080x1920',
      );
      expect(ass).toContain('[Script Info]');
      expect(ass).toContain('PlayResX: 1080');
      expect(ass).toContain('PlayResY: 1920');
      expect(ass).toContain('Style: Default');
    });

    it('formats dialogue lines', () => {
      const ass = buildAssSubtitles(
        [
          { start_time: 1.5, end_time: 3.75, text: '第一句', node_id: 'n1' },
          { start_time: 5, end_time: 7, text: '第二句', node_id: 'n2' },
        ],
        '1080x1920',
      );
      expect(ass).toContain('Dialogue: 0,00:00:01.50,00:00:03.75,Default');
      expect(ass).toContain('第一句');
      expect(ass).toContain('第二句');
    });

    it('uses bottom alignment by default', () => {
      const ass = buildAssSubtitles([], '1080x1920');
      const styleLine = ass.split('\n').find((line) => line.startsWith('Style: Default'));
      expect(styleLine).toContain(',2,');
    });

    it('uses top alignment when requested', () => {
      const ass = buildAssSubtitles([], '1080x1920', { position: 'top' });
      const styleLine = ass.split('\n').find((line) => line.startsWith('Style: Default'));
      expect(styleLine).toContain(',8,');
    });
  });
});
