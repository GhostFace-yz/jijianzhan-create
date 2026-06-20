import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clapperboard,
  Film,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Download,
  SlidersHorizontal,
  MonitorPlay,
  Subtitles,
  Settings2,
  ChevronRight,
  Wand2,
} from 'lucide-react';
import { getProject } from '../api/projects';
import { listStoryboardNodes } from '../api/storyboard';
import { startComposite, getCompositeProgress, getCompositeResult } from '../api/composite';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import {
  PROJECT_STATUS_LABELS,
  VIDEO_STATUS_LABELS,
  type CompositeConfig,
  type CompositeProgress,
  type CompositeResult,
  type CompositeStep,
  type CompositeStepKey,
  type StoryboardNode,
} from '../types';

// ── Constants ─────────────────────────────────────────────────────────

const RESOLUTION_OPTIONS: { value: CompositeConfig['resolution']; label: string; width: number; height: number }[] = [
  { value: 'portrait_9_16', label: '竖屏 9:16', width: 1080, height: 1920 },
  { value: 'landscape_16_9', label: '横屏 16:9', width: 1920, height: 1080 },
];

const FRAME_RATE_OPTIONS: { value: string; label: string }[] = [
  { value: '30', label: '30 fps' },
  { value: '24', label: '24 fps' },
];

const CODEC_OPTIONS: { value: CompositeConfig['codec']; label: string }[] = [
  { value: 'h264', label: 'H.264' },
  { value: 'h265', label: 'H.265' },
];

const SUBTITLE_POSITION_OPTIONS: { value: CompositeConfig['subtitle_position']; label: string }[] = [
  { value: 'bottom', label: '底部' },
  { value: 'top', label: '顶部' },
];

const SUBTITLE_STYLE_OPTIONS: { value: CompositeConfig['subtitle_style']; label: string }[] = [
  { value: 'default', label: '默认白字' },
  { value: 'outline', label: '描边字幕' },
  { value: 'background', label: '背景条字幕' },
];

const SUBTITLE_SIZE_OPTIONS: { value: CompositeConfig['subtitle_size']; label: string }[] = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' },
];

const STEP_ORDER: CompositeStepKey[] = ['concat', 'mix_audio', 'render_subtitles', 'encode'];

const STEP_LABELS: Record<CompositeStepKey, string> = {
  concat: '拼接中',
  mix_audio: '混音中',
  render_subtitles: '字幕渲染中',
  encode: '编码中',
};

const DEFAULT_CONFIG: CompositeConfig = {
  resolution: 'portrait_9_16',
  frame_rate: 30,
  codec: 'h264',
  subtitle_enabled: true,
  subtitle_position: 'bottom',
  subtitle_style: 'default',
  subtitle_size: 'medium',
};

const POLL_INTERVAL_MS = 1500;

// ── Helpers ───────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function buildSteps(progress: CompositeProgress | null): CompositeStep[] {
  const base: CompositeStep[] = STEP_ORDER.map((key) => ({
    key,
    label: STEP_LABELS[key],
    status: 'pending',
  }));

  if (!progress) return base;

  let seenCurrent = false;
  return base.map((step) => {
    const stepIndex = STEP_ORDER.indexOf(step.key);
    const currentIndex = STEP_ORDER.indexOf(progress.current_step);

    if (progress.status === 'completed') {
      return { ...step, status: 'completed' as const };
    }
    if (progress.status === 'failed') {
      if (step.key === progress.current_step) return { ...step, status: 'failed' as const };
      if (stepIndex < currentIndex) return { ...step, status: 'completed' as const };
      return step;
    }

    if (step.key === progress.current_step) {
      seenCurrent = true;
      return { ...step, status: 'running' as const };
    }
    if (!seenCurrent && stepIndex < currentIndex) {
      return { ...step, status: 'completed' as const };
    }
    return step;
  });
}

function getResolutionDimensions(resolution: CompositeConfig['resolution']): { width: number; height: number } {
  return RESOLUTION_OPTIONS.find((r) => r.value === resolution) ?? { width: 1080, height: 1920 };
}

// ── UI Components ─────────────────────────────────────────────────────

