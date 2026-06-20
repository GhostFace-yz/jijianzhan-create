import type {
  RenderMixTrack,
  RenderSubtitleCue,
  RenderTransition,
} from '../../types.js';

export interface VideoSegment {
  url: string;
  duration: number;
  freezeExtend?: number;
}

export interface AudioClip {
  url: string;
  duration: number;
  startTime: number;
}

export interface ComposePlan {
  videoSegments: VideoSegment[];
  audioClips: AudioClip[];
  musicSegments: RenderMixTrack[];
  transitions: RenderTransition[];
  subtitleCues: RenderSubtitleCue[];
  resolution: string;
  fps: number;
  codec: string;
}

export interface ParsedResolution {
  width: number;
  height: number;
}

export function parseResolution(resolution: string): ParsedResolution {
  const [width, height] = resolution.split('x').map(Number);
  return { width, height };
}

/**
 * 计算冻结延伸后的视频总时长
 */
export function computeTotalDuration(segments: VideoSegment[]): number {
  return segments.reduce((sum, s) => sum + s.duration + (s.freezeExtend ?? 0), 0);
}

/**
 * 构建单段视频的 FFmpeg 滤镜链：统一缩放、填充、格式，以及冻结延伸
 */
export function buildSegmentFilter(
  segment: VideoSegment,
  resolution: ParsedResolution,
  fps: number,
): string {
  const targetDuration = segment.duration + (segment.freezeExtend ?? 0);
  const scale = `scale=${resolution.width}:${resolution.height}:force_original_aspect_ratio=decrease`;
  const pad = `pad=${resolution.width}:${resolution.height}:(ow-iw)/2:(oh-ih)/2`;
  const format = 'format=yuv420p';

  if (segment.freezeExtend && segment.freezeExtend > 0) {
    // loop 参数：loop=n:1:0 表示将第 0 帧循环 n 次
    const loopCount = Math.max(1, Math.round(segment.freezeExtend * fps));
    return `fps=${fps},${scale},${pad},${format},loop=loop=${loopCount}:size=1:start=0`;
  }

  return `fps=${fps},${scale},${pad},${format}`;
}

/**
 * 为 transitions 生成 xfade / fade 滤镜链
 * 返回可用于 filter_complex 的字符串片段
 */
export function buildTransitionFilter(
  transitions: RenderTransition[],
  segmentDurations: number[],
): string {
  if (transitions.length === 0) return '';

  const parts: string[] = [];

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    const offset = segmentDurations.slice(0, i + 1).reduce((a, b) => a + b, 0) - t.duration;

    switch (t.transition_type) {
      case 'cut':
        break;
      case 'dissolve':
        parts.push(
          `[v${i}][v${i + 1}]xfade=transition=fade:duration=${t.duration}:offset=${offset}[vt${i}]`,
        );
        break;
      case 'fade':
        parts.push(
          `[v${i}][v${i + 1}]xfade=transition=fade:duration=${t.duration}:offset=${offset}[vt${i}]`,
        );
        break;
      case 'black_fade':
        parts.push(
          `[v${i}][v${i + 1}]xfade=transition=fadeblack:duration=${t.duration}:offset=${offset}[vt${i}]`,
        );
        break;
      case 'white_flash':
        parts.push(
          `[v${i}][v${i + 1}]xfade=transition=fadewhite:duration=${t.duration}:offset=${offset}[vt${i}]`,
        );
        break;
      default:
        // exhaustive check
        const _exhaustive: never = t.transition_type;
        throw new Error(`Unsupported transition type: ${_exhaustive}`);
    }
  }

  return parts.join(';');
}

/**
 * 生成完整的视频 filter_complex 字符串
 */
export function buildVideoFilterComplex(
  segments: VideoSegment[],
  transitions: RenderTransition[],
  resolution: ParsedResolution,
  fps: number,
): string {
  const segmentDurations = segments.map((s) => s.duration + (s.freezeExtend ?? 0));
  const inputLabels: string[] = [];
  const pipeline: string[] = [];

  segments.forEach((segment, index) => {
    const filter = buildSegmentFilter(segment, resolution, fps);
    pipeline.push(`[${index}:v]${filter}[v${index}]`);
    inputLabels.push(`[v${index}]`);
  });

  const transitionFilter = buildTransitionFilter(transitions, segmentDurations);

  if (transitionFilter) {
    pipeline.push(transitionFilter);
    // 最终输出标签是最后一段或最后一个转场
    const lastTransitionIndex = transitions.length - 1;
    pipeline.push(`[vt${lastTransitionIndex}]format=yuv420p[video]`);
  } else {
    // 无转场时直接 concat
    if (segments.length > 1) {
      pipeline.push(`${inputLabels.join('')}concat=n=${segments.length}:v=1:a=0[video]`);
    } else {
      pipeline.push('[v0]format=yuv420p[video]');
    }
  }

  return pipeline.filter(Boolean).join(';');
}

/**
 * 构建音频混音 filter_complex
 */
export function buildAudioFilterComplex(
  audioClips: AudioClip[],
  musicSegments: RenderMixTrack[],
): string {
  const allTracks: Array<{ inputIndex: number; startTime: number; volume: number; duration: number } > = [];

  audioClips.forEach((clip, index) => {
    allTracks.push({
      inputIndex: index,
      startTime: clip.startTime,
      volume: 1.0,
      duration: clip.duration,
    });
  });

  musicSegments.forEach((segment, index) => {
    allTracks.push({
      inputIndex: audioClips.length + index,
      startTime: segment.start_time,
      volume: segment.volume,
      duration: segment.duration,
    });
  });

  if (allTracks.length === 0) {
    return '';
  }

  const parts: string[] = [];
  const inputCount = audioClips.length + musicSegments.length;

  for (let i = 0; i < inputCount; i++) {
    const volume = allTracks.find((t) => t.inputIndex === i)?.volume ?? 1.0;
    parts.push(`[${i}:a]volume=${volume},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${i}]`);
  }

  if (inputCount === 1) {
    parts.push('[a0]asetpts=PTS-STARTPTS[audio]');
  } else {
    const adelayTracks = allTracks.map((t) => {
      const delayMs = Math.round(t.startTime * 1000);
      return `[a${t.inputIndex}]adelay=delays=${delayMs}:${delayMs}:all=1[ad${t.inputIndex}]`;
    });
    parts.push(...adelayTracks);

    const mixInputs = allTracks.map((t) => `[ad${t.inputIndex}]`).join('');
    parts.push(`${mixInputs}amix=inputs=${allTracks.length}:duration=longest[audio]`);
  }

  return parts.join(';');
}

/**
 * 计算命令所需的总输入数（视频 + 音频）
 */
export function computeInputCount(plan: ComposePlan): number {
  return plan.videoSegments.length + plan.audioClips.length + plan.musicSegments.length;
}
