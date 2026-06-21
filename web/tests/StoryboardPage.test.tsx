import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type {
  StoryboardNode,
  ProjectResponse,
} from '../src/types';

// ── Mock API modules ──

vi.mock('../src/api/projects', () => ({
  getProject: vi.fn(),
}));

vi.mock('../src/api/storyboard', () => ({
  listStoryboardNodes: vi.fn(),
  splitStoryboardNodes: vi.fn(),
  updateStoryboardNodes: vi.fn(),
  splitStoryboardNode: vi.fn(),
}));

import { getProject } from '../src/api/projects';
import {
  listStoryboardNodes,
  splitStoryboardNodes,
  updateStoryboardNodes,
  splitStoryboardNode,
} from '../src/api/storyboard';
import { StoryboardPage } from '../src/pages/StoryboardPage';

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

const mockNodes: StoryboardNode[] = [
  {
    node_id: 'ep1-n001',
    scene_id: 'scene-coffee-shop',
    scene_variant: '下午-晴天',
    characters: [
      { char_id: 'char_lin', costume_variant: '休闲装' },
      { char_id: 'char_wang', costume_variant: '正装' },
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

  const route = `/projects/${projectId}/episodes/${episodeNumber}/storyboard`;

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route
            path="/projects/:projectId/episodes/:episodeNumber/storyboard"
            element={<StoryboardPage />}
          />
          <Route path="/projects/:projectId/episodes/:episodeNumber/script" element={<div>Script Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Wait for data to finish loading before making assertions */
async function waitForData() {
  await waitFor(() => {
    expect(screen.queryByTestId('storyboard-skeleton')).not.toBeInTheDocument();
  }, { timeout: 3000 });
}

// ── Tests ──

describe('StoryboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  describe('Empty state', () => {
    it('should show empty state when no nodes exist (404)', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockRejectedValue(new Error('Not found'));

      renderPage();
      await waitForData();

      expect(screen.getByText('还没有分镜节点')).toBeInTheDocument();
      // Button appears both in header and empty state when no nodes
      const buttons = screen.getAllByRole('button', { name: /AI 自动拆分分镜/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it('should show empty state when nodes array is empty', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: [] });

      renderPage();
      await waitForData();

      expect(screen.getByText('还没有分镜节点')).toBeInTheDocument();
    });
  });

  describe('Nodes loaded', () => {
    it('should display header with node count and duration', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText(/3 节点/)).toBeInTheDocument();
      expect(screen.getByText(/18s 总时长/)).toBeInTheDocument();
    });

    it('should show Save button when nodes are loaded', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByRole('button', { name: /保存修改/i })).toBeInTheDocument();
    });

    it('should show back link to script page', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText('返回脚本')).toBeInTheDocument();
    });
  });

  describe('Generate mutation', () => {
    it('should call split API when generate button is clicked in empty state', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockRejectedValue(new Error('Not found'));

      renderPage();
      await waitForData();

      const generateBtn = screen.getAllByRole('button', { name: /AI 自动拆分分镜/i })[0];
      vi.mocked(splitStoryboardNodes).mockResolvedValue({
        data: { nodes: mockNodes, total_duration: 18, node_count: 3 },
      });

      await userEvent.click(generateBtn);

      expect(splitStoryboardNodes).toHaveBeenCalledWith('proj-1', 'ep-1');
    });
  });

  describe('Save mutation', () => {
    it('should show save button disabled when no changes', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      const saveBtn = screen.getByRole('button', { name: /保存修改/i });
      expect(saveBtn).toBeDisabled();
    });
  });

  describe('Loading state', () => {
    it('should show skeleton placeholders while fetching', async () => {
      vi.mocked(getProject).mockReturnValue(new Promise(() => {}));
      vi.mocked(listStoryboardNodes).mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getByTestId('storyboard-skeleton')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error message when fetch fails with non-404 error', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodes).mockRejectedValue(new Error('Internal Server Error'));

      renderPage();
      await waitForData();

      expect(screen.getByText(/加载失败/)).toBeInTheDocument();
      expect(screen.getByText(/Internal Server Error/)).toBeInTheDocument();
    });
  });
});

describe('StoryboardEditor (unit)', () => {
  it('should render lane labels for each scene', async () => {
    const { StoryboardEditor } = await import('../src/components/script/StoryboardEditor');

    const mockFns = {
      onNodesChange: vi.fn(),
      onInsertNode: vi.fn(),
      onDeleteNode: vi.fn(),
      onSplitNode: vi.fn(),
      onVersionHistory: vi.fn(),
    };

    const { container } = render(
      <div style={{ width: 1200, height: 800 }}>
        <StoryboardEditor nodes={mockNodes} projectId="proj-1" episodeNumber={1} {...mockFns} />
      </div>,
    );

    await waitFor(() => {
      expect(container.textContent).toContain('scene-coffee-shop');
      expect(container.textContent).toContain('scene-park');
    });
  });

  it('should render node cards with node IDs', async () => {
    const { StoryboardEditor } = await import('../src/components/script/StoryboardEditor');

    const mockFns = {
      onNodesChange: vi.fn(),
      onInsertNode: vi.fn(),
      onDeleteNode: vi.fn(),
      onSplitNode: vi.fn(),
      onVersionHistory: vi.fn(),
    };

    const { container } = render(
      <div style={{ width: 1200, height: 800 }}>
        <StoryboardEditor nodes={mockNodes} projectId="proj-1" episodeNumber={1} {...mockFns} />
      </div>,
    );

    await waitFor(() => {
      expect(container.textContent).toContain('ep1-n001');
      expect(container.textContent).toContain('ep1-n002');
      expect(container.textContent).toContain('ep1-n003');
    });
  });

  it('should show React Flow container', async () => {
    const { StoryboardEditor } = await import('../src/components/script/StoryboardEditor');

    const mockFns = {
      onNodesChange: vi.fn(),
      onInsertNode: vi.fn(),
      onDeleteNode: vi.fn(),
      onSplitNode: vi.fn(),
      onVersionHistory: vi.fn(),
    };

    render(
      <div style={{ width: 1200, height: 800 }}>
        <StoryboardEditor nodes={mockNodes} projectId="proj-1" episodeNumber={1} {...mockFns} />
      </div>,
    );

    await waitFor(() => {
      expect(document.querySelector('.react-flow')).toBeInTheDocument();
    });
  });
});

describe('StoryboardNode types and helpers', () => {
  it('should have correct shot type labels', async () => {
    const { SHOT_TYPE_LABELS } = await import('../src/types');
    expect(SHOT_TYPE_LABELS['close-up']).toBe('特写');
    expect(SHOT_TYPE_LABELS['wide-shot']).toBe('全景');
  });

  it('should have correct node status labels', async () => {
    const { NODE_STATUS_LABELS } = await import('../src/types');
    expect(NODE_STATUS_LABELS['pending']).toBe('待处理');
    expect(NODE_STATUS_LABELS['completed']).toBe('已完成');
  });

  it('getFieldImpact should return correct impact levels', async () => {
    const { getFieldImpact } = await import('../src/types');
    expect(getFieldImpact('dialogue')).toBe('light');
    expect(getFieldImpact('shot_type')).toBe('medium');
    expect(getFieldImpact('characters')).toBe('deep');
  });
});
