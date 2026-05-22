import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UsageExample } from '../../core/models/models';
import { useI18n } from '../../i18n/I18nProvider';

const emptyRow = (): UsageExample => ({
  id: `usage-${crypto.randomUUID()}`,
  expression: '',
  meaning: '',
  example: '',
});

export function EditableUsageExamplesTable({
  controlledEditing = false,
  onRowsChange,
  onSave,
  readOnly = false,
  rows,
}: {
  controlledEditing?: boolean;
  onRowsChange?: (rows: UsageExample[]) => void;
  onSave?: (rows: UsageExample[]) => Promise<void> | void;
  readOnly?: boolean;
  rows: UsageExample[];
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draftRows, setDraftRows] = useState<UsageExample[]>(rows);
  const [saving, setSaving] = useState(false);
  const isEditing = controlledEditing || editing;
  const editableRows = controlledEditing ? rows : draftRows;

  useEffect(() => {
    if (!controlledEditing && !editing) {
      setDraftRows(rows);
    }
  }, [controlledEditing, editing, rows]);

  function beginEdit() {
    setDraftRows(rows.length ? rows : [emptyRow()]);
    setEditing(true);
  }

  function cancel() {
    setDraftRows(rows);
    setEditing(false);
  }

  function updateDraftRow(rowId: string, input: Partial<Omit<UsageExample, 'id'>>) {
    if (controlledEditing) {
      onRowsChange?.(rows.map((row) => (row.id === rowId ? { ...row, ...input } : row)));
      return;
    }

    setDraftRows((currentRows) => currentRows.map((row) => (row.id === rowId ? { ...row, ...input } : row)));
  }

  function addDraftRow() {
    if (controlledEditing) {
      onRowsChange?.([...rows, emptyRow()]);
      return;
    }

    setDraftRows((currentRows) => [...currentRows, emptyRow()]);
  }

  function deleteDraftRow(rowId: string) {
    if (controlledEditing) {
      onRowsChange?.(rows.filter((row) => row.id !== rowId));
      return;
    }

    setDraftRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
  }

  async function save() {
    if (!onSave) {
      return;
    }

    setSaving(true);
    await onSave(draftRows);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="usage-editor-shell">
      <table className={isEditing ? 'usage-table editable-usage-table editing' : 'usage-table editable-usage-table'}>
        <thead>
          <tr>
            <th>{t('noteDetail.table.expression')}</th>
            <th>{t('noteDetail.table.meaning')}</th>
            <th>{t('noteDetail.table.example')}</th>
            {isEditing ? <th aria-label={t('noteDetail.table.actions')} /> : null}
          </tr>
        </thead>
        <tbody>
          {isEditing ? (
            editableRows.map((row) => (
              <tr className="usage-edit-row" key={row.id}>
                <td>
                  <textarea
                    value={row.expression}
                    onChange={(event) => updateDraftRow(row.id, { expression: event.target.value })}
                    placeholder={t('noteDetail.table.expressionPlaceholder')}
                  />
                </td>
                <td>
                  <textarea value={row.meaning} onChange={(event) => updateDraftRow(row.id, { meaning: event.target.value })} placeholder={t('noteDetail.table.meaningPlaceholder')} />
                </td>
                <td>
                  <textarea value={row.example} onChange={(event) => updateDraftRow(row.id, { example: event.target.value })} placeholder={t('noteDetail.table.examplePlaceholder')} />
                </td>
                <td className="usage-actions-cell">
                  <button className="icon-button danger" type="button" aria-label={t('common.remove')} onClick={() => deleteDraftRow(row.id)}>
                    <Trash2 />
                  </button>
                </td>
              </tr>
            ))
          ) : rows.length ? (
            rows.map((row) => (
              <tr key={row.id}>
                <td>{row.expression}</td>
                <td>{row.meaning}</td>
                <td>
                  {row.example.split('\n').map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3}>{t('noteDetail.emptyUsageExamples')}</td>
            </tr>
          )}
        </tbody>
      </table>

      {isEditing ? (
        <div className="usage-editor-actions">
          <button className="usage-add-row-button" type="button" onClick={addDraftRow}>
            <Plus />
            {t('noteDetail.addUsageRow')}
          </button>
          {!controlledEditing ? (
            <>
              <span className="usage-editor-spacer" />
              <button className="editor-accept-button" disabled={saving} type="button" onClick={() => void save()}>
                <Check />
                {t('editor.accept')}
              </button>
              <button className="editor-cancel-button" disabled={saving} type="button" onClick={cancel}>
                <X />
                {t('common.cancel')}
              </button>
            </>
          ) : null}
        </div>
      ) : readOnly ? null : (
        <button className="usage-add-row-button" type="button" onClick={beginEdit}>
          <Pencil />
          {t('noteDetail.editUsageTable')}
        </button>
      )}
    </div>
  );
}

