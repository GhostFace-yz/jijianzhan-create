import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type {
  ProjectResponse,
  StoryboardNode,
  EpisodeMusicResult,
  EpisodeMusicResultResponse,
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
  generateEpisodeMusic: vi.fn(),
  uploadEpisodeMusic: vi.fn(),
}));

import { getProject } from '../src/api/projects';
import { listStoryboardNodes } from '../src/api/storyboard';
import { getEpisodeMusic, generateEpisodeMusic, uploadEpisodeMusic } from '../src/api/music';
import { MusicPage } from '../src/pages/MusicPage';

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

const mockNodes: StoryboardNode[] = [
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
  },
];

const mockMusic: EpisodeMusicResult = {
  episode_id: 'ep-1',
  original_url: 'https://example.com/bgm.mp3',
  duration: 11,
  segments: [
    {
      node_id: 'ep1-n001',
      start_time: 0,
      duration: 6,
      url: 'https://example.com/bgm.mp3',
      volume: 0.25,
      ducked: true,
      crossfade_in: 0,
      crossfade_out: 0.4,
    },
    {
      node_id: 'ep1-n002',
      start_time: 5.6,
      duration: 5.4,
      url: 'https://example.com/bgm.mp3',
      volume: 0.9,
      ducked: false,
      crossfade_in: 0.4,
      crossfade_out: 0,
    },
  ],
  generated_at: '2026-06-19T00:00:00Z',
  provider: 'mock-music',
  model: 'music-model',
  warnings: [
    {
      type: 'emotion_transition',
      from_node: 'ep1-n001',
      to_node: 'ep1-n002',
      from_mood: '舒缓',
      to_mood: '紧张',
      message: '节点 ep1-n001 (舒缓) 到 ep1-n002 (紧张)：情绪差异较大，建议插入过渡节点',
    },
  ],
};

