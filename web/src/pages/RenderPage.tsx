import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clapperboard,
  Film,
  Music,
  Volume2,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Download,
  Settings2,
  Subtitles,
  Shuffle,
} from 'lucide-react';
import { getProject } from '../api/projects';
import { listStoryboardNodes } from '../api/storyboard';
import { getEpisodeMusic } from '../api/music';
import { startRender, getRenderProgress, getRenderDownload } from '../api/render';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  PROJECT_STATUS_LABELS,
  RENDER_STATUS_LABELS,
  RENDER_STATUS_COLORS,
  VIDEO_STATUS_LABELS,
  TTS_STATUS_LABELS,
  type RenderOptions,
  type EpisodeRenderOutput,
  type StoryboardNode,
  type StoryboardNodeWithVideo,
  type StoryboardNodeWithAudio,
  type EpisodeMusicResult,
  type RenderStatus,
} from '../types';

// ── Constants ─────────────────────────────────────────────────────────

const RESOLUTION_OPTIONS: { value: '1080x1920' | '1920x1080'; label: string }[] = [
  { value: '1080x1920', label: '竖屏 1080×1920' },
  { value: '1920x1080', label: '横屏 1920×1080' },
];

const FRAME_RATE_OPTIONS: { value: string; label: string }[] = [
  { value: '30', label: '30 fps' },
  { value: '24', label: '24 fps' },
];

const CODEC_OPTIONS: { value: 'h264' | 'h265'; label: string }[] = [
  { value: 'h264', label: 'H.264' },
  { value: 'h265', label: 'H.265' },
];

const SUBTITLE_POSITION_OPTIONS: { value: 'bottom' | 'top'; label: string }[] = [
  { value: 'bottom', label: '底部' },
  { value: 'top', label: '顶部' },
];

const SUBTITLE_STYLE_OPTIONS: { value: 'white_with_black_border' | 'white' | 'black'; label: string }[] = [
  { value: 'white_with_black_border', label: '白字黑边' },
  { value: 'white', label: '纯白' },
  { value: 'black', label: '纯黑' },
];

const SUBTITLE_SIZE_OPTIONS: { value: 'small' | 'medium' | 'large'; label: string }[] = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' },
];

const DEFAULT_OPTIONS: Required<RenderOptions> = {
  provider: '',
  resolution: '1080x1920',
  fps: 30,
  codec: 'h264',
  subtitles_enabled: true,
  subtitle_position: 'bottom',
  subtitle_style: 'white_with_black_border',
  subtitle_size: 'medium',
  music_duck_dialogue: 0.3,
  music_duck_nondialogue: 0.75,
  strong_emotion_transition: 'white_flash',
};

const POLL_INTERVAL_MS = 1500;

// ── Helpers ───────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getVideoClip(node: StoryboardNode): { url?: string; status?: string } | null {
  return (node as StoryboardNodeWithVideo).video_clip ?? null;
}

