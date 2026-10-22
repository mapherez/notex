import { Edit3, MoreVertical, Pin, PinOff, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useFloatingPopover } from '../../core/utils/useFloatingPopover';
import { useMenuOptionFocus } from '../../core/utils/useMenuOptionFocus';
import { useI18n } from '../../i18n/I18nProvider';
import { useToastStore } from '../../store/useToastStore';

export function KnowledgeActionsMenu({ name, pinned, onPin, onEdit, onDelete }: {
  name: string;
  pinned: boolean;
  onPin: () => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const menu = useMenuOptionFocus(open, () => setOpen(false));
  useClickOutside(rootRef, open, () => setOpen(false));
  useFloatingPopover(open, menu.triggerRef, menu.menuRef, 'bottom-end');

  async function pin() {
    menu.closeAndFocus();
    setSaving(true);
    try { await onPin(); }
    catch { useToastStore.getState().pushToast(t('quickAccess.saveFailed'), 'warning'); }
    finally { setSaving(false); }
  }

  return (
    <div className="knowledge-actions" ref={rootRef} onKeyDown={(event) => {
      menu.onKeyDown(event);
      if (open) event.stopPropagation();
    }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button
        className="icon-button knowledge-actions-trigger"
        type="button"
        ref={menu.triggerRef}
        aria-label={t('quickAccess.actions', { name })}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-disabled={saving || undefined}
        onKeyDown={(event) => {
          if (!saving && !open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onClick={() => { if (!saving) setOpen((value) => !value); }}
      >
        <MoreVertical />
      </button>
      {open && (
        <div className="floating-menu responsive-popover knowledge-actions-menu" ref={menu.menuRef} id={id} role="menu" aria-label={t('quickAccess.actions', { name })}>
          <button type="button" role="menuitem" tabIndex={-1} onClick={() => void pin()}>
            {pinned ? <PinOff /> : <Pin />}
            {t(pinned ? 'common.unpin' : 'common.pin')}
          </button>
          <button type="button" role="menuitem" tabIndex={-1} onClick={() => { menu.closeAndFocus(); onEdit(); }}>
            <Edit3 />{t('collections.edit')}
          </button>
          <button className="knowledge-actions-delete" type="button" role="menuitem" tabIndex={-1} onClick={() => { menu.closeAndFocus(); onDelete(); }}>
            <Trash2 />{t('common.delete')}
          </button>
        </div>
      )}
    </div>
  );
}
