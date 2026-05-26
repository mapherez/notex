import { Trash2, X } from 'lucide-react';

export function DeleteConfirmModal({
  cancelLabel,
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  title,
}: {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <div className="modal-backdrop">
      <section className="choice-modal delete-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
        <h2 id="delete-confirm-title">{title}</h2>
        <p>{description}</p>
        <div className="choice-modal-actions two-column-actions">
          <button type="button" onClick={onCancel}>
            <X />
            <span>{cancelLabel}</span>
          </button>
          <button type="button" onClick={onConfirm}>
            <Trash2 />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
