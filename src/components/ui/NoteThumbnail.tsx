import clsx from 'clsx';
import { defaultNoteThumbnailVariant, thumbnailOptions } from '../../config/appSettings';
import type { NoteThumbnail as Thumbnail } from '../../core/models/models';

const thumbnailAssets = Object.fromEntries(thumbnailOptions.map((option) => [option.id, `${import.meta.env.BASE_URL}${option.asset.slice(1)}`])) as Record<Thumbnail['variant'], string>;

export function NoteThumbnail({ thumbnail }: { thumbnail?: Thumbnail }) {
  const variant = thumbnail?.variant ?? defaultNoteThumbnailVariant;
  return (
    <span className={clsx('note-thumb', variant)} aria-hidden="true">
      <img src={thumbnailAssets[variant]} alt="" />
    </span>
  );
}
