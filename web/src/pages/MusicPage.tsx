import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  RotateCcw,
  Upload,
  Volume2,
  VolumeX,
  Play,
  Pause,
  AlertTriangle,
  Music,
  SlidersHorizontal,
  Scissors,
  X,
  Headphones,
  CheckCircle,
} from 'lucide-react';
import { getProject } from '../api/projects';
import { listStoryboardNodes } from '../api/storyboard';
import { getEpisodeMusic, generateEpisodeMusic, uploadEpisodeMusic } from '../api/music';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  PROJECT_STATUS_LABELS,
  MUSIC_MOOD_LABELS,
  type StoryboardNode,
  type EpisodeMusicResult,
  type MusicSegment,
} from '../types';

// ── Helpers ──────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getMoodLabel(mood: string): string {
  return MUSIC_MOOD_LABELS[mood] || mood;
}

function getAudioFileDuration(file: File): number {
  return (file as File & { duration?: number }).duration ?? 0;
}

// ── Dialogs ───────────────────────────────────────────────────────────

function UploadDialog({
  onClose,
  onSubmit,
  isPending,
}: {
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
          <h3 className="text-lg font-semibold text-ink">手动上传配乐</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-steel hover:text-ink hover:bg-surface transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-steel mb-4">上传自定义 BGM 文件，覆盖当前 AI 配乐</p>

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
              <p className="text-xs text-muted mt-1">支持 MP3 / WAV</p>
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
            {isPending ? '上传中...' : '确认上传'}
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
    <div className="flex items-center gap-3 bg-surface rounded-lg px-4 py-3 border border-hairline">
      <audio ref={audioRef} src={url} preload="metadata" />
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
        className="w-20 h-1.5 bg-hairline-strong rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

// ── Segment Card ──────────────────────────────────────────────────────

function SegmentCard({ segment, index }: { segment: MusicSegment; index: number }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-hairline bg-canvas px-4 py-3 hover:shadow-sm transition-shadow">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card-tint-lavender text-xs font-semibold text-brand-purple-800">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono font-semibold text-ink truncate" title={segment.node_id}>
            {segment.node_id}
          </span>
          {segment.ducked ? (
            <Badge variant="tag-orange">压低</Badge>
          ) : (
            <Badge variant="tag-green">正常</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel">
          <span>起始: {formatDuration(segment.start_time)}</span>
          <span>时长: {formatDuration(segment.duration)}</span>
          <span>音量: {Math.round(segment.volume * 100)}%</span>
          {segment.crossfade_in > 0 && <span>淡入: {segment.crossfade_in}s</span>}
          {segment.crossfade_out > 0 && <span>淡出: {segment.crossfade_out}s</span>}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export function MusicPage() {
  const { projectId = '', episodeNumber: epNumStr = '1' } = useParams<{
    projectId: string;
    episodeNumber: string;
  }>();
  const episodeNumber = parseInt(epNumStr, 10);
  const epId = `ep-${episodeNumber}`;
  const queryClient = useQueryClient();

  // ── Local state ──
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // ── Project info ──
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
  const projectTitle = project?.meta.title ?? '项目';
  const projectStatus = project?.status ?? 'draft';

  // ── Nodes data (for emotion sequence) ──
  const {
    data: nodesRes,
    isLoading: isNodesLoading,
    error: nodesError,
  } = useQuery({
    queryKey: ['storyboard-nodes', projectId, epId],
    queryFn: () => listStoryboardNodes(projectId, epId),
    enabled: Boolean(projectId),
  });
  const nodes: StoryboardNode[] = nodesRes?.data ?? [];
  const hasNodes = nodes.length > 0;

  const emotionSequence = useMemo(
    () => nodes.map((n) => n.music_mood).filter(Boolean),
    [nodes],
  );

  // ── Music data ──
  const {
    data: musicRes,
    isLoading: isMusicLoading,
    error: musicError,
  } = useQuery({
    queryKey: ['episode-music', projectId, epId],
    queryFn: () => getEpisodeMusic(projectId, epId),
    enabled: Boolean(projectId),
    retry: false,
  });
  const music: EpisodeMusicResult | null = musicRes?.data ?? null;
  const hasMusic = !!music?.original_url;

  // ── Mutations ──
  const generateMutation = useMutation({
    mutationFn: () => generateEpisodeMusic(projectId, epId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episode-music', projectId, epId] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ url, duration }: { url: string; duration: number }) =>
      uploadEpisodeMusic(projectId, epId, { url, duration }),
    onSuccess: () => {
      setShowUploadDialog(false);
      queryClient.invalidateQueries({ queryKey: ['episode-music', projectId, epId] });
    },
  });

  // ── Handlers ──
  const handleGenerate = useCallback(() => {
    generateMutation.mutate();
  }, [generateMutation]);

  const handleUpload = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      uploadMutation.mutate({ url, duration: getAudioFileDuration(file) || 1 });
    },
    [uploadMutation],
  );

  const isLoading = isProjectLoading || isNodesLoading || isMusicLoading;
  const fetchError = projectError || nodesError || (musicError && (musicError as Error).message !== 'Music not found for this episode'
    ? musicError
    : null);

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
                <Music className="h-5 w-5 text-primary" />
                {projectTitle} · 第 {episodeNumber} 集 · 配乐试听与上传
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="purple">{PROJECT_STATUS_LABELS[projectStatus]}</Badge>
              {hasMusic && (
                <span className="text-sm text-steel">
                  总时长 {formatDuration(music.duration)}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="shrink-0 border-b border-hairline bg-canvas px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowUploadDialog(true)}
            disabled={uploadMutation.isPending}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            手动上传 BGM
          </Button>

          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !hasNodes}
            className="gap-2"
          >
            {generateMutation.isPending ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {hasMusic ? '重新生成配乐' : 'AI 生成配乐'}
              </>
            )}
          </Button>

          {!hasNodes && (
            <span className="text-xs text-steel">需先拆分分镜节点</span>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline-strong border-t-primary" />
            <p className="mt-4 text-sm text-slate">加载中...</p>
          </div>
        )}

        {/* Error */}
        {fetchError && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-xl border border-semantic-error/20 bg-semantic-error/5 p-8 text-center max-w-md">
              <AlertTriangle className="h-8 w-8 text-semantic-error mx-auto mb-3" />
              <p className="text-semantic-error mb-1">加载失败</p>
              <p className="text-sm text-steel">{(fetchError as Error).message}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !fetchError && !hasMusic && (
          <div data-testid="music-empty-state" className="flex flex-col items-center justify-center py-20">
            <div className="flex flex-col items-center rounded-xl border border-hairline bg-canvas py-16 px-8 shadow-sm max-w-lg">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-tint-lavender">
                <Music className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-ink">还没有配乐</h2>
              <p className="mb-6 mt-2 text-center text-slate">
                使用 AI 根据分镜节点情绪自动生成整集 BGM，或手动上传已有的 MP3 / WAV 文件。
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowUploadDialog(true)}
                  disabled={uploadMutation.isPending}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  手动上传
                </Button>
                <Button onClick={handleGenerate} disabled={generateMutation.isPending || !hasNodes}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI 生成配乐
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Error banners */}
        {generateMutation.isError && (
          <div className="mx-6 mt-4 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-semantic-error" />
            <div>
              <p className="text-sm font-medium text-semantic-error">配乐生成失败</p>
              <p className="text-xs text-slate mt-0.5">{generateMutation.error.message}</p>
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

        {/* Generated music content */}
        {!isLoading && hasMusic && (
          <div className="p-6 space-y-6">
            {/* Player card */}
            <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Headphones className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-ink">整集 BGM 试听</h2>
              </div>
              <AudioPlayer url={music.original_url} />
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-steel">
                <span>总时长: {formatDuration(music.duration)}</span>
                <span>Provider: {music.provider}</span>
                <span>Model: {music.model}</span>
                <span>生成时间: {new Date(music.generated_at).toLocaleString()}</span>
              </div>
            </section>

            {/* Emotion sequence */}
            {emotionSequence.length > 0 && (
              <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold text-ink">情绪序列</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {emotionSequence.map((mood, idx) => (
                    <div key={`${mood}-${idx}`} className="flex items-center gap-2">
                      <Badge variant="tag-purple">{getMoodLabel(mood)}</Badge>
                      {idx < emotionSequence.length - 1 && (
                        <span className="text-steel">→</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Segment status */}
            {music.segments.length > 0 && (
              <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Scissors className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold text-ink">切割片段状态</h2>
                  <span className="text-xs text-steel ml-auto">
                    共 {music.segments.length} 段
                  </span>
                </div>
                <div className="space-y-3">
                  {music.segments.map((segment, idx) => (
                    <SegmentCard key={`${segment.node_id}-${idx}`} segment={segment} index={idx} />
                  ))}
                </div>
              </section>
            )}

            {/* Warnings */}
            {music.warnings && music.warnings.length > 0 && (
              <section className="rounded-xl border border-semantic-warning/20 bg-card-tint-peach/50 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-semantic-warning" />
                  <h2 className="text-base font-semibold text-charcoal">情绪过渡警告</h2>
                </div>
                <div className="space-y-3">
                  {music.warnings.map((warning, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg bg-canvas border border-hairline p-4"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-steel">{warning.from_node}</span>
                        <span className="text-xs text-steel">→</span>
                        <span className="text-xs font-mono text-steel">{warning.to_node}</span>
                      </div>
                      <p className="text-sm text-charcoal">{warning.message}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Success banner */}
            {generateMutation.isSuccess && (
              <div className="rounded-lg border border-brand-green/20 bg-card-tint-mint/50 p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-brand-green" />
                <p className="text-sm font-medium text-charcoal">配乐生成成功</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Upload dialog */}
      {showUploadDialog && (
        <UploadDialog
          onClose={() => setShowUploadDialog(false)}
          onSubmit={handleUpload}
          isPending={uploadMutation.isPending}
        />
      )}
    </div>
  );
}
