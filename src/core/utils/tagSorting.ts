import type { Tag } from '../models/models';

type TagLike = Pick<Tag, 'id' | 'name'>;

export function sortTagsByName<T extends Pick<Tag, 'name'>>(tags: T[]) {
  return [...tags].sort(compareTagNames);
}

export function sortTagsByFavoriteOrder<T extends TagLike>(tags: T[], favoriteTagIds: string[]) {
  const favoriteOrder = new Map(favoriteTagIds.map((tagId, index) => [tagId, index]));

  return [...tags].sort((a, b) => {
    const aFavoriteIndex = favoriteOrder.get(a.id);
    const bFavoriteIndex = favoriteOrder.get(b.id);
    const aIsFavorite = aFavoriteIndex !== undefined;
    const bIsFavorite = bFavoriteIndex !== undefined;

    if (aIsFavorite && bIsFavorite) {
      return aFavoriteIndex - bFavoriteIndex || compareTagNames(a, b);
    }

    if (aIsFavorite) {
      return -1;
    }

    if (bIsFavorite) {
      return 1;
    }

    return compareTagNames(a, b);
  });
}

function compareTagNames<T extends Pick<Tag, 'name'>>(a: T, b: T) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}
