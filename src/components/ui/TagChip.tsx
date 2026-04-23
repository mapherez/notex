import clsx from 'clsx';
import type { Tag, TagColor } from '../../core/models/models';

export function TagChip({
  tag,
  color,
  removable = false,
}: {
  tag: Pick<Tag, 'name' | 'color'>;
  color?: TagColor;
  removable?: boolean;
}) {
  return (
    <span className={clsx('tag-chip', color ?? tag.color ?? 'neutral')}>
      <span># {tag.name}</span>
      {removable ? <span aria-hidden="true">×</span> : null}
    </span>
  );
}
