import clsx from 'clsx';
import type { NoteThumbnail as Thumbnail } from '../../core/models/models';

const thumbnailAssets: Record<Thumbnail['variant'], string> = {
  purple: '/assets/thumb-roadmap.svg',
  paper: '/assets/thumb-product.svg',
  terminal: '/assets/thumb-terminal.svg',
  landscape: '/assets/thumb-japan.svg',
  book: '/assets/thumb-book.svg',
  text: '/assets/thumb-text.svg',
};

export function NoteThumbnail({ thumbnail }: { thumbnail?: Thumbnail }) {
  const variant = thumbnail?.variant ?? 'text';
  return (
    <span className={clsx('note-thumb', variant)} aria-hidden="true">
      <img src={thumbnailAssets[variant]} alt="" />
    </span>
  );
}
