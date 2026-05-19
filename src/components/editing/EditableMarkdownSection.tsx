import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownPreview } from './MarkdownPreview';

export function EditableMarkdownSection({
  emptyText,
  label,
  onAccept,
  placeholder,
  title,
  value,
}: {
  emptyText: string;
  label: string;
  onAccept: (value: string) => Promise<void> | void;
  placeholder?: string;
  title: string;
  value: string;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <section className="content-section editable-markdown-section editing">
        <h2 className="section-title">{title}</h2>
        <MarkdownEditor
          label={label}
          onAccept={async (nextValue) => {
            await onAccept(nextValue);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          placeholder={placeholder}
          value={value}
        />
      </section>
    );
  }

  return (
    <section className="content-section editable-markdown-section">
      <div className="section-edit-header">
        <h2 className="section-title">{title}</h2>
        <button className="icon-button editable-icon" type="button" aria-label={`${t('editor.edit')} ${label}`} onClick={() => setEditing(true)}>
          <Pencil size={16} />
        </button>
      </div>
      <MarkdownPreview emptyText={emptyText} value={value} />
    </section>
  );
}
