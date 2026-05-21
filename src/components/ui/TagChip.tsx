import clsx from 'clsx';
import { Link } from 'react-router-dom';
import type { Tag, TagColor } from '../../core/models/models';

export function TagChip({
  tag,
  color,
  href,
  removable = false,
  onRemove,
}: {
  tag: Pick<Tag, 'id' | 'name' | 'color'> | Pick<Tag, 'name' | 'color'>;
  color?: TagColor;
  href?: string;
  removable?: boolean;
  onRemove?: () => void;
}) {
  const label = <span># {tag.name}</span>;

  if (href && !removable) {
    return (
      <Link className={clsx('tag-chip', color ?? tag.color ?? 'neutral')} to={href}>
        {label}
      </Link>
    );
  }

  return (
    <span className={clsx('tag-chip', color ?? tag.color ?? 'neutral')}>
      {href ? (
        <Link className="tag-chip-link" to={href}>
          {label}
        </Link>
      ) : (
        label
      )}
      {removable ? (
        <button
          className="tag-remove"
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove?.();
          }}
          aria-label={tag.name}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
