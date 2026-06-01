import { ArchiveRestore, Copy, Folder, GripVertical, MoreVertical, Pin, Star, Trash2 } from 'lucide-react';
import { useRef, useState, type PointerEventHandler } from 'react';
import { Link } from 'react-router-dom';
import type { Collection, DynamicNote, PreferredLayout, Tag } from '../../core/models/models';
import { richTextToPlainText } from '../../core/utils/richText';
import { sortTagsByName } from '../../core/utils/tagSorting';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppStore } from '../../store/useAppStore';
import { useDynamicNotesStore } from '../../store/useDynamicNotesStore';
import { useToastStore } from '../../store/useToastStore';
import { NoteThumbnail } from '../ui/NoteThumbnail';
import { TagChip } from '../ui/TagChip';

export function DynamicNoteRow({
  collections,
  layout = 'list',
  note,
  onPermanentDelete,
  onPinnedDragPointerDown,
  onPinnedDragPointerEnter,
  onPinnedDragPointerMove,
  onPinnedDragPointerUp,
  onSelectionChange,
  pinnedDragActive = false,
  selectable = false,
  selected = false,
  showPinIndicator = false,
  showPinnedDragHandle = false,
  tags,
  timeValue,
}: {
  collections: Collection[];
  layout?: PreferredLayout;
  note: DynamicNote;
  onPermanentDelete?: (noteId: string) => void;
  onPinnedDragPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onPinnedDragPointerEnter?: PointerEventHandler<HTMLElement>;
  onPinnedDragPointerMove?: PointerEventHandler<HTMLElement>;
  onPinnedDragPointerUp?: PointerEventHandler<HTMLElement>;
  onSelectionChange?: (noteId: string, selected: boolean) => void;
  pinnedDragActive?: boolean;
  selectable?: boolean;
  selected?: boolean;
  showPinIndicator?: boolean;
  showPinnedDragHandle?: boolean;
  tags: Tag[];
  timeValue?: string | null;
}) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleFavorite = useDynamicNotesStore((state) => state.toggleDynamicFavorite);
  const togglePinned = useDynamicNotesStore((state) => state.toggleDynamicPinned);
  const setPinnedNoteState = useAppStore((state) => state.setPinnedNoteState);
  const moveToTrash = useDynamicNotesStore((state) => state.moveDynamicNoteToTrash);
  const restoreNote = useDynamicNotesStore((state) => state.restoreDynamicNote);
  const createDynamicNote = useDynamicNotesStore((state) => state.createDynamicNote);
  const pushToast = useToastStore((state) => state.pushToast);
  const noteTags = sortTagsByName(tags.filter((tag) => note.tagIds.includes(tag.id)));
  const collection = collections.find((item) => item.id === note.collectionId);
  const title = richTextToPlainText(note.title).trim() || t('dynamicNotes.untitled');
  const preview =
    richTextToPlainText(note.subtitle).trim() ||
    note.blocks
      ?.map((block) => [richTextToPlainText(block.title), block.contentText].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(' ') ||
    t('dynamicNotes.emptyPreview');

  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  async function handleDuplicate() {
    const duplicate = await createDynamicNote({ collectionId: note.collectionId, title: `${title} (${t('common.copy')})` });
    const dynamicNotesStore = useDynamicNotesStore.getState();
    await dynamicNotesStore.updateDynamicNoteHeader(duplicate.id, { subtitle: note.subtitle });
    await dynamicNotesStore.updateDynamicNoteTags(duplicate.id, note.tagIds);
    if (note.thumbnail) {
      await dynamicNotesStore.updateDynamicNoteThumbnail(duplicate.id, note.thumbnail);
    }
    for (const block of note.blocks ?? []) {
      await dynamicNotesStore.addDynamicBlock(duplicate.id, {
        contentJson: block.contentJson,
        contentText: block.contentText,
        kind: block.kind,
        title: block.title,
      });
    }
    pushToast(t('notes.duplicated'), 'success');
    setMenuOpen(false);
  }

  async function handleTrash() {
    if (note.isTrashed) {
      await restoreNote(note.id);
    } else {
      await moveToTrash(note.id);
    }
    pushToast(t('notes.trashChanged'), 'warning');
    setMenuOpen(false);
  }

  async function handlePin() {
    await togglePinned(note.id);
    await setPinnedNoteState(note.id, !note.isPinned);
    pushToast(t('notes.pinChanged'), 'success');
    setMenuOpen(false);
  }

  return (
    <article
      className={getNoteRowClassName({
        dragActive: pinnedDragActive,
        dragHandle: showPinnedDragHandle,
        pinIndicator: showPinIndicator,
        selectable,
      })}
      onPointerEnter={onPinnedDragPointerEnter}
      onPointerMove={onPinnedDragPointerMove}
      onPointerUp={onPinnedDragPointerUp}
    >
      <Link className="note-row__link-overlay" to={`/notes/${note.id}`} aria-label={`${t('common.open')} ${title}`} />
      {showPinnedDragHandle ? (
        <button
          className="note-row__drag-handle"
          type="button"
          aria-label={t('notes.reorderPinned')}
          title={t('notes.reorderPinned')}
          onPointerDown={onPinnedDragPointerDown}
        >
          <GripVertical />
        </button>
      ) : null}
      {selectable ? (
        <label className="note-select-control">
          <input
            type="checkbox"
            checked={selected}
            aria-label={t('notes.bulk.selectNote', { title })}
            onChange={(event) => onSelectionChange?.(note.id, event.currentTarget.checked)}
          />
        </label>
      ) : null}
      <div className="note-row__status-stack">
        {showPinIndicator ? (
          <button
            className={note.isPinned ? 'note-row__status-button note-row__pin-indicator is-pinned' : 'note-row__status-button note-row__pin-indicator'}
            type="button"
            aria-label={note.isPinned ? t('common.unpin') : t('common.pin')}
            title={note.isPinned ? t('common.unpin') : t('common.pin')}
            onClick={() => void handlePin()}
          >
            <Pin />
          </button>
        ) : null}
        <button
          className={note.isFavorite ? 'note-row__status-button note-row__favorite-toggle is-favorite' : 'note-row__status-button note-row__favorite-toggle'}
          type="button"
          aria-label={note.isFavorite ? t('common.unfavorite') : t('common.favorite')}
          title={note.isFavorite ? t('common.unfavorite') : t('common.favorite')}
          onClick={() => void toggleFavorite(note.id)}
        >
          <Star />
        </button>
      </div>
      <div className="note-row__thumbnail">
        <NoteThumbnail thumbnail={note.thumbnail} />
      </div>
      <div className="note-row__content">
        <div className="note-row__title-line">
          <span className="note-row__title">{title}</span>
        </div>
        {layout === 'grid' ? (
          <p className="note-row__summary-preview">{preview}</p>
        ) : (
          <p className="note-row__intro">{preview}</p>
        )}
      </div>
      <div className="note-row__badges">
        {collection ? (
          <Link className={`collection-chip ${collection.color ?? 'neutral'}`} to={`/notes?collection=${collection.id}`}>
            <Folder strokeWidth={1.9} />
            <span>{collection.name}</span>
          </Link>
        ) : (
          <Link className="collection-chip neutral collection-chip--empty" to={`/notes/${note.id}`} aria-label={`${t('common.open')} ${title}`}>
            <Folder strokeWidth={1.9} />
            <span>{t('noteDetail.noCollection')}</span>
          </Link>
        )}
        {noteTags.length ? (
          <span className="note-row__tag-chain">
            {noteTags.map((tag) => (
              <span className="note-row__tag-chain-item" key={tag.id}>
                <TagChip tag={tag} color={tag.color} href={`/notes?tag=${tag.id}`} />
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <span className="note-row__time">{formatDisplayTime(timeValue ?? note.updatedAt, t('common.today'), t('common.yesterday'))}</span>
      <div className="note-row-actions" ref={menuRef}>
        <button
          className="icon-button"
          type="button"
          aria-label={t('notes.openMenu')}
          onClick={(event) => {
            event.preventDefault();
            setMenuOpen((value) => !value);
          }}
        >
          <MoreVertical />
        </button>
        {menuOpen ? (
          <div className="floating-menu note-row-menu">
            <Link to={`/notes/${note.id}`}>{t('common.open')}</Link>
            <button type="button" onClick={() => void handleDuplicate()}>
              <Copy />
              {t('common.duplicate')}
            </button>
            <button type="button" onClick={() => void handleTrash()}>
              {note.isTrashed ? <ArchiveRestore /> : <Trash2 />}
              {note.isTrashed ? t('notes.restore') : t('notes.moveToTrash')}
            </button>
            {note.isTrashed && onPermanentDelete ? (
              <button type="button" onClick={() => onPermanentDelete(note.id)}>
                <Trash2 />
                {t('notes.deleteForever')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function getNoteRowClassName({
  dragActive,
  dragHandle,
  pinIndicator,
  selectable,
}: {
  dragActive: boolean;
  dragHandle: boolean;
  pinIndicator: boolean;
  selectable: boolean;
}) {
  return [
    'note-row',
    'dynamic-note-row',
    selectable ? 'selectable' : '',
    pinIndicator ? 'with-pin-indicator' : '',
    dragHandle ? 'with-drag-handle' : '',
    dragActive ? 'is-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function formatDisplayTime(value: string, today: string, yesterday: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const mockTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (sameDay) {
    return mockTime;
  }

  const previousDay = new Date(now);
  previousDay.setDate(now.getDate() - 1);
  if (date.toDateString() === previousDay.toDateString()) {
    return `${yesterday}, ${mockTime}`;
  }

  if (value.slice(0, 10) === now.toISOString().slice(0, 10)) {
    return `${today}, ${mockTime}`;
  }

  return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}
