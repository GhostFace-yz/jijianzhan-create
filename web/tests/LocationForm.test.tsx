import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocationForm } from '../src/components/locations/LocationForm';
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
  key_props: ['沙发', '落地灯'],
  status: 'draft',
  base_seed: null,
  base_image_url: null,
  variants: {},
  created_at: '2026-06-18T00:00:00Z',
  updated_at: '2026-06-18T00:00:00Z',
};

function renderForm(location = mockLocation, onSaved = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <LocationForm projectId="proj-1" location={location} onSaved={onSaved} />
    </QueryClientProvider>
  );
}

describe('LocationForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders form fields with initial values', () => {
    renderForm();

    expect(screen.getByLabelText('场景名称 *')).toHaveValue('主角公寓客厅');
    expect(screen.getByLabelText('空间类型')).toHaveValue('室内');
    expect(screen.getByLabelText('场景描述')).toHaveValue('简约现代风格');
    expect(screen.getByLabelText('主色调')).toHaveValue('暖灰');
    expect(screen.getByLabelText('光线类型')).toHaveValue('自然光');
    expect(screen.getByLabelText('关键道具')).toHaveValue('沙发, 落地灯');
  });

  it('renders all status options', () => {
    renderForm();

    expect(screen.getByRole('radio', { name: '草稿' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '已确认' })).not.toBeChecked();
  });

  it('submits updated fields', async () => {
    const onSaved = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { ...mockLocation, description: '更新后的描述', color_tone: '冷白' },
        }),
        { status: 200 }
      )
    );

    renderForm(mockLocation, onSaved);

    const descInput = screen.getByLabelText('场景描述');
    await userEvent.clear(descInput);
    await userEvent.type(descInput, '更新后的描述');

    const colorInput = screen.getByLabelText('主色调');
    await userEvent.clear(colorInput);
    await userEvent.type(colorInput, '冷白');

    const submitButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/locations/loc-1',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('更新后的描述'),
      })
    );
  });

  it('toggles status between draft and confirmed', async () => {
    const onSaved = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { ...mockLocation, status: 'confirmed' },
        }),
        { status: 200 }
      )
    );

    renderForm(mockLocation, onSaved);

    const confirmedRadio = screen.getByRole('radio', { name: '已确认' });
    await userEvent.click(confirmedRadio);

    const submitButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/v1/projects/proj-1/locations/loc-1',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('confirmed'),
      })
    );
  });

  it('handles submit error', async () => {
    const onSaved = vi.fn();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('网络错误'));

    renderForm(mockLocation, onSaved);

    const descInput = screen.getByLabelText('场景描述');
    await userEvent.clear(descInput);
    await userEvent.type(descInput, '新描述');

    const submitButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeInTheDocument();
    });

    expect(onSaved).not.toHaveBeenCalled();
  });
});
