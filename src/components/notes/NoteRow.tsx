import { ArchiveRestore, Copy, Folder, GripVertical, MoreVertical, Pin, Star, Trash2 } from 'lucide-react';
import { useRef, useState, type PointerEventHandler } from 'react';
import { Link } from 'react-router-dom';
import type { Collection, Note, PreferredLayout, Tag } from '../../core/models/models';
import { richTextToPlainText } from '../../core/utils/richText';
import { sortTagsByName } from '../../core/utils/tagSorting';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppStore } from '../../store/useAppStore';
import { useNotesStore } from '../../store/useNotesStore';
import { useToastStore } from '../../store/useToastStore';
import { InlineFormattedText } from '../editing/InlineFormattedText';
import { NoteThumbnail } from '../ui/NoteThumbnail';
import { TagChip } from '../ui/TagChip';

export function NoteRow({
  collections,
  layout = 'list',
  note,
  onPermanentDelete,
  onPinnedDragPointerDown,
  onSelectionChange,
  pinnedDragActive = false,
  pinnedDragEnabled = false,
  selectable = false,
  selected = false,
  showPinIndicator = false,
  showPinnedDragHandle = false,
  tags,
  timeValue,
}: {
  collections: Collection[];
  layout?: PreferredLayout;
  note: Note;
  onPermanentDelete?: (noteId: string) => void;
  onPinnedDragPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onSelectionChange?: (noteId: string, selected: boolean) => void;
  pinnedDragActive?: boolean;
  pinnedDragEnabled?: boolean;
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
  const toggleFavorite = useNotesStore((state) => state.toggleFavorite);
  const togglePinned = useNotesStore((state) => state.togglePinned);
  const setPinnedNoteState = useAppStore((state) => state.setPinnedNoteState);
  const moveToTrash = useNotesStore((state) => state.moveNoteToTrash);
  const restoreNote = useNotesStore((state) => state.restoreNote);
  const createNote = useNotesStore((state) => state.createNote);
  const pushToast = useToastStore((state) => state.pushToast);
  const noteTags = sortTagsByName(tags.filter((tag) => note.tagIds.includes(tag.id)));
  const collection = collections.find((item) => item.id === note.collectionId);
  const titlePlain = richTextToPlainText(note.title).trim();
  const title = titlePlain || t('notes.untitled');
  const subtitlePlain = richTextToPlainText(note.subtitle).trim();

  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  async function handleDuplicate() {
    const duplicate = await createNote({ collectionId: note.collectionId, title: `${title} (${t('common.copy')})` });
    const notesStore = useNotesStore.getState();
    await notesStore.updateNoteHeader(duplicate.id, { subtitle: note.subtitle });
    await notesStore.updateNoteTags(duplicate.id, note.tagIds);
    if (note.thumbnail) {
      await notesStore.updateNoteThumbnail(duplicate.id, note.thumbnail);
    }
    for (const block of note.blocks ?? []) {
      await notesStore.addBlock(duplicate.id, {
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
      data-note-id={note.id}
    >
      <Link className="note-row__link-overlay" to={`/notes/${note.id}`} aria-label={`${t('common.open')} ${title}`} />
      {showPinnedDragHandle ? (
        <button
          className={pinnedDragEnabled ? 'note-row__drag-handle' : 'note-row__drag-handle is-disabled'}
          type="button"
          aria-label={t('notes.reorderPinned')}
          disabled={!pinnedDragEnabled}
          title={t('notes.reorderPinned')}
          onPointerDown={pinnedDragEnabled ? onPinnedDragPointerDown : undefined}
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
          <span className="note-row__title">
            {titlePlain ? <InlineFormattedText value={note.title} /> : title}
          </span>
        </div>
        {subtitlePlain ? (
          layout === 'grid' ? (
            <p className="note-row__summary-preview">
              <InlineFormattedText value={note.subtitle} />
            </p>
          ) : (
            <p className="note-row__intro">
              <InlineFormattedText value={note.subtitle} />
            </p>
          )
        ) : null}
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
  if (Number.isNaN(date.getTime())) {
    return value;
  }

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
