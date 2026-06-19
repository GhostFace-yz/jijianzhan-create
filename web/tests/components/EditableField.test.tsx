import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableField } from '../../src/components/EditableField';

describe('EditableField', () => {
  it('renders the text value', () => {
    render(
      <EditableField value="Hello World" onSave={vi.fn()} label="编辑" />
    );
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('shows placeholder when value is empty', () => {
    render(
      <EditableField value="" onSave={vi.fn()} placeholder="请输入内容" label="编辑" />
    );
    expect(screen.getByText('请输入内容')).toBeInTheDocument();
  });

  it('enters edit mode on click', async () => {
    const user = userEvent.setup();
    render(
      <EditableField value="click me" onSave={vi.fn()} label="编辑" />
    );
    await user.click(screen.getByText('click me'));
    // Should show save/cancel buttons
    expect(screen.getByLabelText('保存')).toBeInTheDocument();
    expect(screen.getByLabelText('取消')).toBeInTheDocument();
  });

  it('calls onSave with new value on blur', async () => {
    const onSave = vi.fn();
    render(
      <EditableField value="old" onSave={onSave} label="编辑" />
    );
    // Click to edit
    fireEvent.click(screen.getByText('old'));
    // Type new value
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'new value' } });
    // Blur to save
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith('new value');
  });

  it('does not call onSave when value is trimmed empty', async () => {
    const onSave = vi.fn();
    render(
      <EditableField value="old" onSave={onSave} label="编辑" />
    );
    fireEvent.click(screen.getByText('old'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(onSave).not.toHaveBeenCalled();
  });
});
