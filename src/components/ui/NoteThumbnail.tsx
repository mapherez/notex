import clsx from 'clsx';
import type { NoteThumbnail as Thumbnail } from '../../core/models/models';

export function NoteThumbnail({ thumbnail }: { thumbnail?: Thumbnail }) {
  return <span className={clsx('note-thumb', thumbnail?.variant ?? 'text')} aria-hidden="true" />;
}
