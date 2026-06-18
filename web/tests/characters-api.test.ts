import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  generateViews,
  retryView,
  confirmViews,
  generateRefs,
  rollbackCharacter,
  listCharacterVersions,
  getCharacterVersion,
  viewImages,
} from '../src/api/characters';
import type { Character } from '../src/types';

const mockCharacter: Character = {
  id: 'char-1',
  project_id: 'proj-1',
  name: '林小夏',
  role_type: 'protagonist',
  episode_range: '1-12',
  appearance: '黑色长发，丹凤眼',
  costume: '白色衬衫配牛仔裤',
  expression: '眼神坚定，嘴角微扬',
  signature_action: '撩头发',
  voice_description: '清冷女声',
  status: 'draft',
  ref_images: [],
  ip_adapter_id: null,
  lora_path: null,
  created_at: '2026-06-18T00:00:00Z',
  updated_at: '2026-06-18T00:00:00Z',
};

describe('characters API service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listCharacters fetches characters', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { total: 1, characters: [mockCharacter] } }), {
        status: 200,
      })
    );

    const result = await listCharacters('proj-1');

    expect(fetch).toHaveBeenCalledWith('/api/v1/projects/proj-1/characters', expect.any(Object));
    expect(result.data.total).toBe(1);
    expect(result.data.characters[0].name).toBe('林小夏');
  });

  it('getCharacter fetches a single character', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockCharacter }), { status: 200 })
    );

    const result = await getCharacter('proj-1', 'char-1');

    expect(fetch).toHaveBeenCalledWith('/api/v1/projects/proj-1/characters/char-1', expect.any(Object));
    expect(result.data.id).toBe('char-1');
  });

  it('createCharacter posts data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockCharacter }), { status: 201 })
    );

    const result = await createCharacter('proj-1', { name: '林小夏', role_type: 'protagonist' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '林小夏', role_type: 'protagonist' }),
      })
    );
    expect(result.data.id).toBe('char-1');
  });

  it('updateCharacter puts data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockCharacter }), { status: 200 })
    );

    const result = await updateCharacter('proj-1', 'char-1', { appearance: '短发' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters/char-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ appearance: '短发' }),
      })
    );
    expect(result.data.id).toBe('char-1');
  });

  it('deleteCharacter sends delete request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteCharacter('proj-1', 'char-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters/char-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('generateViews posts empty body when no input', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockCharacter }), { status: 200 })
    );

    await generateViews('proj-1', 'char-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters/char-1/generate-views',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
  });

  it('retryView posts retry request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockCharacter }), { status: 200 })
    );

    await retryView('proj-1', 'char-1', 'front');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters/char-1/generate-views/front/retry',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('confirmViews posts confirm request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockCharacter }), { status: 200 })
    );

    await confirmViews('proj-1', 'char-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters/char-1/confirm-views',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('generateRefs posts refs request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockCharacter }), { status: 200 })
    );

    await generateRefs('proj-1', 'char-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters/char-1/generate-refs',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('rollbackCharacter posts version_id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockCharacter }), { status: 200 })
    );

    await rollbackCharacter('proj-1', 'char-1', 'v2');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters/char-1/rollback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ version_id: 'v2' }),
      })
    );
  });

  it('listCharacterVersions fetches versions', async () => {
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

    const result = await listCharacterVersions('proj-1', 'char-1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/entities/character/char-1/versions',
      expect.any(Object)
    );
    expect(result.data.total).toBe(1);
  });

  it('getCharacterVersion fetches single version', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            id: 'snap-1',
            versionId: 'v1',
            versionNumber: 1,
            source: 'user_edited',
            editedBy: null,
            aiModel: null,
            promptOverride: null,
            parentVersionNumber: null,
            createdAt: '2026-06-18T00:00:00Z',
            content: {},
            diff: {},
          },
        }),
        { status: 200 }
      )
    );

    await getCharacterVersion('proj-1', 'char-1', 'v1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/entities/character/char-1/versions/v1',
      expect.any(Object)
    );
  });

  it('viewImages partitions ref images', () => {
    const withImages: Character = {
      ...mockCharacter,
      ref_images: [
        { view: 'front', url: 'http://example.com/front.png', seed: 1 },
        { view: 'side', url: 'http://example.com/side.png', seed: 2 },
        { view: 'back', url: 'http://example.com/back.png', seed: 3 },
        { view: 'expr_happy', url: 'http://example.com/e1.png', seed: 4 },
        { view: 'scene_standing_casual', url: 'http://example.com/s1.png', seed: 5 },
      ],
    };

    const result = viewImages(withImages);

    expect(result.views).toHaveLength(3);
    expect(result.expressions).toHaveLength(1);
    expect(result.sceneStandings).toHaveLength(1);
  });

  it('throws on error response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 })
    );

    await expect(getCharacter('proj-1', 'missing')).rejects.toThrow('Not found');
  });
});
