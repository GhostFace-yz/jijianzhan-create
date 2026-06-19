import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import type { Dialogue } from '../../types';

export interface DialogueEditorProps {
  dialogue: Dialogue;
  index: number;
  onSave: (index: number, updated: Dialogue) => void;
  disabled?: boolean;
}

/**
 * Inline-editable dialogue row.
 * Click any field to edit: char_id, text, emotion.
 * Enter or blur to save, Escape to cancel.
 */
export function DialogueEditor({
  dialogue,
  index,
  onSave,
  disabled = false,
}: DialogueEditorProps) {
  const [editingField, setEditingField] = useState<
    'char_id' | 'text' | 'emotion' | null
  >(null);
  const [draft, setDraft] = useState<Dialogue>(dialogue);

  const handleStartEdit = (field: 'char_id' | 'text' | 'emotion') => {
    if (disabled) return;
    setDraft({ ...dialogue });
    setEditingField(field);
  };

  const handleSave = () => {
    const trimmed: Dialogue = {
      char_id: draft.char_id.trim(),
      text: draft.text.trim(),
      emotion: draft.emotion.trim(),
      note: draft.note?.trim() || undefined,
    };
    if (
      trimmed.char_id !== dialogue.char_id ||
      trimmed.text !== dialogue.text ||
      trimmed.emotion !== dialogue.emotion ||
      trimmed.note !== dialogue.note
    ) {
      onSave(index, trimmed);
    }
    setEditingField(null);
  };

  const handleCancel = () => {
    setEditingField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const editingFieldInput = editingField ? (
    <div className="flex items-center gap-1">
      {editingField === 'char_id' ? (
        <input
          autoFocus
          value={draft.char_id}
          onChange={(e) => setDraft({ ...draft, char_id: e.target.value })}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="w-24 rounded border border-hairline-strong bg-canvas px-2 py-0.5 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      ) : editingField === 'text' ? (
        <input
          autoFocus
          value={draft.text}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="min-w-[200px] flex-1 rounded border border-hairline-strong bg-canvas px-2 py-0.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      ) : (
        <input
          autoFocus
          value={draft.emotion}
          onChange={(e) => setDraft({ ...draft, emotion: e.target.value })}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="w-20 rounded border border-hairline-strong bg-canvas px-2 py-0.5 text-xs text-slate focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}
      <button
        type="button"
        onClick={handleSave}
        className="rounded p-0.5 text-semantic-success hover:bg-semantic-success/10"
        aria-label="保存"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={handleCancel}
        className="rounded p-0.5 text-steel hover:bg-surface"
        aria-label="取消"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : null;

  return (
    <div className="group flex items-start gap-3 py-2 border-b border-hairline-soft last:border-b-0">
      {/* Character name */}
      <div className="shrink-0 w-24">
        {editingField === 'char_id' ? (
          editingFieldInput
        ) : (
          <span
            className={`text-sm font-semibold text-primary ${!disabled ? 'cursor-pointer rounded hover:bg-surface/50 px-1 -mx-1' : ''}`}
            onClick={() => handleStartEdit('char_id')}
            role={disabled ? undefined : 'button'}
            tabIndex={disabled ? undefined : 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStartEdit('char_id');
            }}
            title={disabled ? undefined : '点击编辑角色'}
          >
            {dialogue.char_id}
          </span>
        )}
      </div>

      {/* Dialogue text */}
      <div className="flex-1 min-w-0">
        {editingField === 'text' ? (
          editingFieldInput
        ) : (
          <p
            className={`text-sm text-charcoal leading-relaxed ${!disabled ? 'cursor-pointer rounded hover:bg-surface/50 px-1 -mx-1' : ''}`}
            onClick={() => handleStartEdit('text')}
            role={disabled ? undefined : 'button'}
            tabIndex={disabled ? undefined : 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStartEdit('text');
            }}
            title={disabled ? undefined : '点击编辑台词'}
          >
            {dialogue.text}
          </p>
        )}
        {dialogue.note && editingField !== 'text' && (
          <p className="mt-0.5 text-xs text-muted italic">({dialogue.note})</p>
        )}
      </div>

      {/* Emotion badge */}
      <div className="shrink-0">
        {editingField === 'emotion' ? (
          editingFieldInput
        ) : (
          <span
            className={`inline-block rounded-full bg-card-tint-lavender px-2.5 py-0.5 text-xs text-charcoal ${!disabled ? 'cursor-pointer hover:bg-card-tint-sky' : ''}`}
            onClick={() => handleStartEdit('emotion')}
            role={disabled ? undefined : 'button'}
            tabIndex={disabled ? undefined : 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStartEdit('emotion');
            }}
            title={disabled ? undefined : '点击编辑情绪'}
          >
            {dialogue.emotion || '—'}
          </span>
        )}
      </div>

      {/* Edit indicator */}
      {!disabled && !editingField && (
        <div className="shrink-0 hidden group-hover:block">
          <Pencil className="h-3 w-3 text-steel" />
        </div>
      )}
    </div>
  );
}
