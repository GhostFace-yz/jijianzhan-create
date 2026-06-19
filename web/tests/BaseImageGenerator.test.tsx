import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BaseImageGenerator } from '../src/components/locations/BaseImageGenerator';
import type { Location } from '../src/types';

const mockLocation: Location = {
  id: 'loc-1',
  project_id: 'proj-1',
  name: '主角公寓客厅',
  description: '简约现代风格',
  frequency: '高频',
  space_type: '室内',
  style: '现代简约',
  color_tone: '暖灰',
  lighting_type: '自然光',
  key_props: ['沙发'],
  status: 'draft',
  base_seed: null,
  base_image_url: null,
  variants: {},
  created_at: '2026-06-18T00:00:00Z',
  updated_at: '2026-06-18T00:00:00Z',
};

const mockLocationWithBase: Location = {
  ...mockLocation,
  base_seed: 42,
  base_image_url: 'http://example.com/base.png',
};

function renderGen(location = mockLocation, onUpdated = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <BaseImageGenerator projectId="proj-1" location={location} onUpdated={onUpdated} />
    </QueryClientProvider>
  );
}

describe('BaseImageGenerator', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows generate button when no base image', () => {
    renderGen();

    expect(screen.getByRole('button', { name: /生成基准图/ })).toBeInTheDocument();
  });

  it('shows regenerate button when base image exists', () => {
    renderGen(mockLocationWithBase);

    expect(screen.getByRole('button', { name: /重新生成/ })).toBeInTheDocument();
    const seedElements = screen.getAllByText(/Seed:\s*42/);
    expect(seedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('generates and displays candidates on click', async () => {
    const candidates = [
      { url: 'http://example.com/a.png', seed: 1, prompt: 'prompt-a' },
      { url: 'http://example.com/b.png', seed: 2, prompt: 'prompt-b' },
      { url: 'http://example.com/c.png', seed: 3, prompt: 'prompt-c' },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: candidates }), { status: 200 })
    );

    renderGen();

    const generateBtn = screen.getByRole('button', { name: /生成基准图/ });
    await userEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('Seed: 1')).toBeInTheDocument();
      expect(screen.getByText('Seed: 2')).toBeInTheDocument();
      expect(screen.getByText('Seed: 3')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /确认使用/ })).toBeDisabled();
  });

  it('confirms selected candidate', async () => {
    const candidates = [
      { url: 'http://example.com/a.png', seed: 1, prompt: 'prompt-a' },
      { url: 'http://example.com/b.png', seed: 2, prompt: 'prompt-b' },
      { url: 'http://example.com/c.png', seed: 3, prompt: 'prompt-c' },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: candidates }), { status: 200 })
    );

    const onUpdated = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockLocationWithBase }), { status: 200 })
    );

    renderGen(mockLocation, onUpdated);

    const generateBtn = screen.getByRole('button', { name: /生成基准图/ });
    await userEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('Seed: 1')).toBeInTheDocument();
    });

    // Click first candidate image
    const candidateButtons = screen.getAllByRole('button');
    // The first candidate button after the generate button
    const firstCandidate = candidateButtons.find((btn) =>
      btn.textContent?.includes('Seed: 1')
    );
    if (firstCandidate) {
      await userEvent.click(firstCandidate);
    }

    const confirmBtn = screen.getByRole('button', { name: /确认使用/ });
    expect(confirmBtn).not.toBeDisabled();

    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(mockLocationWithBase);
    });
  });

  it('handles generation error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('生成失败'));

    renderGen();

    const generateBtn = screen.getByRole('button', { name: /生成基准图/ });
    await userEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('生成失败')).toBeInTheDocument();
    });
  });
});
