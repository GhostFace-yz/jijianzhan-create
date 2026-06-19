import { Clock } from 'lucide-react';
import type { ScriptScene } from '../../types';

export interface DurationEstimateProps {
  scenes: ScriptScene[];
}

/**
 * Estimates the episode duration based on dialogue word count and scene count.
 * Formula: total_chars / 200 + scenes_count * 0.5 ≈ minutes
 */
export function DurationEstimate({ scenes }: DurationEstimateProps) {
  const totalChars = scenes.reduce((sum, scene) => {
    return (
      sum +
      scene.dialogues.reduce((charSum, d) => charSum + d.text.length, 0)
    );
  }, 0);

  const estimatedMinutes = totalChars / 200 + scenes.length * 0.5;
  const roundedMinutes = Math.round(estimatedMinutes * 10) / 10;

  return (
    <div className="rounded-xl border border-hairline bg-canvas shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-steel" />
          <h3 className="text-sm font-semibold text-ink">估算时长</h3>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-primary">{roundedMinutes}</span>
          <span className="ml-1 text-sm text-slate">分钟</span>
          <p className="mt-0.5 text-xs text-muted">
            {scenes.length} 个场景 · {totalChars} 字台词
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-hairline-soft">
        <p className="text-xs text-muted">
          估算公式：台词字数 / 200 + 场景数 × 0.5 ≈ 分钟
        </p>
      </div>
    </div>
  );
}
