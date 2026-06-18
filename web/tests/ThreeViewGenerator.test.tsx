import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThreeViewGenerator } from '../src/components/characters/ThreeViewGenerator';
import type { Character } from '../src/types';

const baseCharacter: Character = {
  id: 'char-1',
  project_id: 'proj-1',
  name: '林小夏',
  role_type: 'protagonist',
  episode_range: null,
  appearance: null,
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

const withAllViews: Character = {
  ...baseCharacter,
  ref_images: [
    { view: 'front', url: 'http://example.com/front.png', seed: 1 },
    { view: 'side', url: 'http://example.com/side.png', seed: 2 },
    { view: 'back', url: 'http://example.com/back.png', seed: 3 },
  ],
};

function renderGenerator(character = baseCharacter, onUpdated = vi.fn()) {
  return render(
    <ThreeViewGenerator
      projectId="proj-1"
      character={character}
      onUpdated={onUpdated}
    />
  );
}

describe('ThreeViewGenerator', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows empty state when no views', () => {
    renderGenerator();

    expect(screen.getByText('尚未生成三视图，点击上方按钮开始生成')).toBeInTheDocument();
  });

  it('generates all views on button click', async () => {
    const onUpdated = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: withAllViews }), { status: 200 })
    );

    renderGenerator(baseCharacter, onUpdated);

    const generateButton = screen.getByRole('button', { name: '生成三视图' });
    await userEvent.click(generateButton);

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(withAllViews);
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters/char-1/generate-views',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('shows three view images and confirm button when all views exist', () => {
    renderGenerator(withAllViews);

    expect(screen.getByAltText('林小夏 正面')).toBeInTheDocument();
    expect(screen.getByAltText('林小夏 侧面')).toBeInTheDocument();
    expect(screen.getByAltText('林小夏 背面')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认三视图' })).toBeInTheDocument();
  });

  it('retrys a single view', async () => {
    const onUpdated = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: withAllViews }), { status: 200 })
    );

    renderGenerator(withAllViews, onUpdated);

    const retryButtons = screen.getAllByRole('button', { name: '重生成' });
    await userEvent.click(retryButtons[0]);

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalled();
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/generate-views/front/retry'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('confirms views when all present', async () => {
    const onUpdated = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { ...withAllViews, status: 'confirmed' } }), {
        status: 200,
      })
    );

    renderGenerator(withAllViews, onUpdated);

    const confirmButton = screen.getByRole('button', { name: '确认三视图' });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalled();
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters/char-1/confirm-views',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
