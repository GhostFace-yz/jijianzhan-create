import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type {
  StoryboardNodeWithImage,
  ProjectResponse,
  BatchGenerateResultResponse,
  NodeImageResultResponse,
  StoryboardNodeWithImageResponse,
} from '../src/types';

// ── Mock API modules ──

vi.mock('../src/api/projects', () => ({
  getProject: vi.fn(),
}));

vi.mock('../src/api/storyboard', () => ({
  listStoryboardNodesWithImages: vi.fn(),
  batchGenerateImages: vi.fn(),
  generateSingleImage: vi.fn(),
  reviewNodeImage: vi.fn(),
}));

import { getProject } from '../src/api/projects';
import {
  listStoryboardNodesWithImages,
  batchGenerateImages,
  generateSingleImage,
  reviewNodeImage,
} from '../src/api/storyboard';
import { StoryboardReviewPage } from '../src/pages/StoryboardReviewPage';

// ── Mock data ──

const mockProject: ProjectResponse = {
  data: {
    id: 'proj-1',
    user_id: 'user-1',
    team_id: null,
    status: 'asset_prep',
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

const mockNodes: StoryboardNodeWithImage[] = [
  {
    node_id: 'ep1-n001',
    scene_id: 'scene-coffee-shop',
    scene_variant: '下午-晴天',
    characters: [
      { char_id: 'char_lin', costume_variant: '休闲装' },
    ],
    shot_type: 'medium-shot',
    camera_move: 'static',
    visual_desc: '林小夏坐在咖啡厅靠窗位置',
    dialogue: { char_id: 'char_lin', text: '今天的咖啡真好喝。', emotion: 'gentle' },
    emotion_tag: '温馨',
    music_mood: '舒缓',
    duration_target: 6,
    transition_in: 'fade',
    transition_out: 'cut',
    status: 'pending',
    version_history: [],
    image_status: 'completed',
    image_url: 'https://example.com/img1.png',
    image_seed: 12345,
    image_prompt: 'A girl sitting by the window',
    image_negative_prompt: '',
    refinement_iterations: 0,
  },
  {
    node_id: 'ep1-n002',
    scene_id: 'scene-coffee-shop',
    scene_variant: '下午-晴天',
    characters: [{ char_id: 'char_wang', costume_variant: '正装' }],
    shot_type: 'close-up',
    camera_move: 'pan-left',
    visual_desc: '王大明推门进入咖啡厅',
    dialogue: null,
    emotion_tag: '好奇',
    music_mood: '舒缓',
    duration_target: 5,
    transition_in: 'cut',
    transition_out: 'cut',
    status: 'pending',
    version_history: [],
    image_status: 'pending',
  },
  {
    node_id: 'ep1-n003',
    scene_id: 'scene-park',
    scene_variant: '傍晚-多云',
    characters: [
      { char_id: 'char_lin', costume_variant: '休闲装' },
      { char_id: 'char_wang', costume_variant: '休闲装' },
    ],
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
    version_history: [{ version_id: 'v1', version_number: 1, created_at: '2026-06-18T00:00:00Z', source: 'ai_generated' }],
    image_status: 'completed',
    image_url: 'https://example.com/img3.png',
    image_seed: 78901,
    image_prompt: 'Two people walking by the lake',
    image_negative_prompt: '',
    refinement_iterations: 1,
    image_review: { approved: true, reviewed_at: '2026-06-19T00:00:00Z' },
  },
  {
    node_id: 'ep1-n004',
    scene_id: 'scene-park',
    scene_variant: '傍晚-多云',
    characters: [{ char_id: 'char_lin', costume_variant: '休闲装' }],
    shot_type: 'aerial',
    camera_move: 'dolly',
    visual_desc: '俯瞰湖面全景',
    dialogue: null,
    emotion_tag: '平静',
    music_mood: '壮阔',
    duration_target: 8,
    transition_in: 'cut',
    transition_out: 'cut',
    status: 'pending',
    version_history: [],
    image_status: 'needs_redo',
    image_url: 'https://example.com/img4.png',
    image_seed: 11111,
  },
];

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

  const route = `/projects/${projectId}/episodes/${episodeNumber}/storyboard/review`;

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route
            path="/projects/:projectId/episodes/:episodeNumber/storyboard/review"
            element={<StoryboardReviewPage />}
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

/** Wait for data to finish loading before making assertions */
async function waitForData() {
  await waitFor(() => {
    expect(screen.queryByText('加载分镜节点...')).not.toBeInTheDocument();
  }, { timeout: 3000 });
}

// ── Tests ──

describe('StoryboardReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty state', () => {
    it('should show empty state when no nodes exist', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: [] });

      renderPage();
      await waitForData();

      expect(screen.getByText('还没有分镜节点')).toBeInTheDocument();
    });

    it('should show link to storyboard editor', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: [] });

      renderPage();
      await waitForData();

      expect(screen.getByText('前往分镜编辑器')).toBeInTheDocument();
    });
  });

  describe('Nodes loaded', () => {
    it('should display header with approval count', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText('星辰大海 · 第 1 集 · 分镜图审核')).toBeInTheDocument();
      // 1 approved out of 4
      expect(screen.getByText('1/4 已通过')).toBeInTheDocument();
    });

    it('should show all node cards', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText('ep1-n001')).toBeInTheDocument();
      expect(screen.getByText('ep1-n002')).toBeInTheDocument();
      expect(screen.getByText('ep1-n003')).toBeInTheDocument();
      expect(screen.getByText('ep1-n004')).toBeInTheDocument();
    });

    it('should show image status badges', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getAllByText('已完成').length).toBeGreaterThanOrEqual(2);
      // "待生成" appears both in placeholder and status badge
      expect(screen.getAllByText('待生成').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('需重做')).toBeInTheDocument();
    });

    it('should show approved badge for reviewed node', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      // "已通过" appears as both a tag-green badge on the card and in the hover overlay
      expect(screen.getAllByText('已通过').length).toBeGreaterThanOrEqual(1);
    });

    it('should show Generate All button', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByRole('button', { name: /全部生成/i })).toBeInTheDocument();
    });

    it('should show back link to storyboard editor', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText('返回分镜编辑器')).toBeInTheDocument();
    });

    it('should show view mode toggle (grid/timeline)', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText('网格')).toBeInTheDocument();
      expect(screen.getByText('时间轴')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner while fetching', async () => {
      vi.mocked(getProject).mockReturnValue(new Promise(() => {}));
      vi.mocked(listStoryboardNodesWithImages).mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getByText('加载分镜节点...')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error message when fetch fails', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockRejectedValue(new Error('Internal Server Error'));

      renderPage();
      await waitForData();

      expect(screen.getByText('加载失败')).toBeInTheDocument();
      expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
    });
  });

  describe('Node selection', () => {
    it('should select node on click', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      const nodeCard = screen.getByText('ep1-n001').closest('.group');
      expect(nodeCard).toBeInTheDocument();

      await userEvent.click(nodeCard!);

      // The card should now have the selected styling
      expect(nodeCard?.className).toContain('border-primary');
    });

    it('should show batch actions when nodes selected', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      // Select a node that has a completed image (ep1-n001)
      const nodeCard = screen.getByText('ep1-n001').closest('.group');
      await userEvent.click(nodeCard!);

      expect(screen.getByText(/1 个选中/)).toBeInTheDocument();
    });
  });

  describe('Select all', () => {
    it('should select all nodes when clicking Select All', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      await userEvent.click(screen.getByText('全选'));

      expect(screen.getByText(/4 个选中/)).toBeInTheDocument();
    });
  });

  describe('Generate All', () => {
    it('should call batchGenerateImages when Generate All is clicked', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      const batchResult: BatchGenerateResultResponse = {
        data: {
          results: [],
          summary: { total: 4, completed: 3, needs_redo: 1, failed: 0, ip_adapter_injection_rate: 100, scene_seed_lock_rate: 100 },
        },
      };
      vi.mocked(batchGenerateImages).mockResolvedValue(batchResult);

      renderPage();
      await waitForData();

      await userEvent.click(screen.getByRole('button', { name: /全部生成/i }));

      expect(batchGenerateImages).toHaveBeenCalledWith('proj-1', 'ep-1');
    });

    it('should show batch generation summary after success', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      const batchResult: BatchGenerateResultResponse = {
        data: {
          results: [],
          summary: { total: 4, completed: 3, needs_redo: 1, failed: 0, ip_adapter_injection_rate: 100, scene_seed_lock_rate: 100 },
        },
      };
      vi.mocked(batchGenerateImages).mockResolvedValue(batchResult);

      renderPage();
      await waitForData();

      await userEvent.click(screen.getByRole('button', { name: /全部生成/i }));

      await waitFor(() => {
        expect(screen.getByText('批量生成完成')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument(); // completed
        expect(screen.getByText('1')).toBeInTheDocument(); // needs_redo
      });
    });

    it('should show error when batch generation fails', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });
      vi.mocked(batchGenerateImages).mockRejectedValue(new Error('Service unavailable'));

      renderPage();
      await waitForData();

      await userEvent.click(screen.getByRole('button', { name: /全部生成/i }));

      await waitFor(() => {
        expect(screen.getByText('批量生成失败')).toBeInTheDocument();
        expect(screen.getByText('Service unavailable')).toBeInTheDocument();
      });
    });
  });

  describe('Review (approve)', () => {
    it('should call reviewNodeImage with approved=true', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      const reviewResult: StoryboardNodeWithImageResponse = {
        data: { ...mockNodes[0], image_review: { approved: true, reviewed_at: '2026-06-19T00:00:00Z' } },
      };
      vi.mocked(reviewNodeImage).mockResolvedValue(reviewResult);

      renderPage();
      await waitForData();

      // Hover over ep1-n001 card to show actions
      const nodeCard = screen.getByText('ep1-n001').closest('.group');
      await userEvent.hover(nodeCard!);

      // Click approve button
      const approveBtn = screen.getByText('通过');
      await userEvent.click(approveBtn);

      expect(reviewNodeImage).toHaveBeenCalledWith('proj-1', 'ep-1', 'ep1-n001', { approved: true, comment: '' });
    });
  });

  describe('Video generation unlock', () => {
    it('should show Batch Generate Video button when all nodes approved', async () => {
      const allApprovedNodes: StoryboardNodeWithImage[] = mockNodes.map((n) => ({
        ...n,
        image_status: 'completed' as const,
        image_review: { approved: true, reviewed_at: '2026-06-19T00:00:00Z' },
      }));

      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: allApprovedNodes });

      renderPage();
      await waitForData();

      expect(screen.getByRole('button', { name: /批量生成视频/i })).toBeInTheDocument();
    });

    it('should not show Batch Generate Video when not all approved', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.queryByRole('button', { name: /批量生成视频/i })).not.toBeInTheDocument();
    });
  });

  describe('Timeline view', () => {
    it('should switch to timeline view', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      await userEvent.click(screen.getByText('时间轴'));

      // Timeline view should show node IDs in a row format
      expect(screen.getByText('ep1-n001')).toBeInTheDocument();
    });
  });

  describe('Modify dialog', () => {
    it('should open modify dialog when modify button is clicked', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      // Hover over ep1-n001 card
      const nodeCard = screen.getByText('ep1-n001').closest('.group');
      await userEvent.hover(nodeCard!);

      // Click modify button
      const modifyBtn = screen.getByText('修改');
      await userEvent.click(modifyBtn);

      expect(screen.getByText('修改后重新生成')).toBeInTheDocument();
      expect(screen.getByText('ep1-n001')).toBeInTheDocument();
    });
  });

  describe('Upload dialog', () => {
    it('should open upload dialog when upload button is clicked', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      // Hover over ep1-n001 card
      const nodeCard = screen.getByText('ep1-n001').closest('.group');
      await userEvent.hover(nodeCard!);

      // Click upload button
      const uploadBtn = screen.getByText('上传');
      await userEvent.click(uploadBtn);

      expect(screen.getByText('手动上传分镜图')).toBeInTheDocument();
    });
  });

  describe('Batch approve', () => {
    it('should show batch approve when multiple completed nodes selected', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithImages).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      // Select ep1-n001 (completed, not approved)
      const card1 = screen.getByText('ep1-n001').closest('.group');
      await userEvent.click(card1!);

      expect(screen.getByText('批量通过')).toBeInTheDocument();
    });
  });
});

