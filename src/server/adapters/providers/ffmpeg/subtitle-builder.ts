import type { RenderSubtitleCue } from '../../types.js';

export interface SubtitleStyle {
  style: 'white_with_black_border' | 'white' | 'black';
  position: 'bottom' | 'top';
  size: 'small' | 'medium' | 'large';
}

const DEFAULT_STYLE: SubtitleStyle = {
  style: 'white_with_black_border',
  position: 'bottom',
  size: 'medium',
};

function fontSize(size: SubtitleStyle['size']): number {
  switch (size) {
    case 'small':
      return 36;
    case 'large':
      return 64;
    case 'medium':
    default:
      return 48;
  }
}

function primaryColor(style: SubtitleStyle['style']): string {
  switch (style) {
    case 'white':
      return '&H00FFFFFF';
    case 'black':
      return '&H00000000';
    case 'white_with_black_border':
    default:
      return '&H00FFFFFF';
  }
}

function outlineColor(style: SubtitleStyle['style']): string {
  switch (style) {
    case 'white':
      return '&H00000000';
    case 'black':
      return '&H00FFFFFF';
    case 'white_with_black_border':
    default:
      return '&H00000000';
  }
}

function outlineWidth(style: SubtitleStyle['style']): number {
  return style === 'white_with_black_border' ? 2 : 1;
}

function alignment(position: SubtitleStyle['position']): number {
  // ASS alignment: 1=bottom-left, 2=bottom-center, 3=bottom-right,
  // 4=middle-left, 5=middle-center, 6=middle-right,
  // 7=top-left, 8=top-center, 9=top-right
  return position === 'top' ? 8 : 2;
}

export function buildAssSubtitles(
  cues: RenderSubtitleCue[],
  resolution: string,
  styleOverride?: Partial<SubtitleStyle>,
): string {
  const style: SubtitleStyle = { ...DEFAULT_STYLE, ...styleOverride };
  const [width, height] = resolution.split('x').map(Number);
  const fs = fontSize(style.size);
  const marginV = Math.round(height * 0.08);

  const header = `[Script Info]
Title: Render Subtitles
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fs},${primaryColor(style.style)},&H00FFFFFF,${outlineColor(style.style)},&H00000000,0,0,0,0,100,100,0,0,1,${outlineWidth(style.style)},0,${alignment(style.position)},10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines = cues.map((cue) => {
    const start = formatTime(cue.start_time);
    const end = formatTime(cue.end_time);
    const text = cue.text.replace(/\r?\n/g, '\\N');
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  });

  return header + lines.join('\n') + '\n';
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const cs = Math.round((secs % 1) * 100);
  const s = Math.floor(secs);
  return `${pad(hrs)}:${pad(mins)}:${pad(s)}.${pad(cs, 2)}`;
}

function pad(value: number, length = 2): string {
  return value.toString().padStart(length, '0');
}
