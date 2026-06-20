import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Clock,
  Cloud,
  Users,
  RefreshCw,
  MessageSquare,
  Pencil,
} from 'lucide-react';
import { EditableField } from '../EditableField';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  EMOTION_LABELS,
  TIME_OF_DAY_OPTIONS,
  WEATHER_OPTIONS,
  type Scene,
  type Dialogue,
} from '../../types';

interface SceneCardProps {
  scene: Scene;
  sceneIndex: number;
  locationName?: string;
  characterNames: Record<string, string>;
  onUpdateScene: (updated: Scene) => void;
  onRegenerateScene: (sceneId: string) => void;
  locked?: boolean;
  regenerating?: boolean;
  /** Called when any edit is made — for tracking change impact */
  onEditAction: (impact: 'light' | 'medium' | 'deep') => void;
}

export function SceneCard({
  scene,
  sceneIndex,
  locationName,
  characterNames,
  onUpdateScene,
  onRegenerateScene,
  locked = false,
  regenerating = false,
  onEditAction,
}: SceneCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingDialogueIndex, setEditingDialogueIndex] = useState<number | null>(null);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleUpdateScene = useCallback(
    (partial: Partial<Scene>) => {
      onUpdateScene({ ...scene, ...partial });
    },
    [scene, onUpdateScene],
  );

  const handleUpdateDialogue = useCallback(
    (index: number, partial: Partial<Dialogue>) => {
      const updated = [...scene.dialogues];
      updated[index] = { ...updated[index], ...partial };
      handleUpdateScene({ dialogues: updated });
    },
    [scene, handleUpdateScene],
  );

  const handleDialogueEdit = useCallback(
    (index: number, partial: Partial<Dialogue>) => {
      // Determine impact level
      if (partial.text !== undefined || partial.emotion !== undefined) {
        onEditAction('light');
      } else if (partial.char_id !== undefined) {
        onEditAction('medium');
      }
      handleUpdateDialogue(index, partial);
    },
    [handleUpdateDialogue, onEditAction],
  );

  const sceneNumber = sceneIndex + 1;

  return (
    <div className="rounded-xl border border-hairline bg-canvas shadow-sm overflow-hidden">
      {/* Scene header */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between p-5 hover:bg-surface-soft/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-card-tint-lavender shrink-0">
            <span className="text-sm font-semibold text-primary">{sceneNumber}</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink">
              场景 {sceneNumber}
              {locationName ? ` · ${locationName}` : scene.location_id ? ` · ${scene.location_id}` : ''}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs text-slate">
                <Clock className="h-3 w-3" />
                {scene.time_of_day}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate">
                <Cloud className="h-3 w-3" />
                {scene.weather}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate">
                <MessageSquare className="h-3 w-3" />
                {scene.dialogues.length} 句台词
              </span>
              {scene.characters_present.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-slate">
                  <Users className="h-3 w-3" />
                  {scene.characters_present.map((cid) => characterNames[cid] || cid).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-steel" />
          ) : (
            <ChevronRight className="h-5 w-5 text-steel" />
          )}
        </div>
      </button>

      {/* Collapsed preview */}
      {!expanded && scene.scene_summary && (
        <div className="px-5 pb-4">
          <p className="text-sm text-slate line-clamp-2">{scene.scene_summary}</p>
        </div>
      )}

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-hairline-soft pt-4">
          {/* Scene summary */}
          <div>
            <label className="text-xs font-medium text-steel uppercase tracking-wide mb-1 block">
              场景摘要
            </label>
            <EditableField
              value={scene.scene_summary}
              onSave={(v) => {
                onEditAction('medium');
                handleUpdateScene({ scene_summary: v });
              }}
              multiline
              textSize="text-sm"
              placeholder="输入场景摘要..."
              disabled={locked}
              label="编辑场景摘要"
            />
          </div>

          {/* Time of day & Weather */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-steel uppercase tracking-wide mb-1 block">
                时间段
              </label>
              {locked ? (
                <p className="text-sm text-ink">{scene.time_of_day}</p>
              ) : (
                <select
                  value={scene.time_of_day}
                  onChange={(e) => {
                    onEditAction('medium');
                    handleUpdateScene({ time_of_day: e.target.value });
                  }}
                  className="w-full rounded-lg border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {TIME_OF_DAY_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-steel uppercase tracking-wide mb-1 block">
                天气
              </label>
              {locked ? (
                <p className="text-sm text-ink">{scene.weather}</p>
              ) : (
                <select
                  value={scene.weather}
                  onChange={(e) => {
                    onEditAction('medium');
                    handleUpdateScene({ weather: e.target.value });
                  }}
                  className="w-full rounded-lg border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {WEATHER_OPTIONS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Beats */}
          {scene.beats.length > 0 && (
            <div>
              <label className="text-xs font-medium text-steel uppercase tracking-wide mb-2 block">
                节拍 ({scene.beats.length})
              </label>
              <div className="space-y-1.5">
                {scene.beats.map((beat, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs font-medium text-muted mt-0.5 shrink-0">
                      {i + 1}.
                    </span>
                    <EditableField
                      value={beat}
                      onSave={(v) => {
                        onEditAction('medium');
                        const updatedBeats = [...scene.beats];
                        updatedBeats[i] = v;
                        handleUpdateScene({ beats: updatedBeats });
                      }}
                      textSize="text-sm"
                      placeholder="节拍描述..."
                      disabled={locked}
                      label="编辑节拍"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dialogues */}
          <div>
            <label className="text-xs font-medium text-steel uppercase tracking-wide mb-2 block">
              台词 ({scene.dialogues.length})
            </label>
            {scene.dialogues.length === 0 ? (
              <p className="text-sm text-muted italic py-3">暂无台词</p>
            ) : (
              <div className="divide-y divide-hairline-soft rounded-lg border border-hairline bg-surface-soft/50">
                {scene.dialogues.map((dialogue, i) => (
                  <DialogueRow
                    key={i}
                    dialogue={dialogue}
                    index={i}
                    characterName={characterNames[dialogue.char_id] || dialogue.char_id}
                    editing={editingDialogueIndex === i}
                    onEditStart={() => setEditingDialogueIndex(i)}
                    onEditEnd={() => setEditingDialogueIndex(null)}
                    onUpdate={(partial) => handleDialogueEdit(i, partial)}
                    locked={locked}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Characters present */}
          <div>
            <label className="text-xs font-medium text-steel uppercase tracking-wide mb-1 block">
              出场角色
            </label>
            <p className="text-sm text-ink">
              {scene.characters_present.map((cid) => characterNames[cid] || cid).join('、') || '无'}
            </p>
          </div>

          {/* Regenerate scene button */}
          {!locked && (
            <div className="pt-2 flex justify-end">
              <Button
                variant="ghost"
                onClick={() => onRegenerateScene(scene.scene_id)}
                disabled={regenerating}
                className="gap-2 text-semantic-warning hover:text-semantic-warning"
              >
                <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
                {regenerating ? '重新生成中...' : '重新生成此场景'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Single dialogue row — inline editable */
interface DialogueRowProps {
  dialogue: Dialogue;
  index: number;
  characterName: string;
  editing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
  onUpdate: (partial: Partial<Dialogue>) => void;
  locked: boolean;
}

function DialogueRow({
  dialogue,
  index,
  characterName,
  editing,
  onEditStart,
  onEditEnd,
  onUpdate,
  locked,
}: DialogueRowProps) {
  const emotionLabel = EMOTION_LABELS[dialogue.emotion] || dialogue.emotion;

  if (editing && !locked) {
    return (
      <div className="p-3 bg-card-tint-yellow/30">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted w-6">{index + 1}</span>
            <input
              value={dialogue.char_id}
              onChange={(e) => onUpdate({ char_id: e.target.value })}
              className="flex-1 rounded border border-hairline-strong bg-canvas px-2 py-1 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="角色 ID"
            />
            <input
              value={dialogue.emotion}
              onChange={(e) => onUpdate({ emotion: e.target.value })}
              className="w-24 rounded border border-hairline-strong bg-canvas px-2 py-1 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="情绪"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onEditEnd}
                className="rounded p-1 text-semantic-success hover:bg-semantic-success/10 text-xs"
              >
                完成
              </button>
            </div>
          </div>
          <textarea
            value={dialogue.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            className="w-full rounded border border-hairline-strong bg-canvas px-2 py-1 text-sm text-ink resize-y min-h-[40px] focus:outline-none focus:ring-1 focus:ring-primary/30"
            rows={2}
          />
          <input
            value={dialogue.note || ''}
            onChange={(e) => onUpdate({ note: e.target.value || null })}
            className="w-full rounded border border-hairline-soft bg-surface-soft px-2 py-1 text-xs text-slate focus:outline-none focus:ring-1 focus:ring-primary/30"
            placeholder="备注（可选）"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-3 flex items-start gap-3 group transition-colors ${
        locked ? '' : 'cursor-pointer hover:bg-card-tint-yellow/10'
      }`}
      onClick={() => {
        if (!locked) onEditStart();
      }}
      role={locked ? undefined : 'button'}
      tabIndex={locked ? undefined : 0}
      onKeyDown={(e) => {
        if (!locked && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onEditStart();
        }
      }}
    >
      <span className="text-xs font-semibold text-muted mt-0.5 w-6 shrink-0">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-ink">{characterName}</span>
          <Badge variant="tag-purple">{emotionLabel}</Badge>
          {dialogue.note && (
            <span className="text-xs text-steel truncate">{dialogue.note}</span>
          )}
        </div>
        <p className="text-sm text-charcoal leading-relaxed">{dialogue.text}</p>
      </div>
      {!locked && (
        <button
          type="button"
          className="shrink-0 mt-0.5 rounded p-1 text-steel opacity-0 group-hover:opacity-100 hover:text-ink transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onEditStart();
          }}
          aria-label="编辑台词"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
