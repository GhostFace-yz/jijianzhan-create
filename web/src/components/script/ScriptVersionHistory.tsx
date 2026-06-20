import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RotateCcw, Clock } from 'lucide-react';
import { listScriptVersions, rollbackScript } from '../../api/script';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import type { SnapshotMeta, EpisodeScript } from '../../types';

interface ScriptVersionHistoryProps {
  projectId: string;
  episodeNumber: number;
  onRolledBack: (script: EpisodeScript) => void;
}

export function ScriptVersionHistory({
  projectId,
  episodeNumber,
  onRolledBack,
}: ScriptVersionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<SnapshotMeta | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackError, setRollbackError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['script-versions', projectId, episodeNumber],
    queryFn: () => listScriptVersions(projectId, episodeNumber),
    enabled: open && Boolean(projectId),
  });

  const versions = data?.data.versions ?? [];

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    setIsRollingBack(true);
    setRollbackError(null);
    try {
      const response = await rollbackScript(
        projectId,
        episodeNumber,
        rollbackTarget.versionId,
      );
      if (response.data.content) {
        onRolledBack(response.data.content as unknown as EpisodeScript);
      }
      setRollbackTarget(null);
      void refetch();
    } catch (err) {
      setRollbackError(err instanceof Error ? err.message : '回滚失败');
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="gap-2"
        aria-label="版本历史"
      >
        <Clock className="h-4 w-4" />
        版本历史
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="脚本版本历史">
        <div className="space-y-4">
          <p className="text-sm text-slate">
            查看脚本版本变更历史，可回滚到任意历史版本。回滚会创建新版本。
          </p>

          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-steel" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 text-sm text-semantic-error">
              加载失败：{error.message}
            </div>
          ) : versions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-hairline-strong bg-surface-soft py-12 text-center text-sm text-slate">
              暂无版本历史
            </div>
          ) : (
            <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-canvas max-h-96 overflow-y-auto">
              {versions.map((version, index) => (
                <li key={version.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card-tint-lavender">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-ink">
                        {version.versionId}
                        {index === 0 && (
                          <span className="ml-2 rounded-full bg-card-tint-mint px-2 py-0.5 text-xs font-medium text-brand-green">
                            当前
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate">
                        {formatSource(version.source)} · {formatDate(version.createdAt)}
                      </p>
                    </div>
                  </div>
                  {index !== 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => setRollbackTarget(version)}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      回滚
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Rollback confirmation */}
          <Modal
            open={rollbackTarget !== null}
            onClose={() => {
              if (!isRollingBack) setRollbackTarget(null);
            }}
            title="确认回滚"
          >
            <div className="space-y-4">
              <p className="text-sm text-slate">
                确定要回滚到{' '}
                <strong className="text-ink">{rollbackTarget?.versionId}</strong>
                吗？这会基于该版本内容创建一个新版本，当前脚本将被覆盖。
              </p>
              {rollbackError && (
                <div className="rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-3 text-sm text-semantic-error">
                  {rollbackError}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setRollbackTarget(null)}
                  disabled={isRollingBack}
                >
                  取消
                </Button>
                <Button onClick={handleRollback} disabled={isRollingBack} className="gap-2">
                  {isRollingBack ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      回滚中...
                    </>
                  ) : (
                    '确认回滚'
                  )}
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      </Modal>
    </>
  );
}

function formatSource(source: SnapshotMeta['source']): string {
  const map: Record<SnapshotMeta['source'], string> = {
    ai_generated: 'AI 生成',
    user_edited: '用户编辑',
    ai_regenerated: 'AI 重生成',
    locked: '锁定',
  };
  return map[source];
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
