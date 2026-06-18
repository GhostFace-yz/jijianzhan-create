import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  buildQueryString,
} from '../src/api/projects';
import type { Project } from '../src/types';

const mockProject: Project = {
  id: 'proj-1',
  user_id: 'system',
  team_id: null,
  status: 'draft',
  meta: {
    title: '测试项目',
    description: '描述',
    genre: 'urban_romance',
    target_episodes: 12,
    duration_goal: '5min',
    style_tags: ['realistic'],
    notes: null,
  },
  created_at: '2026-06-18T00:00:00Z',
  updated_at: '2026-06-18T00:00:00Z',
};

describe('projects API service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('buildQueryString builds query string', () => {
    expect(
      buildQueryString({
        status: 'draft',
        search: '都市',
        sort: 'updated_at_desc',
        limit: 20,
        offset: 10,
      })
    ).toBe('?status=draft&search=%E9%83%BD%E5%B8%82&sort=updated_at_desc&limit=20&offset=10');
  });

  it('buildQueryString returns empty string when no filters', () => {
    expect(buildQueryString({})).toBe('');
  });

  it('listProjects fetches projects', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { total: 1, projects: [mockProject] } }), {
        status: 200,
      })
    );

    const result = await listProjects({ status: 'draft' });

    expect(fetch).toHaveBeenCalledWith('/api/v1/projects?status=draft', expect.any(Object));
    expect(result.data.total).toBe(1);
  });

  it('getProject fetches a single project', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockProject }), { status: 200 })
    );

    const result = await getProject('proj-1');

    expect(fetch).toHaveBeenCalledWith('/api/v1/projects/proj-1', expect.any(Object));
    expect(result.data.id).toBe('proj-1');
  });

  it('createProject posts data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockProject }), { status: 201 })
    );

    const result = await createProject(mockProject.meta);

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ meta: mockProject.meta }),
      })
    );
    expect(result.data.id).toBe('proj-1');
  });

  it('updateProject patches data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockProject }), { status: 200 })
    );

    const result = await updateProject('proj-1', { status: 'outlining' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'outlining' }),
      })
    );
    expect(result.data.id).toBe('proj-1');
  });

  it('deleteProject sends delete request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteProject('proj-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('throws on error response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 })
    );

    await expect(getProject('missing')).rejects.toThrow('Not found');
  });
});
