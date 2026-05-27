import { Link } from 'react-router-dom';
import { useRef, useState, type PointerEventHandler } from 'react';
import { ArchiveRestore, Copy, Folder, GripVertical, MoreVertical, Pin, Star, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { InlineFormattedText } from '../editing/InlineFormattedText';
import type { Collection, Note, Tag } from '../../core/models/models';
import { stripInlineFormatting } from '../../core/utils/inlineFormatting';
import { sortTagsByName } from '../../core/utils/tagSorting';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useAppStore } from '../../store/useAppStore';
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
  onPermanentDelete,
  timeValue,
  selectable = false,
  selected = false,
  onSelectionChange,
  showPinIndicator = false,
  showPinnedDragHandle = false,
  pinnedDragActive = false,
  onPinnedDragPointerDown,
  onPinnedDragPointerEnter,
  onPinnedDragPointerMove,
  onPinnedDragPointerUp,
}: {
  note: Note;
  tags: Tag[];
  collections: Collection[];
  onToggleFavorite?: (noteId: string) => void;
  actionLabel?: string;
  onAction?: (noteId: string) => void;
  onPermanentDelete?: (noteId: string) => void;
  timeValue?: string | null;
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (noteId: string, selected: boolean) => void;
  showPinIndicator?: boolean;
  showPinnedDragHandle?: boolean;
  pinnedDragActive?: boolean;
  onPinnedDragPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onPinnedDragPointerEnter?: PointerEventHandler<HTMLElement>;
  onPinnedDragPointerMove?: PointerEventHandler<HTMLElement>;
  onPinnedDragPointerUp?: PointerEventHandler<HTMLElement>;
}) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleFavorite = useKnowledgeStore((state) => state.toggleFavorite);
  const togglePinned = useKnowledgeStore((state) => state.togglePinned);
  const setPinnedNoteState = useAppStore((state) => state.setPinnedNoteState);
  const moveToTrash = useKnowledgeStore((state) => state.moveToTrash);
  const restoreNote = useKnowledgeStore((state) => state.restoreNote);
  const duplicateNote = useKnowledgeStore((state) => state.duplicateNote);
  const pushToast = useToastStore((state) => state.pushToast);
  const noteTags = sortTagsByName(tags.filter((tag) => note.tagIds.includes(tag.id)));
  const collection = collections.find((item) => item.id === note.collectionId);
  const plainTitle = stripInlineFormatting(note.title);

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

  function handlePermanentDelete() {
    onPermanentDelete?.(note.id);
    setMenuOpen(false);
  }

  async function handlePin() {
    await togglePinned(note.id);
    await setPinnedNoteState(note.id, !note.isPinned);
    pushToast(t('notes.pinChanged'), 'success');
    setMenuOpen(false);
  }

  async function handleDuplicate() {
    await duplicateNote(note.id, `${plainTitle} (${t('common.copy')})`);
    pushToast(t('notes.duplicated'), 'success');
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
      <Link
        className="note-row__link-overlay"
        to={`/notes/${note.id}`}
        aria-label={`${t("common.open")} ${plainTitle}`}
      />
      {showPinnedDragHandle ? (
        <button
          className="note-row__drag-handle"
          type="button"
          aria-label={t("notes.reorderPinned")}
          title={t("notes.reorderPinned")}
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
            aria-label={t("notes.bulk.selectNote", { title: plainTitle })}
            onChange={(event) =>
              onSelectionChange?.(note.id, event.currentTarget.checked)
            }
          />
        </label>
      ) : null}
      <div className="note-row__status-stack">
        {showPinIndicator ? (
          <button
            className={
              note.isPinned
                ? "note-row__status-button note-row__pin-indicator is-pinned"
                : "note-row__status-button note-row__pin-indicator"
            }
            type="button"
            aria-label={note.isPinned ? t("common.unpin") : t("common.pin")}
            title={note.isPinned ? t("common.unpin") : t("common.pin")}
            onClick={() => void handlePin()}
          >
            <Pin />
          </button>
        ) : null}
        <button
          className={
            note.isFavorite
              ? "note-row__status-button note-row__favorite-toggle is-favorite"
              : "note-row__status-button note-row__favorite-toggle"
          }
          type="button"
          aria-label={
            note.isFavorite ? t("common.unfavorite") : t("common.favorite")
          }
          title={note.isFavorite ? t("common.unfavorite") : t("common.favorite")}
          onClick={() => void handleFavorite()}
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
            <InlineFormattedText value={note.title} />
          </span>
        </div>
        <p className="note-row__intro">
          <InlineFormattedText value={note.content.intro} />
        </p>
      </div>
      <div className="note-row__badges">
        {collection ? (
          <Link
            className={`collection-chip ${collection.color ?? "neutral"}`}
            to={`/notes?collection=${collection.id}`}
          >
            <Folder strokeWidth={1.9} />
            <span>{collection.name}</span>
          </Link>
        ) : (
          <Link
            className="collection-chip neutral collection-chip--empty"
            to={`/notes/${note.id}`}
            aria-label={`${t("common.open")} ${plainTitle}`}
          >
            <Folder strokeWidth={1.9} />
            <span>{t("noteDetail.noCollection")}</span>
          </Link>
        )}
        {noteTags.length ? (
          <span className="note-row__tag-chain">
            {noteTags.map((tag) => (
              <span className="note-row__tag-chain-item" key={tag.id}>
                <TagChip
                  tag={tag}
                  color={tag.color}
                  href={`/notes?tag=${tag.id}`}
                />
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <span className="note-row__time">
        {formatDisplayTime(
          timeValue ?? note.updatedAt,
          t("common.today"),
          t("common.yesterday"),
        )}
      </span>
      <div className="note-row-actions" ref={menuRef}>
        <button
          className="icon-button"
          type="button"
          aria-label={actionLabel ?? t("notes.openMenu")}
          onClick={(event) => {
            event.preventDefault();
            setMenuOpen((value) => !value);
          }}
        >
          <MoreVertical />
        </button>
        {menuOpen ? (
          <div className="floating-menu note-row-menu">
            <Link to={`/notes/${note.id}`}>{t("common.open")}</Link>
            <button type="button" onClick={() => void handleDuplicate()}>
              <Copy />
              {t("common.duplicate")}
            </button>
            <button type="button" onClick={() => void handleTrash()}>
              {note.isTrashed ? <ArchiveRestore /> : <Trash2 />}
              {note.isTrashed ? t("notes.restore") : t("notes.moveToTrash")}
            </button>
            {note.isTrashed && onPermanentDelete ? (
              <button type="button" onClick={handlePermanentDelete}>
                <Trash2 />
                {t("notes.deleteForever")}
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