function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  id?: string;
}) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
          ${checked ? 'bg-primary' : 'bg-hairline-strong'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-on-primary transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
      {label ? <span className="text-sm text-charcoal">{label}</span> : null}
    </label>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-hairline-strong bg-surface-soft p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${active ? 'bg-canvas text-ink shadow-sm' : 'text-steel hover:text-ink'}
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function StepItem({ step, index }: { step: CompositeStep; index: number }) {
  const icon =
    step.status === 'completed' ? (
      <CheckCircle className="h-4 w-4 text-on-primary" />
    ) : step.status === 'running' ? (
      <RotateCcw className="h-4 w-4 animate-spin text-on-primary" />
    ) : step.status === 'failed' ? (
      <AlertTriangle className="h-4 w-4 text-on-primary" />
    ) : (
      <span className="text-xs font-semibold text-on-primary">{index + 1}</span>
    );

  const bubbleClass =
    step.status === 'completed'
      ? 'bg-brand-green'
      : step.status === 'running'
      ? 'bg-primary'
      : step.status === 'failed'
      ? 'bg-semantic-error'
      : 'bg-hairline-strong';

  return (
    <div className="flex items-center gap-3">
      <div
        className={`
          flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors
          ${bubbleClass}
        `}
      >
        {icon}
      </div>
      <span
        className={`
          text-sm font-medium
          ${step.status === 'pending' ? 'text-steel' : 'text-ink'}
        `}
      >
        {step.label}
      </span>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-ink">总进度</span>
        <span className="font-semibold text-primary">{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function VideoPreview({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration || 0);
    const onEnded = () => setPlaying(false);
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
  }, [url]);

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

  return (
    <div className="rounded-xl border border-hairline bg-canvas p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <MonitorPlay className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold text-ink">成片预览</h3>
      </div>

      <div className="relative aspect-video rounded-lg bg-ink-deep overflow-hidden mb-4">
        <video
          ref={videoRef}
          src={url}
          className="h-full w-full object-contain"
          preload="metadata"
          onClick={togglePlay}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-pressed transition-colors"
          aria-label={playing ? '暂停' : '播放'}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
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
          className="flex-1 h-1.5 bg-hairline-strong rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export function CompositePage() {
  const { projectId = '', episodeNumber: epNumStr = '1' } = useParams<{
    projectId: string;
    episodeNumber: string;
  }>();
  const episodeNumber = parseInt(epNumStr, 10);
  const epId = `ep-${episodeNumber}`;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Local state ──
  const [config, setConfig] = useState<CompositeConfig>(DEFAULT_CONFIG);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CompositeProgress | null>(null);
  const [result, setResult] = useState<CompositeResult | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [showNodeList, setShowNodeList] = useState(false);

  // ── Data queries ──
  const { data: projectRes, isLoading: isProjectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });
  const project = projectRes?.data;

  const {
    data: nodesRes,
    isLoading: isNodesLoading,
    error: nodesError,
  } = useQuery({
    queryKey: ['storyboard-nodes-composite', projectId, epId],
    queryFn: () => listStoryboardNodes(projectId, epId),
    enabled: Boolean(projectId),
  });
  const nodes: StoryboardNode[] = nodesRes?.data ?? [];

  const generatedCount = useMemo(
    () => nodes.filter((n) => (n as StoryboardNode & { video_clip?: { url?: string } }).video_clip?.url).length,
    [nodes],
  );
  const reviewedCount = useMemo(
    () =>
      nodes.filter(
        (n) =>
          (n as StoryboardNode & { video_clip?: { status?: string } }).video_clip?.status === 'reviewed',
      ).length,
    [nodes],
  );
  const allReviewed = nodes.length > 0 && reviewedCount === nodes.length;

  // ── Start mutation ──
  const startMutation = useMutation({
    mutationFn: () => startComposite(projectId, epId, config),
    onSuccess: (res) => {
      setJobId(res.data.job_id);
      setResult(null);
      setPollingError(null);
      setProgress({
        job_id: res.data.job_id,
        status: res.data.status,
        progress: 0,
        current_step: 'concat',
        steps: buildSteps(null),
      });
    },
  });

  // ── Progress polling ──
  const isTerminal = progress?.status === 'completed' || progress?.status === 'failed';

  useEffect(() => {
    if (!jobId || isTerminal) return;

    const poll = async () => {
      try {
        const res = await getCompositeProgress(projectId, epId, jobId);
        setProgress(res.data);
        setPollingError(null);

        if (res.data.status === 'completed') {
          const resultRes = await getCompositeResult(projectId, epId, jobId);
          setResult(resultRes.data);
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
        }
      } catch (err) {
        setPollingError((err as Error).message);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [jobId, isTerminal, projectId, epId, queryClient]);

  // ── Handlers ──
  const handleStart = useCallback(() => {
    startMutation.mutate();
  }, [startMutation]);

  const handleReset = useCallback(() => {
    setJobId(null);
    setProgress(null);
    setResult(null);
    setPollingError(null);
  }, []);

  const handleRecomposite = useCallback(() => {
    handleReset();
  }, [handleReset]);

  const handleEditNode = useCallback(
    (nodeId: string) => {
      navigate(`/projects/${projectId}/episodes/${episodeNumber}/video?node=${nodeId}`);
    },
    [navigate, projectId, episodeNumber],
  );

  const isLoading = isProjectLoading || isNodesLoading;
  const steps = useMemo(() => buildSteps(progress), [progress]);

  // ── Render ──
  return (
    <div className="flex flex-col min-h-screen bg-surface-soft">
      {/* Header */}
      <header className="shrink-0 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto max-w-full px-6 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                to={`/projects/${projectId}/episodes/${episodeNumber}/video`}
                className="inline-flex items-center gap-1 text-sm text-steel hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                返回视频审核
              </Link>
              <h1 className="mt-0.5 text-lg font-semibold text-ink flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-primary" />
                {project?.meta.title ?? '项目'} · 第 {episodeNumber} 集 · 合成输出
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="purple">{PROJECT_STATUS_LABELS[project?.status ?? 'draft']}</Badge>
              {nodes.length > 0 && (
                <span className="text-sm text-steel">
                  {reviewedCount}/{nodes.length} 已审核 · {generatedCount}/{nodes.length} 已生成
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline-strong border-t-primary" />
              <p className="mt-4 text-sm text-slate">加载中...</p>
            </div>
          ) : nodesError ? (
            <div className="rounded-xl border border-semantic-error/20 bg-semantic-error/5 p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-semantic-error mx-auto mb-3" />
              <p className="text-semantic-error mb-1">加载失败</p>
              <p className="text-sm text-steel">{(nodesError as Error).message}</p>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="flex flex-col items-center rounded-xl border border-hairline bg-canvas py-16 px-8 shadow-sm max-w-lg">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-tint-lavender">
                  <Film className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-ink">还没有分镜节点</h2>
                <p className="mb-6 mt-2 text-center text-slate">
                  请先在分镜编辑器中拆分节点并生成、审核视频片段，然后再进入合成阶段。
                </p>
                <Link to={`/projects/${projectId}/episodes/${episodeNumber}/storyboard`}>
                  <Button className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    前往分镜编辑器
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Readiness warning */}
              {!allReviewed && !jobId && !result && (
                <div className="rounded-lg border border-semantic-warning/20 bg-card-tint-peach/50 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-warning" />
                  <div>
                    <p className="text-sm font-medium text-charcoal">
                      还有 {nodes.length - reviewedCount} 个节点未通过审核
                    </p>
                    <p className="text-xs text-steel mt-0.5">
                      建议全部节点审核通过后再开始合成，以保证成片质量。
                    </p>
                  </div>
                </div>
              )}

              {/* Config form */}
              {!jobId && !result && (
                <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Settings2 className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold text-ink">合成参数配置</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-charcoal">分辨率</label>
                      <SegmentedControl
                        options={RESOLUTION_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
                        value={config.resolution}
                        onChange={(resolution) => setConfig((c) => ({ ...c, resolution }))}
                      />
                      <p className="text-xs text-stone">
                        {(() => {
                          const dims = getResolutionDimensions(config.resolution);
                          return `${dims.width} × ${dims.height}`;
                        })()}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-charcoal">帧率</label>
                      <SegmentedControl
                        options={FRAME_RATE_OPTIONS}
                        value={String(config.frame_rate)}
                        onChange={(frame_rate) => setConfig((c) => ({ ...c, frame_rate: Number(frame_rate) as CompositeConfig['frame_rate'] }))}
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-charcoal">视频编码</label>
                      <SegmentedControl
                        options={CODEC_OPTIONS}
                        value={config.codec}
                        onChange={(codec) => setConfig((c) => ({ ...c, codec }))}
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-charcoal">字幕</label>
                      <Switch
                        id="subtitle-toggle"
                        checked={config.subtitle_enabled}
                        onChange={(subtitle_enabled) => setConfig((c) => ({ ...c, subtitle_enabled }))}
                        label={config.subtitle_enabled ? '开启' : '关闭'}
                      />
                    </div>

                    {config.subtitle_enabled && (
                      <>
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-charcoal">字幕位置</label>
                          <Select
                            options={SUBTITLE_POSITION_OPTIONS}
                            value={config.subtitle_position}
                            onChange={(e) =>
                              setConfig((c) => ({ ...c, subtitle_position: e.target.value as CompositeConfig['subtitle_position'] }))
                            }
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-charcoal">字幕样式</label>
                          <Select
                            options={SUBTITLE_STYLE_OPTIONS}
                            value={config.subtitle_style}
                            onChange={(e) =>
                              setConfig((c) => ({ ...c, subtitle_style: e.target.value as CompositeConfig['subtitle_style'] }))
                            }
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-charcoal">字幕大小</label>
                          <Select
                            options={SUBTITLE_SIZE_OPTIONS}
                            value={config.subtitle_size}
                            onChange={(e) =>
                              setConfig((c) => ({ ...c, subtitle_size: e.target.value as CompositeConfig['subtitle_size'] }))
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button
                      onClick={handleStart}
                      disabled={startMutation.isPending}
                      className="gap-2"
                    >
                      {startMutation.isPending ? (
                        <>
                          <RotateCcw className="h-4 w-4 animate-spin" />
                          启动中...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4" />
                          开始合成
                        </>
                      )}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => setShowNodeList(true)}
                      className="gap-2"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      返回节点修改
                    </Button>
                  </div>

                  {startMutation.isError && (
                    <div className="mt-4 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
                      <div>
                        <p className="text-sm font-medium text-semantic-error">启动合成失败</p>
                        <p className="text-xs text-slate mt-0.5">{startMutation.error.message}</p>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Progress panel */}
              {jobId && (
                <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <RotateCcw
                      className={`h-5 w-5 text-primary ${progress?.status === 'running' ? 'animate-spin' : ''}`}
                    />
                    <h2 className="text-base font-semibold text-ink">合成进度</h2>
                    <Badge variant={progress?.status === 'failed' ? 'orange' : 'purple'}>
                      {progress?.status === 'completed'
                        ? '已完成'
                        : progress?.status === 'failed'
                        ? '失败'
                        : progress?.status === 'running'
                        ? '合成中'
                        : '排队中'}
                    </Badge>
                  </div>

                  <ProgressBar progress={progress?.progress ?? 0} />

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {steps.map((step, idx) => (
                      <StepItem key={step.key} step={step} index={idx} />
                    ))}
                  </div>

                  {progress?.message && (
                    <p className="mt-4 text-sm text-steel">{progress.message}</p>
                  )}

                  {pollingError && (
                    <div className="mt-4 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
                      <div>
                        <p className="text-sm font-medium text-semantic-error">进度同步失败</p>
                        <p className="text-xs text-slate mt-0.5">{pollingError}</p>
                      </div>
                    </div>
                  )}

                  {progress?.status === 'failed' && (
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <Button onClick={handleStart} disabled={startMutation.isPending} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        重新合成
                      </Button>
                      <Button variant="secondary" onClick={() => setShowNodeList(true)} className="gap-2">
                        <SlidersHorizontal className="h-4 w-4" />
                        返回节点修改
                      </Button>
                    </div>
                  )}
                </section>
              )}

              {/* Result panel */}
              {result && (
                <section className="space-y-6">
                  <div className="rounded-lg border border-brand-green/20 bg-card-tint-mint/50 p-4 flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-brand-green" />
                    <div>
                      <p className="text-sm font-semibold text-charcoal">合成完成</p>
                      <p className="text-xs text-steel">
                        {getResolutionDimensions(config.resolution).width} × {getResolutionDimensions(config.resolution).height} ·{' '}
                        {config.frame_rate}fps · {config.codec.toUpperCase()} · {formatDuration(result.duration)}
                      </p>
                    </div>
                  </div>

                  <VideoPreview url={result.url} />

                  <div className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Download className="h-5 w-5 text-primary" />
                      <h2 className="text-base font-semibold text-ink">高清下载</h2>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 space-y-1 text-sm text-steel">
                        <p>文件大小：{formatFileSize(result.file_size)}</p>
                        <p>生成时间：{new Date(result.created_at).toLocaleString()}</p>
                      </div>
                      <a
                        href={result.url}
                        download
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-[18px] py-[10px] text-sm font-medium text-on-primary hover:bg-primary-pressed transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        下载成片
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={handleRecomposite} className="gap-2">
                      <RotateCcw className="h-4 w-4" />
                      重新合成
                    </Button>
                    <Button variant="secondary" onClick={() => setShowNodeList(true)} className="gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      返回节点修改
                    </Button>
                  </div>
                </section>
              )}

              {/* Node list for edit */}
              {showNodeList && (
                <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Subtitles className="h-5 w-5 text-primary" />
                      <h2 className="text-base font-semibold text-ink">选择节点返回修改</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNodeList(false)}
                      className="text-sm text-steel hover:text-ink"
                    >
                      收起
                    </button>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {nodes.map((node, idx) => {
                      const videoStatus = (node as StoryboardNode & { video_clip?: { status?: string } }).video_clip?.status;
                      return (
                        <button
                          key={node.node_id}
                          type="button"
                          onClick={() => handleEditNode(node.node_id)}
                          className="w-full flex items-center gap-3 rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-left hover:border-primary/50 transition-colors"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card-tint-lavender text-xs font-semibold text-brand-purple-800">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink truncate">{node.node_id}</p>
                            <p className="text-xs text-steel truncate">{node.visual_desc}</p>
                          </div>
                          <Badge variant={videoStatus === 'reviewed' ? 'green' : 'orange'}>
                            {videoStatus ? VIDEO_STATUS_LABELS[videoStatus as 'pending' | 'generated' | 'reviewed'] ?? videoStatus : '待生成'}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-steel" />
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
