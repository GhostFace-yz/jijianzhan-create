import { useState } from 'react';
import { Loader2, Check, RefreshCw, Zap } from 'lucide-react';
import { generateBaseCandidates, confirmBaseImage } from '../../api/locations';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import type { BaseCandidate, Location } from '../../types';

interface BaseImageGeneratorProps {
  projectId: string;
  location: Location;
  onUpdated: (location: Location) => void;
}

export function BaseImageGenerator({ projectId, location, onUpdated }: BaseImageGeneratorProps) {
  const [candidates, setCandidates] = useState<BaseCandidate[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const hasBaseImage = Boolean(location.base_seed && location.base_image_url);

  const handleGenerate = async () => {
    if (hasBaseImage) {
      setShowRegenConfirm(true);
      return;
    }
    await doGenerate();
  };

  const doGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    setSelectedIndex(null);
    try {
      const result = await generateBaseCandidates(projectId, location.id);
      setCandidates(result.data);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = async () => {
    if (selectedIndex === null) return;
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const response = await confirmBaseImage(projectId, location.id, {
        candidate: candidates[selectedIndex],
      });
      onUpdated(response.data);
      setCandidates([]);
      setSelectedIndex(null);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : '确认失败');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">基准图</h3>
          <p className="text-sm text-slate">
            {hasBaseImage
              ? `基准 Seed: ${location.base_seed} — 同场景所有生成将基于此 Seed`
              : '为场景生成 3 张候选图，选择最满意的一张锁定 Seed'}
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              生成中...
            </>
          ) : hasBaseImage ? (
            <>
              <RefreshCw className="h-4 w-4" />
              重新生成
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              生成基准图
            </>
          )}
        </Button>
      </div>

      {generateError ? (
        <div className="rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 text-sm text-semantic-error">
          {generateError}
        </div>
      ) : null}

      {hasBaseImage ? (
        <div className="rounded-xl border border-hairline bg-canvas p-4">
          <div className="flex items-center gap-4">
            <div className="h-32 w-48 shrink-0 overflow-hidden rounded-lg bg-surface">
              <img
                src={location.base_image_url!}
                alt="基准图"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-ink">当前基准图</p>
              <p className="mt-1 text-xs text-slate">
                Seed: {location.base_seed}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {candidates.length > 0 ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {candidates.map((candidate, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                  selectedIndex === index
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-hairline hover:border-hairline-strong'
                }`}
              >
                <div className="aspect-[4/3] bg-surface">
                  <img
                    src={candidate.url}
                    alt={`候选图 ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-2 text-left text-xs text-slate">
                  Seed: {candidate.seed}
                </div>
                {selectedIndex === index ? (
                  <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-4 w-4" />
                  </div>
                ) : null}
              </button>
            ))}
          </div>

          {confirmError ? (
            <div className="rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-3 text-sm text-semantic-error">
              {confirmError}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setCandidates([]);
                setSelectedIndex(null);
              }}
              disabled={isConfirming}
            >
              取消
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedIndex === null || isConfirming}
              className="gap-2"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  确认中...
                </>
              ) : (
                '确认使用'
              )}
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        open={showRegenConfirm}
        onClose={() => setShowRegenConfirm(false)}
        title="重新生成基准图"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate">
            当前已有基准图（Seed: {location.base_seed}）。重新生成将产生 3 张新候选图，确认后会覆盖现有基准 Seed。
            已有的变体图不会被自动更新。
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowRegenConfirm(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                setShowRegenConfirm(false);
                void doGenerate();
              }}
            >
              继续生成
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
