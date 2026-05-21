import { Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { ArchiveRestore, Copy, Folder, MoreVertical, Pin, Star, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import type { Collection, Note, Tag } from '../../core/models/models';
import { sortTagsByName } from '../../core/utils/tagSorting';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { useToastStore } from '../../store/useToastStore';
import { NoteThumbnail } from './NoteThumbnail';
import { TagChip } from './TagChip';

export function NoteRow({
  note,
  tags,
  collections,
  onToggleFavorite,
  actionLabel,
  onAction,
  timeValue,
  selectable = false,
  selected = false,
  onSelectionChange,
}: {
  note: Note;
  tags: Tag[];
  collections: Collection[];
  onToggleFavorite?: (noteId: string) => void;
  actionLabel?: string;
  onAction?: (noteId: string) => void;
  timeValue?: string | null;
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (noteId: string, selected: boolean) => void;
}) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleFavorite = useKnowledgeStore((state) => state.toggleFavorite);
  const togglePinned = useKnowledgeStore((state) => state.togglePinned);
  const moveToTrash = useKnowledgeStore((state) => state.moveToTrash);
  const restoreNote = useKnowledgeStore((state) => state.restoreNote);
  const duplicateNote = useKnowledgeStore((state) => state.duplicateNote);
  const pushToast = useToastStore((state) => state.pushToast);
  const noteTags = sortTagsByName(tags.filter((tag) => note.tagIds.includes(tag.id)));
  const collection = collections.find((item) => item.id === note.collectionId);

  useClickOutside(menuRef, menuOpen, () => setMenuOpen(false));

  async function handleFavorite() {
    await (onToggleFavorite ? onToggleFavorite(note.id) : toggleFavorite(note.id));
    pushToast(t('notes.favoriteChanged'), 'success');
    setMenuOpen(false);
  }

  async function handleTrash() {
    if (onAction) {
      onAction(note.id);
    } else if (note.isTrashed) {
      await restoreNote(note.id);
    } else {
      await moveToTrash(note.id);
    }
    pushToast(t('notes.trashChanged'), 'warning');
    setMenuOpen(false);
  }

  async function handlePin() {
    await togglePinned(note.id);
    pushToast(t('notes.pinChanged'), 'success');
    setMenuOpen(false);
  }

  async function handleDuplicate() {
    await duplicateNote(note.id, `${note.title} (${t('common.copy')})`);
    pushToast(t('notes.duplicated'), 'success');
    setMenuOpen(false);
  }

  return (
    <article className={selectable ? 'note-row selectable' : 'note-row'}>
      {selectable ? (
        <label className="note-select-control">
          <input
            type="checkbox"
            checked={selected}
            aria-label={t('notes.bulk.selectNote', { title: note.title })}
            onChange={(event) => onSelectionChange?.(note.id, event.currentTarget.checked)}
          />
        </label>
      ) : null}
      <Link to={`/notes/${note.id}`} aria-label={`${t('common.open')} ${note.title}`}>
        <NoteThumbnail thumbnail={note.thumbnail} />
      </Link>
      <Link to={`/notes/${note.id}`} className="min-w-0">
        <div className="note-title-line">
          <span className="note-title">{note.title}</span>
          {note.isFavorite ? <Star size={14} fill="currentColor" color="var(--color-warning)" /> : null}
        </div>
        <p className="note-intro">{note.content.intro}</p>
      </Link>
      {collection || noteTags.length ? (
        <div className="note-meta-badges">
          {collection ? (
            <Link className={`collection-chip ${collection.color ?? 'neutral'}`} to={`/notes?collection=${collection.id}`}>
              <Folder size={14} strokeWidth={1.9} />
              <span>{collection.name}</span>
            </Link>
          ) : null}
          {noteTags.length ? (
            <span className="tag-chain">
              {noteTags.map((tag, index) => (
                <span
                  className="tag-chain-item"
                  key={tag.id}
                  style={{
                    zIndex: noteTags.length - index,
                  }}
                >
                  <TagChip tag={tag} color={tag.color} href={`/notes?tag=${tag.id}`} />
                </span>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
      <span className="note-time">{formatDisplayTime(timeValue ?? note.updatedAt, t('common.today'), t('common.yesterday'))}</span>
      <div className="note-row-actions" ref={menuRef}>
        <button
          className="icon-button"
          type="button"
          aria-label={actionLabel ?? t('notes.openMenu')}
          onClick={(event) => {
            event.preventDefault();
            setMenuOpen((value) => !value);
          }}
        >
          <MoreVertical size={18} />
        </button>
        {menuOpen ? (
          <div className="floating-menu note-row-menu">
            <Link to={`/notes/${note.id}`}>{t('common.open')}</Link>
            <button type="button" onClick={() => void handleFavorite()}>
              <Star size={16} />
              {note.isFavorite ? t('common.unfavorite') : t('common.favorite')}
            </button>
            <button type="button" onClick={() => void handlePin()}>
              <Pin size={16} />
              {note.isPinned ? t('common.unpin') : t('common.pin')}
            </button>
            <button type="button" onClick={() => void handleDuplicate()}>
              <Copy size={16} />
              {t('common.duplicate')}
            </button>
            <button type="button" onClick={() => void handleTrash()}>
              {note.isTrashed ? <ArchiveRestore size={16} /> : <Trash2 size={16} />}
              {note.isTrashed ? t('notes.restore') : t('notes.moveToTrash')}
            </button>
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
  const mockDay = value.slice(0, 10);
  const mockTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (mockDay === '2024-05-18') {
    return `${today}, ${mockTime}`;
  }

  if (mockDay === '2024-05-17') {
    return `${yesterday}, ${mockTime}`;
  }

  if (sameDay) {
    return mockTime;
  }

  return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}
