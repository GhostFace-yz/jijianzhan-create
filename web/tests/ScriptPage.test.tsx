import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ScriptPage } from '../src/pages/ScriptPage';
import {
  type EpisodeScript,
  type OutlineSummaryResponse,
  type ProjectResponse,
} from '../src/types';

// ── Mock data ──

const mockScript: EpisodeScript = {
  episode_title: '命运的相遇',
  scenes: [
    {
      scene_id: 'scene-01',
      location_id: 'loc-1',
      time_of_day: '下午',
      weather: '晴天',
      characters_present: ['char_lin', 'char_wang'],
      scene_summary: '林小夏在咖啡厅第一次遇见王大明',
      beats: ['林小夏走进咖啡厅', '王大明不小心撞到她'],
      dialogues: [
        {
          char_id: 'char_lin',
          text: '对不起，你没事吧？',
          emotion: 'surprised',
          note: null,
        },
        {
          char_id: 'char_wang',
          text: '没事没事，是我太冒失了。',
          emotion: 'shy',
          note: '尴尬地笑',
        },
      ],
    },
    {
      scene_id: 'scene-02',
      location_id: 'loc-2',
      time_of_day: '傍晚',
      weather: '多云',
      characters_present: ['char_lin', 'char_wang'],
      scene_summary: '两人在公园散步，气氛温馨',
      beats: ['两人沿湖边散步', '交换联系方式'],
      dialogues: [
        {
          char_id: 'char_lin',
          text: '今天的夕阳真美。',
          emotion: 'gentle',
          note: null,
        },
        {
          char_id: 'char_wang',
          text: '是啊，和你一起看的夕阳更美。',
          emotion: 'gentle',
          note: null,
        },
      ],
    },
  ],
  end_state: {
    characters: [
      { char_id: 'char_lin', emotion: 'happy', position: '公园' },
      { char_id: 'char_wang', emotion: 'excited', position: '公园' },
    ],
    unresolved_conflicts: ['王大明的秘密身份尚未揭晓'],
    key_prop_states: { '咖啡杯': '已归还', '联系方式纸条': '林小夏持有' },
  },
};

const mockProject: ProjectResponse = {
  data: {
    id: 'proj-1',
    user_id: 'user-1',
    team_id: null,
    status: 'producing',
    meta: {
      title: '测试短剧',
      description: '一个测试项目',
      genre: 'urban_romance',
      target_episodes: 3,
      duration_goal: '5min',
      style_tags: ['fresh'],
      notes: null,
    },
    created_at: '2026-06-19T00:00:00Z',
    updated_at: '2026-06-19T00:00:00Z',
  },
};

const mockOutline: OutlineSummaryResponse = {
  data: {
    outline: {
      world_setting: '现代都市',
      main_conflict: '爱情与事业的抉择',
      characters: [
        { name: 'char_lin', description: '女主角' },
        { name: 'char_wang', description: '男主角' },
      ],
      locations: [
        { name: 'loc-1', description: '咖啡厅' },
        { name: 'loc-2', description: '公园' },
      ],
      episode_count: 3,
      episodes: [
        {
          episode_number: 1,
          title: '命运的相遇',
          summary: '第一集摘要',
          key_events: ['第一次相遇'],
          featured_characters: ['char_lin', 'char_wang'],
          featured_locations: ['loc-1', 'loc-2'],
        },
      ],
    },
    outline_locked: true,
    project_status: 'producing',
  },
};

// ── Test helpers ──

