import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  RotateCcw,
  Pencil,
  Upload,
  Volume2,
  VolumeX,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Headphones,
  Check,
  X,
  MessageSquare,
  Music,
} from 'lucide-react';
import { getProject } from '../api/projects';
import {
  listStoryboardNodesWithAudio,
  batchGenerateTts,
  generateNodeTts,
  reviewNodeTts,
  uploadNodeTts,
  updateStoryboardNodes,
} from '../api/tts';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  PROJECT_STATUS_LABELS,
  TTS_STATUS_LABELS,
  TTS_STATUS_COLORS,
  EMOTION_LABELS,
  EMOTION_TAG_OPTIONS,
  type StoryboardNodeWithAudio,
  type TtsStatus,
  type TtsGenerateOptions,
} from '../types';

// ── Helpers ──────────────────────────────────────────────────────────

function getTtsStatus(node: StoryboardNodeWithAudio): TtsStatus {
  if (node.audio_clip) return node.audio_clip.status;
  return 'pending';
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getAudioFileDuration(file: File): number {
  return (file as File & { duration?: number }).duration ?? 0;
}

function getEmotionLabel(emotion: string): string {
  return EMOTION_LABELS[emotion] || emotion;
}

// ── Dialogs ───────────────────────────────────────────────────────────

function EditDialog({
  title,
  children,
  onClose,
  onSubmit,
  isPending,
  submitDisabled = false,
  submitLabel = '确认',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-hairline bg-canvas shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-steel hover:text-ink hover:bg-surface transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || submitDisabled}
            className="gap-2"
          >
            {isPending ? '处理中...' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmotionEditDialog({
  node,
  onClose,
  onSubmit,
  isPending,
}: {
  node: StoryboardNodeWithAudio;
  onClose: () => void;
  onSubmit: (emotion: string) => void;
  isPending: boolean;
}) {
  const [emotion, setEmotion] = useState(node.emotion_tag || 'neutral');

  return (
    <EditDialog
      title="修改情绪后重新生成"
      onClose={onClose}
      onSubmit={() => onSubmit(emotion)}
      isPending={isPending}
      submitLabel="重新生成"
    >
      <p className="text-xs text-steel mb-4">节点: {node.node_id}</p>
      <label className="block text-sm font-medium text-charcoal mb-1.5">
        情绪标签
      </label>
      <select
        value={emotion}
        onChange={(e) => setEmotion(e.target.value)}
        className="w-full rounded-md border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
      >
        {EMOTION_TAG_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </EditDialog>
  );
}

function DialogueEditDialog({
  node,
  onClose,
  onSubmit,
  isPending,
}: {
  node: StoryboardNodeWithAudio;
  onClose: () => void;
  onSubmit: (text: string) => void;
  isPending: boolean;
}) {
  const [text, setText] = useState(node.dialogue?.text || '');

  return (
    <EditDialog
      title="修改台词后重新生成"
      onClose={onClose}
      onSubmit={() => onSubmit(text.trim())}
      isPending={isPending}
      submitLabel="保存并重生成"
      submitDisabled={!text.trim()}
    >
      <p className="text-xs text-steel mb-4">节点: {node.node_id}</p>
      <label className="block text-sm font-medium text-charcoal mb-1.5">
        台词文本
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary resize-none"
        placeholder="输入台词..."
      />
    </EditDialog>
  );
}

function UploadDialog({
  node,
  onClose,
  onSubmit,
  isPending,
}: {
  node: StoryboardNodeWithAudio;
  onClose: () => void;
  onSubmit: (file: File) => void;
  isPending: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) return;
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0] || null);
    },
    [handleFile],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-canvas shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink">手动上传录音</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-steel hover:text-ink hover:bg-surface transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-steel mb-4">
          节点: {node.node_id} — 使用 wav / mp3 替换 AI 配音
        </p>

        <div
          aria-label="拖拽音频到此处，或点击选择"
          role="button"
          tabIndex={0}
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
          {selectedFile ? (
            <div className="text-center">
              <Music className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-ink font-medium">{selectedFile.name}</p>
              <p className="text-xs text-steel mt-1">
                {formatDuration(getAudioFileDuration(selectedFile))}
              </p>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted mb-2" />
              <p className="text-sm text-steel">拖拽音频到此处，或点击选择</p>
              <p className="text-xs text-muted mt-1">支持 WAV / MP3</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/wav,audio/mpeg,audio/mp3"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => selectedFile && onSubmit(selectedFile)}
            disabled={isPending || !selectedFile}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {isPending ? '上传中...' : '确认替换'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Audio Player ──────────────────────────────────────────────────────

function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [url]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
    setCurrentTime(audio.currentTime);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const v = Number(e.target.value);
    audio.volume = v;
    setVolume(v);
    setMuted(v === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !muted;
    setMuted(!muted);
  };

  return (
    <div className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2 border border-hairline">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-pressed transition-colors"
        aria-label={playing ? '暂停' : '播放'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      <span className="text-xs text-steel w-14 text-center">
        {formatDuration(currentTime)} / {formatDuration(duration)}
      </span>

      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        className="flex-1 h-1 bg-hairline-strong rounded-lg appearance-none cursor-pointer accent-primary"
      />

      <button
        type="button"
        onClick={toggleMute}
        className="text-steel hover:text-ink"
        aria-label={muted ? '取消静音' : '静音'}
      >
        {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={handleVolume}
        className="w-20 h-1 bg-hairline-strong rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

// ── Node Card ─────────────────────────────────────────────────────────

function NodeCard({
  node,
  selected,
  onSelect,
  onPlay,
  onRegenerate,
  onEditEmotion,
  onEditDialogue,
  onUpload,
  onApprove,
  onReject,
  isGenerating,
  isReviewing,
}: {
  node: StoryboardNodeWithAudio;
  selected: boolean;
  onSelect: (nodeId: string, shiftKey: boolean) => void;
  onPlay: (nodeId: string) => void;
  onRegenerate: (nodeId: string) => void;
  onEditEmotion: (nodeId: string) => void;
  onEditDialogue: (nodeId: string) => void;
  onUpload: (nodeId: string) => void;
  onApprove: (nodeId: string) => void;
  onReject: (nodeId: string) => void;
  isGenerating: boolean;
  isReviewing: boolean;
}) {
  const [hover, setHover] = useState(false);
  const status = getTtsStatus(node);
  const hasAudio = !!node.audio_clip?.url;
  const isReviewed = status === 'reviewed';
  const isApproved = isReviewed && node.audio_clip?.reviewed;
  const isRejected = isReviewed && node.audio_clip?.reviewed === false;

  const dialogueText = node.dialogue?.text || '';
  const charId = node.dialogue?.char_id || '-';
  const emotionLabel = getEmotionLabel(node.emotion_tag || node.dialogue?.emotion || 'neutral');

  return (
    <div
      data-testid={`tts-node-${node.node_id}`}
      className={`
        group relative rounded-lg border bg-canvas shadow-sm transition-all select-none
        ${selected ? 'border-primary shadow-md ring-2 ring-primary/20' : 'border-hairline'}
        ${isApproved ? 'ring-1 ring-brand-green/30' : ''}
        ${isRejected ? 'ring-1 ring-semantic-error/30' : ''}
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

      {/* Status badge */}
      <div className="absolute top-2 right-2 z-10">
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
            TTS_STATUS_COLORS[status] || 'bg-surface text-steel'
          }`}
        >
          {TTS_STATUS_LABELS[status] || status}
        </span>
      </div>

      {/* Main content */}
      <div className="p-4 pt-8">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-mono font-semibold text-ink truncate" title={node.node_id}>
            {node.node_id}
          </span>
          <span className="text-xs text-steel">{node.duration_target}s</span>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-steel">角色:</span>
            <span className="text-sm font-medium text-charcoal">{charId}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-steel">情绪:</span>
            <Badge variant="tag-purple">{emotionLabel}</Badge>
          </div>
          <div>
            <span className="text-xs text-steel">台词:</span>
            <p className="text-sm text-ink mt-0.5 line-clamp-3" title={dialogueText}>
              {dialogueText || <span className="text-muted italic">无台词</span>}
            </p>
          </div>
        </div>

        {/* Audio player */}
        {hasAudio ? (
          <div className="mb-3">
            <AudioPlayer url={node.audio_clip!.url} />
          </div>
        ) : (
          <div className="mb-3 flex items-center justify-center rounded-lg border border-dashed border-hairline-strong bg-surface-soft py-6">
            <div className="text-center">
              <Headphones className="h-6 w-6 text-muted mx-auto mb-1" />
              <p className="text-xs text-steel">待生成配音</p>
            </div>
          </div>
        )}

        {/* Review comment */}
        {node.audio_clip?.review_comment && (
          <div className="mb-3 flex items-start gap-1.5 text-xs text-steel bg-surface-soft rounded px-2 py-1.5">
            <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{node.audio_clip.review_comment}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {!hasAudio && (
            <Button
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate(node.node_id);
              }}
              disabled={isGenerating}
              className="text-xs h-8 gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isGenerating ? '生成中...' : '生成配音'}
            </Button>
          )}

          {hasAudio && !isReviewed && (
            <>
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(node.node_id);
                }}
                disabled={isReviewing}
                className="text-xs h-8 gap-1.5 text-brand-green hover:text-brand-green hover:bg-card-tint-mint"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                通过
              </Button>
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onReject(node.node_id);
                }}
                disabled={isReviewing}
                className="text-xs h-8 gap-1.5 text-semantic-error hover:text-semantic-error hover:bg-semantic-error/5"
              >
                <XCircle className="h-3.5 w-3.5" />
                驳回
              </Button>
            </>
          )}

          {hasAudio && (
            <Button
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate(node.node_id);
              }}
              disabled={isGenerating}
              className="text-xs h-8 gap-1.5"
              title="相同参数重新生成"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重生成
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onEditEmotion(node.node_id);
            }}
            disabled={isGenerating}
            className="text-xs h-8 gap-1.5"
            title="修改情绪后重新生成"
          >
            <Pencil className="h-3.5 w-3.5" />
            改情绪
          </Button>

          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onEditDialogue(node.node_id);
            }}
            disabled={isGenerating}
            className="text-xs h-8 gap-1.5"
            title="修改台词后重新生成"
          >
            <Pencil className="h-3.5 w-3.5" />
            改台词
          </Button>

          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onUpload(node.node_id);
            }}
            className="text-xs h-8 gap-1.5"
            title="手动上传录音"
          >
            <Upload className="h-3.5 w-3.5" />
            上传
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export function TtsReviewPage() {
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
  const [emotionNodeId, setEmotionNodeId] = useState<string | null>(null);
  const [dialogueNodeId, setDialogueNodeId] = useState<string | null>(null);
  const [uploadNodeId, setUploadNodeId] = useState<string | null>(null);
  const [generatingNodeIds, setGeneratingNodeIds] = useState<Set<string>>(new Set());
  const [reviewingNodeIds, setReviewingNodeIds] = useState<Set<string>>(new Set());
  const [editingNodeIds, setEditingNodeIds] = useState<Set<string>>(new Set());

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
    queryKey: ['storyboard-nodes-audio', projectId, epId],
    queryFn: () => listStoryboardNodesWithAudio(projectId, epId),
    enabled: Boolean(projectId),
  });

  const nodes: StoryboardNodeWithAudio[] = useMemo(
    () =>
      (nodesRes?.data ?? []).map((n) => ({
        ...n,
        tts_status: getTtsStatus(n as StoryboardNodeWithAudio),
      })),
    [nodesRes],
  );
  const hasNodes = nodes.length > 0;

  // ── Computed ──
  const sortedNodes = useMemo(
    () =>
      [...nodes].sort((a, b) => {
        const aReviewed = a.audio_clip?.status === 'reviewed' ? 0 : 1;
        const bReviewed = b.audio_clip?.status === 'reviewed' ? 0 : 1;
        if (aReviewed !== bReviewed) return aReviewed - bReviewed;
        return a.node_id.localeCompare(b.node_id);
      }),
    [nodes],
  );

  const reviewedCount = useMemo(
    () => nodes.filter((n) => n.audio_clip?.status === 'reviewed').length,
    [nodes],
  );
  const generatedCount = useMemo(
    () => nodes.filter((n) => n.audio_clip?.url).length,
    [nodes],
  );

  // ── Mutations ──
  const batchGenerateMutation = useMutation({
    mutationFn: () => batchGenerateTts(projectId, epId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-audio', projectId, epId] });
    },
  });

  const singleGenerateMutation = useMutation({
    mutationFn: ({ nodeId, options }: { nodeId: string; options?: TtsGenerateOptions }) =>
      generateNodeTts(projectId, epId, nodeId, options),
    onMutate: ({ nodeId }) => {
      setGeneratingNodeIds((prev) => new Set(prev).add(nodeId));
    },
    onSuccess: (_data, { nodeId }) => {
      setGeneratingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-audio', projectId, epId] });
    },
    onError: (_error, { nodeId }) => {
      setGeneratingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ nodeId, approved }: { nodeId: string; approved: boolean }) =>
      reviewNodeTts(projectId, epId, nodeId, { approved }),
    onMutate: ({ nodeId }) => {
      setReviewingNodeIds((prev) => new Set(prev).add(nodeId));
    },
    onSuccess: (_data, { nodeId }) => {
      setReviewingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-audio', projectId, epId] });
    },
    onError: (_error, { nodeId }) => {
      setReviewingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ nodeId, input }: { nodeId: string; input: { url: string; duration: number } }) =>
      uploadNodeTts(projectId, epId, nodeId, input),
    onSuccess: (_data, { nodeId }) => {
      setUploadNodeId(null);
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-audio', projectId, epId] });
    },
  });

  const editNodeMutation = useMutation({
    mutationFn: async ({
      nodeId,
      updater,
      regenerateOptions,
    }: {
      nodeId: string;
      updater: (node: StoryboardNodeWithAudio) => StoryboardNodeWithAudio;
      regenerateOptions?: TtsGenerateOptions;
    }) => {
      setEditingNodeIds((prev) => new Set(prev).add(nodeId));
      const allNodes = nodes.map((n) => (n.node_id === nodeId ? updater(n) : n));
      await updateStoryboardNodes(projectId, epId, { nodes: allNodes });
      const result = await generateNodeTts(projectId, epId, nodeId, regenerateOptions);
      setEditingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      return result;
    },
    onSuccess: () => {
      setEmotionNodeId(null);
      setDialogueNodeId(null);
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-audio', projectId, epId] });
    },
  });

  // ── Handlers ──
  const handleSelect = useCallback(
    (nodeId: string, shiftKey: boolean) => {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastClickedId) {
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

  const handleRegenerate = useCallback(
    (nodeId: string) => {
      singleGenerateMutation.mutate({ nodeId });
    },
    [singleGenerateMutation],
  );

  const handleApprove = useCallback(
    (nodeId: string) => {
      reviewMutation.mutate({ nodeId, approved: true });
    },
    [reviewMutation],
  );

  const handleReject = useCallback(
    (nodeId: string) => {
      reviewMutation.mutate({ nodeId, approved: false });
    },
    [reviewMutation],
  );

  const handleEditEmotion = useCallback((nodeId: string) => {
    setEmotionNodeId(nodeId);
  }, []);

  const handleEditDialogue = useCallback((nodeId: string) => {
    setDialogueNodeId(nodeId);
  }, []);

  const handleUpload = useCallback((nodeId: string) => {
    setUploadNodeId(nodeId);
  }, []);

  const handleEmotionSubmit = useCallback(
    (emotion: string) => {
      if (!emotionNodeId) return;
      const nodeId = emotionNodeId;
      editNodeMutation.mutate({
        nodeId,
        updater: (n) => ({ ...n, emotion_tag: emotion }),
        regenerateOptions: { emotion },
      });
    },
    [emotionNodeId, editNodeMutation],
  );

  const handleDialogueSubmit = useCallback(
    (text: string) => {
      if (!dialogueNodeId) return;
      const nodeId = dialogueNodeId;
      editNodeMutation.mutate({
        nodeId,
        updater: (n) => ({
          ...n,
          dialogue: n.dialogue ? { ...n.dialogue, text } : { char_id: '-', text, emotion: n.emotion_tag || 'neutral' },
        }),
      });
    },
    [dialogueNodeId, editNodeMutation],
  );

  const handleUploadSubmit = useCallback(
    (file: File) => {
      if (!uploadNodeId) return;
      // Create object URL for local playback; in production this would be uploaded to storage first
      const url = URL.createObjectURL(file);
      uploadMutation.mutate({
        nodeId: uploadNodeId,
        input: { url, duration: getAudioFileDuration(file) },
      });
    },
    [uploadNodeId, uploadMutation],
  );

  const handleBatchGenerate = useCallback(() => {
    batchGenerateMutation.mutate();
  }, [batchGenerateMutation]);

  const handleBatchApprove = useCallback(() => {
    const ids = Array.from(selectedNodeIds);
    for (const nodeId of ids) {
      const node = nodes.find((n) => n.node_id === nodeId);
      if (node?.audio_clip?.url && node.audio_clip.status !== 'reviewed') {
        reviewMutation.mutate({ nodeId, approved: true });
      }
    }
    setSelectedNodeIds(new Set());
  }, [selectedNodeIds, nodes, reviewMutation]);

  const handleBatchRegenerate = useCallback(() => {
    const ids = Array.from(selectedNodeIds);
    for (const nodeId of ids) {
      singleGenerateMutation.mutate({ nodeId });
    }
    setSelectedNodeIds(new Set());
  }, [selectedNodeIds, singleGenerateMutation]);

  const selectedCount = selectedNodeIds.size;
  const canBatchApprove = selectedCount > 0 &&
    Array.from(selectedNodeIds).some((id) => {
      const node = nodes.find((n) => n.node_id === id);
      return node?.audio_clip?.url && node.audio_clip.status !== 'reviewed';
    });

  const emotionNode = emotionNodeId ? nodes.find((n) => n.node_id === emotionNodeId) : null;
  const dialogueNode = dialogueNodeId ? nodes.find((n) => n.node_id === dialogueNodeId) : null;
  const uploadNode = uploadNodeId ? nodes.find((n) => n.node_id === uploadNodeId) : null;

  // ── Render ──
  return (
    <div className="flex flex-col h-screen bg-surface-soft">
      {/* Header */}
      <header className="shrink-0 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto max-w-full px-6 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                to={`/projects/${projectId}/episodes/${episodeNumber}/storyboard/review`}
                className="inline-flex items-center gap-1 text-sm text-steel hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                返回分镜审核
              </Link>
              <h1 className="mt-0.5 text-lg font-semibold text-ink flex items-center gap-2">
                <Headphones className="h-5 w-5 text-primary" />
                {projectTitle} · 第 {episodeNumber} 集 · 配音试听与审核
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="purple">{PROJECT_STATUS_LABELS[projectStatus]}</Badge>
              {hasNodes && (
                <span className="text-sm text-steel">
                  {reviewedCount}/{nodes.length} 已审核 · {generatedCount} 已生成
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      {hasNodes && (
        <div className="shrink-0 border-b border-hairline bg-canvas px-6 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="text-xs text-steel hover:text-ink px-2 py-1 rounded hover:bg-surface transition-colors"
              onClick={handleSelectAll}
            >
              {selectedNodeIds.size === nodes.length ? '取消全选' : '全选'}
            </button>

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

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="secondary"
                onClick={handleBatchGenerate}
                disabled={batchGenerateMutation.isPending}
                className="gap-2 text-sm"
              >
                <Sparkles className="h-4 w-4" />
                {batchGenerateMutation.isPending ? '生成中...' : '批量生成配音'}
              </Button>
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
                <Headphones className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-ink">还没有分镜节点</h2>
              <p className="mb-6 mt-2 text-center text-slate">
                请先在分镜编辑器中通过 AI 拆分生成分镜节点，然后再进入此页面生成与审核配音。
              </p>
              <Link to={`/projects/${projectId}/episodes/${episodeNumber}/storyboard`}>
                <Button className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  前往分镜编辑器
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Batch result summary */}
        {batchGenerateMutation.isSuccess && batchGenerateMutation.data && (
          <div className="mx-6 mt-4 rounded-lg border border-brand-green/20 bg-card-tint-mint/50 p-4">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="h-5 w-5 text-brand-green" />
              <p className="text-sm font-medium text-charcoal">批量配音生成完成</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
              <div>
                <p className="text-xs text-steel">总数</p>
                <p className="font-semibold text-ink">{batchGenerateMutation.data.data.total_nodes}</p>
              </div>
              <div>
                <p className="text-xs text-steel">有台词</p>
                <p className="font-semibold text-ink">{batchGenerateMutation.data.data.nodes_with_dialogue}</p>
              </div>
              <div>
                <p className="text-xs text-steel">已生成</p>
                <p className="font-semibold text-brand-green">{batchGenerateMutation.data.data.nodes_generated}</p>
              </div>
              <div>
                <p className="text-xs text-steel">跳过</p>
                <p className="font-semibold text-steel">{batchGenerateMutation.data.data.nodes_skipped}</p>
              </div>
              <div>
                <p className="text-xs text-steel">失败</p>
                <p className="font-semibold text-semantic-error">{batchGenerateMutation.data.data.nodes_failed}</p>
              </div>
              <div>
                <p className="text-xs text-steel">成功率</p>
                <p className="font-semibold text-ink">{Math.round(batchGenerateMutation.data.data.success_rate * 100)}%</p>
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

        {editNodeMutation.isError && (
          <div className="mx-6 mt-4 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
            <div>
              <p className="text-sm font-medium text-semantic-error">编辑失败</p>
              <p className="text-xs text-slate mt-0.5">{editNodeMutation.error.message}</p>
            </div>
          </div>
        )}

        {/* Node grid */}
        {hasNodes && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {sortedNodes.map((node) => (
                <NodeCard
                  key={node.node_id}
                  node={node}
                  selected={selectedNodeIds.has(node.node_id)}
                  onSelect={handleSelect}
                  onPlay={() => {}}
                  onRegenerate={handleRegenerate}
                  onEditEmotion={handleEditEmotion}
                  onEditDialogue={handleEditDialogue}
                  onUpload={handleUpload}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isGenerating={generatingNodeIds.has(node.node_id) || editingNodeIds.has(node.node_id)}
                  isReviewing={reviewingNodeIds.has(node.node_id)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Emotion edit dialog */}
      {emotionNode && (
        <EmotionEditDialog
          node={emotionNode}
          onClose={() => setEmotionNodeId(null)}
          onSubmit={handleEmotionSubmit}
          isPending={editNodeMutation.isPending}
        />
      )}

      {/* Dialogue edit dialog */}
      {dialogueNode && (
        <DialogueEditDialog
          node={dialogueNode}
          onClose={() => setDialogueNodeId(null)}
          onSubmit={handleDialogueSubmit}
          isPending={editNodeMutation.isPending}
        />
      )}

      {/* Upload dialog */}
      {uploadNode && (
        <UploadDialog
          node={uploadNode}
          onClose={() => setUploadNodeId(null)}
          onSubmit={handleUploadSubmit}
          isPending={uploadMutation.isPending}
        />
      )}
    </div>
  );
}
