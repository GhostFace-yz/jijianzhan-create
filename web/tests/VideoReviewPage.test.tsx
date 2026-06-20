import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type {
  ProjectResponse,
  StoryboardNodeWithVideo,
  VideoBatchResult,
  VideoNodeResult,
  VideoClip,
} from '../src/types';

// ── Mock API modules ──

vi.mock('../src/api/projects', () => ({
  getProject: vi.fn(),
}));

vi.mock('../src/api/storyboard', () => ({
  listStoryboardNodes: vi.fn(),
}));

vi.mock('../src/api/video', () => ({
  batchGenerateVideo: vi.fn(),
  generateNodeVideo: vi.fn(),
  reviewNodeVideo: vi.fn(),
  uploadNodeVideoFile: vi.fn(),
}));

import { getProject } from '../src/api/projects';
import { listStoryboardNodes } from '../src/api/storyboard';
import { batchGenerateVideo, generateNodeVideo, reviewNodeVideo, uploadNodeVideoFile } from '../src/api/video';
import { VideoReviewPage } from '../src/pages/VideoReviewPage';

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

function createMockVideoClip(overrides?: Partial<VideoClip>): VideoClip {
  return {
    url: 'https://example.com/video1.mp4',
    duration: 6,
    camera_move: 'none',
    motion_description: '静态镜头',
    generated_at: '2026-06-19T00:00:00Z',
    status: 'generated',
    quality_report: {
      actual_duration: 6,
      target_duration: 6,
      duration_ok: true,
      face_corruption_detected: false,
      motion_jump_detected: false,
      passed: true,
      details: ['Duration check passed: error 0.00s', 'Face corruption check passed', 'Motion jump check passed'],
    },
    provider: 'mock-video',
    model: 'video-model',
    fallback_used: false,
    ...overrides,
  };
}

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
    video_clip: createMockVideoClip(),
    video_status: 'generated',
  },
  {
    node_id: 'ep1-n002',
    scene_id: 'scene-coffee-shop',
    scene_variant: '下午-晴天',
    characters: [{ char_id: 'char_wang', costume_variant: '正装' }],
    shot_type: 'close-up',
    camera_move: 'pan-left',
    visual_desc: '王大明推门进入咖啡厅',
    dialogue: { char_id: 'char_wang', text: '你好，请给我一杯美式。', emotion: 'neutral' },
    emotion_tag: '平静',
    music_mood: '舒缓',
    duration_target: 5,
    transition_in: 'cut',
    transition_out: 'cut',
    status: 'pending',
    version_history: [],
    video_clip: null,
    video_status: 'pending',
  },
  {
    node_id: 'ep1-n003',
    scene_id: 'scene-park',
    scene_variant: '傍晚-多云',
    characters: [{ char_id: 'char_wang', costume_variant: '休闲装' }],
    shot_type: 'wide-shot',
    camera_move: 'tracking',
    visual_desc: '两人并肩走在公园湖边',
    dialogue: { char_id: 'char_wang', text: '夕阳真美啊。', emotion: 'contemplative' },
    emotion_tag: '浪漫',
    music_mood: '温馨',
    duration_target: 7,
    transition_in: 'dissolve',
    transition_out: 'fade',
    status: 'completed',
    version_history: [],
    video_clip: createMockVideoClip({
      status: 'reviewed',
      reviewed: true,
      reviewed_at: '2026-06-19T00:00:00Z',
    }),
    video_status: 'reviewed',
  },
];

