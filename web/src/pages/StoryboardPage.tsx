import { useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  Save,
  AlertTriangle,
  CheckCircle,
  Film,
  Eye,
  Headphones,
} from 'lucide-react';
import { getProject } from '../api/projects';
import {
  listStoryboardNodes,
  splitStoryboardNodes,
  updateStoryboardNodes,
  splitStoryboardNode,
} from '../api/storyboard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/shadcn/skeleton';
import { StoryboardEditor } from '../components/script/StoryboardEditor';
import {
  PROJECT_STATUS_LABELS,
  type StoryboardNode as StoryboardNodeType,
} from '../types';

/** Generate a new node ID */
function generateNodeId(epId: string, existingNodes: StoryboardNodeType[]): string {
  const maxNum = existingNodes.reduce((max, n) => {
    const match = n.node_id.match(/-n(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `${epId}-n${String(maxNum + 1).padStart(3, '0')}`;
}

/** Deep clone a node with a new ID */
function cloneNode(node: StoryboardNodeType, newNodeId: string): StoryboardNodeType {
  return {
    ...node,
    node_id: newNodeId,
    version_history: [],
    status: 'pending' as const,
  };
}

export function StoryboardPage() {
  const { projectId = '', episodeNumber: epNumStr = '1' } = useParams<{
    projectId: string;
    episodeNumber: string;
  }>();
  const episodeNumber = parseInt(epNumStr, 10);
  const epId = `ep-${episodeNumber}`;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── local state ──
  const [draftNodes, setDraftNodes] = useState<StoryboardNodeType[] | null>(null);
  const [dirty, setDirty] = useState(false);

  // ── project info ──
  const { data: projectRes } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });
  const project = projectRes?.data;
  const projectStatus = project?.status ?? 'draft';

  // ── nodes data ──
  const {
    data: nodesRes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['storyboard-nodes', projectId, epId],
    queryFn: () => listStoryboardNodes(projectId, epId),
    enabled: Boolean(projectId),
  });

  const nodes: StoryboardNodeType[] = draftNodes ?? nodesRes?.data ?? [];
  const hasNodes = nodes.length > 0;
  const isNotFoundError = error?.message?.toLowerCase().includes('not found');
  const showError = error && !isNotFoundError && !hasNodes;
  const showEmpty = !isLoading && (!error || isNotFoundError) && !hasNodes;

  // ── mutations ──
  const splitMutation = useMutation({
    mutationFn: () => splitStoryboardNodes(projectId, epId),
    onSuccess: (res) => {
      setDraftNodes(res.data.nodes);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes', projectId, epId] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: StoryboardNodeType[]) =>
      updateStoryboardNodes(projectId, epId, { nodes: data }),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes', projectId, epId] });
    },
  });

  const splitNodeMutation = useMutation({
    mutationFn: (nodeId: string) => splitStoryboardNode(projectId, epId, nodeId),
    onSuccess: (res, _nodeId) => {
      const currentNodes = nodes;
      const originalIdx = currentNodes.findIndex(
        (n) => n.node_id === res.data.original.node_id,
      );
      if (originalIdx >= 0) {
        const newNodes = [...currentNodes];
        newNodes.splice(originalIdx, 1, ...res.data.new_nodes);
        setDraftNodes(newNodes);
        setDirty(true);
      }
    },
  });

  // ── handlers ──
  const handleGenerate = useCallback(() => {
    splitMutation.mutate();
  }, [splitMutation]);

  const handleSave = useCallback(() => {
    if (nodes.length > 0) {
      saveMutation.mutate(nodes);
    }
  }, [nodes, saveMutation]);

  const handleNodesChange = useCallback(
    (newNodes: StoryboardNodeType[]) => {
      setDraftNodes(newNodes);
      setDirty(true);
    },
    [],
  );

  const handleInsertNode = useCallback(
    (afterNodeId: string, before: boolean) => {
      const idx = nodes.findIndex((n) => n.node_id === afterNodeId);
      if (idx < 0) return;
      const targetIdx = before ? idx : idx + 1;
      const sourceNode = nodes[idx];
      const newNode = cloneNode(sourceNode, generateNodeId(epId, nodes));
      const newNodes = [...nodes];
      newNodes.splice(targetIdx, 0, newNode);
      setDraftNodes(newNodes);
      setDirty(true);
    },
    [nodes, epId],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (nodes.length <= 1) return;
      const newNodes = nodes.filter((n) => n.node_id !== nodeId);
      setDraftNodes(newNodes);
      setDirty(true);
    },
    [nodes],
  );

  const handleSplitNode = useCallback(
    (nodeId: string) => {
      splitNodeMutation.mutate(nodeId);
    },
    [splitNodeMutation],
  );

  const handleVersionHistory = useCallback(
    (nodeId: string) => {
      // Navigate to version history for this entity
      navigate(
        `/projects/${projectId}/entities/node/${nodeId}/versions`,
      );
    },
    [projectId, navigate],
  );

  // ── computed ──
  const totalDuration = useMemo(
    () => nodes.reduce((sum, n) => sum + n.duration_target, 0),
    [nodes],
  );
  const projectTitle = project?.meta.title ?? '项目';
  const sceneCount = useMemo(() => new Set(nodes.map((n) => n.scene_id)).size, [nodes]);

  // ── render ──
  return (
    <div className="flex flex-col h-screen bg-surface-soft">
      {/* Header */}
      <header className="shrink-0 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto max-w-full px-6 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                to={`/projects/${projectId}/episodes/${episodeNumber}/script`}
                className="inline-flex items-center gap-1 text-sm text-steel hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                返回脚本
              </Link>
              <h1 className="mt-0.5 text-lg font-semibold text-ink flex items-center gap-2">
                <Film className="h-5 w-5 text-primary" />
                {projectTitle} · 第 {episodeNumber} 集 · 分镜节点编辑器
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="purple">{PROJECT_STATUS_LABELS[projectStatus]}</Badge>

              {hasNodes && (
                <span className="text-sm text-steel">
                  {nodes.length} 节点 · {sceneCount} 场景 · {totalDuration}s 总时长
                </span>
              )}

              {/* Generate */}
              {!hasNodes && (
                <Button
                  onClick={handleGenerate}
                  loading={splitMutation.isPending}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  AI 自动拆分分镜
                </Button>
              )}

              {/* Save */}
              {hasNodes && (
                <Button
                  variant="secondary"
                  onClick={handleSave}
                  loading={saveMutation.isPending}
                  disabled={!dirty}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  保存修改
                </Button>
              )}

              {/* Review page link */}
              {hasNodes && (
                <Link to={`/projects/${projectId}/episodes/${episodeNumber}/storyboard/review`}>
                  <Button variant="secondary" className="gap-2">
                    <Eye className="h-4 w-4" />
                    审核分镜图
                  </Button>
                </Link>
              )}

              {/* TTS review page link */}
              {hasNodes && (
                <Link to={`/projects/${projectId}/episodes/${episodeNumber}/tts`}>
                  <Button variant="secondary" className="gap-2">
                    <Headphones className="h-4 w-4" />
                    配音审核
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0">
        {/* Loading */}
        {isLoading && (
          <div className="mx-auto max-w-7xl px-6 py-8 space-y-6" data-testid="storyboard-skeleton">
            <Skeleton className="h-8 w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm space-y-3"
                >
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-24 w-full rounded-md" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {showError && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-xl border border-semantic-error/20 bg-semantic-error/5 p-8 text-center max-w-md">
              <AlertTriangle className="h-8 w-8 text-semantic-error mx-auto mb-3" />
              <p className="text-semantic-error mb-4">加载失败：{error?.message}</p>
              <Button onClick={handleGenerate} className="gap-2">
                <Sparkles className="h-4 w-4" />
                尝试拆分分镜
              </Button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {showEmpty && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex flex-col items-center rounded-xl border border-hairline bg-canvas py-16 px-8 shadow-sm max-w-lg">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-tint-lavender">
                <Film className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-ink">还没有分镜节点</h2>
              <p className="mb-6 mt-2 text-center text-slate">
                点击「AI 自动拆分分镜」让 AI 根据脚本自动拆分镜头节点，每个节点 5-8 秒，包含镜头类型、运镜、情绪等建议。
              </p>
              <Button
                onClick={handleGenerate}
                loading={splitMutation.isPending}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                AI 自动拆分分镜
              </Button>
            </div>
          </div>
        )}

        {/* Errors banner */}
        {splitMutation.isError && (
          <div className="mx-6 mt-4 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
            <div>
              <p className="text-sm font-medium text-semantic-error">分镜拆分失败</p>
              <p className="text-xs text-slate mt-0.5">{splitMutation.error.message}</p>
            </div>
          </div>
        )}

        {saveMutation.isError && (
          <div className="mx-6 mt-4 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
            <p className="text-sm text-semantic-error">
              保存失败：{saveMutation.error.message}
            </p>
          </div>
        )}

        {/* Unsaved warning */}
        {dirty && hasNodes && (
          <div className="mx-6 mt-4 rounded-lg border border-semantic-warning/20 bg-semantic-warning/5 p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-semantic-warning" />
            <p className="text-sm text-charcoal">有未保存的修改</p>
          </div>
        )}

        {/* Editor */}
        {hasNodes && (
          <div className="h-[calc(100vh-140px)]">
            <StoryboardEditor
              nodes={nodes}
              projectId={projectId}
              episodeNumber={episodeNumber}
              onNodesChange={handleNodesChange}
              onInsertNode={handleInsertNode}
              onDeleteNode={handleDeleteNode}
              onSplitNode={handleSplitNode}
              onVersionHistory={handleVersionHistory}
            />
          </div>
        )}
      </main>
    </div>
  );
}
