import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CharacterListPage } from '../src/pages/characters/CharacterListPage';
import type { Character, Project } from '../src/types';

const mockProject: Project = {
  id: 'proj-1',
  user_id: 'user-1',
  team_id: null,
  status: 'draft',
  meta: {
    title: '测试项目',
    description: '测试项目描述',
    genre: 'urban_romance',
    target_episodes: 12,
    duration_goal: '5min',
    style_tags: ['realistic'],
    notes: null,
  },
  created_at: '2026-06-18T00:00:00Z',
  updated_at: '2026-06-18T00:00:00Z',
};

const mockCharacter: Character = {
  id: 'char-1',
  project_id: 'proj-1',
  name: '林小夏',
  role_type: 'protagonist',
  episode_range: '1-12',
  appearance: '黑色长发',
  costume: null,
  expression: null,
  signature_action: null,
  voice_description: null,
  status: 'draft',
  ref_images: [],
  ip_adapter_id: null,
  lora_path: null,
  created_at: '2026-06-18T00:00:00Z',
  updated_at: '2026-06-18T00:00:00Z',
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/proj-1/characters']}>
        <Routes>
          <Route path="/projects/:projectId/characters" element={<CharacterListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CharacterListPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/v1/projects/proj-1') {
          return Promise.resolve(new Response(JSON.stringify({ data: mockProject }), { status: 200 }));
        }
        if (url === '/api/v1/projects/proj-1/characters') {
          return Promise.resolve(
            new Response(JSON.stringify({ data: { total: 1, characters: [mockCharacter] } }), {
              status: 200,
            })
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders character cards with name, role and status', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('林小夏')).toBeInTheDocument();
    });

    expect(screen.getByText('主角')).toBeInTheDocument();
    expect(screen.getByText('草稿', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(/测试项目/)).toBeInTheDocument();
  });

  it('filters characters by status', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('林小夏')).toBeInTheDocument();
    });

    const confirmedFilter = screen.getByRole('button', { name: '已确认' });
    await userEvent.click(confirmedFilter);

    await waitFor(() => {
      expect(screen.queryByText('林小夏')).not.toBeInTheDocument();
    });

    const allFilter = screen.getByRole('button', { name: '全部' });
    await userEvent.click(allFilter);

    await waitFor(() => {
      expect(screen.getByText('林小夏')).toBeInTheDocument();
    });
  });

  it('filters characters by search', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('林小夏')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('搜索角色');
    await userEvent.type(searchInput, '不存在');

    await waitFor(() => {
      expect(screen.queryByText('林小夏')).not.toBeInTheDocument();
    });
  });

  it('opens create character form and submits', async () => {
    vi.mocked(fetch).mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/v1/projects/proj-1') {
        return Promise.resolve(new Response(JSON.stringify({ data: mockProject }), { status: 200 }));
      }
      if (url === '/api/v1/projects/proj-1/characters' && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({ data: mockCharacter }), { status: 201 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: { total: 0, characters: [] } }), { status: 200 })
      );
    });

    renderPage();

    const createButton = await screen.findByRole('button', { name: '手动创建角色' });
    await userEvent.click(createButton);

    const nameInput = await screen.findByLabelText('姓名 *');
    await userEvent.type(nameInput, '林小夏');

    const submitButton = screen.getByRole('button', { name: '创建角色' });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        '/api/v1/projects/proj-1/characters',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('林小夏'),
        })
      );
    });
  });
});
