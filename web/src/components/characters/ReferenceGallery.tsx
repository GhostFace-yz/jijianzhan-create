import { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { viewImages } from '../../api/characters';
import { VIEW_LABELS, type Character } from '../../types';

interface ReferenceGalleryProps {
  character: Character;
}

export function ReferenceGallery({ character }: ReferenceGalleryProps) {
  const { expressions, sceneStandings } = viewImages(character);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const hasRefs = expressions.length > 0 || sceneStandings.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">参考图集</h3>
          <p className="text-sm text-slate">
            {hasRefs
              ? '表情组与场景站立图，点击可放大预览。'
              : '确认三视图后将自动生成表情组与场景站立图。'}
          </p>
        </div>
        {character.ip_adapter_id ? (
          <span className="rounded-full bg-card-tint-mint px-3 py-1 text-xs font-medium text-brand-green">
            IP-Adapter 已就绪
          </span>
        ) : (
          <span className="rounded-full bg-card-tint-gray px-3 py-1 text-xs font-medium text-steel">
            IP-Adapter 未获取
          </span>
        )}
      </div>

      {!hasRefs ? (
        <div className="rounded-xl border border-dashed border-hairline-strong bg-surface-soft py-12 text-center text-sm text-slate">
          暂无扩展参考图
        </div>
      ) : (
        <>
          <Section title="表情组" images={expressions} character={character} onPreview={setPreviewUrl} />
          <Section
            title="场景站立图"
            images={sceneStandings}
            character={character}
            onPreview={setPreviewUrl}
          />
        </>
      )}

      {previewUrl ? (
        <ImagePreview url={previewUrl} onClose={() => setPreviewUrl(null)} />
      ) : null}
    </div>
  );
}

interface SectionProps {
  title: string;
  images: { view: string; url: string; seed: number }[];
  character: Character;
  onPreview: (url: string) => void;
}

function Section({ title, images, character, onPreview }: SectionProps) {
  if (images.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-slate">{title}</h4>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img) => (
          <button
            key={img.view}
            type="button"
            onClick={() => onPreview(img.url)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-hairline bg-surface text-left"
          >
            <img
              src={img.url}
              alt={`${character.name} ${VIEW_LABELS[img.view] ?? img.view}`}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
              <ZoomIn className="h-8 w-8 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
              {VIEW_LABELS[img.view] ?? img.view}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface ImagePreviewProps {
  url: string;
  onClose: () => void;
}

function ImagePreview({ url, onClose }: ImagePreviewProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
        aria-label="关闭预览"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={url}
        alt="参考图预览"
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
