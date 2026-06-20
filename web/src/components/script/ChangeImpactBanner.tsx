import { AlertTriangle, Info } from 'lucide-react';
import type { EditImpact } from '../../types';

interface ChangeImpactBannerProps {
  impact: EditImpact | null;
  affectedScenes: number;
  totalScenes: number;
  onDismiss: () => void;
}

export function ChangeImpactBanner({
  impact,
  affectedScenes,
  totalScenes,
  onDismiss,
}: ChangeImpactBannerProps) {
  if (!impact) return null;

  const styles: Record<EditImpact, { bg: string; border: string; icon: string; text: string }> = {
    light: {
      bg: 'bg-card-tint-sky/50',
      border: 'border-hairline',
      icon: 'text-link-blue',
      text: 'text-charcoal',
    },
    medium: {
      bg: 'bg-card-tint-yellow/50',
      border: 'border-semantic-warning/20',
      icon: 'text-semantic-warning',
      text: 'text-charcoal',
    },
    deep: {
      bg: 'bg-card-tint-peach/50',
      border: 'border-semantic-error/20',
      icon: 'text-semantic-error',
      text: 'text-charcoal',
    },
  };

  const s = styles[impact];

  const messages: Record<EditImpact, string> = {
    light: '台词修改 — 仅影响当前台词文本，无需重新生成分镜',
    medium: `场景结构调整 — 影响 ${affectedScenes}/${totalScenes} 个场景，建议检查分镜节点`,
    deep: `深度修改 — 影响 ${affectedScenes}/${totalScenes} 个场景，分镜节点需重新生成`,
  };

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${s.bg} ${s.border} animate-in fade-in slide-in-from-top-2`}
    >
      {impact === 'deep' ? (
        <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${s.icon}`} />
      ) : (
        <Info className={`h-5 w-5 shrink-0 mt-0.5 ${s.icon}`} />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${s.text}`}>{messages[impact]}</p>
        {impact === 'deep' && (
          <p className="text-xs text-steel mt-1">
            确认脚本后请重新进入分镜节点化流程，确保分镜图与脚本一致
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-sm text-steel hover:text-ink transition-colors"
        aria-label="关闭提示"
      >
        ✕
      </button>
    </div>
  );
}