const mockBatchResult: { data: VideoBatchResult } = {
  data: {
    episode_id: 'ep-1',
    total_nodes: 3,
    nodes_generated: 3,
    nodes_skipped: 0,
    nodes_failed: 0,
    success_rate: 1,
    fallback_used_count: 0,
    quality_passed_count: 3,
    results: mockNodes.map((n) => ({
      node_id: n.node_id,
      video_clip: n.video_clip,
      skipped: false,
    })) as VideoNodeResult[],
  },
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

  const route = `/projects/${projectId}/episodes/${episodeNumber}/video`;

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/projects/:projectId/episodes/:episodeNumber/video" element={<VideoReviewPage />} />
          <Route
            path="/projects/:projectId/episodes/:episodeNumber/music"
            element={<div>Music Page</div>}
          />
          <Route
            path="/projects/:projectId/episodes/:episodeNumber/storyboard"
            element={<div>Storyboard Page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function waitForData() {
  await waitFor(() => {
    expect(screen.queryByText('加载分镜节点...')).not.toBeInTheDocument();
  });
}

// ── Tests ──

describe('VideoReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty state', () => {
    it('should show empty state when no nodes exist', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: [] });

      renderPage();
      await waitForData();

      expect(screen.getByText('还没有分镜节点')).toBeInTheDocument();
      expect(screen.getByText('前往分镜编辑器')).toBeInTheDocument();
    });
  });

  describe('Nodes loaded', () => {
    it('should display header with review count', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText('星辰大海 · 第 1 集 · 视频片段预览与审核')).toBeInTheDocument();
      expect(screen.getByText(/1\s*\/\s*3\s*已通过/)).toBeInTheDocument();
      expect(screen.getByText(/1\s*已审核/)).toBeInTheDocument();
      expect(screen.getByText(/2\s*已生成/)).toBeInTheDocument();
    });

    it('should show all timeline node items', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByTestId('video-node-ep1-n001')).toBeInTheDocument();
      expect(screen.getByTestId('video-node-ep1-n002')).toBeInTheDocument();
      expect(screen.getByTestId('video-node-ep1-n003')).toBeInTheDocument();
    });

    it('should show video status badges', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText('已生成')).toBeInTheDocument();
      expect(screen.getByText('待生成')).toBeInTheDocument();
      expect(screen.getByText('已审核')).toBeInTheDocument();
    });

    it('should show batch generate button', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByRole('button', { name: /批量生成视频/i })).toBeInTheDocument();
    });

    it('should show quality report for selected node', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText('质量检测报告')).toBeInTheDocument();
      expect(screen.getByText('检测详情')).toBeInTheDocument();
    });

    it('should show continuous playback checkbox', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByLabelText('连续播放相邻节点')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner while fetching', async () => {
      vi.mocked(getProject).mockReturnValue(new Promise(() => {}));
      vi.mocked(listStoryboardNodes).mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getByText('加载分镜节点...')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error message when fetch fails', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockRejectedValue(new Error('Service unavailable'));

      renderPage();
      await waitForData();

      expect(screen.getByText('加载失败')).toBeInTheDocument();
      expect(screen.getByText('Service unavailable')).toBeInTheDocument();
    });
  });

  describe('Batch generation', () => {
    it('should call batchGenerateVideo when batch generate button is clicked', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(batchGenerateVideo).mockResolvedValue(mockBatchResult);

      renderPage();
      await waitForData();

      await userEvent.click(screen.getByRole('button', { name: /批量生成视频/i }));

      await waitFor(() => {
        expect(batchGenerateVideo).toHaveBeenCalledWith('proj-1', 'ep-1');
      });
    });

    it('should display batch generation summary on success', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(batchGenerateVideo).mockResolvedValue(mockBatchResult);

      renderPage();
      await waitForData();

      await userEvent.click(screen.getByRole('button', { name: /批量生成视频/i }));

      await waitFor(() => {
        expect(screen.getByText('批量视频生成完成')).toBeInTheDocument();
      });
    });
  });

  describe('Single generation', () => {
    it('should call generateNodeVideo for a pending node', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(generateNodeVideo).mockResolvedValue({
        data: {
          node_id: 'ep1-n002',
          video_clip: createMockVideoClip(),
          skipped: false,
        },
      });

      renderPage();
      await waitForData();

      const card = screen.getByTestId('video-node-ep1-n002');
      const generateBtn = within(card).getByText('生成视频');
      expect(generateBtn).toBeEnabled();
      await userEvent.click(generateBtn);

      expect(generateNodeVideo).toHaveBeenCalledWith('proj-1', 'ep-1', 'ep1-n002', undefined);
    });
  });

  describe('Review actions', () => {
    it('should call reviewNodeVideo with approved=true', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(reviewNodeVideo).mockResolvedValue({
        data: createMockVideoClip({ status: 'reviewed', reviewed: true }),
      });

      renderPage();
      await waitForData();

      const card = screen.getByTestId('video-node-ep1-n001');
      const approveBtn = within(card).getByRole('button', { name: /通过/i });
      await userEvent.click(approveBtn);

      await waitFor(() => {
        expect(reviewNodeVideo).toHaveBeenCalledWith('proj-1', 'ep-1', 'ep1-n001', { approved: true });
      });
    });

    it('should call reviewNodeVideo with approved=false', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(reviewNodeVideo).mockResolvedValue({
        data: createMockVideoClip({ status: 'reviewed', reviewed: false }),
      });

      renderPage();
      await waitForData();

      const card = screen.getByTestId('video-node-ep1-n001');
      const rejectBtn = within(card).getByRole('button', { name: /驳回/i });
      await userEvent.click(rejectBtn);

      await waitFor(() => {
        expect(reviewNodeVideo).toHaveBeenCalledWith('proj-1', 'ep-1', 'ep1-n001', { approved: false });
      });
    });
  });

  describe('Upload replacement', () => {
    it('should open upload dialog and call uploadNodeVideoFile with the raw File', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(uploadNodeVideoFile).mockResolvedValue({
        data: createMockVideoClip({
          url: 'https://storage.example.com/uploaded.mp4',
          duration: 6,
          provider: 'user-upload',
          model: 'user-upload',
        }),
      });

      renderPage();
      await waitForData();

      const card = screen.getByTestId('video-node-ep1-n001');
      const uploadBtn = within(card).getByRole('button', { name: /上传/i });
      await userEvent.click(uploadBtn);

      expect(screen.getByText('手动上传视频片段')).toBeInTheDocument();

      const file = new File(['video content'], 'clip.mp4', { type: 'video/mp4' });
      const dropZone = screen.getByRole('button', { name: /拖拽视频到此处/i });
      const input = dropZone.querySelector('input[type="file"]');
      await userEvent.upload(input!, file);

      await userEvent.click(screen.getByRole('button', { name: /确认替换/i }));

      await waitFor(() => {
        expect(uploadNodeVideoFile).toHaveBeenCalledWith('proj-1', 'ep-1', 'ep1-n001', file, {
          duration: 6,
          camera_move: 'static',
          motion_description: '林小夏坐在咖啡厅靠窗位置',
        });
      });
    });
  });

  describe('Adjust params regenerate', () => {
    it('should open regenerate options dialog', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(generateNodeVideo).mockResolvedValue({
        data: {
          node_id: 'ep1-n001',
          video_clip: createMockVideoClip(),
          skipped: false,
        },
      });

      renderPage();
      await waitForData();

      const card = screen.getByTestId('video-node-ep1-n001');
      const adjustBtn = within(card).getByRole('button', { name: /调参重生/i });
      await userEvent.click(adjustBtn);

      expect(screen.getByText('调整参数后重新生成')).toBeInTheDocument();
    });
  });

  describe('Composition unlock', () => {
    it('should show unlock banner when all nodes are approved', async () => {
      const allApprovedNodes = mockNodes.map((n) => ({
        ...n,
        video_clip: createMockVideoClip({ status: 'reviewed' as const, reviewed: true as const }),
        video_status: 'reviewed' as const,
      }));

      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: allApprovedNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText('全部节点审核通过，已解锁合成入口')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /开始合成/i })).toBeInTheDocument();
    });
  });
});
