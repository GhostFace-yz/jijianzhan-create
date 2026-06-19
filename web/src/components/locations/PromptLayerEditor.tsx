import { useState } from 'react';
import { Eye, Layers, Loader2 } from 'lucide-react';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { Location } from '../../types';

interface PromptLayers {
  environment: string;
  lighting: string;
  style: string;
  detail: string;
  negative: string;
}

const LAYER_LABELS: Record<keyof PromptLayers, string> = {
  environment: '环境层',
  lighting: '光线层',
  style: '风格层',
  detail: '细节层',
  negative: '负向层',
};

const LAYER_PLACEHOLDERS: Record<keyof PromptLayers, string> = {
  environment: '描述场景环境、空间布局、建筑风格...',
  lighting: '描述光线方向、强度、色温...',
  style: '描述视觉风格、氛围色调、质感...',
  detail: '描述细节元素、装饰物、道具摆放...',
  negative: '不希望出现的内容，如：people, humans, characters, blurry, bad quality',
};

const DEFAULT_NEGATIVE = 'people, humans, characters, blurry, bad quality, distorted';

function buildDefaultLayers(location: Location): PromptLayers {
  return {
    environment: location.description ?? '',
    lighting: location.lighting_type ?? '',
    style: [location.style, location.color_tone].filter(Boolean).join(', '),
    detail: location.key_props?.join(', ') ?? '',
    negative: DEFAULT_NEGATIVE,
  };
}

function assemblePrompt(layers: PromptLayers, location: Location): string {
  const parts = [
    layers.environment || location.description || '',
    layers.lighting || location.lighting_type || '',
    layers.style || [location.style, location.color_tone].filter(Boolean).join(', ') || '',
    'no people, no characters, empty room',
    'architectural photography',
    layers.detail || location.key_props?.join(', ') || '',
  ].filter(Boolean);
  return parts.join(', ');
}

interface PromptLayerEditorProps {
  location: Location;
}

export function PromptLayerEditor({ location }: PromptLayerEditorProps) {
  const [layers, setLayers] = useState<PromptLayers>(() => buildDefaultLayers(location));
  const [expandedLayer, setExpandedLayer] = useState<keyof PromptLayers | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const updateLayer = (key: keyof PromptLayers, value: string) => {
    setLayers((prev) => ({ ...prev, [key]: value }));
  };

  const fullPrompt = assemblePrompt(layers, location);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-ink">Prompt 分层编辑器</h3>
        <p className="text-sm text-slate">
          将 Prompt 拆解为 5 层独立编辑，系统自动拼接为完整 Prompt 用于图像生成。
        </p>
      </div>

      <div className="space-y-3">
        {(Object.keys(LAYER_LABELS) as Array<keyof PromptLayers>).map((key) => (
          <div
            key={key}
            className="overflow-hidden rounded-xl border border-hairline bg-canvas"
          >
            <button
              type="button"
              onClick={() => setExpandedLayer(expandedLayer === key ? null : key)}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-surface-soft"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card-tint-lavender text-sm font-medium text-primary">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-ink">{LAYER_LABELS[key]}</p>
                  <p className="text-xs text-slate line-clamp-1">
                    {layers[key] ? (
                      key === 'negative' ? (
                        <span className="text-semantic-error">{layers[key]}</span>
                      ) : (
                        layers[key]
                      )
                    ) : (
                      <span className="italic text-stone">未填写</span>
                    )}
                  </p>
                </div>
              </div>
              <span className="text-xs text-stone">{expandedLayer === key ? '收起' : '编辑'}</span>
            </button>
            {expandedLayer === key ? (
              <div className="border-t border-hairline px-4 pb-4 pt-3">
                <Textarea
                  value={layers[key]}
                  onChange={(e) => updateLayer(key, e.target.value)}
                  placeholder={LAYER_PLACEHOLDERS[key]}
                  maxLength={2000}
                />
                <p className="mt-1.5 text-right text-xs text-stone">
                  {layers[key]?.length ?? 0} / 2000
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => setShowPreview(!showPreview)}
          className="gap-2"
        >
          <Eye className="h-4 w-4" />
          {showPreview ? '隐藏预览' : '预览完整 Prompt'}
        </Button>
      </div>

      {showPreview ? (
        <div className="space-y-3 rounded-xl border border-hairline bg-surface-soft p-4">
          <div>
            <p className="text-xs font-medium text-steel">拼接后的完整 Prompt（正面）</p>
            <p className="mt-1 whitespace-pre-wrap break-all text-sm text-ink">{fullPrompt}</p>
          </div>
          {layers.negative ? (
            <div>
              <p className="text-xs font-medium text-semantic-error">负向 Prompt</p>
              <p className="mt-1 whitespace-pre-wrap break-all text-sm text-semantic-error">
                {layers.negative}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
