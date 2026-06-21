import { useState } from 'react';
import { Loader2, RefreshCw, CheckCircle2, Wand2 } from 'lucide-react';
import { generateViews, retryView, confirmViews, viewImages, viewUrl } from '../../api/characters';
import { Button } from '../../components/ui/Button';
import { VIEW_LABELS, type Character } from '../../types';

const VIEW_ORDER: ('front' | 'side' | 'back')[] = ['front', 'side', 'back'];

interface ThreeViewGeneratorProps {
  projectId: string;
  character: Character;
  onUpdated: (character: Character) => void;
}

export function ThreeViewGenerator({ projectId, character, onUpdated }: ThreeViewGeneratorProps) {
  const [loadingViews, setLoadingViews] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const { views } = viewImages(character);
  const hasAllViews = VIEW_ORDER.every((view) => views.some((v) => v.view === view));

  const startLoading = (key: string) => {
    setLoadingViews((prev) => new Set(prev).add(key));
  };

  const stopLoading = (key: string) => {
    setLoadingViews((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleGenerateAll = async () => {
    const key = 'all';
    setActionError(null);
    startLoading(key);
    try {
      const response = await generateViews(projectId, character.id);
      onUpdated(response.data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '生成失败');
    } finally {
      stopLoading(key);
    }
  };

  const handleRetry = async (viewId: 'front' | 'side' | 'back') => {
    setActionError(null);
    startLoading(viewId);
    try {
      const response = await retryView(projectId, character.id, viewId);
      onUpdated(response.data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '重新生成失败');
    } finally {
      stopLoading(viewId);
    }
  };

  const handleConfirm = async () => {
    setActionError(null);
    startLoading('confirm');
    try {
      const response = await confirmViews(projectId, character.id);
      onUpdated(response.data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '确认失败');
    } finally {
      stopLoading('confirm');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">三视图</h3>
          <p className="text-sm text-slate">
            {hasAllViews
              ? '三视图已生成，可单独重新生成或确认锁定。'
              : '生成正面、侧面、背面三视图，统一角色形象。'}
          </p>
        </div>
        <Button
          onClick={handleGenerateAll}
          loading={loadingViews.has('all')}
          className="gap-2"
        >
          <Wand2 className="h-4 w-4" />
          {views.length > 0 ? '重新生成三视图' : '生成三视图'}
        </Button>
      </div>

      {views.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline-strong bg-surface-soft py-16 text-center">
          <Wand2 className="h-10 w-10 text-steel" />
          <p className="mt-3 text-sm text-slate">尚未生成三视图，点击上方按钮开始生成</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {VIEW_ORDER.map((view) => {
            const url = viewUrl(character, view);
            const isLoading = loadingViews.has(view);
            return (
              <div
                key={view}
                className="flex flex-col gap-3 rounded-xl border border-hairline bg-canvas p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{VIEW_LABELS[view] ?? view}</span>
                  <Button
                    variant="ghost"
                    onClick={() => handleRetry(view)}
                    loading={isLoading}
                    className="h-8 gap-1 px-2 text-xs"
                  >
                    <RefreshCw className="h-3 w-3" />
                    重生成
                  </Button>
                </div>
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-surface">
                  {url ? (
                    <img
                      src={url}
                      alt={`${character.name} ${VIEW_LABELS[view] ?? view}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-steel" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasAllViews ? (
        <div className="flex items-center justify-end">
          <Button
            onClick={handleConfirm}
            loading={loadingViews.has('confirm')}
            disabled={character.status === 'confirmed'}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            确认三视图
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 text-sm text-semantic-error">
          {actionError}
        </div>
      ) : null}
    </div>
  );
}