const mockMusicResponse: EpisodeMusicResultResponse = {
  data: mockMusic,
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

  const route = `/projects/${projectId}/episodes/${episodeNumber}/music`;

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/projects/:projectId/episodes/:episodeNumber/music" element={<MusicPage />} />
          <Route
            path="/projects/:projectId/episodes/:episodeNumber/storyboard/review"
            element={<div>Storyboard Review</div>}
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

describe('MusicPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock-url') });
  });

  describe('Empty state', () => {
    it('should show empty state when no music exists', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(getEpisodeMusic).mockRejectedValue(new Error('Music not found for this episode'));

      renderPage();
      await waitForData();

      expect(screen.getByTestId('music-empty-state')).toBeInTheDocument();
      expect(screen.getByText('还没有配乐')).toBeInTheDocument();

      const emptyState = screen.getByTestId('music-empty-state');
      expect(within(emptyState).getByRole('button', { name: /AI 生成配乐/i })).toBeInTheDocument();
      expect(within(emptyState).getByRole('button', { name: /手动上传/i })).toBeInTheDocument();
    });

    it('should show empty state hint when no storyboard nodes exist', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: [] });
      vi.mocked(getEpisodeMusic).mockRejectedValue(new Error('Music not found for this episode'));

      renderPage();
      await waitForData();

      expect(screen.getByText('需先拆分分镜节点')).toBeInTheDocument();
    });
  });

  describe('Music loaded', () => {
    it('should display header with music duration', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(getEpisodeMusic).mockResolvedValue(mockMusicResponse);

      renderPage();
      await waitForData();

      expect(screen.getByText('星辰大海 · 第 1 集 · 配乐试听与上传')).toBeInTheDocument();
      expect(screen.getByText('总时长 0:11')).toBeInTheDocument();
    });

    it('should show BGM player and metadata', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(getEpisodeMusic).mockResolvedValue(mockMusicResponse);

      renderPage();
      await waitForData();

      expect(screen.getByText('整集 BGM 试听')).toBeInTheDocument();
      expect(screen.getByText('Provider: mock-music')).toBeInTheDocument();
      expect(screen.getByText('Model: music-model')).toBeInTheDocument();
    });

    it('should show emotion sequence', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(getEpisodeMusic).mockResolvedValue(mockMusicResponse);

      renderPage();
      await waitForData();

      expect(screen.getByText('情绪序列')).toBeInTheDocument();
      expect(screen.getByText('舒缓')).toBeInTheDocument();
      expect(screen.getByText('紧张')).toBeInTheDocument();
    });

    it('should show segment status', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(getEpisodeMusic).mockResolvedValue(mockMusicResponse);

      renderPage();
      await waitForData();

      expect(screen.getByText('切割片段状态')).toBeInTheDocument();
      expect(screen.getAllByText('ep1-n001')[0]).toBeInTheDocument();
      expect(screen.getAllByText('ep1-n002')[0]).toBeInTheDocument();
      expect(screen.getByText('压低')).toBeInTheDocument();
      expect(screen.getByText('正常')).toBeInTheDocument();
    });

    it('should show emotion transition warnings', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(getEpisodeMusic).mockResolvedValue(mockMusicResponse);

      renderPage();
      await waitForData();

      expect(screen.getByText('情绪过渡警告')).toBeInTheDocument();
      expect(
        screen.getByText(
          '节点 ep1-n001 (舒缓) 到 ep1-n002 (紧张)：情绪差异较大，建议插入过渡节点',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner while fetching', async () => {
      vi.mocked(getProject).mockReturnValue(new Promise(() => {}));
      vi.mocked(listStoryboardNodes).mockReturnValue(new Promise(() => {}));
      vi.mocked(getEpisodeMusic).mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error message when fetch fails', async () => {
      vi.mocked(getProject).mockRejectedValue(new Error('Service unavailable'));
      vi.mocked(listStoryboardNodes).mockRejectedValue(new Error('Service unavailable'));
      vi.mocked(getEpisodeMusic).mockRejectedValue(new Error('Service unavailable'));

      renderPage();
      await waitForData();

      expect(screen.getByText('加载失败')).toBeInTheDocument();
      expect(screen.getByText('Service unavailable')).toBeInTheDocument();
    });
  });

  describe('Generate music', () => {
    it('should call generateEpisodeMusic when generate button is clicked', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(getEpisodeMusic).mockRejectedValue(new Error('Music not found for this episode'));
      vi.mocked(generateEpisodeMusic).mockResolvedValue(mockMusicResponse);

      renderPage();
      await waitForData();

      await userEvent.click(
        within(screen.getByTestId('music-empty-state')).getByRole('button', { name: /AI 生成配乐/i }),
      );

      await waitFor(() => {
        expect(generateEpisodeMusic).toHaveBeenCalledWith('proj-1', 'ep-1');
      });
    });
  });

  describe('Upload music', () => {
    it('should open upload dialog and call uploadEpisodeMusic', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(getEpisodeMusic).mockRejectedValue(new Error('Music not found for this episode'));
      vi.mocked(uploadEpisodeMusic).mockResolvedValue(mockMusicResponse);

      renderPage();
      await waitForData();

      await userEvent.click(screen.getAllByRole('button', { name: /手动上传 BGM/i })[0]);

      expect(screen.getByText('手动上传配乐')).toBeInTheDocument();

      const file = new File(['audio content'], 'bgm.mp3', { type: 'audio/mpeg' });
      const dropZone = screen.getByRole('button', { name: /拖拽音频到此处/i });
      const input = dropZone.querySelector('input[type="file"]');
      fireEvent.change(input!, { target: { files: [file] } });

      await userEvent.click(screen.getByRole('button', { name: /确认上传/i }));

      await waitFor(() => {
        expect(uploadEpisodeMusic).toHaveBeenCalledWith('proj-1', 'ep-1', {
          url: 'blob:mock-url',
          duration: 1,
        });
      });
    });
  });
});
