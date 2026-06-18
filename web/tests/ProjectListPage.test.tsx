import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ProjectListPage } from '../src/pages/ProjectListPage';
import { TestProviders } from './helpers/providers';

const mockProjects = [
  {
    id: 'proj-1',
    user_id: 'system',
    team_id: null,
    status: 'draft',
    meta: {
      title: '都市奇缘',
      description: '都市爱情故事',
      genre: 'urban_romance',
      target_episodes: 12,
      duration_goal: '5min',
      style_tags: ['realistic'],
      notes: null,
    },
    created_at: '2026-06-18T00:00:00Z',
    updated_at: '2026-06-18T00:00:00Z',
  },
  {
    id: 'proj-2',
    user_id: 'system',
    team_id: null,
    status: 'outlining',
    meta: {
      title: '古装风云',
      description: '古装权谋',
      genre: 'ancient_costume',
      target_episodes: 24,
      duration_goal: '10min',
      style_tags: ['chinese_style'],
      notes: null,
    },
    created_at: '2026-06-18T00:00:00Z',
    updated_at: '2026-06-18T00:00:00Z',
  },
];

describe('ProjectListPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { total: 2, projects: mockProjects } }), {
          status: 200,
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderPage() {
    render(
      <MemoryRouter>
        <TestProviders>
          <ProjectListPage />
        </TestProviders>
      </MemoryRouter>
    );
  }

  it('renders project list with cards', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('都市奇缘')).toBeInTheDocument();
    });

    expect(screen.getByText('古装风云')).toBeInTheDocument();
    expect(screen.getByText('共 2 个项目')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByText('都市奇缘'));

    await user.click(screen.getByRole('button', { name: /大纲中/ }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=outlining'),
        expect.any(Object)
      );
    });
  });

  it('searches by title', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByText('都市奇缘'));

    const searchInput = screen.getByLabelText('搜索项目');
    await user.type(searchInput, '都市');

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=%E9%83%BD%E5%B8%82'),
        expect.any(Object)
      );
    });
  });

  it('shows empty state when no projects', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { total: 0, projects: [] } }), { status: 200 })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('还没有项目')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('link', { name: /新建项目/ }).length).toBeGreaterThanOrEqual(1);
  });
});