function renderScriptPage(initialRoute = '/projects/proj-1/episodes/1/script') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/projects/:projectId/episodes/:episodeNumber/script" element={<ScriptPage />} />
            <Route path="/projects/:projectId/episodes/:episodeNumber/storyboard" element={<div>分镜页面占位</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

// Mock fetch to return all needed data
function mockFetchForScriptPage() {
  vi.mocked(fetch).mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes('/projects/proj-1') && !url.includes('outline') && !url.includes('script')) {
      return Promise.resolve(new Response(JSON.stringify(mockProject), { status: 200 }));
    }
    if (url.includes('/outline')) {
      return Promise.resolve(new Response(JSON.stringify(mockOutline), { status: 200 }));
    }
    if (url.includes('/script/generate')) {
      return Promise.resolve(new Response(JSON.stringify({ data: mockScript }), { status: 201 }));
    }
    if (url.includes('/script') && !url.includes('generate') && !url.includes('regenerate')) {
      return Promise.resolve(new Response(JSON.stringify({ data: mockScript }), { status: 200 }));
    }
    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  });
}

// ── Tests ──

describe('ScriptPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // Mock scrollIntoView since jsdom doesn't support it
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Empty state', () => {
    it('shows empty state when no script exists', async () => {
      vi.mocked(fetch).mockImplementation((input) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/projects/proj-1') && !url.includes('outline') && !url.includes('script')) {
          return Promise.resolve(new Response(JSON.stringify(mockProject), { status: 200 }));
        }
        if (url.includes('/outline')) {
          return Promise.resolve(new Response(JSON.stringify(mockOutline), { status: 200 }));
        }
        // Script returns 404 — page treats as "not generated yet" (empty state, not error)
        if (url.includes('/script')) {
          return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 }));
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      renderScriptPage();

      const emptyHeading = await screen.findByText('还没有脚本', {}, { timeout: 5000 });
      expect(emptyHeading).toBeDefined();

      const generateButtons = screen.getAllByRole('button', { name: /生成脚本/ });
      expect(generateButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('has a generate button in empty state', async () => {
      vi.mocked(fetch).mockImplementation((input) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/projects/proj-1') && !url.includes('outline') && !url.includes('script')) {
          return Promise.resolve(new Response(JSON.stringify(mockProject), { status: 200 }));
        }
        if (url.includes('/outline')) {
          return Promise.resolve(new Response(JSON.stringify(mockOutline), { status: 200 }));
        }
        if (url.includes('/script')) {
          return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 }));
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      renderScriptPage();

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /生成脚本/ });
        expect(btn).toBeDefined();
        expect(btn).not.toBeDisabled();
      });
    });

    it('generates script on button click', async () => {
      let generated = false;
      vi.mocked(fetch).mockImplementation((input) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/projects/proj-1') && !url.includes('outline') && !url.includes('script')) {
          return Promise.resolve(new Response(JSON.stringify(mockProject), { status: 200 }));
        }
        if (url.includes('/outline')) {
          return Promise.resolve(new Response(JSON.stringify(mockOutline), { status: 200 }));
        }
        if (url.includes('/script/generate')) {
          generated = true;
          return Promise.resolve(new Response(JSON.stringify({ data: mockScript }), { status: 201 }));
        }
        if (url.includes('/script') && !url.includes('generate')) {
          if (generated) {
            return Promise.resolve(new Response(JSON.stringify({ data: mockScript }), { status: 200 }));
          }
          return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 }));
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      renderScriptPage();

      // Wait for empty state heading
      await screen.findByText('还没有脚本', {}, { timeout: 5000 });

      // Click the first generate button (empty state area)
      const generateButtons = screen.getAllByRole('button', { name: /生成脚本/ });
      await userEvent.click(generateButtons[0]);

      await waitFor(() => {
        expect(vi.mocked(fetch)).toHaveBeenCalledWith(
          '/api/v1/projects/proj-1/episodes/1/script/generate',
          expect.objectContaining({ method: 'POST' }),
        );
      }, { timeout: 5000 });
    });
  });

  describe('Script display', () => {
    it('renders scene cards when script is loaded', async () => {
      mockFetchForScriptPage();
      renderScriptPage();

      await waitFor(() => {
        expect(screen.getByText('场景 1 · loc-1')).toBeDefined();
        expect(screen.getByText('场景 2 · loc-2')).toBeDefined();
      });
    });

    it('displays dialogues with character names and emotions', async () => {
      mockFetchForScriptPage();
      renderScriptPage();

      await waitFor(() => {
        expect(screen.getByText('对不起，你没事吧？')).toBeDefined();
        expect(screen.getByText('没事没事，是我太冒失了。')).toBeDefined();
      });
    });

    it('shows estimated duration at bottom', async () => {
      mockFetchForScriptPage();
      renderScriptPage();

      await waitFor(() => {
        expect(screen.getByText(/估算时长/)).toBeDefined();
        expect(screen.getByText(/2 场景/)).toBeDefined();
      });
    });

    it('displays end state information', async () => {
      mockFetchForScriptPage();
      renderScriptPage();

      await waitFor(() => {
        expect(screen.getByText('本集结尾状态')).toBeDefined();
        expect(screen.getByText('王大明的秘密身份尚未揭晓')).toBeDefined();
        expect(screen.getByText('咖啡杯')).toBeDefined();
      });
    });

    it('shows confirm and enter storyboard button', async () => {
      mockFetchForScriptPage();
      renderScriptPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /确认脚本，进入分镜/ })).toBeDefined();
      });
    });

    it('shows version history button', async () => {
      mockFetchForScriptPage();
      renderScriptPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /版本历史/ })).toBeDefined();
      });
    });
  });

  describe('Editing', () => {
    it('marks dirty when scene summary is edited', async () => {
      mockFetchForScriptPage();
      renderScriptPage();

      await waitFor(() => {
        expect(screen.getByText('林小夏在咖啡厅第一次遇见王大明')).toBeDefined();
      });

      // Click to edit the scene summary
      const summary = screen.getByText('林小夏在咖啡厅第一次遇见王大明');
      await userEvent.click(summary);

      // Type new value
      const input = screen.getByDisplayValue('林小夏在咖啡厅第一次遇见王大明');
      await userEvent.clear(input);
      await userEvent.type(input, '修改后的场景摘要');
      await userEvent.tab(); // blur to save

      await waitFor(() => {
        expect(screen.getByText('修改后的场景摘要')).toBeDefined();
        expect(screen.getByText('有未保存的修改，请点击「保存草稿」')).toBeDefined();
      });
    });
  });

  describe('Change impact', () => {
    it('shows change impact banner when editing', async () => {
      mockFetchForScriptPage();
      renderScriptPage();

      await waitFor(() => {
        expect(screen.getByText('林小夏在咖啡厅第一次遇见王大明')).toBeDefined();
      });

      // Click a dialogue to edit
      const dialogue = screen.getByText('对不起，你没事吧？');
      await userEvent.click(dialogue);

      // Change the text
      const textArea = screen.getByDisplayValue('对不起，你没事吧？');
      await userEvent.clear(textArea);
      await userEvent.type(textArea, '你好！');
      // Click 完成
      await userEvent.click(screen.getByText('完成'));

      await waitFor(() => {
        expect(screen.getByText(/台词修改/)).toBeDefined();
      });
    });
  });
});

describe('ScriptPage components', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders save button when script exists', async () => {
    mockFetchForScriptPage();
    renderScriptPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /保存草稿/ })).toBeDefined();
    });
  });

  it('navigates to storyboard on confirm click', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/projects/proj-1') && !url.includes('outline') && !url.includes('script')) {
        return Promise.resolve(new Response(JSON.stringify(mockProject), { status: 200 }));
      }
      if (url.includes('/outline')) {
        return Promise.resolve(new Response(JSON.stringify(mockOutline), { status: 200 }));
      }
      // Script PUT (save)
      if (url.includes('/script') && !url.includes('generate') && !url.includes('regenerate')) {
        return Promise.resolve(new Response(JSON.stringify({ data: mockScript }), { status: 200 }));
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    renderScriptPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /确认脚本，进入分镜/ })).toBeDefined();
    });

    const confirmBtn = screen.getByRole('button', { name: /确认脚本，进入分镜/ });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('分镜页面占位')).toBeDefined();
    });
  });
});
