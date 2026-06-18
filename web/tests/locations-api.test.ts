import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listLocations,
  updateLocation,
  generateBaseCandidates,
  confirmBaseImage,
  generateLocationVariant,
  confirmLocationVariant,
  listLocationVersions,
  rollbackLocation,
  variantKey,
  getVariant,
} from '../src/api/locations';
import type { Location } from '../src/types';

const mockLocation: Location = {
  id: 'loc-1',
  project_id: 'proj-1',
  name: '主角公寓客厅',
  description: '简约现代风格，落地窗外是城市夜景',
  frequency: '高频',
  space_type: '室内',
  style: '现代简约',
  color_tone: '暖灰',
  lighting_type: '夜景灯光',
  key_props: ['沙发', '落地灯', '书架'],
  status: 'draft',
  base_seed: null,
  base_image_url: null,
  variants: {},
  created_at: '2026-06-18T00:00:00Z',
  updated_at: '2026-06-18T00:00:00Z',
};

describe('locations API service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listLocations fetches locations', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { total: 1, locations: [mockLocation] } }), {
        status: 200,
      })
    );

    const result = await listLocations('proj-1');

    expect(fetch).toHaveBeenCalledWith('/api/v1/projects/proj-1/locations', expect.any(Object));
    expect(result.data.total).toBe(1);
    expect(result.data.locations[0].name).toBe('主角公寓客厅');
  });

  it('updateLocation puts data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockLocation }), { status: 200 })
    );

    const result = await updateLocation('proj-1', 'loc-1', { description: '更新后的描述' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/locations/loc-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ description: '更新后的描述' }),
      })
    );
    expect(result.data.id).toBe('loc-1');
  });

  it('generateBaseCandidates posts empty body when no input', async () => {
    const candidates = [
      { url: 'http://example.com/a.png', seed: 1, prompt: 'prompt-a' },
      { url: 'http://example.com/b.png', seed: 2, prompt: 'prompt-b' },
      { url: 'http://example.com/c.png', seed: 3, prompt: 'prompt-c' },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: candidates }), { status: 200 })
    );

    const result = await generateBaseCandidates('proj-1', 'loc-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/locations/loc-1/generate-base',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
    expect(result.data).toHaveLength(3);
  });

  it('generateBaseCandidates forwards seed when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    );

    await generateBaseCandidates('proj-1', 'loc-1', { seed: 42 });

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/locations/loc-1/generate-base',
      expect.objectContaining({
        body: JSON.stringify({ seed: 42 }),
      })
    );
  });

  it('confirmBaseImage posts candidate', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockLocation }), { status: 200 })
    );

    const candidate = { url: 'http://example.com/base.png', seed: 7, prompt: 'base-prompt' };
    const result = await confirmBaseImage('proj-1', 'loc-1', { candidate });

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/locations/loc-1/confirm-base',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ candidate }),
      })
    );
    expect(result.data.id).toBe('loc-1');
  });

  it('generateLocationVariant posts time and weather', async () => {
    const variant = { url: 'http://example.com/var.png', seed: 9, prompt: 'var-prompt' };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: variant }), { status: 200 })
    );

    const result = await generateLocationVariant('proj-1', 'loc-1', {
      time_of_day: 'day',
      weather: 'sunny',
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/locations/loc-1/generate-variant',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ time_of_day: 'day', weather: 'sunny' }),
      })
    );
    expect(result.data.seed).toBe(9);
  });

  it('confirmLocationVariant posts variant payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockLocation }), { status: 200 })
    );

    const variant = { url: 'http://example.com/var.png', seed: 9, prompt: 'var-prompt' };
    await confirmLocationVariant('proj-1', 'loc-1', {
      time_of_day: 'night',
      weather: 'rainy',
      variant,
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/locations/loc-1/confirm-variant',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ time_of_day: 'night', weather: 'rainy', variant }),
      })
    );
  });

  it('listLocationVersions fetches versions', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            total: 1,
            versions: [
              {
                id: 'snap-1',
                versionId: 'v1',
                versionNumber: 1,
                source: 'user_edited',
                editedBy: null,
                aiModel: null,
                promptOverride: null,
                parentVersionNumber: null,
                createdAt: '2026-06-18T00:00:00Z',
              },
            ],
          },
        }),
        { status: 200 }
      )
    );

    const result = await listLocationVersions('proj-1', 'loc-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/locations/loc-1/versions',
      expect.any(Object)
    );
    expect(result.data.total).toBe(1);
  });

  it('rollbackLocation posts version_id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockLocation }), { status: 200 })
    );

    const result = await rollbackLocation('proj-1', 'loc-1', { version_id: 'v2' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/locations/loc-1/rollback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ version_id: 'v2' }),
      })
    );
    expect(result.data.id).toBe('loc-1');
  });

  it('variantKey builds deterministic key', () => {
    expect(variantKey('day', 'sunny')).toBe('day-sunny');
  });

  it('getVariant returns matching variant', () => {
    const location: Location = {
      ...mockLocation,
      variants: {
        'day-sunny': { image_url: 'http://example.com/day.png', prompt: 'p', seed: 1 },
      },
    };

    const result = getVariant(location, 'day', 'sunny');

    expect(result?.seed).toBe(1);
  });

  it('throws on error response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 })
    );

    await expect(listLocations('proj-1')).rejects.toThrow('Not found');
  });
});
