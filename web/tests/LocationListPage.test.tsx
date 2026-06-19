import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { LocationListPage } from '../src/pages/locations/LocationListPage';

const mockLocations = [
  {
    id: 'loc-1',
    project_id: 'proj-1',
    name: '主角公寓客厅',
    description: '简约现代风格',
    frequency: '高频',
    space_type: '室内',
    style: '现代简约',
    color_tone: '暖灰',
    lighting_type: '自然光',
    key_props: ['沙发'],
    status: 'draft' as const,
    base_seed: null,
    base_image_url: null,
    variants: {},
    created_at: '2026-06-18T00:00:00Z',
    updated_at: '2026-06-18T00:00:00Z',
  },
  {
    id: 'loc-2',
    project_id: 'proj-1',
    name: '公司办公室',
    description: '现代办公空间',
    frequency: '中频',
    space_type: '室内',
    style: '工业风',
    color_tone: '冷灰',
    lighting_type: '荧光灯',
    key_props: ['办公桌'],
    status: 'confirmed' as const,
    base_seed: 42,
    base_image_url: 'http://example.com/office.png',
    variants: { 'day-sunny': { image_url: 'http://example.com/v.png', prompt: 'p', seed: 5 } },
    created_at: '2026-06-18T00:00:00Z',
    updated_at: '2026-06-18T00:00:00Z',
  },
];

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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/proj-1/locations']}>
        <Routes>
          <Route path="/projects/:projectId/locations" element={<LocationListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LocationListPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('displays locations after loading', async () => {
    let callCount = 0;
    vi.mocked(fetch).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: mockProject }), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ data: { total: 2, locations: mockLocations } }),
          { status: 200 }
        )
      );
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('主角公寓客厅')).toBeInTheDocument();
    });

    expect(screen.getByText('公司办公室')).toBeInTheDocument();
    expect(screen.getByText('共 2 个场景')).toBeInTheDocument();
  });

  it('shows empty state when no locations', async () => {
    let callCount = 0;
    vi.mocked(fetch).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: mockProject }), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ data: { total: 0, locations: [] } }),
          { status: 200 }
        )
      );
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('还没有场景')).toBeInTheDocument();
    });
  });

  it('filters locations by status', async () => {
    let callCount = 0;
    vi.mocked(fetch).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: mockProject }), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ data: { total: 2, locations: mockLocations } }),
          { status: 200 }
        )
      );
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('主角公寓客厅')).toBeInTheDocument();
    });

    const confirmedButton = screen.getByRole('button', { name: '已确认' });
    await userEvent.click(confirmedButton);

    await waitFor(() => {
      expect(screen.queryByText('主角公寓客厅')).not.toBeInTheDocument();
      expect(screen.getByText('公司办公室')).toBeInTheDocument();
    });
  });
});
