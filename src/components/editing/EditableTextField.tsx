import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { useI18n } from '../../i18n/I18nProvider';

export function EditableTextField({
  className,
  label,
  multiline = false,
  onAccept,
  placeholder,
  readClassName,
  renderValue,
  value,
}: {
  className?: string;
  label: string;
  multiline?: boolean;
  onAccept: (value: string) => Promise<void> | void;
  placeholder?: string;
  readClassName?: string;
  renderValue?: (value: string) => ReactNode;
  value: string;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  function beginEdit() {
    setDraft(value);
    setEditing(true);
  }

  async function acceptEdit() {
    setSaving(true);
    await onAccept(draft);
    setSaving(false);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(value);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className={clsx('editable-field', className)}>
        <div className={clsx('editable-read', readClassName)}>
          {renderValue ? renderValue(value) : <span>{value || placeholder}</span>}
        </div>
        <button className="icon-button editable-icon" type="button" aria-label={`${t('editor.edit')} ${label}`} onClick={beginEdit}>
          <Pencil size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className={clsx('editable-field editing', className)}>
      {multiline ? (
        <textarea
          className="editable-control"
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          value={draft}
        />
      ) : (
        <input
          className="editable-control"
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          type="text"
          value={draft}
        />
      )}
      <div className="editable-actions">
        <button className="icon-button" disabled={saving} type="button" aria-label={t('editor.accept')} onClick={() => void acceptEdit()}>
          <Check size={17} />
        </button>
        <button className="icon-button" disabled={saving} type="button" aria-label={t('common.cancel')} onClick={cancelEdit}>
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
