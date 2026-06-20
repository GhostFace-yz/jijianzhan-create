import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  Save,
  Clock,
  AlertTriangle,
  CheckCircle,
  Users,
  MapPin,
  Swords,
  Key,
} from 'lucide-react';
import { getProject } from '../api/projects';
import { getOutline } from '../api/outline';
import {
  generateScript,
  getScript,
  updateScript,
  regenerateScene,
} from '../api/script';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SceneCard } from '../components/script/SceneCard';
import { ChangeImpactBanner } from '../components/script/ChangeImpactBanner';
import { ScriptVersionHistory } from '../components/script/ScriptVersionHistory';
import {
  PROJECT_STATUS_LABELS,
  EMOTION_LABELS,
  type EpisodeScript,
  type Scene,
  type EditImpact,
  type OutlineEpisode,
} from '../types';

/** Get the most severe impact */
function mergeImpact(a: EditImpact | null, b: EditImpact): EditImpact {
  if (!a) return b;
  const order: EditImpact[] = ['light', 'medium', 'deep'];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

/** Estimate duration from script data */
function estimateDuration(scenes: Scene[]): { totalSeconds: number; totalWords: number } {
  const CHARS_PER_SECOND = 4; // Chinese speaking rate
  const SCENE_TRANSITION_SEC = 4;

  let totalChars = 0;
  for (const scene of scenes) {
    for (const dialogue of scene.dialogues) {
      totalChars += dialogue.text.length;
    }
  }

  const speakingSeconds = totalChars / CHARS_PER_SECOND;
  const transitionSeconds = scenes.length * SCENE_TRANSITION_SEC;
  const totalSeconds = Math.round(speakingSeconds + transitionSeconds);

  return { totalSeconds, totalWords: totalChars };
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} 秒`;
  return `${minutes} 分 ${seconds} 秒`;
}

/** Determine which outline episode corresponds to the script episode */
function findOutlineEpisode(
  episodes: OutlineEpisode[] | undefined,
  episodeNumber: number,
): OutlineEpisode | undefined {
  return episodes?.find((ep) => ep.episode_number === episodeNumber);
}

export function ScriptPage() {
  const { projectId = '', episodeNumber: epNumStr = '1' } = useParams<{
    projectId: string;
    episodeNumber: string;
  }>();
  const episodeNumber = parseInt(epNumStr, 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirmDialogRef = useState<HTMLDialogElement | null>(null);

  // ── local state ──
  const [draft, setDraft] = useState<EpisodeScript | null>(null);
  const [dirty, setDirty] = useState(false);
  const [impact, setImpact] = useState<EditImpact | null>(null);
  const [impactDismissed, setImpactDismissed] = useState(false);
  const [affectedScenes, setAffectedScenes] = useState(0);
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);

  // ── project info ──
  const { data: projectRes } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });
  const project = projectRes?.data;
  const projectStatus = project?.status ?? 'draft';

  // ── outline (for character & location names) ──
  const { data: outlineSummary } = useQuery({
    queryKey: ['outline', projectId],
    queryFn: () => getOutline(projectId),
    enabled: Boolean(projectId),
  });
  const outlineData = outlineSummary?.data.outline;
  const outlineEpisode = findOutlineEpisode(outlineData?.episodes, episodeNumber);

  // ── character name map ──
  const characterNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (outlineData?.characters) {
      for (const ch of outlineData.characters) {
        map[ch.name] = ch.name;
      }
    }
    return map;
  }, [outlineData]);

  // ── script data ──
  const {
    data: scriptRes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['script', projectId, episodeNumber],
    queryFn: () => getScript(projectId, episodeNumber),
    enabled: Boolean(projectId),
  });

  const scriptData: EpisodeScript | null = draft ?? scriptRes?.data ?? null;

  // Treat 404 / "not found" as "script not yet generated" (empty state)
  const isNotFoundError = error?.message?.toLowerCase().includes('not found');
  const showError = error && !isNotFoundError && !scriptData;
  const showEmptyOrNotFound = !isLoading && (!error || isNotFoundError) && !scriptData;

  // ── mutations ──
  const generateMutation = useMutation({
    mutationFn: () => generateScript(projectId, episodeNumber),
    onSuccess: (res) => {
      setDraft(res.data);
      setDirty(false);
      setImpact(null);
      queryClient.invalidateQueries({ queryKey: ['script', projectId, episodeNumber] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: EpisodeScript) => updateScript(projectId, episodeNumber, data),
    onSuccess: () => {
      setDirty(false);
      setImpact(null);
      queryClient.invalidateQueries({ queryKey: ['script', projectId, episodeNumber] });
    },
  });

  const regenerateSceneMutation = useMutation({
    mutationFn: (sceneId: string) => regenerateScene(projectId, episodeNumber, sceneId),
    onSuccess: (res, _sceneId) => {
      if (draft) {
        const updated = {
          ...draft,
          scenes: draft.scenes.map((s) =>
            s.scene_id === res.data.scene_id ? res.data : s,
          ),
        };
        setDraft(updated);
        setDirty(true);
      }
      setRegeneratingSceneId(null);
      queryClient.invalidateQueries({ queryKey: ['script', projectId, episodeNumber] });
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
    if (draft) {
      setImpact('medium');
      saveMutation.mutate(draft);
    }
  }, [draft, saveMutation]);

  const handleRegenerateScene = useCallback(
    (sceneId: string) => {
      setRegeneratingSceneId(sceneId);
      regenerateSceneMutation.mutate(sceneId);
    },
    [regenerateSceneMutation],
  );

  const handleEditAction = useCallback(
    (newImpact: EditImpact) => {
      if (!draft) return;
      setDirty(true);
      const merged = mergeImpact(impact, newImpact);
      setImpact(merged);
      setImpactDismissed(false);
      setAffectedScenes((prev) => Math.min(prev + 1, draft.scenes.length));
    },
    [draft, impact],
  );

  const handleUpdateScene = useCallback(
    (index: number, updated: Scene) => {
      if (!scriptData) return;
      const scenes = [...scriptData.scenes];
      scenes[index] = updated;
      const newDraft = { ...scriptData, scenes };
      setDraft(newDraft);
      setDirty(true);
    },
    [scriptData],
  );

  const handleRolledBack = useCallback(
    (rolledBackScript: EpisodeScript) => {
      setDraft(rolledBackScript);
      setDirty(false);
      setImpact(null);
      queryClient.invalidateQueries({ queryKey: ['script', projectId, episodeNumber] });
    },
    [projectId, episodeNumber, queryClient],
  );

  const handleConfirm = useCallback(() => {
    if (!scriptData) return;
    saveMutation.mutate(scriptData);
  }, [scriptData, saveMutation]);

  // Navigate to storyboard after save succeeds
  useEffect(() => {
    if (saveMutation.isSuccess) {
      navigate(`/projects/${projectId}/episodes/${episodeNumber}/storyboard`);
    }
  }, [saveMutation.isSuccess, navigate, projectId, episodeNumber]);

  // ── computed ──
  const duration = scriptData ? estimateDuration(scriptData.scenes) : null;
  const projectTitle = project?.meta.title ?? '项目';
  const episodeTitle =
    scriptData?.episode_title || outlineEpisode?.title || `第 ${episodeNumber} 集`;

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
                {projectTitle} · {episodeTitle}
              </h1>
              <p className="mt-1 text-sm text-slate">脚本编辑器 · 场景折叠查看 · 台词编辑</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="purple">{PROJECT_STATUS_LABELS[projectStatus]}</Badge>

              {/* Version history */}
              {scriptData && (
                <ScriptVersionHistory
                  projectId={projectId}
                  episodeNumber={episodeNumber}
                  onRolledBack={handleRolledBack}
                />
              )}

              {/* Generate */}
              {!scriptData && (
                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {generateMutation.isPending ? 'AI 生成中...' : '生成脚本'}
                </Button>
              )}

              {/* Save */}
              {scriptData && (
                <>
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
            <p className="mt-4 text-sm text-slate">加载脚本数据...</p>
          </div>
        )}

        {/* Error */}
        {showError && (
          <div className="rounded-xl border border-semantic-error/20 bg-semantic-error/5 p-8 text-center">
            <p className="text-semantic-error mb-4">加载失败：{error?.message}</p>
            <Button onClick={handleGenerate} className="gap-2">
              <Sparkles className="h-4 w-4" />
              尝试生成脚本
            </Button>
          </div>
        )}

        {/* Empty state */}
        {showEmptyOrNotFound && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-hairline bg-canvas py-20 shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-tint-lavender">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-ink">还没有脚本</h2>
            <p className="mb-6 mt-2 max-w-md text-center text-slate">
              点击「生成脚本」让 AI 根据大纲自动生成完整的场景脚本和台词。
            </p>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {generateMutation.isPending ? 'AI 生成中...' : '生成脚本'}
            </Button>
          </div>
        )}

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

        {/* Save feedback */}
        {dirty && (
          <div className="mb-6 rounded-lg border border-semantic-warning/20 bg-semantic-warning/5 p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-semantic-warning" />
            <p className="text-sm text-charcoal">有未保存的修改，请点击「保存草稿」</p>
          </div>
        )}

        {/* Save error */}
        {saveMutation.isError && (
          <div className="mb-6 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
            <p className="text-sm text-semantic-error">
              保存失败：{saveMutation.error.message}
            </p>
          </div>
        )}

        {/* Change impact banner */}
        {impact && !impactDismissed && dirty && (
          <div className="mb-6">
            <ChangeImpactBanner
              impact={impact}
              affectedScenes={affectedScenes}
              totalScenes={scriptData?.scenes.length ?? 0}
              onDismiss={() => setImpactDismissed(true)}
            />
          </div>
        )}

        {/* Script content */}
        {scriptData && (
          <div className="space-y-6">
            {/* Scene cards */}
            <div className="space-y-4">
              {scriptData.scenes.map((scene, i) => (
                <SceneCard
                  key={scene.scene_id || i}
                  scene={scene}
                  sceneIndex={i}
                  locationName={outlineData?.locations?.find(
                    (l) => l.name === scene.location_id,
                  )?.name}
                  characterNames={characterNames}
                  onUpdateScene={(updated) => handleUpdateScene(i, updated)}
                  onRegenerateScene={handleRegenerateScene}
                  locked={false}
                  regenerating={regeneratingSceneId === scene.scene_id}
                  onEditAction={handleEditAction}
                />
              ))}
            </div>

            {/* End State */}
            <div className="rounded-xl border border-hairline bg-canvas shadow-sm p-5">
              <h3 className="text-base font-semibold text-ink mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                本集结尾状态
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Character end states */}
                {scriptData.end_state.characters.length > 0 && (
                  <div className="rounded-lg border border-hairline bg-surface-soft/50 p-4">
                    <h4 className="text-xs font-medium text-steel uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      角色状态
                    </h4>
                    <div className="space-y-2">
                      {scriptData.end_state.characters.map((ec) => (
                        <div key={ec.char_id} className="text-sm">
                          <span className="font-semibold text-ink">
                            {characterNames[ec.char_id] || ec.char_id}
                          </span>
                          <span className="text-slate">
                            {' '}
                            · {EMOTION_LABELS[ec.emotion] || ec.emotion} · {ec.position}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unresolved conflicts */}
                {scriptData.end_state.unresolved_conflicts.length > 0 && (
                  <div className="rounded-lg border border-hairline bg-surface-soft/50 p-4">
                    <h4 className="text-xs font-medium text-steel uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Swords className="h-3.5 w-3.5" />
                      未解决冲突
                    </h4>
                    <ul className="space-y-1">
                      {scriptData.end_state.unresolved_conflicts.map((c, i) => (
                        <li key={i} className="text-sm text-charcoal flex items-start gap-1.5">
                          <span className="text-muted mt-0.5">•</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Key prop states */}
                {Object.keys(scriptData.end_state.key_prop_states).length > 0 && (
                  <div className="rounded-lg border border-hairline bg-surface-soft/50 p-4">
                    <h4 className="text-xs font-medium text-steel uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5" />
                      关键道具状态
                    </h4>
                    <div className="space-y-1.5">
                      {Object.entries(scriptData.end_state.key_prop_states).map(
                        ([prop, state]) => (
                          <div key={prop} className="text-sm">
                            <span className="font-medium text-ink">{prop}</span>
                            <span className="text-slate"> — {state}</span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom bar: estimated duration + confirm */}
            <div className="sticky bottom-0 rounded-xl border border-hairline bg-canvas shadow-lg p-4 -mx-2">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  {duration && (
                    <div className="flex items-center gap-2 text-sm text-slate">
                      <Clock className="h-4 w-4" />
                      <span>
                        估算时长：<strong className="text-ink">{formatDuration(duration.totalSeconds)}</strong>
                      </span>
                      <span className="text-xs text-steel">
                        （{scriptData.scenes.length} 场景 · {duration.totalWords} 字）
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleConfirm}
                  disabled={saveMutation.isPending}
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  {saveMutation.isPending ? '保存并确认中...' : '确认脚本，进入分镜'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
