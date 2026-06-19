import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';

export interface EditableFieldProps {
  /** Current text value */
  value: string;
  /** Called when the user confirms the edit */
  onSave: (value: string) => void;
  /** Textarea mode for multi-line content */
  multiline?: boolean;
  /** Placeholder shown when value is empty */
  placeholder?: string;
  /** Tailwind text size class, e.g. 'text-sm', 'text-lg' */
  textSize?: string;
  /** Whether the field is editable (respects outline_locked) */
  disabled?: boolean;
  /** Accessible label for the edit button */
  label?: string;
}

/**
 * Inline-editable text field.
 * Click to edit, blur or Enter to save, Escape to cancel.
 */
export function EditableField({
  value,
  onSave,
  multiline = false,
  placeholder = '',
  textSize = 'text-sm',
  disabled = false,
  label = '编辑',
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      if (multiline) {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
  }, [editing, multiline]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    setEditing(false);
    setDraft(value);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (editing && !disabled) {
    return (
      <div className="flex items-start gap-2">
        {multiline ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={`${textSize} min-h-[60px] flex-1 rounded-lg border border-hairline-strong bg-canvas p-2 text-ink resize-y focus:outline-none focus:ring-2 focus:ring-primary/30`}
            rows={3}
          />
        ) : (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={`${textSize} flex-1 rounded-lg border border-hairline-strong bg-canvas px-2 py-1 text-ink focus:outline-none focus:ring-2 focus:ring-primary/30`}
          />
        )}
        <div className="flex shrink-0 gap-1 pt-0.5">
          <button
            type="button"
            onClick={handleSave}
            className="rounded p-1 text-semantic-success hover:bg-semantic-success/10"
            aria-label="保存"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded p-1 text-steel hover:bg-surface"
            aria-label="取消"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const displayText = value || placeholder;

  return (
    <div className="group relative">
      <div
        className={`${textSize} ${value ? 'text-ink' : 'text-muted italic'} whitespace-pre-wrap ${!disabled ? 'cursor-pointer rounded-lg hover:bg-surface/50' : ''}`}
        onClick={() => {
          if (!disabled) {
            setDraft(value);
            setEditing(true);
          }
        }}
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? undefined : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setDraft(value);
            setEditing(true);
          }
        }}
        aria-label={disabled ? undefined : `${label}: ${displayText}`}
      >
        {displayText}
      </div>
      {!disabled && (
        <button
          type="button"
          className="absolute right-0 top-0 hidden rounded p-1 text-steel hover:text-ink group-hover:inline-flex"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(value);
            setEditing(true);
          }}
          aria-label={label}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
