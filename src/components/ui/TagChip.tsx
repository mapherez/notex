import clsx from 'clsx';
import type { Tag, TagColor } from '../../core/models/models';

export function TagChip({
  tag,
  color,
  removable = false,
  onRemove,
}: {
  tag: Pick<Tag, 'name' | 'color'>;
  color?: TagColor;
  removable?: boolean;
  onRemove?: () => void;
}) {
  return (
    <span className={clsx('tag-chip', color ?? tag.color ?? 'neutral')}>
      <span># {tag.name}</span>
      {removable ? (
        <button className="tag-remove" type="button" onClick={onRemove} aria-label={tag.name}>
          ×
        </button>
      ) : null}
    </span>
  );
}
