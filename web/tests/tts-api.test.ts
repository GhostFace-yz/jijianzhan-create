import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('TTS API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should call batchGenerateTts with correct URL and body', async () => {
    const api = await import('../src/api/tts');

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            episode_id: 'ep-1',
            total_nodes: 3,
            nodes_with_dialogue: 2,
            nodes_generated: 2,
            nodes_skipped: 1,
            nodes_failed: 0,
            success_rate: 1,
            results: [],
          },
        }),
        { status: 201 },
      ),
    );

    await api.batchGenerateTts('proj-1', 'ep-1', { speed: 1.1 });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/audio/tts/generate',
      expect.objectContaining({ method: 'POST' }),
    );
    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.speed).toBe(1.1);
  });

  it('should call generateNodeTts with correct URL', async () => {
    const api = await import('../src/api/tts');

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            node_id: 'ep1-n001',
            audio_clip: {
              url: 'https://example.com/audio.mp3',
              duration: 3,
              voice_id: 'voice-1',
              emotion: 'happy',
              speed: 1,
              generated_at: '2026-06-19T00:00:00Z',
              status: 'generated',
            },
            skipped: false,
          },
        }),
        { status: 201 },
      ),
    );

    await api.generateNodeTts('proj-1', 'ep-1', 'ep1-n001', { emotion: 'sad' });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/audio/tts/nodes/ep1-n001/generate',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should call reviewNodeTts with PUT and approved flag', async () => {
    const api = await import('../src/api/tts');

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            url: 'https://example.com/audio.mp3',
            duration: 3,
            voice_id: 'voice-1',
            emotion: 'happy',
            speed: 1,
            generated_at: '2026-06-19T00:00:00Z',
            status: 'reviewed',
            reviewed: true,
          },
        }),
        { status: 200 },
      ),
    );

    await api.reviewNodeTts('proj-1', 'ep-1', 'ep1-n001', { approved: true });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/audio/tts/nodes/ep1-n001/review',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('should call uploadNodeTts with PUT and url/duration', async () => {
    const api = await import('../src/api/tts');

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            url: 'blob:https://example.com/audio',
            duration: 5,
            voice_id: 'user-uploaded',
            emotion: 'neutral',
            speed: 1,
            generated_at: '2026-06-19T00:00:00Z',
            status: 'reviewed',
            reviewed: true,
          },
        }),
        { status: 200 },
      ),
    );

    await api.uploadNodeTts('proj-1', 'ep-1', 'ep1-n001', { url: 'blob:audio', duration: 5 });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/audio/tts/nodes/ep1-n001/upload',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('should call updateStoryboardNodes for dialogue edits', async () => {
    const api = await import('../src/api/tts');

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    await api.updateStoryboardNodes('proj-1', 'ep-1', { nodes: [] });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/episodes/ep-1/storyboard/nodes',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
