import { useState } from 'react';
import { Film, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { EditableField } from '../EditableField';
import type { OutlineEpisode } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface EpisodesTimelineProps {
  episodes: OutlineEpisode[];
  onEpisodeChange: (index: number, episode: OutlineEpisode) => void;
  onRegenerateEpisode: (episodeNumber: number) => void;
  locked?: boolean;
  regenerating?: number | null;
}

/**
 * Horizontal timeline of episode cards.
 * Click to expand details and edit or regenerate a single episode.
 */
export function EpisodesTimeline({
  episodes,
  onEpisodeChange,
  onRegenerateEpisode,
  locked = false,
  regenerating = null,
}: EpisodesTimelineProps) {
  const [expandedEpisode, setExpandedEpisode] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card-tint-yellow">
          <Film className="h-5 w-5 text-brand-orange" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink">集数时间轴</h2>
          <p className="text-xs text-slate">共 {episodes.length} 集</p>
        </div>
      </div>

      {episodes.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">暂无集数数据</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 snap-x snap-mandatory">
          {episodes.map((ep, index) => (
            <div
              key={ep.episode_number}
              className={`snap-start shrink-0 w-[280px] rounded-lg border transition-all ${
                expandedEpisode === ep.episode_number
                  ? 'border-primary/30 bg-surface shadow-sm'
                  : 'border-hairline-soft bg-surface-soft hover:border-hairline'
              }`}
            >
              {/* Card header — always visible */}
              <button
                type="button"
                className="flex w-full items-center gap-3 p-4 text-left"
                onClick={() =>
                  setExpandedEpisode(
                    expandedEpisode === ep.episode_number ? null : ep.episode_number
                  )
                }
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card-tint-yellow-bold text-sm font-bold text-charcoal">
                  {ep.episode_number}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-ink line-clamp-1">{ep.title}</h3>
                  <p className="text-xs text-slate line-clamp-1">{ep.summary || '暂无摘要'}</p>
                </div>
                {expandedEpisode === ep.episode_number ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-steel" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-steel" />
                )}
              </button>

              {/* Expanded detail */}
              {expandedEpisode === ep.episode_number && (
                <div className="border-t border-hairline-soft px-4 pb-4 pt-3 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-charcoal">标题</label>
                    <EditableField
                      value={ep.title}
                      onSave={(title) => onEpisodeChange(index, { ...ep, title })}
                      placeholder="单集标题"
                      textSize="text-sm"
                      disabled={locked}
                      label="编辑标题"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-charcoal">摘要</label>
                    <EditableField
                      value={ep.summary}
                      onSave={(summary) => onEpisodeChange(index, { ...ep, summary })}
                      multiline
                      placeholder="单集内容摘要..."
                      textSize="text-sm"
                      disabled={locked}
                      label="编辑摘要"
                    />
                  </div>

                  {/* Key events */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-charcoal">
                      关键事件
                    </label>
                    <EventTags
                      items={ep.key_events}
                      onChange={(key_events) =>
                        onEpisodeChange(index, { ...ep, key_events })
                      }
                      locked={locked}
                      addLabel="添加事件"
                    />
                  </div>

                  {/* Featured characters */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-charcoal">
                      出场角色
                    </label>
                    <EventTags
                      items={ep.featured_characters}
                      onChange={(featured_characters) =>
                        onEpisodeChange(index, { ...ep, featured_characters })
                      }
                      locked={locked}
                      addLabel="添加角色"
                    />
                  </div>

                  {/* Featured locations */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-charcoal">
                      出场场景
                    </label>
                    <EventTags
                      items={ep.featured_locations}
                      onChange={(featured_locations) =>
                        onEpisodeChange(index, { ...ep, featured_locations })
                      }
                      locked={locked}
                      addLabel="添加场景"
                    />
                  </div>

                  {!locked && (
                    <Button
                      variant="secondary"
                      className="w-full gap-2"
                      disabled={regenerating === ep.episode_number}
                      onClick={() => onRegenerateEpisode(ep.episode_number)}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${regenerating === ep.episode_number ? 'animate-spin' : ''}`}
                      />
                      {regenerating === ep.episode_number ? '重新生成中...' : '重新生成此集'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Editable tag list used for key_events, featured_characters, featured_locations */
function EventTags({
  items,
  onChange,
  locked,
  addLabel,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  locked: boolean;
  addLabel: string;
}) {
  const [draft, setDraft] = useState('');

  function handleAdd() {
    const trimmed = draft.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setDraft('');
    }
  }

  function handleRemove(removed: string) {
    onChange(items.filter((i) => i !== removed));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-xs text-ink"
          >
            {item}
            {!locked && (
              <button
                type="button"
                className="ml-0.5 text-steel hover:text-semantic-error"
                onClick={() => handleRemove(item)}
                aria-label={`移除 ${item}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-xs text-muted italic">暂无</span>
        )}
      </div>
      {!locked && (
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder={addLabel}
            className="flex-1 rounded-lg border border-hairline bg-canvas px-2 py-1 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.trim()}
            className="shrink-0 rounded-lg bg-surface px-2 py-1 text-xs font-medium text-primary hover:bg-card-tint-lavender disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
