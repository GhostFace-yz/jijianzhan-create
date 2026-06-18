import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CharacterForm } from '../src/components/characters/CharacterForm';
import type { Character } from '../src/types';

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

function renderForm(character = mockCharacter, onSaved = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <CharacterForm projectId="proj-1" character={character} onSaved={onSaved} />
    </QueryClientProvider>
  );
}

describe('CharacterForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders form fields with initial values', () => {
    renderForm();

    expect(screen.getByLabelText('姓名 *')).toHaveValue('林小夏');
    expect(screen.getByLabelText('角色定位 *')).toHaveValue('protagonist');
    expect(screen.getByLabelText('登场集数范围')).toHaveValue('1-12');
    expect(screen.getByLabelText('外貌描述')).toHaveValue('黑色长发');
  });

  it('submits updated fields', async () => {
    const onSaved = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { ...mockCharacter, appearance: '黑色短发' },
        }),
        { status: 200 }
      )
    );

    renderForm(mockCharacter, onSaved);

    const appearanceInput = screen.getByLabelText('外貌描述');
    await userEvent.clear(appearanceInput);
    await userEvent.type(appearanceInput, '黑色短发');

    const submitButton = screen.getByRole('button', { name: '保存' });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters/char-1',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('黑色短发'),
      })
    );
  });

  it('toggles status between draft and confirmed', async () => {
    const onSaved = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { ...mockCharacter, status: 'confirmed' },
        }),
        { status: 200 }
      )
    );

    renderForm(mockCharacter, onSaved);

    const confirmedRadio = screen.getByRole('radio', { name: '已确认' });
    await userEvent.click(confirmedRadio);

    const submitButton = screen.getByRole('button', { name: '保存' });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters/char-1',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('confirmed'),
      })
    );
  });
});