function getAudioClip(node: StoryboardNode): { url?: string; status?: string } | null {
  return (node as StoryboardNodeWithAudio).audio_clip ?? null;
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

function ProgressBar({ progress, label }: { progress: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{label || '总进度'}</span>
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

function SummaryCard({
  icon,
  title,
  ready,
  total,
  readyLabel,
  pendingLabel,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  ready: number;
  total: number;
  readyLabel: string;
  pendingLabel: string;
  testId?: string;
}) {
  const complete = total > 0 && ready === total;
  return (
    <div
      data-testid={testId}
      className={`
        rounded-xl border p-5 shadow-sm transition-colors
        ${complete ? 'border-brand-green/30 bg-card-tint-mint/40' : 'border-hairline bg-canvas'}
      `}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="text-primary">{icon}</div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {complete && <CheckCircle className="h-4 w-4 text-brand-green ml-auto" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-ink">{ready}</span>
        <span className="text-sm text-steel">/ {total} {readyLabel}</span>
      </div>
      {total === 0 && (
        <p className="mt-2 text-xs text-steel">{pendingLabel}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: RenderStatus }) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
        ${RENDER_STATUS_COLORS[status] || 'bg-surface text-steel'}
      `}
    >
      {RENDER_STATUS_LABELS[status] || status}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export function RenderPage() {
  const { projectId = '', episodeNumber: epNumStr = '1' } = useParams<{
    projectId: string;
    episodeNumber: string;
  }>();
  const episodeNumber = parseInt(epNumStr, 10);
  const epId = `ep-${episodeNumber}`;
  const queryClient = useQueryClient();

  // ── Local state ──
  const [options, setOptions] = useState<Required<RenderOptions>>(DEFAULT_OPTIONS);
  const [renderOutput, setRenderOutput] = useState<EpisodeRenderOutput | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);

  // ── Data queries ──
  const {
    data: projectRes,
    isLoading: isProjectLoading,
    error: projectError,
  } = useQuery({
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
    queryKey: ['storyboard-nodes-render', projectId, epId],
    queryFn: () => listStoryboardNodes(projectId, epId),
    enabled: Boolean(projectId),
  });
  const nodes: StoryboardNode[] = nodesRes?.data ?? [];

  const {
    data: musicRes,
    isLoading: isMusicLoading,
  } = useQuery({
    queryKey: ['episode-music-render', projectId, epId],
    queryFn: () => getEpisodeMusic(projectId, epId),
    enabled: Boolean(projectId),
    retry: false,
  });
  const music: EpisodeMusicResult | null = musicRes?.data ?? null;

  // ── Computed readiness ──
  const generatedVideoCount = useMemo(
    () => nodes.filter((n) => getVideoClip(n)?.url).length,
    [nodes],
  );
  const reviewedVideoCount = useMemo(
    () => nodes.filter((n) => getVideoClip(n)?.status === 'reviewed').length,
    [nodes],
  );
  const ttsReadyCount = useMemo(
    () => nodes.filter((n) => getAudioClip(n)?.url).length,
    [nodes],
  );
  const hasMusic = Boolean(music?.original_url);

  // ── Start mutation ──
  const startMutation = useMutation({
    mutationFn: () => startRender(projectId, epId, options),
    onSuccess: async (res) => {
      setRenderOutput(res.data);
      setDownloadUrl(null);
      setPollingError(null);

      if (res.data.status === 'completed') {
        try {
          const dl = await getRenderDownload(projectId, epId);
          setDownloadUrl(dl.data.url);
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
        } catch {
          // download URL will be fetched when user clicks download
        }
      }
    },
  });

  // ── Progress polling ──
  const jobId = renderOutput?.job_id;
  const isTerminal = renderOutput?.status === 'completed' || renderOutput?.status === 'failed';

  useEffect(() => {
    if (!jobId || isTerminal) return;

    const poll = async () => {
      try {
        const res = await getRenderProgress(projectId, epId);
        setRenderOutput(res.data);
        setPollingError(null);

        if (res.data.status === 'completed') {
          const dl = await getRenderDownload(projectId, epId);
          setDownloadUrl(dl.data.url);
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
    setRenderOutput(null);
    setDownloadUrl(null);
    setPollingError(null);
  }, []);

  const handleDownload = useCallback(async () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
      return;
    }
    try {
      const res = await getRenderDownload(projectId, epId);
      setDownloadUrl(res.data.url);
      window.open(res.data.url, '_blank');
    } catch (err) {
      setPollingError((err as Error).message);
    }
  }, [downloadUrl, projectId, epId]);

  const isLoading = isProjectLoading || isNodesLoading || isMusicLoading;
  const fetchError = projectError || nodesError;

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
                  {reviewedVideoCount}/{nodes.length} 视频已审核
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
          ) : fetchError ? (
            <div className="rounded-xl border border-semantic-error/20 bg-semantic-error/5 p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-semantic-error mx-auto mb-3" />
              <p className="text-semantic-error mb-1">加载失败</p>
              <p className="text-sm text-steel">{(fetchError as Error).message}</p>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="flex flex-col items-center rounded-xl border border-hairline bg-canvas py-16 px-8 shadow-sm max-w-lg">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-tint-lavender">
                  <Film className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-ink">还没有分镜节点</h2>
                <p className="mb-6 mt-2 text-center text-slate">
                  请先在分镜编辑器中拆分节点并完成视频片段生成与审核，然后再进入合成阶段。
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
              {/* Readiness summary */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard
                  testId="video-summary"
                  icon={<Film className="h-5 w-5" />}
                  title="视频片段"
                  ready={generatedVideoCount}
                  total={nodes.length}
                  readyLabel="已生成"
                  pendingLabel="暂无可合成视频片段"
                />
                <SummaryCard
                  testId="tts-summary"
                  icon={<Volume2 className="h-5 w-5" />}
                  title="配音"
                  ready={ttsReadyCount}
                  total={nodes.length}
                  readyLabel="已就绪"
                  pendingLabel="暂未生成配音"
                />
                <SummaryCard
                  testId="music-summary"
                  icon={<Music className="h-5 w-5" />}
                  title="配乐"
                  ready={hasMusic ? 1 : 0}
                  total={1}
                  readyLabel="已生成"
                  pendingLabel="暂未生成配乐"
                />
              </section>

              {/* Readiness warning */}
              {generatedVideoCount < nodes.length && !renderOutput && (
                <div className="rounded-lg border border-semantic-warning/20 bg-card-tint-peach/50 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-warning" />
                  <div>
                    <p className="text-sm font-medium text-charcoal">
                      还有 {nodes.length - generatedVideoCount} 个节点未生成视频片段
                    </p>
                    <p className="text-xs text-steel mt-0.5">
                      建议所有节点都生成并审核通过后再开始合成，以保证成片质量。
                    </p>
                  </div>
                </div>
              )}

              {/* Config form */}
              {!renderOutput && (
                <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Settings2 className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold text-ink">合成参数配置</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-charcoal">分辨率</label>
                      <SegmentedControl
                        options={RESOLUTION_OPTIONS}
                        value={options.resolution ?? '1080x1920'}
                        onChange={(resolution) => setOptions((o) => ({ ...o, resolution }))}
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-charcoal">帧率</label>
                      <SegmentedControl
                        options={FRAME_RATE_OPTIONS}
                        value={String(options.fps ?? 30)}
                        onChange={(fps) =>
                          setOptions((o) => ({ ...o, fps: Number(fps) as Required<RenderOptions>['fps'] }))
                        }
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-charcoal">视频编码</label>
                      <SegmentedControl
                        options={CODEC_OPTIONS}
                        value={options.codec ?? 'h264'}
                        onChange={(codec) => setOptions((o) => ({ ...o, codec }))}
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-charcoal">字幕</label>
                      <Switch
                        id="subtitle-toggle"
                        checked={options.subtitles_enabled ?? true}
                        onChange={(subtitles_enabled) => setOptions((o) => ({ ...o, subtitles_enabled }))}
                        label={options.subtitles_enabled ? '开启' : '关闭'}
                      />
                    </div>

                    {options.subtitles_enabled && (
                      <>
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-charcoal">字幕位置</label>
                          <SegmentedControl
                            options={SUBTITLE_POSITION_OPTIONS}
                            value={options.subtitle_position ?? 'bottom'}
                            onChange={(subtitle_position) =>
                              setOptions((o) => ({ ...o, subtitle_position }))
                            }
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-charcoal">字幕样式</label>
                          <SegmentedControl
                            options={SUBTITLE_STYLE_OPTIONS}
                            value={options.subtitle_style ?? 'white_with_black_border'}
                            onChange={(subtitle_style) =>
                              setOptions((o) => ({ ...o, subtitle_style }))
                            }
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-charcoal">字幕大小</label>
                          <SegmentedControl
                            options={SUBTITLE_SIZE_OPTIONS}
                            value={options.subtitle_size ?? 'medium'}
                            onChange={(subtitle_size) =>
                              setOptions((o) => ({ ...o, subtitle_size }))
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
                          <Clapperboard className="h-4 w-4" />
                          开始合成
                        </>
                      )}
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
              {renderOutput && (
                <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <RotateCcw
                      className={`h-5 w-5 text-primary ${
                        renderOutput.status !== 'completed' && renderOutput.status !== 'failed'
                          ? 'animate-spin'
                          : ''
                      }`}
                    />
                    <h2 className="text-base font-semibold text-ink">合成进度</h2>
                    <StatusBadge status={renderOutput.status} />
                  </div>

                  <ProgressBar progress={renderOutput.progress_percent} />

                  {renderOutput.error_message && (
                    <div className="mt-4 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
                      <div>
                        <p className="text-sm font-medium text-semantic-error">合成失败</p>
                        <p className="text-xs text-slate mt-0.5">{renderOutput.error_message}</p>
                      </div>
                    </div>
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

                  {renderOutput.status === 'completed' && (
                    <div className="mt-6 rounded-lg border border-brand-green/20 bg-card-tint-mint/50 p-4 flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-brand-green shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-charcoal">合成完成</p>
                        <p className="text-xs text-steel mt-0.5">
                          {renderOutput.resolution ?? options.resolution} · {renderOutput.fps ?? options.fps}fps ·{' '}
                          {(renderOutput.codec ?? options.codec)?.toUpperCase()} ·{' '}
                          {formatDuration(renderOutput.output_duration ?? 0)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    {renderOutput.status === 'completed' ? (
                      <Button onClick={handleDownload} className="gap-2">
                        <Download className="h-4 w-4" />
                        {downloadUrl ? '下载成片' : '获取下载链接'}
                      </Button>
                    ) : renderOutput.status === 'failed' ? (
                      <Button onClick={handleStart} disabled={startMutation.isPending} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        重新合成
                      </Button>
                    ) : null}

                    <Button variant="secondary" onClick={handleReset} className="gap-2">
                      <RotateCcw className="h-4 w-4" />
                      重置
                    </Button>
                  </div>
                </section>
              )}

              {/* Transitions preview */}
              {renderOutput && renderOutput.transitions.length > 0 && (
                <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Shuffle className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold text-ink">转场列表</h2>
                    <span className="text-xs text-steel ml-auto">共 {renderOutput.transitions.length} 处</span>
                  </div>
                  <div className="space-y-2">
                    {renderOutput.transitions.map((t, idx) => (
                      <div
                        key={`${t.from_node_id}-${t.to_node_id}-${idx}`}
                        className="flex items-center justify-between rounded-lg border border-hairline bg-surface-soft px-4 py-3"
                      >
                        <div className="flex items-center gap-3 text-sm">
                          <span className="font-mono text-steel">{t.from_node_id}</span>
                          <span className="text-stone">→</span>
                          <span className="font-mono text-steel">{t.to_node_id}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-steel">
                          <Badge variant="tag-purple">{t.transition_type}</Badge>
                          <span>{t.duration}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Subtitle cues preview */}
              {renderOutput && renderOutput.subtitle_cues.length > 0 && (
                <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Subtitles className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold text-ink">字幕时间线预览</h2>
                    <span className="text-xs text-steel ml-auto">
                      共 {renderOutput.subtitle_cues.length} 条
                    </span>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {renderOutput.subtitle_cues.map((cue, idx) => (
                      <div
                        key={`${cue.node_id}-${idx}`}
                        className="flex items-start gap-4 rounded-lg border border-hairline bg-surface-soft px-4 py-3"
                      >
                        <div className="shrink-0 text-xs font-mono text-steel w-24">
                          {formatDuration(cue.start_time)} → {formatDuration(cue.end_time)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink line-clamp-2" title={cue.text}>
                            {cue.text}
                          </p>
                          <p className="text-xs text-steel mt-0.5">{cue.node_id}</p>
                        </div>
                      </div>
                    ))}
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
