import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ProjectDetailPage } from '../src/pages/ProjectDetailPage';
import { TestProviders } from './helpers/providers';

const mockProject = {
  id: 'proj-detail-1',
  user_id: 'system',
  team_id: null,
  status: 'draft',
  meta: {
    title: '测试项目详情',
    description: '这是一个测试项目的描述',
    genre: 'suspense',
    target_episodes: 5,
    duration_goal: '3min',
    style_tags: ['dark', 'realistic'],
    notes: '测试备注',
  },
  created_at: '2026-06-18T00:00:00Z',
  updated_at: '2026-06-19T00:00:00Z',
};

const mockOutline = {
  outline: {
    world_setting: '现代都市',
    main_conflict: '主角追查真相',
    characters: [{ name: '主角', role_type: 'protagonist', description: '聪明果断' }],
    locations: [{ name: '警察局', description: '主要场景' }],
    episode_count: 2,
    episodes: [
      {
        episode_number: 1,
        title: '第一集',
        summary: '故事开始',
        key_events: ['事件发生', '主角出场'],
        featured_characters: ['主角'],
        featured_locations: ['警察局'],
      },
      {
        episode_number: 2,
        title: '第二集',
        summary: '调查深入',
        key_events: ['发现线索'],
        featured_characters: ['主角'],
        featured_locations: ['警察局'],
      },
    ],
  },
  outline_locked: false,
  project_status: 'draft',
};

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/projects/proj-detail-1/outline')) {
          return Promise.resolve(
            new Response(JSON.stringify({ data: mockOutline }), { status: 200 })
          );
        }
        if (url.includes('/api/v1/projects/proj-detail-1')) {
          return Promise.resolve(
            new Response(JSON.stringify({ data: mockProject }), { status: 200 })
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 }));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderPage() {
    render(
      <MemoryRouter initialEntries={['/projects/proj-detail-1']}>
        <TestProviders>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </TestProviders>
      </MemoryRouter>
    );
  }

  it('renders project metadata and status workflow', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('测试项目详情')).toBeInTheDocument();
    });

    expect(screen.getByText('这是一个测试项目的描述')).toBeInTheDocument();
    expect(screen.getByText('悬疑')).toBeInTheDocument();
    expect(screen.getByText('5 集')).toBeInTheDocument();
    expect(screen.getByText('3 分钟')).toBeInTheDocument();
    expect(screen.getByText('暗黑系')).toBeInTheDocument();
    expect(screen.getByText('写实')).toBeInTheDocument();
    expect(screen.getByText('测试备注')).toBeInTheDocument();

    // Status badge
    expect(screen.getByText('草稿', { selector: '[class*="bg-primary"]' })).toBeInTheDocument();

    // Status workflow labels
    expect(screen.getByText('大纲')).toBeInTheDocument();
    expect(screen.getByText('资产准备')).toBeInTheDocument();
    expect(screen.getByText('制作中')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
  });

  it('renders module cards', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('测试项目详情')).toBeInTheDocument();
    });

    expect(screen.getByText('故事大纲')).toBeInTheDocument();
    expect(screen.getByText('角色圣经')).toBeInTheDocument();
    expect(screen.getByText('场景圣经')).toBeInTheDocument();
    expect(screen.getByText('分集制作')).toBeInTheDocument();
  });

  it('renders episodes preview when outline exists', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('测试项目详情')).toBeInTheDocument();
    });

    expect(screen.getByText('分集概览')).toBeInTheDocument();
    expect(screen.getByText('第一集')).toBeInTheDocument();
    expect(screen.getByText('第二集')).toBeInTheDocument();
    expect(screen.getByText('进入第一集 →')).toBeInTheDocument();
  });

  it('primary action links to outline for draft status', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('测试项目详情')).toBeInTheDocument();
    });

    const actionLink = screen.getByRole('link', { name: /生成大纲/ });
    expect(actionLink).toHaveAttribute('href', '/projects/proj-detail-1/outline');
  });
});
