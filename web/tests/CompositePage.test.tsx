import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ProjectResponse, StoryboardNodeWithVideo, CompositeProgress, CompositeResult } from '../src/types';

// ── Mock API modules ──

vi.mock('../src/api/projects', () => ({
  getProject: vi.fn(),
}));

vi.mock('../src/api/storyboard', () => ({
  listStoryboardNodes: vi.fn(),
}));

vi.mock('../src/api/composite', () => ({
  startComposite: vi.fn(),
  getCompositeProgress: vi.fn(),
  getCompositeResult: vi.fn(),
}));

import { getProject } from '../src/api/projects';
import { listStoryboardNodes } from '../src/api/storyboard';
import { startComposite, getCompositeProgress, getCompositeResult } from '../src/api/composite';
import { CompositePage } from '../src/pages/CompositePage';

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

const mockNodes: StoryboardNodeWithVideo[] = [
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
  },
];

function createMockProgress(overrides?: Partial<CompositeProgress>): CompositeProgress {
  return {
    job_id: 'job-1',
    status: 'running',
    progress: 0.25,
    current_step: 'concat',
    steps: [
      { key: 'concat', label: '拼接中', status: 'running' },
      { key: 'mix_audio', label: '混音中', status: 'pending' },
      { key: 'render_subtitles', label: '字幕渲染中', status: 'pending' },
      { key: 'encode', label: '编码中', status: 'pending' },
    ],
    message: '正在拼接视频片段',
    ...overrides,
  };
}

const mockResult: CompositeResult = {
  job_id: 'job-1',
  url: 'https://example.com/final.mp4',
  duration: 11,
  width: 1080,
  height: 1920,
  file_size: 12_345_678,
  created_at: '2026-06-19T00:00:00Z',
};

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

  const route = `/projects/${projectId}/episodes/${episodeNumber}/composite`;

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/projects/:projectId/episodes/:episodeNumber/composite" element={<CompositePage />} />
          <Route path="/projects/:projectId/episodes/:episodeNumber/video" element={<div>Video Review</div>} />
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

describe('CompositePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render config form with default values', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });

    renderPage();
    await waitForData();

    expect(screen.getByText('合成参数配置')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /开始合成/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /返回节点修改/i })).toBeInTheDocument();
  });

  it('should start composite and show progress', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
    vi.mocked(startComposite).mockResolvedValue({ data: { job_id: 'job-1', status: 'running' } });
    vi.mocked(getCompositeProgress).mockResolvedValue({ data: createMockProgress() });

    renderPage();
    await waitForData();

    const startButton = screen.getByRole('button', { name: /开始合成/i });
    await userEvent.click(startButton);

    await waitFor(() => {
      expect(startComposite).toHaveBeenCalledWith('proj-1', 'ep-1', expect.objectContaining({
        resolution: 'portrait_9_16',
        frame_rate: 30,
        codec: 'h264',
        subtitle_enabled: true,
      }));
    });

    await waitFor(() => {
      expect(screen.getByText('合成进度')).toBeInTheDocument();
    });
  });

  it('should show completed result and download link', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
    vi.mocked(startComposite).mockResolvedValue({ data: { job_id: 'job-1', status: 'running' } });
    vi.mocked(getCompositeProgress).mockResolvedValue({
      data: createMockProgress({ status: 'completed', progress: 1, current_step: 'encode' }),
    });
    vi.mocked(getCompositeResult).mockResolvedValue({ data: mockResult });

    renderPage();
    await waitForData();

    await userEvent.click(screen.getByRole('button', { name: /开始合成/i }));

    await waitFor(() => {
      expect(screen.getByText('成片预览')).toBeInTheDocument();
    });

    const downloadLink = screen.getByRole('link', { name: /下载成片/i }) as HTMLAnchorElement;
    expect(downloadLink.href).toBe(mockResult.url);
    expect(downloadLink).toHaveAttribute('download');
  });

  it('should show failure state and retry button', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
    vi.mocked(startComposite).mockResolvedValue({ data: { job_id: 'job-1', status: 'running' } });
    vi.mocked(getCompositeProgress).mockResolvedValue({
      data: createMockProgress({ status: 'failed', current_step: 'encode', message: '编码失败' }),
    });

    renderPage();
    await waitForData();

    await userEvent.click(screen.getByRole('button', { name: /开始合成/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /重新合成/i })).toBeInTheDocument();
    });
  });

  it('should expand node list and navigate to video review', async () => {
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });

    renderPage();
    await waitForData();

    await userEvent.click(screen.getByRole('button', { name: /返回节点修改/i }));

    await waitFor(() => {
      expect(screen.getByText('选择节点返回修改')).toBeInTheDocument();
    });

    const nodeButton = screen.getByText('ep1-n001');
    await userEvent.click(nodeButton);

    await waitFor(() => {
      expect(screen.getByText('Video Review')).toBeInTheDocument();
    });
  });
});
