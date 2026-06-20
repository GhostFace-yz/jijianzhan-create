import { useState, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle,
  RotateCcw,
  Pencil,
  Upload,
  Film,
  Sparkles,
  Play,
  AlertTriangle,
  X,
  Image as ImageIcon,
  Clock,
  Camera,
  Download,
} from 'lucide-react';
import { getProject } from '../api/projects';
import {
  listStoryboardNodesWithImages,
  batchGenerateImages,
  generateSingleImage,
  reviewNodeImage,
} from '../api/storyboard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  PROJECT_STATUS_LABELS,
  SHOT_TYPE_LABELS,
  CAMERA_MOVE_LABELS,
  IMAGE_STATUS_LABELS,
  IMAGE_STATUS_COLORS,
  NODE_STATUS_LABELS,
  type StoryboardNodeWithImage,
  type ImageGenerationStatus,
} from '../types';

// ── Constants ────────────────────────────────────────────────────────

const STATUS_ORDER: Record<ImageGenerationStatus, number> = {
  completed: 0,
  needs_redo: 1,
  generating: 2,
  pending: 3,
};

// ── Modify Dialog ────────────────────────────────────────────────────

function ModifyDialog({
  node,
  onClose,
  onSubmit,
  isPending,
}: {
  node: StoryboardNodeWithImage;
  onClose: () => void;
  onSubmit: (visualDesc: string, promptOverride: string) => void;
  isPending: boolean;
}) {
  const [visualDesc, setVisualDesc] = useState(node.visual_desc);
  const [promptOverride, setPromptOverride] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-hairline bg-canvas shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink">修改后重新生成</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-steel hover:text-ink hover:bg-surface transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-steel mb-4">节点: {node.node_id}</p>

        <label className="block text-sm font-medium text-charcoal mb-1.5">
          视觉描述 (visual_desc)
        </label>
        <textarea
          value={visualDesc}
          onChange={(e) => setVisualDesc(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary resize-none mb-4"
          placeholder="描述镜头画面..."
        />

        <label className="block text-sm font-medium text-charcoal mb-1.5">
          追加 Prompt（可选）
        </label>
        <textarea
          value={promptOverride}
          onChange={(e) => setPromptOverride(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary resize-none mb-6"
          placeholder="额外指导，如：cinematic lighting, warm tone..."
        />

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => onSubmit(visualDesc, promptOverride)}
            disabled={isPending || !visualDesc.trim()}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {isPending ? '生成中...' : '重新生成'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Dialog ────────────────────────────────────────────────────

function UploadDialog({
  node,
  onClose,
  onSubmit,
  isPending,
}: {
  node: StoryboardNodeWithImage;
  onClose: () => void;
  onSubmit: (file: File) => void;
  isPending: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      // Keep file reference for submission
      (uploadDialogState as unknown as { selectedFile: File | null }).selectedFile = file;
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0] || null);
    },
    [handleFile],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-canvas shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink">手动上传分镜图</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-steel hover:text-ink hover:bg-surface transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-steel mb-4">节点: {node.node_id} — 跳过 AI 生成，直接使用上传图片</p>

        <div
          className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-hairline-strong bg-surface-soft hover:border-primary/50'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-48 rounded-md object-contain"
            />
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted mb-2" />
              <p className="text-sm text-steel">拖拽图片到此处，或点击选择</p>
              <p className="text-xs text-muted mt-1">支持 PNG / JPG / WebP</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              const file = (uploadDialogState as unknown as { selectedFile: File | null }).selectedFile;
              if (file) onSubmit(file);
            }}
            disabled={isPending || !previewUrl}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {isPending ? '上传中...' : '确认上传'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Store file reference outside component to survive re-renders
let uploadDialogState = { selectedFile: null as File | null };

// ── Node Card ─────────────────────────────────────────────────────────

function NodeCard({
  node,
  selected,
  onSelect,
  onApprove,
  onRegenerate,
  onModifyRegenerate,
  onUpload,
  isApprovePending,
  isRegeneratePending,
}: {
  node: StoryboardNodeWithImage;
  selected: boolean;
  onSelect: (nodeId: string, shiftKey: boolean) => void;
  onApprove: (nodeId: string) => void;
  onRegenerate: (nodeId: string) => void;
  onModifyRegenerate: (nodeId: string) => void;
  onUpload: (nodeId: string) => void;
  isApprovePending: boolean;
  isRegeneratePending: boolean;
}) {
  const [hover, setHover] = useState(false);
  const hasImage = node.image_status === 'completed' && node.image_url;
  const isGenerating = node.image_status === 'generating';
  const needsRedo = node.image_status === 'needs_redo';
  const isReviewApproved = node.image_review?.approved;

  const shotLabel = SHOT_TYPE_LABELS[node.shot_type] || node.shot_type;
  const cameraLabel = CAMERA_MOVE_LABELS[node.camera_move] || node.camera_move;

  return (
    <div
      className={`
        group relative rounded-lg border bg-canvas shadow-sm transition-all select-none
        ${selected ? 'border-primary shadow-md ring-2 ring-primary/20' : 'border-hairline'}
        ${isReviewApproved ? 'ring-1 ring-brand-green/30' : ''}
        hover:shadow-md
      `}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => onSelect(node.node_id, e.shiftKey)}
    >
      {/* Selection checkbox */}
      <div
        className={`absolute top-2 left-2 z-10 flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
          selected
            ? 'bg-primary border-primary'
            : 'border-hairline-strong bg-canvas opacity-0 group-hover:opacity-100'
        }`}
      >
        {selected && <CheckCircle className="h-3.5 w-3.5 text-on-primary" />}
      </div>

      {/* Approved badge */}
      {isReviewApproved && (
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="tag-green">已通过</Badge>
        </div>
      )}

      {/* Image area */}
      <div className="relative aspect-square w-full rounded-t-lg bg-surface flex items-center justify-center overflow-hidden">
        {hasImage ? (
          <img
            src={node.image_url}
            alt={`${node.node_id} 分镜图`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : isGenerating ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline-strong border-t-primary" />
            <p className="text-xs text-steel">AI 生成中...</p>
          </div>
        ) : needsRedo ? (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <AlertTriangle className="h-8 w-8 text-semantic-warning" />
            <p className="text-xs text-semantic-warning">需要重新生成</p>
            {node.image_url && (
              <img
                src={node.image_url}
                alt={`${node.node_id} 分镜图（需重做）`}
                className="mt-1 max-h-24 rounded-md object-contain opacity-50"
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <ImageIcon className="h-8 w-8 text-muted" />
            <p className="text-xs text-muted">待生成</p>
          </div>
        )}

        {/* Hover action overlay */}
        {hover && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-deep/60 backdrop-blur-[1px] transition-opacity">
            {hasImage && !isReviewApproved && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-green/90 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(node.node_id);
                }}
                disabled={isApprovePending}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                通过
              </button>
            )}
            {hasImage && isReviewApproved && (
              <span className="rounded-md bg-brand-green/80 px-3 py-1.5 text-xs font-medium text-white">
                ✓ 已通过
              </span>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-canvas/90 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-canvas transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate(node.node_id);
                }}
                disabled={isRegeneratePending || isGenerating}
                title="相同参数重新生成"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重生成
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-canvas/90 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-canvas transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onModifyRegenerate(node.node_id);
                }}
                disabled={isGenerating}
                title="修改描述后重新生成"
              >
                <Pencil className="h-3.5 w-3.5" />
                修改
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-canvas/90 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-canvas transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpload(node.node_id);
                }}
                title="手动上传图片"
              >
                <Upload className="h-3.5 w-3.5" />
                上传
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="px-3 py-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-mono font-semibold text-ink truncate" title={node.node_id}>
            {node.node_id}
          </span>
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium shrink-0 ${IMAGE_STATUS_COLORS[node.image_status] || 'bg-surface text-steel'}`}>
            {IMAGE_STATUS_LABELS[node.image_status] || node.image_status}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-0.5 rounded bg-card-tint-lavender px-1.5 py-0.5 text-xs font-medium text-brand-purple-800">
            <Camera className="h-3 w-3" />
            {shotLabel}
          </span>
          <span className="text-xs text-slate truncate">{cameraLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-steel">
          <Clock className="h-3 w-3" />
          <span>{node.duration_target}s</span>
          {node.image_seed != null && (
            <span className="text-muted" title="生成种子">seed:{node.image_seed}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────

export function StoryboardReviewPage() {
  const { projectId = '', episodeNumber: epNumStr = '1' } = useParams<{
    projectId: string;
    episodeNumber: string;
  }>();
  const episodeNumber = parseInt(epNumStr, 10);
  const epId = `ep-${episodeNumber}`;
  const queryClient = useQueryClient();

  // ── Local state ──
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [modifyNodeId, setModifyNodeId] = useState<string | null>(null);
  const [uploadNodeId, setUploadNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [generatingNodeIds, setGeneratingNodeIds] = useState<Set<string>>(new Set());
  const [approvingNodeIds, setApprovingNodeIds] = useState<Set<string>>(new Set());

  // ── Project info ──
  const { data: projectRes } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });
  const project = projectRes?.data;
  const projectTitle = project?.meta.title ?? '项目';
  const projectStatus = project?.status ?? 'draft';

  // ── Nodes data ──
  const {
    data: nodesRes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['storyboard-nodes-images', projectId, epId],
    queryFn: () => listStoryboardNodesWithImages(projectId, epId),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      // Auto-refresh if any node is generating
      const nodes = query.state.data?.data;
      if (nodes?.some((n) => n.image_status === 'generating')) {
        return 2000;
      }
      return false;
    },
  });

  const nodes: StoryboardNodeWithImage[] = nodesRes?.data ?? [];
  const hasNodes = nodes.length > 0;

  // ── Computed ──
  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => {
      // Sort: approved first, then by node_id
      const aApproved = a.image_review?.approved ? 0 : 1;
      const bApproved = b.image_review?.approved ? 0 : 1;
      if (aApproved !== bApproved) return aApproved - bApproved;
      return a.node_id.localeCompare(b.node_id);
    }),
    [nodes],
  );

  const approvedCount = useMemo(
    () => nodes.filter((n) => n.image_review?.approved).length,
    [nodes],
  );

  const completedCount = useMemo(
    () => nodes.filter((n) => n.image_status === 'completed').length,
    [nodes],
  );

  const generatingCount = useMemo(
    () => nodes.filter((n) => n.image_status === 'generating' || generatingNodeIds.has(n.node_id)).length,
    [nodes, generatingNodeIds],
  );

  const allApproved = hasNodes && approvedCount === nodes.length;
  const allGenerated = hasNodes && nodes.every((n) => n.image_status === 'completed');

  // ── Mutations ──
  const batchGenerateMutation = useMutation({
    mutationFn: () => batchGenerateImages(projectId, epId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-images', projectId, epId] });
    },
  });

  const singleGenerateMutation = useMutation({
    mutationFn: (nodeId: string) => {
      setGeneratingNodeIds((prev) => new Set(prev).add(nodeId));
      return generateSingleImage(projectId, epId, nodeId, { force: true });
    },
    onSuccess: (_data, nodeId) => {
      setGeneratingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-images', projectId, epId] });
    },
    onError: (_error, nodeId) => {
      setGeneratingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ nodeId, approved }: { nodeId: string; approved: boolean }) =>
      reviewNodeImage(projectId, epId, nodeId, { approved, comment: '' }),
    onMutate: ({ nodeId }) => {
      setApprovingNodeIds((prev) => new Set(prev).add(nodeId));
    },
    onSuccess: (_data, { nodeId }) => {
      setApprovingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-images', projectId, epId] });
    },
    onError: (_error, { nodeId }) => {
      setApprovingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
  });

  // ── Handlers ──
  const handleSelect = useCallback(
    (nodeId: string, shiftKey: boolean) => {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastClickedId) {
          // Range select
          const sortedIds = sortedNodes.map((n) => n.node_id);
          const lastIdx = sortedIds.indexOf(lastClickedId);
          const currIdx = sortedIds.indexOf(nodeId);
          if (lastIdx >= 0 && currIdx >= 0) {
            const [from, to] = lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx];
            for (let i = from; i <= to; i++) {
              next.add(sortedIds[i]);
            }
          }
        } else if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
      setLastClickedId(nodeId);
    },
    [lastClickedId, sortedNodes],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedNodeIds.size === nodes.length) {
      setSelectedNodeIds(new Set());
    } else {
      setSelectedNodeIds(new Set(nodes.map((n) => n.node_id)));
    }
  }, [selectedNodeIds, nodes]);

  const handleApprove = useCallback(
    (nodeId: string) => {
      reviewMutation.mutate({ nodeId, approved: true });
    },
    [reviewMutation],
  );

  const handleRegenerate = useCallback(
    (nodeId: string) => {
      singleGenerateMutation.mutate(nodeId);
    },
    [singleGenerateMutation],
  );

  const handleModifyRegenerate = useCallback((nodeId: string) => {
    setModifyNodeId(nodeId);
  }, []);

  const handleModifySubmit = useCallback(
    (visualDesc: string, _promptOverride: string) => {
      if (!modifyNodeId) return;
      // For now, regenerate with force=true to get new image
      // In a full implementation, we'd update the node's visual_desc first
      singleGenerateMutation.mutate(modifyNodeId);
      setModifyNodeId(null);
    },
    [modifyNodeId, singleGenerateMutation],
  );

  const handleUpload = useCallback((nodeId: string) => {
    uploadDialogState = { selectedFile: null };
    setUploadNodeId(nodeId);
  }, []);

  const handleUploadSubmit = useCallback(
    (_file: File) => {
      if (!uploadNodeId) return;
      // Manual upload: approve the node (treating uploaded image as accepted)
      // In a full implementation, this would upload the file first
      reviewMutation.mutate({ nodeId: uploadNodeId, approved: true });
      setUploadNodeId(null);
    },
    [uploadNodeId, reviewMutation],
  );

  const handleBatchApprove = useCallback(() => {
    const ids = Array.from(selectedNodeIds);
    for (const nodeId of ids) {
      // Only approve nodes that have completed images and aren't already approved
      const node = nodes.find((n) => n.node_id === nodeId);
      if (node && node.image_status === 'completed' && !node.image_review?.approved) {
        reviewMutation.mutate({ nodeId, approved: true });
      }
    }
    setSelectedNodeIds(new Set());
  }, [selectedNodeIds, nodes, reviewMutation]);

  const handleBatchRegenerate = useCallback(() => {
    const ids = Array.from(selectedNodeIds);
    for (const nodeId of ids) {
      singleGenerateMutation.mutate(nodeId);
    }
    setSelectedNodeIds(new Set());
  }, [selectedNodeIds, singleGenerateMutation]);

  const handleGenerateAll = useCallback(() => {
    batchGenerateMutation.mutate();
  }, [batchGenerateMutation]);

  const modifyNode = modifyNodeId ? nodes.find((n) => n.node_id === modifyNodeId) : null;
  const uploadNode = uploadNodeId ? nodes.find((n) => n.node_id === uploadNodeId) : null;

  const selectedCount = selectedNodeIds.size;
  const canBatchApprove = selectedCount > 0 &&
    Array.from(selectedNodeIds).some((id) => {
      const node = nodes.find((n) => n.node_id === id);
      return node && node.image_status === 'completed' && !node.image_review?.approved;
    });

  // ── Render ──
  return (
    <div className="flex flex-col h-screen bg-surface-soft">
      {/* Header */}
      <header className="shrink-0 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto max-w-full px-6 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                to={`/projects/${projectId}/episodes/${episodeNumber}/storyboard`}
                className="inline-flex items-center gap-1 text-sm text-steel hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                返回分镜编辑器
              </Link>
              <h1 className="mt-0.5 text-lg font-semibold text-ink flex items-center gap-2">
                <Film className="h-5 w-5 text-primary" />
                {projectTitle} · 第 {episodeNumber} 集 · 分镜图审核
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="purple">{PROJECT_STATUS_LABELS[projectStatus]}</Badge>

              {hasNodes && (
                <>
                  <span className="text-sm text-steel">
                    {approvedCount}/{nodes.length} 已通过
                  </span>
                  {generatingCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-sm text-link-blue">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-link-blue border-t-transparent" />
                      {generatingCount} 生成中
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      {hasNodes && (
        <div className="shrink-0 border-b border-hairline bg-canvas px-6 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* View mode toggle */}
            <div className="flex rounded-md border border-hairline overflow-hidden mr-2">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-primary text-on-primary'
                    : 'bg-canvas text-steel hover:bg-surface'
                }`}
                onClick={() => setViewMode('grid')}
              >
                网格
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-primary text-on-primary'
                    : 'bg-canvas text-steel hover:bg-surface'
                }`}
                onClick={() => setViewMode('timeline')}
              >
                时间轴
              </button>
            </div>

            {/* Select all */}
            <button
              type="button"
              className="text-xs text-steel hover:text-ink px-2 py-1 rounded hover:bg-surface transition-colors"
              onClick={handleSelectAll}
            >
              {selectedNodeIds.size === nodes.length ? '取消全选' : '全选'}
            </button>

            {/* Batch actions */}
            {selectedCount > 0 && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-hairline">
                <span className="text-xs text-steel">{selectedCount} 个选中</span>
                {canBatchApprove && (
                  <Button
                    variant="secondary"
                    onClick={handleBatchApprove}
                    disabled={reviewMutation.isPending}
                    className="text-xs h-8 gap-1.5"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    批量通过
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={handleBatchRegenerate}
                  disabled={singleGenerateMutation.isPending}
                  className="text-xs h-8 gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  批量重生成
                </Button>
              </div>
            )}

            {/* Generate buttons */}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="secondary"
                onClick={handleGenerateAll}
                disabled={batchGenerateMutation.isPending || generatingCount > 0}
                className="gap-2 text-sm"
              >
                <Sparkles className="h-4 w-4" />
                {batchGenerateMutation.isPending ? '生成中...' : '全部生成'}
              </Button>

              {/* Unlock video generation */}
              {allApproved && (
                <Button
                  onClick={() => {
                    // Placeholder: navigate to video generation
                  }}
                  className="gap-2 text-sm"
                >
                  <Play className="h-4 w-4" />
                  批量生成视频
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline-strong border-t-primary" />
            <p className="mt-4 text-sm text-slate">加载分镜节点...</p>
          </div>
        )}

        {/* Error */}
        {error && !hasNodes && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-xl border border-semantic-error/20 bg-semantic-error/5 p-8 text-center max-w-md">
              <AlertTriangle className="h-8 w-8 text-semantic-error mx-auto mb-3" />
              <p className="text-semantic-error mb-1">加载失败</p>
              <p className="text-sm text-steel">{(error as Error).message}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && !hasNodes && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex flex-col items-center rounded-xl border border-hairline bg-canvas py-16 px-8 shadow-sm max-w-lg">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-tint-lavender">
                <ImageIcon className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-ink">还没有分镜节点</h2>
              <p className="mb-6 mt-2 text-center text-slate">
                请先在分镜编辑器中通过 AI 拆分生成分镜节点，然后再进入此页面审核分镜图。
              </p>
              <Link
                to={`/projects/${projectId}/episodes/${episodeNumber}/storyboard`}
              >
                <Button className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  前往分镜编辑器
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Batch generate summary */}
        {batchGenerateMutation.isSuccess && batchGenerateMutation.data && (
          <div className="mx-6 mt-4 rounded-lg border border-brand-green/20 bg-card-tint-mint/50 p-4">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="h-5 w-5 text-brand-green" />
              <p className="text-sm font-medium text-charcoal">批量生成完成</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div>
                <p className="text-xs text-steel">总数</p>
                <p className="font-semibold text-ink">{batchGenerateMutation.data.data.summary.total}</p>
              </div>
              <div>
                <p className="text-xs text-steel">已完成</p>
                <p className="font-semibold text-brand-green">{batchGenerateMutation.data.data.summary.completed}</p>
              </div>
              <div>
                <p className="text-xs text-steel">需重做</p>
                <p className="font-semibold text-semantic-warning">{batchGenerateMutation.data.data.summary.needs_redo}</p>
              </div>
              <div>
                <p className="text-xs text-steel">失败</p>
                <p className="font-semibold text-semantic-error">{batchGenerateMutation.data.data.summary.failed}</p>
              </div>
              <div>
                <p className="text-xs text-steel">角色注入率</p>
                <p className="font-semibold text-ink">{batchGenerateMutation.data.data.summary.ip_adapter_injection_rate}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Errors banner */}
        {batchGenerateMutation.isError && (
          <div className="mx-6 mt-4 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
            <div>
              <p className="text-sm font-medium text-semantic-error">批量生成失败</p>
              <p className="text-xs text-slate mt-0.5">{batchGenerateMutation.error.message}</p>
            </div>
          </div>
        )}

        {/* Node grid */}
        {hasNodes && viewMode === 'grid' && (
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {sortedNodes.map((node) => (
                <NodeCard
                  key={node.node_id}
                  node={node}
                  selected={selectedNodeIds.has(node.node_id)}
                  onSelect={handleSelect}
                  onApprove={handleApprove}
                  onRegenerate={handleRegenerate}
                  onModifyRegenerate={handleModifyRegenerate}
                  onUpload={handleUpload}
                  isApprovePending={approvingNodeIds.has(node.node_id)}
                  isRegeneratePending={generatingNodeIds.has(node.node_id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Timeline view */}
        {hasNodes && viewMode === 'timeline' && (
          <div className="p-6">
            <div className="space-y-3">
              {sortedNodes.map((node, idx) => (
                <div
                  key={node.node_id}
                  className={`flex items-center gap-4 rounded-lg border bg-canvas p-4 shadow-sm transition-all ${
                    selectedNodeIds.has(node.node_id)
                      ? 'border-primary shadow-md ring-2 ring-primary/20'
                      : 'border-hairline'
                  } ${node.image_review?.approved ? 'ring-1 ring-brand-green/30' : ''}`}
                  onClick={(e) => handleSelect(node.node_id, e.shiftKey)}
                >
                  {/* Selection checkbox */}
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all ${
                      selectedNodeIds.has(node.node_id)
                        ? 'bg-primary border-primary'
                        : 'border-hairline-strong'
                    }`}
                  >
                    {selectedNodeIds.has(node.node_id) && (
                      <CheckCircle className="h-3.5 w-3.5 text-on-primary" />
                    )}
                  </div>

                  {/* Index */}
                  <span className="text-xs font-mono text-muted w-16 shrink-0">
                    {node.node_id}
                  </span>

                  {/* Thumbnail */}
                  <div className="h-16 w-16 shrink-0 rounded-md bg-surface flex items-center justify-center overflow-hidden">
                    {node.image_url ? (
                      <img
                        src={node.image_url}
                        alt={node.node_id}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">
                        {SHOT_TYPE_LABELS[node.shot_type]}
                      </span>
                      <span className="text-xs text-steel">
                        {CAMERA_MOVE_LABELS[node.camera_move]} · {node.duration_target}s
                      </span>
                    </div>
                    <p className="text-xs text-slate truncate mt-0.5" title={node.visual_desc}>
                      {node.visual_desc}
                    </p>
                  </div>

                  {/* Status */}
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium shrink-0 ${IMAGE_STATUS_COLORS[node.image_status] || 'bg-surface text-steel'}`}>
                    {IMAGE_STATUS_LABELS[node.image_status] || node.image_status}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {node.image_status === 'completed' && !node.image_review?.approved && (
                      <Button
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(node.node_id);
                        }}
                        disabled={approvingNodeIds.has(node.node_id)}
                        className="h-8 w-8 p-0"
                        title="通过"
                      >
                        <CheckCircle className="h-4 w-4 text-brand-green" />
                      </Button>
                    )}
                    {node.image_review?.approved && (
                      <Badge variant="tag-green">已通过</Badge>
                    )}
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerate(node.node_id);
                      }}
                      disabled={generatingNodeIds.has(node.node_id) || node.image_status === 'generating'}
                      className="h-8 w-8 p-0"
                      title="重新生成"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modify dialog */}
      {modifyNode && (
        <ModifyDialog
          node={modifyNode}
          onClose={() => setModifyNodeId(null)}
          onSubmit={handleModifySubmit}
          isPending={singleGenerateMutation.isPending}
        />
      )}

      {/* Upload dialog */}
      {uploadNode && (
        <UploadDialog
          node={uploadNode}
          onClose={() => setUploadNodeId(null)}
          onSubmit={handleUploadSubmit}
          isPending={reviewMutation.isPending}
        />
      )}
    </div>
  );
}
