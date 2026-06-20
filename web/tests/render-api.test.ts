import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startRender, getRenderProgress, getRenderDownload } from '../src/api/render';
import type { EpisodeRenderOutput } from '../src/types';

const mockRenderOutput: EpisodeRenderOutput = {
  episode_id: 'ep-1',
  status: 'queued',
  progress_percent: 0,
  output_url: null,
  output_duration: null,
  resolution: '1080x1920',
  fps: 30,
  codec: 'h264',
  subtitle_cues: [],
  transitions: [],
  started_at: '2026-06-19T00:00:00Z',
  queued_at: '2026-06-19T00:00:01Z',
  completed_at: null,
  error_message: null,
  job_id: 'job-1',
};

describe('render API service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('startRender posts options and returns output', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockRenderOutput }), { status: 202 }),
    );

    const options = { resolution: '1920x1080' as const, fps: 24 as const, codec: 'h265' as const };
    const result = await startRender('proj-1', 'ep-1', options);

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/render',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(options),
      }),
    );
    expect(result.data.status).toBe('queued');
  });

  it('startRender posts empty body when no options', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockRenderOutput }), { status: 202 }),
    );

    await startRender('proj-1', 'ep-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/render',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
  });

  it('getRenderProgress fetches progress', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { ...mockRenderOutput, status: 'encoding', progress_percent: 75 },
        }),
        { status: 200 },
      ),
    );

    const result = await getRenderProgress('proj-1', 'ep-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/render/progress',
      expect.any(Object),
    );
    expect(result.data.status).toBe('encoding');
    expect(result.data.progress_percent).toBe(75);
  });

  it('getRenderDownload fetches download url', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://example.com/final.mp4' } }), {
        status: 200,
      }),
    );

    const result = await getRenderDownload('proj-1', 'ep-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/render/download',
      expect.any(Object),
    );
    expect(result.data.url).toBe('https://example.com/final.mp4');
  });

  it('throws on error response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Render not found' } }), { status: 404 }),
    );

    await expect(getRenderProgress('proj-1', 'ep-1')).rejects.toThrow('Render not found');
  });
});
