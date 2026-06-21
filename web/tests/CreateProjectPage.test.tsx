import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { CreateProjectPage } from '../src/pages/CreateProjectPage';
import { TestProviders } from './helpers/providers';

describe('CreateProjectPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              id: 'new-proj',
              status: 'draft',
              meta: {
                title: '新项目',
                description: '新描述',
                genre: 'urban_romance',
                style_tags: [],
              },
            },
          }),
          { status: 201 }
        )
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderPage() {
    render(
      <MemoryRouter>
        <TestProviders>
          <CreateProjectPage />
        </TestProviders>
      </MemoryRouter>
    );
  }

  it('renders form fields', () => {
    renderPage();

    expect(screen.getByLabelText('项目标题 *')).toBeInTheDocument();
    expect(screen.getByLabelText('创意描述 *')).toBeInTheDocument();
    expect(screen.getByLabelText('题材 *')).toBeInTheDocument();
    expect(screen.getByLabelText('目标集数')).toBeInTheDocument();
    expect(screen.getByLabelText('时长目标')).toBeInTheDocument();
    expect(screen.getByText('风格标签')).toBeInTheDocument();
    expect(screen.getByLabelText('创作备注')).toBeInTheDocument();
  });

  it('shows validation errors for empty required fields', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '创建项目' }));

    await waitFor(() => {
      expect(screen.getByText('标题不能为空')).toBeInTheDocument();
    });
    expect(screen.getByText('创意描述不能为空')).toBeInTheDocument();
    expect(
      screen.getByText('请选择题材', { selector: '[data-slot="field-error"] p' })
    ).toBeInTheDocument();
  });

  it('shows error for title exceeding 50 characters', async () => {
    renderPage();

    const titleInput = screen.getByLabelText('项目标题 *');
    fireEvent.change(titleInput, { target: { value: 'a'.repeat(51) } });

    await waitFor(() => {
      expect(screen.getByText('标题最多 50 字')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('项目标题 *'), '新项目');
    await user.type(screen.getByLabelText('创意描述 *'), '新描述');

    await user.click(screen.getByLabelText('题材 *'));
    await user.click(screen.getByRole('option', { name: '都市情感' }));

    await user.type(screen.getByLabelText('目标集数'), '12');

    await user.click(screen.getByLabelText('时长目标'));
    await user.click(screen.getByRole('option', { name: '5 分钟' }));

    await user.click(screen.getByRole('button', { name: '创建项目' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/projects',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"title":"新项目"'),
        })
      );
    });
  });
});
