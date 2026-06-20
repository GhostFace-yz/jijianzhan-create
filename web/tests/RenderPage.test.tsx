import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type {
  ProjectResponse,
  StoryboardNodeWithVideo,
  StoryboardNodeWithAudio,
  EpisodeMusicResult,
  EpisodeRenderOutput,
} from '../src/types';

// ── Mock API modules ──

vi.mock('../src/api/projects', () => ({
  getProject: vi.fn(),
}));

vi.mock('../src/api/storyboard', () => ({
  listStoryboardNodes: vi.fn(),
}));

vi.mock('../src/api/music', () => ({
  getEpisodeMusic: vi.fn(),
}));

vi.mock('../src/api/render', () => ({
  startRender: vi.fn(),
  getRenderProgress: vi.fn(),
  getRenderDownload: vi.fn(),
}));

import { getProject } from '../src/api/projects';
import { listStoryboardNodes } from '../src/api/storyboard';
import { getEpisodeMusic } from '../src/api/music';
import { startRender, getRenderProgress, getRenderDownload } from '../src/api/render';
import { RenderPage } from '../src/pages/RenderPage';

// ── Mock data ──

const mockProject: ProjectResponse = {
  data: {
    id: 'proj-1',
    user_id: 'user-1',
    team_id: null,
    status: 'producing',
    meta: {
      title: '星辰大海',
      description: '一部都市情感剧',
      genre: 'urban_romance',
      style_tags: ['realistic', 'fresh'],
      target_episodes: 12,
      duration_goal: '5min',
      notes: null,
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
};

const mockNodes: (StoryboardNodeWithVideo & StoryboardNodeWithAudio)[] = [
  {
    node_id: 'ep1-n001',
    scene_id: 'scene-coffee-shop',
    scene_variant: '下午-晴天',
    characters: [{ char_id: 'char_lin', costume_variant: '休闲装' }],
    shot_type: 'medium-shot',
    camera_move: 'static',
    visual_desc: '林小夏坐在咖啡厅靠窗位置',
    dialogue: { char_id: 'char_lin', text: '今天的咖啡真好喝。', emotion: 'gentle' },
    emotion_tag: '温馨',
    music_mood: '舒缓',
    duration_target: 6,
    transition_in: 'fade',
    transition_out: 'cut',
    status: 'completed',
    version_history: [],
    video_clip: {
      url: 'https://example.com/video1.mp4',
      duration: 6,
      camera_move: 'static',
      motion_description: '静态镜头',
      generated_at: '2026-06-19T00:00:00Z',
      status: 'reviewed',
      reviewed: true,
      quality_report: {
        actual_duration: 6,
        target_duration: 6,
        duration_ok: true,
        face_corruption_detected: false,
        motion_jump_detected: false,
        passed: true,
        details: [],
      },
      provider: 'mock-video',
      model: 'video-model',
      fallback_used: false,
    },
    audio_clip: {
      url: 'https://example.com/audio1.mp3',
      duration: 4,
      voice_id: 'voice-1',
      emotion: 'gentle',
      speed: 1,
      generated_at: '2026-06-19T00:00:00Z',
      status: 'generated',
    },
    tts_status: 'generated',
  },
  {
    node_id: 'ep1-n002',
    scene_id: 'scene-park',
    scene_variant: '傍晚-多云',
    characters: [{ char_id: 'char_wang', costume_variant: '正装' }],
    shot_type: 'wide-shot',
    camera_move: 'tracking',
    visual_desc: '两人并肩走在公园湖边',
    dialogue: null,
    emotion_tag: '紧张',
    music_mood: '紧张',
    duration_target: 5,
    transition_in: 'cut',
    transition_out: 'fade',
    status: 'pending',
    version_history: [],
    video_clip: null,
    audio_clip: null,
    tts_status: 'pending',
  },
];

const mockMusic: EpisodeMusicResult = {
  episode_id: 'ep-1',
  original_url: 'https://example.com/bgm.mp3',
  duration: 11,
  segments: [],
  generated_at: '2026-06-19T00:00:00Z',
  provider: 'mock-music',
  model: 'music-model',
};

function createMockRenderOutput(overrides?: Partial<EpisodeRenderOutput>): EpisodeRenderOutput {
  return {
    episode_id: 'ep-1',
    status: 'queued',
    progress_percent: 0,
    output_url: null,
    output_duration: null,
    resolution: '1080x1920',
    fps: 30,
    codec: 'h264',
    subtitle_cues: [],
    transitions: [],
    started_at: '2026-06-19T00:00:00Z',
    queued_at: '2026-06-19T00:00:01Z',
    completed_at: null,
    error_message: null,
    job_id: 'job-1',
    ...overrides,
  };
}

// ── Helpers ──

function renderPage({
  projectId = 'proj-1',
  episodeNumber = '1',
}: {
  projectId?: string;
  episodeNumber?: string;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  const route = `/projects/${projectId}/episodes/${episodeNumber}/render`;

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route
            path="/projects/:projectId/episodes/:episodeNumber/render"
            element={<RenderPage />}
          />
          <Route
            path="/projects/:projectId/episodes/:episodeNumber/video"
            element={<div>Video Review</div>}
          />
          <Route
            path="/projects/:projectId/episodes/:episodeNumber/storyboard"
            element={<div>Storyboard</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function waitForData() {
  await waitFor(() => {
    expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
  });
}

// ── Tests ──

describe('RenderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should render config form with default values and summary cards', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
    vi.mocked(getEpisodeMusic).mockResolvedValue({ data: mockMusic });

    renderPage();
    await waitForData();

    expect(screen.getByText('合成参数配置')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /开始合成/i })).toBeInTheDocument();
    expect(screen.getByTestId('video-summary')).toHaveTextContent(/1\s*\/\s*2\s*已生成/);
    expect(screen.getByTestId('tts-summary')).toHaveTextContent(/1\s*\/\s*2\s*已就绪/);
    expect(screen.getByTestId('music-summary')).toHaveTextContent(/1\s*\/\s*1\s*已生成/);
  });

  it('should show readiness warning when not all videos are generated', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
    vi.mocked(getEpisodeMusic).mockResolvedValue({ data: mockMusic });

    renderPage();
    await waitForData();

    expect(screen.getByText(/还有 1 个节点未生成视频片段/)).toBeInTheDocument();
  });

  it('should start render and show progress', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
    vi.mocked(getEpisodeMusic).mockResolvedValue({ data: mockMusic });
    vi.mocked(startRender).mockResolvedValue({
      data: createMockRenderOutput({ status: 'queued', progress_percent: 5 }),
    });
    vi.mocked(getRenderProgress).mockResolvedValue({
      data: createMockRenderOutput({ status: 'encoding', progress_percent: 60 }),
    });

    renderPage();
    await waitForData();

    await userEvent.click(screen.getByRole('button', { name: /开始合成/i }));

    await waitFor(() => {
      expect(startRender).toHaveBeenCalledWith('proj-1', 'ep-1', expect.objectContaining({
        resolution: '1080x1920',
        fps: 30,
        codec: 'h264',
      }));
    });

    await waitFor(() => {
      expect(screen.getByText('合成进度')).toBeInTheDocument();
    });
  });

  it('should show completed result and download button', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
    vi.mocked(getEpisodeMusic).mockResolvedValue({ data: mockMusic });
    vi.mocked(startRender).mockResolvedValue({
      data: createMockRenderOutput({ status: 'queued' }),
    });
    vi.mocked(getRenderProgress).mockResolvedValue({
      data: createMockRenderOutput({
        status: 'completed',
        progress_percent: 100,
        output_url: 'https://example.com/final.mp4',
        output_duration: 11,
      }),
    });
    vi.mocked(getRenderDownload).mockResolvedValue({
      data: { url: 'https://example.com/final.mp4' },
    });

    renderPage();
    await waitForData();

    await userEvent.click(screen.getByRole('button', { name: /开始合成/i }));

    await waitFor(() => {
      expect(screen.getByText('合成完成')).toBeInTheDocument();
    });

    const downloadButton = screen.getByRole('button', { name: /下载成片/i });
    expect(downloadButton).toBeInTheDocument();
  });

  it('should open download url when download button clicked', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
    vi.mocked(getEpisodeMusic).mockResolvedValue({ data: mockMusic });
    vi.mocked(startRender).mockResolvedValue({
      data: createMockRenderOutput({ status: 'queued' }),
    });
    vi.mocked(getRenderProgress).mockResolvedValue({
      data: createMockRenderOutput({
        status: 'completed',
        progress_percent: 100,
        output_url: 'https://example.com/final.mp4',
        output_duration: 11,
      }),
    });
    vi.mocked(getRenderDownload).mockResolvedValue({
      data: { url: 'https://example.com/final.mp4' },
    });

    renderPage();
    await waitForData();

    await userEvent.click(screen.getByRole('button', { name: /开始合成/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /下载成片/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /下载成片/i }));

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith('https://example.com/final.mp4', '_blank');
    });
  });

  it('should show failure state and retry button', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
    vi.mocked(getEpisodeMusic).mockResolvedValue({ data: mockMusic });
    vi.mocked(startRender).mockResolvedValue({
      data: createMockRenderOutput({ status: 'queued' }),
    });
    vi.mocked(getRenderProgress).mockResolvedValue({
      data: createMockRenderOutput({
        status: 'failed',
        progress_percent: 40,
        error_message: '编码失败：分辨率不支持',
      }),
    });

    renderPage();
    await waitForData();

    await userEvent.click(screen.getByRole('button', { name: /开始合成/i }));

    await waitFor(() => {
      expect(screen.getByText('编码失败：分辨率不支持')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /重新合成/i })).toBeInTheDocument();
  });

  it('should show empty state when no storyboard nodes exist', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: [] });
    vi.mocked(getEpisodeMusic).mockResolvedValue({ data: mockMusic });

    renderPage();
    await waitForData();

    expect(screen.getByText('还没有分镜节点')).toBeInTheDocument();
  });

  it('should show error message when fetch fails', async () => {
    vi.mocked(getProject).mockRejectedValue(new Error('Service unavailable'));
    vi.mocked(listStoryboardNodes).mockRejectedValue(new Error('Service unavailable'));

    renderPage();
    await waitForData();

    expect(screen.getByText('加载失败')).toBeInTheDocument();
    expect(screen.getByText('Service unavailable')).toBeInTheDocument();
  });

  it('should render transitions and subtitle cues when render output includes them', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
    vi.mocked(getEpisodeMusic).mockResolvedValue({ data: mockMusic });
    vi.mocked(startRender).mockResolvedValue({
      data: createMockRenderOutput({
        status: 'completed',
        progress_percent: 100,
        transitions: [
          {
            from_node_id: 'ep1-n001',
            to_node_id: 'ep1-n002',
            transition_type: 'fade',
            duration: 0.5,
          },
        ],
        subtitle_cues: [
          {
            node_id: 'ep1-n001',
            start_time: 0,
            end_time: 4,
            text: '今天的咖啡真好喝。',
          },
        ],
      }),
    });
    vi.mocked(getRenderDownload).mockResolvedValue({
      data: { url: 'https://example.com/final.mp4' },
    });

    renderPage();
    await waitForData();

    await userEvent.click(screen.getByRole('button', { name: /开始合成/i }));

    await waitFor(() => {
      expect(screen.getByText('转场列表')).toBeInTheDocument();
    });

    expect(screen.getByText('字幕时间线预览')).toBeInTheDocument();
    expect(screen.getByText('今天的咖啡真好喝。')).toBeInTheDocument();
    expect(screen.getByText('fade')).toBeInTheDocument();
  });
});
