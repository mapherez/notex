import { ArchiveRestore, Copy, Folder, MoreVertical, Pin, Star, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Collection, DynamicNote, PreferredLayout, Tag } from '../../core/models/models';
import { sortTagsByName } from '../../core/utils/tagSorting';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useI18n } from '../../i18n/I18nProvider';
import { useDynamicNotesStore } from '../../store/useDynamicNotesStore';
import { useToastStore } from '../../store/useToastStore';
import { NoteThumbnail } from '../ui/NoteThumbnail';
import { TagChip } from '../ui/TagChip';

export function DynamicNoteRow({
  collections,
  layout = 'list',
  note,
  onPermanentDelete,
  tags,
  timeValue,
}: {
  collections: Collection[];
  layout?: PreferredLayout;
  note: DynamicNote;
  onPermanentDelete?: (noteId: string) => void;
  tags: Tag[];
  timeValue?: string | null;
}) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleFavorite = useDynamicNotesStore((state) => state.toggleDynamicFavorite);
  const togglePinned = useDynamicNotesStore((state) => state.toggleDynamicPinned);
  const moveToTrash = useDynamicNotesStore((state) => state.moveDynamicNoteToTrash);
  const restoreNote = useDynamicNotesStore((state) => state.restoreDynamicNote);
  const createDynamicNote = useDynamicNotesStore((state) => state.createDynamicNote);
  const pushToast = useToastStore((state) => state.pushToast);
  const noteTags = sortTagsByName(tags.filter((tag) => note.tagIds.includes(tag.id)));
  const collection = collections.find((item) => item.id === note.collectionId);
  const title = note.title.trim() || t('dynamicNotes.untitled');
  const preview = note.subtitle || note.blocks?.map((block) => [block.title, block.contentText].filter(Boolean).join(' ')).filter(Boolean).join(' ') || t('dynamicNotes.emptyPreview');

  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  async function handleDuplicate() {
    const duplicate = await createDynamicNote({ collectionId: note.collectionId, title: `${title} (${t('common.copy')})` });
    await useDynamicNotesStore.getState().updateDynamicNoteHeader(duplicate.id, {
      subtitle: note.subtitle,
    });
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

  return (
    <article className="note-row dynamic-note-row">
      <Link className="note-row__link-overlay" to={`/notes/${note.id}`} aria-label={`${t('common.open')} ${title}`} />
      <div className="note-row__status-stack">
        <button
          className={note.isPinned ? 'note-row__status-button note-row__pin-indicator is-pinned' : 'note-row__status-button note-row__pin-indicator'}
          type="button"
          aria-label={note.isPinned ? t('common.unpin') : t('common.pin')}
          title={note.isPinned ? t('common.unpin') : t('common.pin')}
          onClick={() => void togglePinned(note.id)}
        >
          <Pin />
        </button>
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
        ) : null}
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
