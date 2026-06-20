import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Storyboard API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should call listStoryboardNodes with correct URL', async () => {
    const api = await import('../src/api/storyboard');

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    await api.listStoryboardNodes('proj-1', 'ep-1');

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/storyboard/nodes',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('should call splitStoryboardNodes with POST', async () => {
    const api = await import('../src/api/storyboard');

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({
        data: { nodes: [], total_duration: 0, node_count: 0 },
      }), { status: 201 }),
    );

    await api.splitStoryboardNodes('proj-1', 'ep-1');

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/storyboard/split',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should call updateStoryboardNodes with PUT', async () => {
    const api = await import('../src/api/storyboard');

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    await api.updateStoryboardNodes('proj-1', 'ep-1', { nodes: [] });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/storyboard/nodes',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('should call splitStoryboardNode correctly', async () => {
    const api = await import('../src/api/storyboard');

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          original: { node_id: 'ep1-n001', scene_id: 's1' },
          new_nodes: [
            { node_id: 'ep1-n001a', duration_target: 3 },
            { node_id: 'ep1-n001b', duration_target: 3 },
          ],
        },
      }), { status: 200 }),
    );

    const result = await api.splitStoryboardNode('proj-1', 'ep-1', 'ep1-n001', { split_point_seconds: 3 });

    expect(result.data.new_nodes).toHaveLength(2);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/storyboard/nodes/ep1-n001/split',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
