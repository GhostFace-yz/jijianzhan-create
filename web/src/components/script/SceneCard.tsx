import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Edit3,
  RefreshCw,
  MapPin,
  Clock,
  Cloud,
  Users,
} from 'lucide-react';
import { Button } from '../ui/Button';
import type { ScriptScene } from '../../types';
import { DialogueEditor } from './DialogueEditor';

export interface SceneCardProps {
  scene: ScriptScene;
  index: number;
  onSceneUpdate: (index: number, updated: ScriptScene) => void;
  onRegenerateScene: (sceneId: string) => void;
  regenerating: string | null;
  disabled?: boolean;
}

/**
 * Collapsible scene card showing scene summary, beats, and dialogues.
 * Supports editing scene metadata and inline dialogue editing.
 */
export function SceneCard({
  scene,
  index,
  onSceneUpdate,
  onRegenerateScene,
  regenerating,
  disabled = false,
}: SceneCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState({
    scene_summary: scene.scene_summary,
    time_of_day: scene.time_of_day,
    weather: scene.weather,
  });

  const isRegenerating = regenerating === scene.scene_id;

  const handleStartMetaEdit = () => {
    setMetaDraft({
      scene_summary: scene.scene_summary,
      time_of_day: scene.time_of_day,
      weather: scene.weather,
    });
    setEditingMeta(true);
  };

  const handleSaveMeta = () => {
    const trimmed = {
      scene_summary: metaDraft.scene_summary.trim(),
      time_of_day: metaDraft.time_of_day.trim(),
      weather: metaDraft.weather.trim(),
    };
    if (
      trimmed.scene_summary !== scene.scene_summary ||
      trimmed.time_of_day !== scene.time_of_day ||
      trimmed.weather !== scene.weather
    ) {
      onSceneUpdate(index, { ...scene, ...trimmed });
    }
    setEditingMeta(false);
  };

  const handleCancelMeta = () => {
    setEditingMeta(false);
  };

  const handleDialogueSave = (dialogueIndex: number, updated: typeof scene.dialogues[number]) => {
    const newDialogues = [...scene.dialogues];
    newDialogues[dialogueIndex] = updated;
    onSceneUpdate(index, { ...scene, dialogues: newDialogues });
  };

  return (
    <div className="rounded-xl border border-hairline bg-canvas shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface/50 transition-colors"
      >
        <span className="shrink-0 text-steel">
          {expanded ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink">
              场景 {index + 1}
            </span>
            <span className="text-xs text-muted">·</span>
            <span className="text-sm text-slate truncate">
              {scene.scene_summary}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted flex-wrap">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {scene.location_id}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {scene.time_of_day}
            </span>
            <span className="inline-flex items-center gap-1">
              <Cloud className="h-3 w-3" />
              {scene.weather}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {scene.characters_present.length} 角色
            </span>
            <span className="text-xs">
              {scene.dialogues.length} 句台词
            </span>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-hairline-soft">
          {/* Scene metadata (editable) */}
          <div className="mt-4 space-y-3">
            {/* Scene summary */}
            <div>
              <label className="text-xs font-medium text-slate uppercase tracking-wider">
                场景摘要
              </label>
              {editingMeta ? (
                <div className="mt-1 flex items-start gap-2">
                  <textarea
                    value={metaDraft.scene_summary}
                    onChange={(e) =>
                      setMetaDraft({ ...metaDraft, scene_summary: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-hairline-strong bg-canvas p-2 text-sm text-ink resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                    rows={2}
                    autoFocus
                  />
                </div>
              ) : (
                <p
                  className={`mt-1 text-sm text-charcoal ${!disabled ? 'cursor-pointer rounded-lg hover:bg-surface/50 p-1 -m-1' : ''}`}
                  onClick={disabled ? undefined : handleStartMetaEdit}
                >
                  {scene.scene_summary}
                </p>
              )}
            </div>

            {/* Time & Weather row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate uppercase tracking-wider">
                  时间段
                </label>
                {editingMeta ? (
                  <input
                    value={metaDraft.time_of_day}
                    onChange={(e) =>
                      setMetaDraft({ ...metaDraft, time_of_day: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-hairline-strong bg-canvas px-2 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                ) : (
                  <p
                    className={`mt-1 text-sm text-charcoal ${!disabled ? 'cursor-pointer rounded-lg hover:bg-surface/50 p-1 -m-1' : ''}`}
                    onClick={disabled ? undefined : handleStartMetaEdit}
                  >
                    {scene.time_of_day}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate uppercase tracking-wider">
                  天气
                </label>
                {editingMeta ? (
                  <input
                    value={metaDraft.weather}
                    onChange={(e) =>
                      setMetaDraft({ ...metaDraft, weather: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-hairline-strong bg-canvas px-2 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                ) : (
                  <p
                    className={`mt-1 text-sm text-charcoal ${!disabled ? 'cursor-pointer rounded-lg hover:bg-surface/50 p-1 -m-1' : ''}`}
                    onClick={disabled ? undefined : handleStartMetaEdit}
                  >
                    {scene.weather}
                  </p>
                )}
              </div>
            </div>

            {/* Meta edit controls */}
            {editingMeta && (
              <div className="flex gap-2">
                <Button variant="primary" onClick={handleSaveMeta} className="gap-1 text-xs py-1 px-3">
                  <Edit3 className="h-3 w-3" />
                  保存
                </Button>
                <Button variant="ghost" onClick={handleCancelMeta} className="text-xs py-1 px-3">
                  取消
                </Button>
              </div>
            )}

            {!editingMeta && !disabled && (
              <button
                type="button"
                onClick={handleStartMetaEdit}
                className="inline-flex items-center gap-1 text-xs text-steel hover:text-ink"
              >
                <Edit3 className="h-3 w-3" />
                编辑场景信息
              </button>
            )}
          </div>

          {/* Characters present */}
          <div className="mt-4">
            <label className="text-xs font-medium text-slate uppercase tracking-wider">
              出场角色
            </label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {scene.characters_present.map((charId) => (
                <span
                  key={charId}
                  className="inline-flex items-center rounded-full bg-card-tint-sky px-2.5 py-0.5 text-xs text-charcoal"
                >
                  {charId}
                </span>
              ))}
            </div>
          </div>

          {/* Beats */}
          {scene.beats.length > 0 && (
            <div className="mt-4">
              <label className="text-xs font-medium text-slate uppercase tracking-wider">
                节奏点
              </label>
              <ol className="mt-1 space-y-1 list-decimal list-inside">
                {scene.beats.map((beat, i) => (
                  <li key={i} className="text-sm text-charcoal">
                    {beat}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Dialogues */}
          <div className="mt-4">
            <label className="text-xs font-medium text-slate uppercase tracking-wider">
              台词 ({scene.dialogues.length})
            </label>
            <div className="mt-2 rounded-lg border border-hairline-soft bg-surface-soft/50 p-4">
              {scene.dialogues.length === 0 ? (
                <p className="text-sm text-muted italic">暂无台词</p>
              ) : (
                scene.dialogues.map((dialogue, di) => (
                  <DialogueEditor
                    key={`${scene.scene_id}-dialogue-${di}`}
                    dialogue={dialogue}
                    index={di}
                    onSave={handleDialogueSave}
                    disabled={disabled}
                  />
                ))
              )}
            </div>
          </div>

          {/* Regenerate scene button */}
          {!disabled && (
            <div className="mt-4 pt-3 border-t border-hairline-soft flex justify-end">
              <Button
                variant="ghost"
                onClick={() => onRegenerateScene(scene.scene_id)}
                disabled={isRegenerating}
                className="gap-2 text-xs"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRegenerating ? 'animate-spin' : ''}`}
                />
                {isRegenerating ? '重新生成中...' : '重新生成此场景'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
