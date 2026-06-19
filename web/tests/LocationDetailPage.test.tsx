import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { LocationDetailPage } from '../src/pages/locations/LocationDetailPage';

const mockLocation = {
  id: 'loc-1',
  project_id: 'proj-1',
  name: '主角公寓客厅',
  description: '简约现代风格客厅',
  frequency: '高频',
  space_type: '室内',
  style: '现代简约',
  color_tone: '暖灰',
  lighting_type: '自然光',
  key_props: ['沙发', '茶几', '落地灯'],
  status: 'draft' as const,
  base_seed: null,
  base_image_url: null,
  variants: {},
  created_at: '2026-06-18T00:00:00Z',
  updated_at: '2026-06-18T00:00:00Z',
};

const mockProject = {
  id: 'proj-1',
  user_id: 'u-1',
  team_id: null,
  status: 'draft' as const,
  meta: {
    title: '测试短剧',
    description: '测试',
    genre: 'urban_romance' as const,
    target_episodes: null,
    duration_goal: null,
    style_tags: [],
    notes: null,
  },
  created_at: '2026-06-18T00:00:00Z',
  updated_at: '2026-06-18T00:00:00Z',
};

const mockVersions = {
  data: {
    total: 1,
    versions: [
      {
        id: 'v1',
        versionId: 'v1',
        versionNumber: 1,
        source: 'ai_generated' as const,
        editedBy: null,
        aiModel: null,
        promptOverride: null,
        parentVersionNumber: null,
        createdAt: '2026-06-18T00:00:00Z',
      },
    ],
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/proj-1/locations/loc-1']}>
        <Routes>
          <Route
            path="/projects/:projectId/locations/:locationId"
            element={<LocationDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LocationDetailPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('displays location details after loading', async () => {
    vi.mocked(fetch).mockImplementation((url: string) => {
      if (String(url).includes('/api/v1/projects/proj-1/locations/loc-1/versions')) {
        return Promise.resolve(new Response(JSON.stringify(mockVersions), { status: 200 }));
      }
      if (String(url).includes('/api/v1/projects/proj-1/locations')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: { total: 1, locations: [mockLocation] } }),
            { status: 200 }
          )
        );
      }
      if (String(url).includes('/api/v1/projects/proj-1')) {
        return Promise.resolve(new Response(JSON.stringify({ data: mockProject }), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('主角公寓客厅')).toBeInTheDocument();
    });

    expect(screen.getByText('基础信息')).toBeInTheDocument();
    expect(screen.getByText('基准图')).toBeInTheDocument();
    expect(screen.getByText('场景变体')).toBeInTheDocument();
    expect(screen.getByText('Prompt 分层编辑器')).toBeInTheDocument();
    expect(screen.getByText('版本历史')).toBeInTheDocument();
    expect(screen.getByText(/测试短剧/)).toBeInTheDocument();
  });

  it('shows back link to location list', async () => {
    vi.mocked(fetch).mockImplementation((url: string) => {
      if (String(url).includes('/api/v1/projects/proj-1/locations/loc-1/versions')) {
        return Promise.resolve(new Response(JSON.stringify(mockVersions), { status: 200 }));
      }
      if (String(url).includes('/api/v1/projects/proj-1/locations')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: { total: 1, locations: [mockLocation] } }),
            { status: 200 }
          )
        );
      }
      if (String(url).includes('/api/v1/projects/proj-1')) {
        return Promise.resolve(new Response(JSON.stringify({ data: mockProject }), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('主角公寓客厅')).toBeInTheDocument();
    });

    const backLink = screen.getByText('返回场景列表');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/projects/proj-1/locations');
  });

  it('shows error state on fetch failure', async () => {
    vi.mocked(fetch).mockImplementation((url: string) => {
      if (String(url).includes('/api/v1/projects/proj-1')) {
        return Promise.resolve(new Response(JSON.stringify({ data: mockProject }), { status: 200 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: { message: 'Location not found' } }), { status: 404 })
      );
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/加载场景失败/)).toBeInTheDocument();
    });
  });
});