describe('StoryboardReviewPage types and helpers', () => {
  it('should have correct image status labels', async () => {
    const { IMAGE_STATUS_LABELS } = await import('../src/types');
    expect(IMAGE_STATUS_LABELS['pending']).toBe('待生成');
    expect(IMAGE_STATUS_LABELS['generating']).toBe('生成中');
    expect(IMAGE_STATUS_LABELS['completed']).toBe('已完成');
    expect(IMAGE_STATUS_LABELS['needs_redo']).toBe('需重做');
  });

  it('should have correct image status colors', async () => {
    const { IMAGE_STATUS_COLORS } = await import('../src/types');
    expect(IMAGE_STATUS_COLORS['pending']).toContain('bg-surface');
    expect(IMAGE_STATUS_COLORS['completed']).toContain('bg-card-tint-mint');
    expect(IMAGE_STATUS_COLORS['generating']).toContain('bg-card-tint-sky');
    expect(IMAGE_STATUS_COLORS['needs_redo']).toContain('bg-card-tint-peach');
  });

  it('StoryboardNodeWithImage should extend StoryboardNode with image fields', async () => {
    const node: StoryboardNodeWithImage = {
      node_id: 'ep1-n001',
      scene_id: 'scene-1',
      scene_variant: 'day',
      characters: [],
      shot_type: 'medium-shot',
      camera_move: 'static',
      visual_desc: 'test',
      dialogue: null,
      emotion_tag: 'calm',
      music_mood: 'soft',
      duration_target: 5,
      transition_in: 'cut',
      transition_out: 'cut',
      status: 'pending',
      version_history: [],
      image_status: 'pending',
    };
    expect(node.image_status).toBe('pending');
    expect(node.image_url).toBeUndefined();
  });
});
