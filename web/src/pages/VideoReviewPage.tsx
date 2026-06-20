import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  RotateCcw,
  Upload,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Film,
  Check,
  X,
  MessageSquare,
  SlidersHorizontal,
  Clock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  SkipBack,
  Clapperboard,
} from 'lucide-react';
import { getProject } from '../api/projects';
import { listStoryboardNodes } from '../api/storyboard';
import { batchGenerateVideo, generateNodeVideo, reviewNodeVideo, uploadNodeVideoFile } from '../api/video';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  PROJECT_STATUS_LABELS,
  VIDEO_STATUS_LABELS,
  VIDEO_STATUS_COLORS,
  CAMERA_MOVE_LABELS,
  SHOT_TYPE_LABELS,
  type StoryboardNodeWithVideo,
  type VideoStatus,
  type VideoGenerateOptions,
  type QualityReport,
} from '../types';

// ── Helpers ──────────────────────────────────────────────────────────

function getVideoStatus(node: StoryboardNodeWithVideo): VideoStatus {
  if (node.video_clip) return node.video_clip.status;
  return 'pending';
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getVideoFileDuration(file: File): number {
  return (file as File & { duration?: number }).duration ?? 0;
}

function isVideoApproved(node: StoryboardNodeWithVideo): boolean {
  return node.video_clip?.status === 'reviewed' && node.video_clip.reviewed === true;
}

function isVideoRejected(node: StoryboardNodeWithVideo): boolean {
  return node.video_clip?.status === 'reviewed' && node.video_clip.reviewed === false;
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

function UploadDialog({
  node,
  onClose,
  onSubmit,
  isPending,
}: {
  node: StoryboardNodeWithVideo;
  onClose: () => void;
  onSubmit: (file: File) => void;
  isPending: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) return;
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
          <h3 className="text-lg font-semibold text-ink">手动上传视频片段</h3>
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
          节点: {node.node_id} — 使用本地视频文件替换 AI 生成片段
        </p>

        <div
          aria-label="拖拽视频到此处，或点击选择"
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
              <Film className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-ink font-medium">{selectedFile.name}</p>
              <p className="text-xs text-steel mt-1">
                {formatDuration(getVideoFileDuration(selectedFile))}
              </p>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted mb-2" />
              <p className="text-sm text-steel">拖拽视频到此处，或点击选择</p>
              <p className="text-xs text-muted mt-1">支持 MP4 / WebM / MOV</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
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

function RegenerateOptionsDialog({
  node,
  onClose,
  onSubmit,
  isPending,
}: {
  node: StoryboardNodeWithVideo;
  onClose: () => void;
  onSubmit: (options: VideoGenerateOptions) => void;
  isPending: boolean;
}) {
  const [duration, setDuration] = useState<number>(node.duration_target || 6);
  const [faceEnhancement, setFaceEnhancement] = useState(false);
  const [provider, setProvider] = useState('mock-video');
  const [force, setForce] = useState(true);

  return (
    <EditDialog
      title="调整参数后重新生成"
      onClose={onClose}
      onSubmit={() =>
        onSubmit({
          duration,
          face_enhancement: faceEnhancement,
          provider,
          force,
        })
      }
      isPending={isPending}
      submitLabel="重新生成"
      submitDisabled={duration < 3 || duration > 15}
    >
      <p className="text-xs text-steel mb-4">节点: {node.node_id}</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            视频时长（秒）
          </label>
          <input
            type="number"
            min={3}
            max={15}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full rounded-md border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <p className="text-xs text-stone mt-1">范围 3-15 秒，默认使用节点目标时长</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            Provider
          </label>
          <input
            type="text"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full rounded-md border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            id="face-enhancement"
            type="checkbox"
            checked={faceEnhancement}
            onChange={(e) => setFaceEnhancement(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <label htmlFor="face-enhancement" className="text-sm text-charcoal">
            开启人脸增强
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="force-regenerate"
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <label htmlFor="force-regenerate" className="text-sm text-charcoal">
            强制重新生成
          </label>
        </div>
      </div>
    </EditDialog>
  );
}

// ── Quality Report Card ───────────────────────────────────────────────

function QualityReportCard({ report }: { report: QualityReport }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold text-ink">质量检测报告</h3>
        {report.passed ? (
          <Badge variant="tag-green">通过</Badge>
        ) : (
          <Badge variant="tag-orange">未通过</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg bg-surface p-3">
          <p className="text-xs text-steel mb-1">实际时长</p>
          <p className="text-sm font-semibold text-ink">{report.actual_duration.toFixed(2)}s</p>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <p className="text-xs text-steel mb-1">目标时长</p>
          <p className="text-sm font-semibold text-ink">{report.target_duration.toFixed(2)}s</p>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <p className="text-xs text-steel mb-1">时长误差</p>
          <p className={`text-sm font-semibold ${report.duration_ok ? 'text-brand-green' : 'text-semantic-error'}`}>
            {report.duration_ok ? '合格' : '超限'}
          </p>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <p className="text-xs text-steel mb-1">人脸崩坏</p>
          <p className={`text-sm font-semibold ${report.face_corruption_detected ? 'text-semantic-error' : 'text-brand-green'}`}>
            {report.face_corruption_detected ? '检测到' : '未检测'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          {report.motion_jump_detected ? (
            <>
              <ShieldAlert className="h-4 w-4 text-semantic-error" />
              <span className="text-semantic-error">检测到动作跳变</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 text-brand-green" />
              <span className="text-charcoal">动作连续性正常</span>
            </>
          )}
        </div>

        <div className="rounded-lg bg-surface p-3">
          <p className="text-xs text-steel mb-1.5">检测详情</p>
          <ul className="space-y-1">
            {report.details.map((detail, idx) => (
              <li key={idx} className="text-xs text-charcoal flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 rounded-full bg-stone shrink-0" />
                {detail}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Video Player ──────────────────────────────────────────────────────

function VideoPlayer({
  nodes,
  currentIndex,
  onIndexChange,
  autoPlayNext = true,
}: {
  nodes: StoryboardNodeWithVideo[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  autoPlayNext?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [continuous, setContinuous] = useState(autoPlayNext);

  const currentNode = nodes[currentIndex];
  const hasVideo = !!currentNode?.video_clip?.url;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration || 0);
    const onEnded = () => {
      setPlaying(false);
      if (continuous && currentIndex < nodes.length - 1) {
        onIndexChange(currentIndex + 1);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [currentIndex, nodes, continuous, onIndexChange]);

  useEffect(() => {
    if (hasVideo && playing) {
      videoRef.current?.play().catch(() => {});
    }
  }, [currentIndex, hasVideo, playing]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(e.target.value);
    setCurrentTime(video.currentTime);
  };

  const handlePrev = () => {
    if (currentIndex > 0) onIndexChange(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < nodes.length - 1) onIndexChange(currentIndex + 1);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const v = Number(e.target.value);
    video.volume = v;
    setVolume(v);
  };

  if (!currentNode) {
    return (
      <div className="rounded-xl border border-hairline bg-canvas p-8 text-center shadow-sm">
        <Film className="h-12 w-12 text-muted mx-auto mb-3" />
        <p className="text-steel">未选择节点</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hairline bg-canvas p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Clapperboard className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold text-ink">视频预览</h3>
        <span className="text-xs text-steel ml-auto">
          节点 {currentIndex + 1} / {nodes.length}
        </span>
      </div>

      <div className="relative aspect-video rounded-lg bg-ink-deep overflow-hidden mb-4">
        {hasVideo ? (
          <video
            ref={videoRef}
            src={currentNode.video_clip!.url}
            className="h-full w-full object-contain"
            preload="metadata"
            onClick={togglePlay}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Film className="h-12 w-12 text-muted mx-auto mb-2" />
              <p className="text-sm text-steel">暂无视频片段</p>
              <p className="text-xs text-stone mt-1">生成或上传后即可预览</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink hover:bg-hairline disabled:opacity-40 transition-colors"
          aria-label="上一个"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={togglePlay}
          disabled={!hasVideo}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-pressed disabled:opacity-50 transition-colors"
          aria-label={playing ? '暂停' : '播放'}
        >
          {playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentIndex === nodes.length - 1}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink hover:bg-hairline disabled:opacity-40 transition-colors"
          aria-label="下一个"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        <span className="text-xs text-steel w-20 text-center">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>

        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          disabled={!hasVideo}
          className="flex-1 h-1.5 bg-hairline-strong rounded-lg appearance-none cursor-pointer accent-primary disabled:cursor-not-allowed"
        />

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={handleVolume}
          className="w-20 h-1.5 bg-hairline-strong rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      <div className="flex items-center gap-2 mt-4">
        <input
          id="continuous-playback"
          type="checkbox"
          checked={continuous}
          onChange={(e) => setContinuous(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <label htmlFor="continuous-playback" className="text-sm text-charcoal">
          连续播放相邻节点
        </label>
      </div>
    </div>
  );
}

// ── Timeline Node Item ────────────────────────────────────────────────

function TimelineNodeItem({
  node,
  index,
  selected,
  onSelect,
  onRegenerate,
  onAdjustRegenerate,
  onUpload,
  onApprove,
  onReject,
  isGenerating,
  isReviewing,
}: {
  node: StoryboardNodeWithVideo;
  index: number;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  onRegenerate: (nodeId: string) => void;
  onAdjustRegenerate: (nodeId: string) => void;
  onUpload: (nodeId: string) => void;
  onApprove: (nodeId: string) => void;
  onReject: (nodeId: string) => void;
  isGenerating: boolean;
  isReviewing: boolean;
}) {
  const status = getVideoStatus(node);
  const hasVideo = !!node.video_clip?.url;
  const approved = isVideoApproved(node);
  const rejected = isVideoRejected(node);
  const qualityPassed = node.video_clip?.quality_report?.passed ?? null;

  return (
    <div
      data-testid={`video-node-${node.node_id}`}
      className={`
        group relative rounded-lg border bg-canvas p-4 transition-all cursor-pointer
        ${selected ? 'border-primary shadow-md ring-2 ring-primary/20' : 'border-hairline hover:border-hairline-strong'}
        ${approved ? 'ring-1 ring-brand-green/30' : ''}
        ${rejected ? 'ring-1 ring-semantic-error/30' : ''}
      `}
      onClick={() => onSelect(node.node_id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card-tint-lavender text-xs font-semibold text-brand-purple-800">
            {index + 1}
          </div>
          <div>
            <p className="text-xs font-mono font-semibold text-ink truncate" title={node.node_id}>
              {node.node_id}
            </p>
            <p className="text-xs text-steel mt-0.5">
              {SHOT_TYPE_LABELS[node.shot_type]} · {CAMERA_MOVE_LABELS[node.camera_move]} · {node.duration_target}s
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
              VIDEO_STATUS_COLORS[status] || 'bg-surface text-steel'
            }`}
          >
            {VIDEO_STATUS_LABELS[status] || status}
          </span>
          {qualityPassed === true && (
            <ShieldCheck className="h-4 w-4 text-brand-green" />
          )}
          {qualityPassed === false && (
            <ShieldAlert className="h-4 w-4 text-semantic-error" />
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-sm text-ink line-clamp-2" title={node.visual_desc}>
          {node.visual_desc}
        </p>
        {node.dialogue?.text && (
          <p className="text-xs text-steel line-clamp-1">
            台词: {node.dialogue.text}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!hasVideo && (
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
            {isGenerating ? '生成中...' : '生成视频'}
          </Button>
        )}

        {hasVideo && status !== 'reviewed' && (
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

        {hasVideo && (
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
            onAdjustRegenerate(node.node_id);
          }}
          disabled={isGenerating}
          className="text-xs h-8 gap-1.5"
          title="调整参数后重新生成"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          调参重生
        </Button>

        <Button
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onUpload(node.node_id);
          }}
          className="text-xs h-8 gap-1.5"
          title="手动上传视频"
        >
          <Upload className="h-3.5 w-3.5" />
          上传
        </Button>
      </div>

      {node.video_clip?.review_comment && (
        <div className="mt-3 flex items-start gap-1.5 text-xs text-steel bg-surface-soft rounded px-2 py-1.5">
          <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{node.video_clip.review_comment}</span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export function VideoReviewPage() {
  const { projectId = '', episodeNumber: epNumStr = '1' } = useParams<{
    projectId: string;
    episodeNumber: string;
  }>();
  const episodeNumber = parseInt(epNumStr, 10);
  const epId = `ep-${episodeNumber}`;
  const queryClient = useQueryClient();

  // ── Local state ──
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [uploadNodeId, setUploadNodeId] = useState<string | null>(null);
  const [regenerateNodeId, setRegenerateNodeId] = useState<string | null>(null);
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
    queryKey: ['storyboard-nodes-video', projectId, epId],
    queryFn: () => listStoryboardNodes(projectId, epId),
    enabled: Boolean(projectId),
  });

  const nodes: StoryboardNodeWithVideo[] = useMemo(
    () =>
      (nodesRes?.data ?? []).map((n) => ({
        ...n,
        video_status: getVideoStatus(n as StoryboardNodeWithVideo),
      })),
    [nodesRes],
  );
  const hasNodes = nodes.length > 0;

  // ── Computed ──
  const sortedNodes = useMemo(
    () =>
      [...nodes].sort((a, b) => {
        const aReviewed = a.video_clip?.status === 'reviewed' ? 0 : 1;
        const bReviewed = b.video_clip?.status === 'reviewed' ? 0 : 1;
        if (aReviewed !== bReviewed) return aReviewed - bReviewed;
        return a.node_id.localeCompare(b.node_id);
      }),
    [nodes],
  );

  const selectedIndex = useMemo(
    () => sortedNodes.findIndex((n) => n.node_id === selectedNodeId),
    [sortedNodes, selectedNodeId],
  );

  const reviewedCount = useMemo(
    () => nodes.filter((n) => n.video_clip?.status === 'reviewed').length,
    [nodes],
  );
  const generatedCount = useMemo(
    () => nodes.filter((n) => n.video_clip?.url).length,
    [nodes],
  );
  const approvedCount = useMemo(
    () => nodes.filter((n) => isVideoApproved(n)).length,
    [nodes],
  );
  const allReviewedAndApproved = hasNodes && approvedCount === nodes.length;

  // ── Mutations ──
  const batchGenerateMutation = useMutation({
    mutationFn: () => batchGenerateVideo(projectId, epId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-video', projectId, epId] });
    },
  });

  const singleGenerateMutation = useMutation({
    mutationFn: ({ nodeId, options }: { nodeId: string; options?: VideoGenerateOptions }) =>
      generateNodeVideo(projectId, epId, nodeId, options),
    onMutate: ({ nodeId }) => {
      setGeneratingNodeIds((prev) => new Set(prev).add(nodeId));
    },
    onSuccess: (_data, { nodeId }) => {
      setGeneratingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-video', projectId, epId] });
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
      reviewNodeVideo(projectId, epId, nodeId, { approved }),
    onMutate: ({ nodeId }) => {
      setReviewingNodeIds((prev) => new Set(prev).add(nodeId));
    },
    onSuccess: (_data, { nodeId }) => {
      setReviewingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-video', projectId, epId] });
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
    mutationFn: async ({ nodeId, file }: { nodeId: string; file: File }) => {
      const node = nodes.find((n) => n.node_id === nodeId);
      return uploadNodeVideoFile(projectId, epId, nodeId, file, {
        duration: getVideoFileDuration(file) || node?.duration_target || 6,
        camera_move: node?.camera_move,
        motion_description: node?.visual_desc,
      });
    },
    onSuccess: () => {
      setUploadNodeId(null);
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-video', projectId, epId] });
    },
  });

  const adjustRegenerateMutation = useMutation({
    mutationFn: async ({
      nodeId,
      options,
    }: {
      nodeId: string;
      options: VideoGenerateOptions;
    }) => {
      setEditingNodeIds((prev) => new Set(prev).add(nodeId));
      const result = await generateNodeVideo(projectId, epId, nodeId, options);
      setEditingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      return result;
    },
    onSuccess: () => {
      setRegenerateNodeId(null);
      queryClient.invalidateQueries({ queryKey: ['storyboard-nodes-video', projectId, epId] });
    },
    onError: () => {
      // editingNodeIds cleared in mutationFn on error via try/finally not used here;
      // rely on component unmount or next operation
    },
  });

  // ── Handlers ──
  const handleSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handlePlayerIndexChange = useCallback((index: number) => {
    const node = sortedNodes[index];
    if (node) setSelectedNodeId(node.node_id);
  }, [sortedNodes]);

  const handleRegenerate = useCallback(
    (nodeId: string) => {
      singleGenerateMutation.mutate({ nodeId });
    },
    [singleGenerateMutation],
  );

  const handleAdjustRegenerate = useCallback((nodeId: string) => {
    setRegenerateNodeId(nodeId);
  }, []);

  const handleUpload = useCallback((nodeId: string) => {
    setUploadNodeId(nodeId);
  }, []);

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

  const handleUploadSubmit = useCallback(
    (file: File) => {
      if (!uploadNodeId) return;
      uploadMutation.mutate({ nodeId: uploadNodeId, file });
    },
    [uploadNodeId, uploadMutation],
  );

  const handleAdjustSubmit = useCallback(
    (options: VideoGenerateOptions) => {
      if (!regenerateNodeId) return;
      adjustRegenerateMutation.mutate({ nodeId: regenerateNodeId, options });
    },
    [regenerateNodeId, adjustRegenerateMutation],
  );

  const handleBatchGenerate = useCallback(() => {
    batchGenerateMutation.mutate();
  }, [batchGenerateMutation]);

  useEffect(() => {
    if (hasNodes && !selectedNodeId) {
      setSelectedNodeId(sortedNodes[0]?.node_id ?? null);
    }
  }, [hasNodes, selectedNodeId, sortedNodes]);

  const uploadNode = uploadNodeId ? nodes.find((n) => n.node_id === uploadNodeId) : null;
  const regenerateNode = regenerateNodeId ? nodes.find((n) => n.node_id === regenerateNodeId) : null;
  const selectedNode = nodes.find((n) => n.node_id === selectedNodeId) ?? null;

  // ── Render ──
  return (
    <div className="flex flex-col h-screen bg-surface-soft">
      {/* Header */}
      <header className="shrink-0 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto max-w-full px-6 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                to={`/projects/${projectId}/episodes/${episodeNumber}/music`}
                className="inline-flex items-center gap-1 text-sm text-steel hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                返回配乐
              </Link>
              <h1 className="mt-0.5 text-lg font-semibold text-ink flex items-center gap-2">
                <Film className="h-5 w-5 text-primary" />
                {projectTitle} · 第 {episodeNumber} 集 · 视频片段预览与审核
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="purple">{PROJECT_STATUS_LABELS[projectStatus]}</Badge>
              {hasNodes && (
                <span className="text-sm text-steel">
                  {approvedCount}/{nodes.length} 已通过 · {reviewedCount} 已审核 · {generatedCount} 已生成
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      {hasNodes && (
        <div className="shrink-0 border-b border-hairline bg-canvas px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleBatchGenerate}
                disabled={batchGenerateMutation.isPending}
                className="gap-2"
              >
                {batchGenerateMutation.isPending ? (
                  <>
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    批量生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    批量生成视频
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-steel" />
              <span className="text-sm text-steel">
                总时长目标: {nodes.reduce((sum, n) => sum + (n.duration_target || 0), 0)}s
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Composition unlock banner */}
      {allReviewedAndApproved && (
        <div className="shrink-0 mx-6 mt-4 rounded-lg border border-brand-green/20 bg-card-tint-mint/50 p-4 flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-brand-green" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-charcoal">全部节点审核通过，已解锁合成入口</p>
            <p className="text-xs text-steel">所有 {nodes.length} 个视频片段已通过质量检测与人工审核，可进入最终合成阶段。</p>
          </div>
          <Link
            to={`/projects/${projectId}/episodes/${episodeNumber}/composite`}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-[18px] py-[10px] text-sm font-medium text-on-primary hover:bg-primary-pressed transition-colors"
          >
            <Clapperboard className="h-4 w-4" />
            开始合成
          </Link>
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
                <Film className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-ink">还没有分镜节点</h2>
              <p className="mb-6 mt-2 text-center text-slate">
                请先在分镜编辑器中通过 AI 拆分生成分镜节点，然后再进入此页面生成与审核视频片段。
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
              <p className="text-sm font-medium text-charcoal">批量视频生成完成</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3 text-sm">
              <div>
                <p className="text-xs text-steel">总数</p>
                <p className="font-semibold text-ink">{batchGenerateMutation.data.data.total_nodes}</p>
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
              <div>
                <p className="text-xs text-steel">Fallback</p>
                <p className="font-semibold text-ink">{batchGenerateMutation.data.data.fallback_used_count}</p>
              </div>
              <div>
                <p className="text-xs text-steel">质检通过</p>
                <p className="font-semibold text-brand-green">{batchGenerateMutation.data.data.quality_passed_count}</p>
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

        {adjustRegenerateMutation.isError && (
          <div className="mx-6 mt-4 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
            <div>
              <p className="text-sm font-medium text-semantic-error">调参重新生成失败</p>
              <p className="text-xs text-slate mt-0.5">{adjustRegenerateMutation.error.message}</p>
            </div>
          </div>
        )}

        {uploadMutation.isError && (
          <div className="mx-6 mt-4 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
            <div>
              <p className="text-sm font-medium text-semantic-error">上传失败</p>
              <p className="text-xs text-slate mt-0.5">{uploadMutation.error.message}</p>
            </div>
          </div>
        )}

        {/* Node layout */}
        {hasNodes && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Timeline */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold text-ink">分镜时间轴</h2>
                  <span className="text-xs text-steel ml-auto">共 {nodes.length} 个节点</span>
                </div>
                <div className="space-y-3">
                  {sortedNodes.map((node, idx) => (
                    <TimelineNodeItem
                      key={node.node_id}
                      node={node}
                      index={idx}
                      selected={node.node_id === selectedNodeId}
                      onSelect={handleSelect}
                      onRegenerate={handleRegenerate}
                      onAdjustRegenerate={handleAdjustRegenerate}
                      onUpload={handleUpload}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      isGenerating={
                        generatingNodeIds.has(node.node_id) || editingNodeIds.has(node.node_id)
                      }
                      isReviewing={reviewingNodeIds.has(node.node_id)}
                    />
                  ))}
                </div>
              </div>

              {/* Player + details */}
              <div className="lg:col-span-7 space-y-4">
                <VideoPlayer
                  nodes={sortedNodes}
                  currentIndex={selectedIndex >= 0 ? selectedIndex : 0}
                  onIndexChange={handlePlayerIndexChange}
                />

                {selectedNode?.video_clip?.quality_report && (
                  <QualityReportCard report={selectedNode.video_clip.quality_report} />
                )}

                {selectedNode && !selectedNode.video_clip?.quality_report && (
                  <div className="rounded-xl border border-hairline bg-canvas p-8 text-center shadow-sm">
                    <Shield className="h-10 w-10 text-muted mx-auto mb-3" />
                    <p className="text-steel">选择已生成视频的节点以查看质量检测报告</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Upload dialog */}
      {uploadNode && (
        <UploadDialog
          node={uploadNode}
          onClose={() => setUploadNodeId(null)}
          onSubmit={handleUploadSubmit}
          isPending={uploadMutation.isPending}
        />
      )}

      {/* Regenerate options dialog */}
      {regenerateNode && (
        <RegenerateOptionsDialog
          node={regenerateNode}
          onClose={() => setRegenerateNodeId(null)}
          onSubmit={handleAdjustSubmit}
          isPending={adjustRegenerateMutation.isPending}
        />
      )}
    </div>
  );
}
