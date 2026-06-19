import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { getProject } from '../api/projects';
import {
  generateScript,
  updateScript,
  regenerateScene,
} from '../api/script';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { SceneCard } from '../components/script/SceneCard';
import { EndStateCard } from '../components/script/EndStateCard';
import { DurationEstimate } from '../components/script/DurationEstimate';
import {
  PROJECT_STATUS_LABELS,
  type ScriptData,
  type ScriptScene,
  type ProjectStatus,
} from '../types';

/** Check whether the "生成脚本" action is available for this project status */
function canGenerate(status: ProjectStatus): boolean {
  return status === 'asset_prep' || status === 'producing';
}

export function ScriptPage() {
  const { id: projectId = '', epId: episodeId = '' } = useParams<{
    id: string;
    epId: string;
  }>();
  const queryClient = useQueryClient();

  // ── local state ──
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);

  // ── project info ──
  const { data: projectRes } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });

  const project = projectRes?.data;
  const projectStatus = project?.status ?? 'draft';

  // ── mutations ──
  const generateMutation = useMutation({
    mutationFn: () => generateScript(projectId, episodeId),
    onSuccess: (res) => {
      setScriptData(res.data);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: ScriptData) =>
      updateScript(projectId, episodeId, {
        scenes: data.scenes,
        end_state: data.end_state,
      }),
    onSuccess: () => {
      setDirty(false);
    },
  });

  const regenerateSceneMutation = useMutation({
    mutationFn: (sceneId: string) =>
      regenerateScene(projectId, episodeId, sceneId),
    onSuccess: (res, sceneId) => {
      if (scriptData) {
        const updated = {
          ...scriptData,
          scenes: scriptData.scenes.map((s) =>
            s.scene_id === sceneId ? res.data.scene : s
          ),
        };
        setScriptData(updated);
        setDirty(true);
      }
      setRegeneratingSceneId(null);
    },
    onError: () => {
      setRegeneratingSceneId(null);
    },
  });

  // ── handlers ──
  const handleGenerate = useCallback(() => {
    generateMutation.mutate();
  }, [generateMutation]);

  const handleSave = useCallback(() => {
    if (scriptData) {
      saveMutation.mutate(scriptData);
    }
  }, [scriptData, saveMutation]);

  const handleSceneUpdate = useCallback(
    (index: number, updated: ScriptScene) => {
      if (!scriptData) return;
      const newScenes = [...scriptData.scenes];
      newScenes[index] = updated;
      setScriptData({ ...scriptData, scenes: newScenes });
      setDirty(true);
    },
    [scriptData]
  );

  const handleRegenerateScene = useCallback(
    (sceneId: string) => {
      setRegeneratingSceneId(sceneId);
      regenerateSceneMutation.mutate(sceneId);
    },
    [regenerateSceneMutation]
  );

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
                to={`/projects/${projectId}/outline`}
                className="inline-flex items-center gap-1 text-sm text-steel hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                返回大纲
              </Link>
              <h1 className="mt-1 text-2xl font-semibold text-ink">
                {projectTitle} · 第 {episodeId} 集脚本
              </h1>
              {scriptData && (
                <p className="mt-1 text-sm text-slate">{scriptData.episode_title}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="purple">{PROJECT_STATUS_LABELS[projectStatus]}</Badge>

              {/* Generate button */}
              {!scriptData && canGenerate(projectStatus) && (
                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {generateMutation.isPending ? 'AI 生成中...' : '生成本集脚本'}
                </Button>
              )}

              {/* Save button */}
              {scriptData && (
                <Button
                  variant="secondary"
                  onClick={handleSave}
                  disabled={!dirty || saveMutation.isPending}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? '保存中...' : '保存脚本'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Generation error */}
        {generateMutation.isError && (
          <div className="mb-6 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
            <div>
              <p className="text-sm font-medium text-semantic-error">脚本生成失败</p>
              <p className="text-xs text-slate mt-0.5">{generateMutation.error.message}</p>
            </div>
          </div>
        )}

        {/* Save error */}
        {saveMutation.isError && (
          <div className="mb-6 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
            <div>
              <p className="text-sm font-medium text-semantic-error">保存失败</p>
              <p className="text-xs text-slate mt-0.5">{saveMutation.error.message}</p>
            </div>
          </div>
        )}

        {/* Regenerate error */}
        {regenerateSceneMutation.isError && (
          <div className="mb-6 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
            <div>
              <p className="text-sm font-medium text-semantic-error">场景重新生成失败</p>
              <p className="text-xs text-slate mt-0.5">
                {regenerateSceneMutation.error.message}
              </p>
            </div>
          </div>
        )}

        {/* Unsaved warning */}
        {dirty && (
          <div className="mb-6 rounded-lg border border-semantic-warning/20 bg-semantic-warning/5 p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-semantic-warning" />
            <p className="text-sm text-charcoal">
              有未保存的修改，请点击「保存脚本」
            </p>
          </div>
        )}

        {/* Loading state - generating */}
        {generateMutation.isPending && (
          <div className="flex flex-col items-center justify-center py-20">
            <Spinner size="h-10 w-10" />
            <p className="mt-4 text-sm text-slate">AI 正在生成脚本，请稍候...</p>
            <p className="mt-1 text-xs text-muted">
              这可能需要 30 秒到 2 分钟
            </p>
          </div>
        )}

        {/* Empty state - no script yet, not generating */}
        {!scriptData && !generateMutation.isPending && !generateMutation.isError && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-hairline bg-canvas py-20 shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-tint-lavender">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-ink">还没有脚本</h2>
            <p className="mb-6 mt-2 max-w-md text-center text-slate">
              点击「生成本集脚本」让 AI 根据大纲、角色圣经和场景圣经生成完整的脚本内容。
            </p>
            {canGenerate(projectStatus) ? (
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {generateMutation.isPending ? 'AI 生成中...' : '生成本集脚本'}
              </Button>
            ) : (
              <p className="text-sm text-muted">
                当前项目状态（{PROJECT_STATUS_LABELS[projectStatus]}）不支持生成脚本
              </p>
            )}
          </div>
        )}

        {/* Script content */}
        {scriptData && !generateMutation.isPending && (
          <div className="space-y-4">
            {/* Scenes */}
            <div>
              <h2 className="text-sm font-semibold text-slate uppercase tracking-wider mb-3">
                场景列表 ({scriptData.scenes.length})
              </h2>
              <div className="space-y-2">
                {scriptData.scenes.map((scene, index) => (
                  <SceneCard
                    key={scene.scene_id}
                    scene={scene}
                    index={index}
                    onSceneUpdate={handleSceneUpdate}
                    onRegenerateScene={handleRegenerateScene}
                    regenerating={regeneratingSceneId}
                  />
                ))}
              </div>
            </div>

            {/* Duration estimate */}
            <DurationEstimate scenes={scriptData.scenes} />

            {/* End state */}
            <EndStateCard endState={scriptData.end_state} />
          </div>
        )}
      </main>
    </div>
  );
}
