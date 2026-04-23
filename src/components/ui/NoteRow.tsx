import { Link } from 'react-router-dom';
import { MoreVertical, Star } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import type { Collection, Note, Tag } from '../../core/models/models';
import { NoteThumbnail } from './NoteThumbnail';
import { TagChip } from './TagChip';

export function NoteRow({
  note,
  tags,
  collections,
  onToggleFavorite,
  actionLabel,
  onAction,
}: {
  note: Note;
  tags: Tag[];
  collections: Collection[];
  onToggleFavorite?: (noteId: string) => void;
  actionLabel?: string;
  onAction?: (noteId: string) => void;
}) {
  const { t } = useI18n();
  const primaryTag = tags.find((tag) => note.tagIds.includes(tag.id));
  const collection = collections.find((item) => item.id === note.collectionId);

  return (
    <article className="note-row">
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
      {primaryTag ? <TagChip tag={primaryTag} color={primaryTag.color} /> : collection ? <TagChip tag={collection} /> : null}
      <span className="note-time">{formatDisplayTime(note.updatedAt)}</span>
      <button
        className="icon-button"
        type="button"
        aria-label={actionLabel ?? t('common.more')}
        onClick={(event) => {
          event.preventDefault();
          if (onAction) {
            onAction(note.id);
            return;
          }
          onToggleFavorite?.(note.id);
        }}
      >
        <MoreVertical size={18} />
      </button>
    </article>
  );
}

function formatDisplayTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}
