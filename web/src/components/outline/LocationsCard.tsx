import { useState } from 'react';
import { MapPin, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { EditableField } from '../EditableField';
import type { OutlineLocation } from '../../types';
import { Button } from '../ui/Button';

export interface LocationsCardProps {
  locations: OutlineLocation[];
  onChange: (locations: OutlineLocation[]) => void;
  locked?: boolean;
}

/**
 * Displays the outline location/scene list with inline add/edit/delete.
 */
export function LocationsCard({ locations, onChange, locked = false }: LocationsCardProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  function handleAdd() {
    onChange([...locations, { name: '新场景', description: '' }]);
    setExpandedIndex(locations.length);
  }

  function handleUpdateName(index: number, name: string) {
    const updated = locations.map((l, i) => (i === index ? { ...l, name } : l));
    onChange(updated);
  }

  function handleUpdateDesc(index: number, description: string) {
    const updated = locations.map((l, i) => (i === index ? { ...l, description } : l));
    onChange(updated);
  }

  function handleDelete(index: number) {
    const updated = locations.filter((_, i) => i !== index);
    onChange(updated);
    setExpandedIndex(null);
  }

  return (
    <div className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card-tint-mint">
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink">场景列表</h2>
          <p className="text-xs text-slate">{locations.length} 个场景</p>
        </div>
        {!locked && (
          <Button variant="ghost" className="ml-auto gap-1" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            添加
          </Button>
        )}
      </div>

      {locations.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">暂无场景，点击「添加」创建</p>
      ) : (
        <div className="space-y-2">
          {locations.map((loc, index) => (
            <div
              key={index}
              className="rounded-lg border border-hairline-soft bg-surface-soft"
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                {expandedIndex === index ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-steel" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-steel" />
                )}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card-tint-mint text-sm font-semibold text-brand-teal">
                  {loc.name.slice(0, 1)}
                </div>
                <span className="flex-1 text-sm font-medium text-ink line-clamp-1">
                  {loc.name}
                </span>
                <span className="text-xs text-muted line-clamp-1 max-w-[120px]">
                  {loc.description || '暂无描述'}
                </span>
                {!locked && (
                  <button
                    type="button"
                    className="ml-1 rounded p-1 text-steel hover:text-semantic-error"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(index);
                    }}
                    aria-label={`删除场景 ${loc.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </button>

              {expandedIndex === index && (
                <div className="border-t border-hairline-soft px-3 pb-3 pt-2 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-charcoal">名称</label>
                    <EditableField
                      value={loc.name}
                      onSave={(v) => handleUpdateName(index, v)}
                      placeholder="场景名称"
                      textSize="text-sm"
                      disabled={locked}
                      label="编辑场景名称"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-charcoal">描述</label>
                    <EditableField
                      value={loc.description}
                      onSave={(v) => handleUpdateDesc(index, v)}
                      multiline
                      placeholder="场景描述、氛围、特征..."
                      textSize="text-sm"
                      disabled={locked}
                      label="编辑场景描述"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
