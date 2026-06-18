import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VersionHistory } from '../src/components/characters/VersionHistory';
import type { Character, SnapshotMeta } from '../src/types';

const mockCharacter: Character = {
  id: 'char-1',
  project_id: 'proj-1',
  name: '林小夏',
  role_type: 'protagonist',
  episode_range: null,
  appearance: '黑色短发',
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

const versions: SnapshotMeta[] = [
  {
    id: 'snap-2',
    versionId: 'v2',
    versionNumber: 2,
    source: 'user_edited',
    editedBy: null,
    aiModel: null,
    promptOverride: null,
    parentVersionNumber: 1,
    createdAt: '2026-06-19T10:00:00Z',
  },
  {
    id: 'snap-1',
    versionId: 'v1',
    versionNumber: 1,
    source: 'user_edited',
    editedBy: null,
    aiModel: null,
    promptOverride: null,
    parentVersionNumber: null,
    createdAt: '2026-06-18T10:00:00Z',
  },
];

function renderHistory(onRolledBack = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <VersionHistory
        projectId="proj-1"
        character={mockCharacter}
        onRolledBack={onRolledBack}
      />
    </QueryClientProvider>
  );
}

describe('VersionHistory', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders version list with current badge', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { total: 2, versions } }), { status: 200 })
    );

    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('v2')).toBeInTheDocument();
    });

    expect(screen.getByText('当前')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
  });

  it('opens confirmation dialog and rolls back', async () => {
    const onRolledBack = vi.fn();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { total: 2, versions } }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: mockCharacter }), { status: 200 })
      );

    renderHistory(onRolledBack);

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument();
    });

    const rollbackButton = screen.getAllByRole('button', { name: '回滚' })[0];
    await userEvent.click(rollbackButton);

    expect(screen.getByRole('dialog', { name: '确认回滚' })).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: '确认回滚' });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(onRolledBack).toHaveBeenCalledWith(mockCharacter);
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/characters/char-1/rollback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ version_id: 'v1' }),
      })
    );
  });

  it('allows canceling rollback', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { total: 2, versions } }), { status: 200 })
    );

    renderHistory();

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument();
    });

    const rollbackButton = screen.getAllByRole('button', { name: '回滚' })[0];
    await userEvent.click(rollbackButton);

    const cancelButton = screen.getByRole('button', { name: '取消' });
    await userEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '确认回滚' })).not.toBeInTheDocument();
    });
  });
});
