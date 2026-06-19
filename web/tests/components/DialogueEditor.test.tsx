import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DialogueEditor } from '../../src/components/script/DialogueEditor';
import type { Dialogue } from '../../src/types';

const sampleDialogue: Dialogue = {
  char_id: '张三',
  text: '今天天气真好。',
  emotion: '开心',
};

describe('DialogueEditor', () => {
  it('renders character, text, and emotion', () => {
    render(
      <DialogueEditor dialogue={sampleDialogue} index={0} onSave={vi.fn()} />
    );
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('今天天气真好。')).toBeInTheDocument();
    expect(screen.getByText('开心')).toBeInTheDocument();
  });

  it('shows note when provided', () => {
    const withNote: Dialogue = { ...sampleDialogue, note: '小声说' };
    render(
      <DialogueEditor dialogue={withNote} index={0} onSave={vi.fn()} />
    );
    expect(screen.getByText('(小声说)')).toBeInTheDocument();
  });

  it('enters edit mode on character click', async () => {
    const user = userEvent.setup();
    render(
      <DialogueEditor dialogue={sampleDialogue} index={0} onSave={vi.fn()} />
    );
    await user.click(screen.getByText('张三'));
    // Should show save/cancel buttons
    expect(screen.getByLabelText('保存')).toBeInTheDocument();
    expect(screen.getByLabelText('取消')).toBeInTheDocument();
  });

  it('enters edit mode on text click', async () => {
    const user = userEvent.setup();
    render(
      <DialogueEditor dialogue={sampleDialogue} index={0} onSave={vi.fn()} />
    );
    await user.click(screen.getByText('今天天气真好。'));
    expect(screen.getByLabelText('保存')).toBeInTheDocument();
  });

  it('calls onSave with updated dialogue on blur', async () => {
    const onSave = vi.fn();
    render(
      <DialogueEditor dialogue={sampleDialogue} index={3} onSave={onSave} />
    );
    // Click text to edit
    fireEvent.click(screen.getByText('今天天气真好。'));
    // Change value
    const input = screen.getByDisplayValue('今天天气真好。');
    fireEvent.change(input, { target: { value: '明天可能会下雨。' } });
    // Blur to save
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith(3, {
      ...sampleDialogue,
      text: '明天可能会下雨。',
    });
  });

  it('cancels edit on Escape without saving', async () => {
    const onSave = vi.fn();
    render(
      <DialogueEditor dialogue={sampleDialogue} index={0} onSave={onSave} />
    );
    fireEvent.click(screen.getByText('开心'));
    const input = screen.getByDisplayValue('开心');
    fireEvent.change(input, { target: { value: '悲伤' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSave).not.toHaveBeenCalled();
    // Should return to display mode
    expect(screen.getByText('开心')).toBeInTheDocument();
  });

  it('does not enter edit mode when disabled', async () => {
    const user = userEvent.setup();
    render(
      <DialogueEditor dialogue={sampleDialogue} index={0} onSave={vi.fn()} disabled={true} />
    );
    await user.click(screen.getByText('张三'));
    // Save/cancel buttons should not appear
    expect(screen.queryByLabelText('保存')).not.toBeInTheDocument();
  });

  it('shows empty emotion as dash', () => {
    const noEmotion: Dialogue = { ...sampleDialogue, emotion: '' };
    render(
      <DialogueEditor dialogue={noEmotion} index={0} onSave={vi.fn()} />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
