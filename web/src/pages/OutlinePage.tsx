import { useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  Save,
  ShieldAlert,
  Lock,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { getProject } from '../api/projects';
import {
  getOutline,
  generateOutline,
  updateOutline,
  regenerateEpisode,
  validateOutline,
  confirmOutline,
} from '../api/outline';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { WorldSettingCard } from '../components/outline/WorldSettingCard';
import { CharactersCard } from '../components/outline/CharactersCard';
import { LocationsCard } from '../components/outline/LocationsCard';
import { EpisodesTimeline } from '../components/outline/EpisodesTimeline';
import { ValidationReportCard } from '../components/outline/ValidationReportCard';
import {
  PROJECT_STATUS_LABELS,
  type OutlineData,
  type OutlineCharacter,
  type OutlineLocation,
  type OutlineEpisode,
  type ValidationReport,
  type ProjectStatus,
} from '../types';

/** Check whether the "生成大纲" action is available for this project status */
function canGenerate(status: ProjectStatus): boolean {
  return status === 'draft' || status === 'outlining';
}

export function OutlinePage() {
  const { id: projectId = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const confirmDialogRef = useRef<HTMLDialogElement>(null);

  // ── local state ──
  const [draft, setDraft] = useState<OutlineData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [regeneratingEpisode, setRegeneratingEpisode] = useState<number | null>(null);
  const [regenerateAllConfirm, setRegenerateAllConfirm] = useState(false);

  // ── project info ──
  const { data: projectRes } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });

  const project = projectRes?.data;
  const projectStatus = project?.status ?? 'draft';

  // ── outline data ──
  const {
    data: outlineSummary,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['outline', projectId],
    queryFn: () => getOutline(projectId),
    enabled: Boolean(projectId),
  });

  const outlineData: OutlineData | null = draft ?? outlineSummary?.data.outline ?? null;
  const outlineLocked = outlineSummary?.data.outline_locked ?? false;

  // Sync draft when API data arrives
  const serverDraft = outlineSummary?.data.outline;
  const lastServerRef = useRef(serverDraft);
  if (serverDraft && serverDraft !== lastServerRef.current && !draft) {
    lastServerRef.current = serverDraft;
    setDraft(null);
  }

  // ── mutations ──
  const generateMutation = useMutation({
    mutationFn: () => generateOutline(projectId),
    onSuccess: (res) => {
      setDraft(res.data);
      setDirty(false);
      setValidationReport(null);
      queryClient.invalidateQueries({ queryKey: ['outline', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: OutlineData) => updateOutline(projectId, data),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['outline', projectId] });
    },
  });

  const regenerateEpisodeMutation = useMutation({
    mutationFn: (episodeNumber: number) => regenerateEpisode(projectId, episodeNumber),
    onSuccess: (res, episodeNumber) => {
      if (draft) {
        const updated = {
          ...draft,
          episodes: draft.episodes.map((ep) =>
            ep.episode_number === episodeNumber ? res.data.episode : ep
          ),
        };
        setDraft(updated);
      }
      setRegeneratingEpisode(null);
      queryClient.invalidateQueries({ queryKey: ['outline', projectId] });
    },
    onError: () => {
      setRegeneratingEpisode(null);
    },
  });

  const validateMutation = useMutation({
    mutationFn: () => validateOutline(projectId),
    onSuccess: (res) => {
      setValidationReport(res.data);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmOutline(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  // ── handlers ──
  const handleGenerate = useCallback(() => {
    generateMutation.mutate();
  }, [generateMutation]);

  const handleSave = useCallback(() => {
    if (draft) {
      saveMutation.mutate(draft);
    }
  }, [draft, saveMutation]);

  const handleRegenerateEpisode = useCallback(
    (episodeNumber: number) => {
      setRegeneratingEpisode(episodeNumber);
      regenerateEpisodeMutation.mutate(episodeNumber);
    },
    [regenerateEpisodeMutation]
  );

  const handleValidate = useCallback(() => {
    validateMutation.mutate();
  }, [validateMutation]);

  const handleConfirm = useCallback(() => {
    confirmMutation.mutate();
    confirmDialogRef.current?.close();
  }, [confirmMutation]);

  const handleRegenerateAll = useCallback(() => {
    setRegenerateAllConfirm(false);
    generateMutation.mutate();
  }, [generateMutation]);

  // ── draft update helpers ──
  function updateDraft(partial: Partial<OutlineData>) {
    if (!outlineData) return;
    const updated = { ...outlineData, ...partial };
    setDraft(updated);
    setDirty(true);
  }

  const projectTitle = project?.meta.title ?? '项目';

  // ── render ──
  return (
    <div className="min-h-screen bg-surface-soft">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-sm text-steel hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                返回项目
              </Link>
              <h1 className="mt-1 text-2xl font-semibold text-ink">{projectTitle} · 大纲</h1>
              <p className="mt-1 text-sm text-slate">
                AI 生成剧情大纲 · 编辑 · 剧本医生检查 · 确认锁定
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status badge */}
              <Badge variant="purple">{PROJECT_STATUS_LABELS[projectStatus]}</Badge>
              {outlineLocked && (
                <Badge variant="orange">
                  <Lock className="h-3 w-3 mr-1" />
                  已锁定
                </Badge>
              )}

              {/* Action buttons */}
              {!outlineData && canGenerate(projectStatus) && (
                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {generateMutation.isPending ? 'AI 生成中...' : '生成大纲'}
                </Button>
              )}

              {outlineData && !outlineLocked && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setRegenerateAllConfirm(true)}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    重新生成大纲
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSave}
                    disabled={!dirty || saveMutation.isPending}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saveMutation.isPending ? '保存中...' : '保存草稿'}
                  </Button>
                </>
              )}

              {outlineData && (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleValidate}
                    disabled={validateMutation.isPending}
                    className="gap-2"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    {validateMutation.isPending ? '检查中...' : '自洽性检查'}
                  </Button>
                  <Button
                    onClick={() => confirmDialogRef.current?.showModal()}
                    disabled={confirmMutation.isPending}
                    className="gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    {confirmMutation.isPending ? '确认中...' : '确认大纲'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline-strong border-t-primary" />
            <p className="mt-4 text-sm text-slate">加载大纲数据...</p>
          </div>
        )}

        {/* Error */}
        {error && !outlineData && (
          <div className="rounded-xl border border-semantic-error/20 bg-semantic-error/5 p-8 text-center">
            <p className="text-semantic-error mb-4">加载失败：{error.message}</p>
            {canGenerate(projectStatus) && (
              <Button onClick={handleGenerate} className="gap-2">
                <Sparkles className="h-4 w-4" />
                尝试重新生成
              </Button>
            )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && !outlineData && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-hairline bg-canvas py-20 shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-tint-lavender">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-ink">还没有大纲</h2>
            <p className="mb-6 mt-2 max-w-md text-center text-slate">
              点击「生成大纲」让 AI 根据项目描述生成完整的剧情框架。
            </p>
            {canGenerate(projectStatus) ? (
              <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2">
                <Sparkles className="h-4 w-4" />
                {generateMutation.isPending ? 'AI 生成中...' : '生成大纲'}
              </Button>
            ) : (
              <p className="text-sm text-muted">
                当前项目状态（{PROJECT_STATUS_LABELS[projectStatus]}）不支持生成大纲
              </p>
            )}
          </div>
        )}

        {/* Generation error */}
        {generateMutation.isError && (
          <div className="mb-6 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
            <div>
              <p className="text-sm font-medium text-semantic-error">大纲生成失败</p>
              <p className="text-xs text-slate mt-0.5">{generateMutation.error.message}</p>
            </div>
          </div>
        )}

        {/* Save feedback */}
        {dirty && (
          <div className="mb-6 rounded-lg border border-semantic-warning/20 bg-semantic-warning/5 p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-semantic-warning" />
            <p className="text-sm text-charcoal">
              有未保存的修改，请点击「保存草稿」
            </p>
          </div>
        )}

        {/* Locked warning */}
        {outlineLocked && outlineData && (
          <div className="mb-6 rounded-lg border border-semantic-warning/20 bg-card-tint-yellow p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-semantic-warning" />
              <p className="text-sm font-medium text-charcoal">
                大纲已锁定 — 修改可能影响已生成的脚本和分镜，相关节点将被标记为「需检查」
              </p>
            </div>
          </div>
        )}

        {/* Outline content */}
        {outlineData && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <WorldSettingCard
                worldSetting={outlineData.world_setting}
                mainConflict={outlineData.main_conflict}
                onWorldSettingChange={(v) => updateDraft({ world_setting: v })}
                onMainConflictChange={(v) => updateDraft({ main_conflict: v })}
                locked={outlineLocked}
              />
              <div className="space-y-6">
                <CharactersCard
                  characters={outlineData.characters}
                  onChange={(characters: OutlineCharacter[]) => updateDraft({ characters })}
                  locked={outlineLocked}
                />
                <LocationsCard
                  locations={outlineData.locations}
                  onChange={(locations: OutlineLocation[]) => updateDraft({ locations })}
                  locked={outlineLocked}
                />
              </div>
            </div>

            <EpisodesTimeline
              episodes={outlineData.episodes}
              onEpisodeChange={(index: number, episode: OutlineEpisode) => {
                const updated = [...outlineData.episodes];
                updated[index] = episode;
                updateDraft({ episodes: updated });
              }}
              onRegenerateEpisode={handleRegenerateEpisode}
              locked={outlineLocked}
              regenerating={regeneratingEpisode}
            />

            {validationReport && (
              <ValidationReportCard report={validationReport} />
            )}

            {/* Validate error */}
            {validateMutation.isError && (
              <div className="rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
                <p className="text-sm text-semantic-error">
                  检查失败：{validateMutation.error.message}
                </p>
              </div>
            )}

            {/* Confirm error */}
            {confirmMutation.isError && (
              <div className="rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
                <p className="text-sm text-semantic-error">
                  确认失败：{confirmMutation.error.message}
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Regenerate all confirmation dialog */}
      {regenerateAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-hairline bg-canvas p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-semantic-warning/10">
                <AlertTriangle className="h-5 w-5 text-semantic-warning" />
              </div>
              <h3 className="text-lg font-semibold text-ink">确认重新生成大纲？</h3>
            </div>
            <p className="text-sm text-slate mb-6">
              此操作将使用 AI 重新生成完整大纲，当前编辑的内容将被覆盖。此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRegenerateAllConfirm(false)}>
                取消
              </Button>
              <Button onClick={handleRegenerateAll} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? '生成中...' : '确认重新生成'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm & lock dialog */}
      <dialog
        ref={confirmDialogRef}
        className="rounded-2xl border border-hairline bg-canvas p-6 shadow-xl backdrop:bg-ink/40 max-w-md w-[calc(100%-2rem)]"
        onClick={(e) => {
          if (e.target === confirmDialogRef.current) confirmDialogRef.current?.close();
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card-tint-lavender">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-ink">确认并锁定大纲？</h3>
        </div>
        <p className="text-sm text-slate mb-2">
          锁定后大纲仍可编辑，但修改会触发下游影响提示（如「脚本需重新生成」）。
        </p>
        {validationReport && !validationReport.passed && (
          <div className="mt-3 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-semantic-error" />
            <p className="text-xs text-semantic-error">
              剧本医生检查存在 {validationReport.errors.length} 项错误，建议修复后再确认。
            </p>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => confirmDialogRef.current?.close()}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={confirmMutation.isPending}>
            {confirmMutation.isPending ? '确认中...' : '确认锁定'}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
