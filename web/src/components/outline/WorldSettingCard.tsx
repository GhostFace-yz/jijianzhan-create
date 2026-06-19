import { Globe } from 'lucide-react';
import { EditableField } from '../EditableField';

export interface WorldSettingCardProps {
  worldSetting: string;
  mainConflict: string;
  onWorldSettingChange: (value: string) => void;
  onMainConflictChange: (value: string) => void;
  locked?: boolean;
}

/**
 * Displays and allows inline editing of the world setting (世界观) and main conflict (主要冲突).
 */
export function WorldSettingCard({
  worldSetting,
  mainConflict,
  onWorldSettingChange,
  onMainConflictChange,
  locked = false,
}: WorldSettingCardProps) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card-tint-sky">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink">世界观</h2>
          <p className="text-xs text-slate">故事背景与核心冲突</p>
        </div>
        {locked && (
          <span className="ml-auto text-xs text-semantic-warning font-medium">
            ⚠ 已锁定，修改可能影响下游
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="mb-1 text-sm font-medium text-charcoal">世界观设定</h3>
          <EditableField
            value={worldSetting}
            onSave={onWorldSettingChange}
            multiline
            placeholder="描述故事的世界背景、时代、规则体系..."
            textSize="text-sm"
            disabled={false}
            label="编辑世界观"
          />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium text-charcoal">主要冲突</h3>
          <EditableField
            value={mainConflict}
            onSave={onMainConflictChange}
            multiline
            placeholder="描述故事的核心冲突与矛盾..."
            textSize="text-sm"
            disabled={false}
            label="编辑主要冲突"
          />
        </div>
      </div>
    </div>
  );
}
