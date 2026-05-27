import { Check, Edit3, Hash, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ColorPicker } from '../components/ui/ColorPicker';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { IconBadge } from '../components/ui/IconBadge';
import { SortableTagList } from '../components/ui/SortableTagList';
import { TagChip } from '../components/ui/TagChip';
import { appLimits, defaultNewTagColor } from '../config/appSettings';
import type { Tag, TagColor } from '../core/models/models';
import { sortTagsByFavoriteOrder, sortTagsByName } from '../core/utils/tagSorting';
import { useClickOutside } from '../core/utils/useClickOutside';
import { useKeyboardListNavigation } from '../core/utils/useKeyboardListNavigation';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';

type TagWithCount = Tag & {
  count: number;
};

type TagDraft = {
  color: TagColor;
  name: string;
};

export function TagsPage() {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<TagDraft>({ name: '', color: defaultNewTagColor });
  const [deleteCandidate, setDeleteCandidate] = useState<TagWithCount | null>(null);
  const [favoritePickerOpen, setFavoritePickerOpen] = useState(false);
  const [favoriteQuery, setFavoriteQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<TagColor>(defaultNewTagColor);
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const favoritePickerRef = useRef<HTMLDivElement>(null);
  const favoriteSearchRef = useRef<HTMLInputElement>(null);
  const tags = useKnowledgeStore((state) => state.tags);
  const notes = useKnowledgeStore((state) => state.notes);
  const createTag = useKnowledgeStore((state) => state.createTag);
  const updateTag = useKnowledgeStore((state) => state.updateTag);
  const deleteTag = useKnowledgeStore((state) => state.deleteTag);
  const settings = useAppStore((state) => state.settings);
  const toggleFavoriteTag = useAppStore((state) => state.toggleFavoriteTag);
  const reorderFavoriteTags = useAppStore((state) => state.reorderFavoriteTags);
  const pushToast = useToastStore((state) => state.pushToast);
  const activeNotes = useMemo(() => notes.filter((note) => !note.isTrashed), [notes]);
  const tagsWithCounts = useMemo(
    () =>
      sortTagsByName(tags).map((tag) => ({
        ...tag,
        count: activeNotes.filter((note) => note.tagIds.includes(tag.id)).length,
      })),
    [activeNotes, tags],
  );
  const popularTags = useMemo(
    () =>
      [...tagsWithCounts]
        .filter((tag) => tag.count > 0)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
        .slice(0, appLimits.popularTags),
    [tagsWithCounts],
  );
  const favoriteTags = useMemo(
    () => sortTagsByFavoriteOrder(tags.filter((tag) => settings.favoriteTagIds.includes(tag.id)), settings.favoriteTagIds),
    [settings.favoriteTagIds, tags],
  );
  const remainingFavoriteOptions = useMemo(
    () => sortTagsByName(tags.filter((tag) => !settings.favoriteTagIds.includes(tag.id))),
    [settings.favoriteTagIds, tags],
  );
  const filteredFavoriteOptions = useMemo(
    () =>
      favoriteQuery.trim()
        ? remainingFavoriteOptions.filter((tag) =>
            normalizeSearchValue(tag.name).includes(normalizeSearchValue(favoriteQuery)),
          )
        : remainingFavoriteOptions,
    [favoriteQuery, remainingFavoriteOptions],
  );
  const canAddFavoriteTag = favoriteTags.length < appLimits.favoriteTags;
  const favoritePickerNavigation = useKeyboardListNavigation({
    enabled: favoritePickerOpen,
    itemCount: filteredFavoriteOptions.length,
    onEscape: closeFavoritePicker,
    onSelect: (index) => {
      const tag = filteredFavoriteOptions[index];
      if (tag) {
        void addFavoriteTag(tag.id);
      }
    },
  });

  useClickOutside(favoritePickerRef, favoritePickerOpen, closeFavoritePicker);

  useEffect(() => {
    if (favoritePickerOpen) {
      requestAnimationFrame(() => favoriteSearchRef.current?.focus());
    }
  }, [favoritePickerOpen]);

  useEffect(() => {
    if (editingId) {
      requestAnimationFrame(() => editNameInputRef.current?.focus());
    }
  }, [editingId]);

  function beginEdit(tag: TagWithCount) {
    closeFavoritePicker();
    setEditingId(tag.id);
    setEditingDraft({
      name: tag.name,
      color: tag.color ?? 'neutral',
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(tagId: string) {
    if (!editingDraft.name.trim()) {
      return;
    }

    await updateTag(tagId, editingDraft);
    setEditingId(null);
    pushToast(t('tagsPage.updated'), 'success');
  }

  async function confirmRemoveTag() {
    if (!deleteCandidate) {
      return;
    }

    await deleteTag(deleteCandidate.id);
    if (editingId === deleteCandidate.id) {
      setEditingId(null);
    }
    setDeleteCandidate(null);
    pushToast(t('tagsPage.deleted'), 'warning');
  }

  async function createLabel() {
    const created = await createTag(newName, newColor);
    if (!created) {
      return;
    }

    setNewName('');
    setNewColor(defaultNewTagColor);
    pushToast(t('tagsPage.created'), 'success');
  }

  function closeFavoritePicker() {
    setFavoritePickerOpen(false);
    setFavoriteQuery('');
  }

  async function addFavoriteTag(tagId: string) {
    if (!canAddFavoriteTag) {
      pushToast(
        t('tagsPage.favoriteTagsLimit', {
          count: appLimits.favoriteTags,
        }),
        'warning',
      );
      closeFavoritePicker();
      return;
    }

    await toggleFavoriteTag(tagId);
    closeFavoritePicker();
    pushToast(t('tagsPage.favoriteTagsUpdated'), 'success');
  }

  return (
    <div className="page-content list-page-grid tags-page">
      <header>
        <h1 className="page-title">{t('tagsPage.title')}</h1>
        <p className="page-subtitle">{t('tagsPage.subtitle')}</p>
      </header>

      <div className="tags-layout">
        <section className="tags-main-section" aria-label={t('tagsPage.allTags')}>
          {tagsWithCounts.length ? (
            <div className="tag-grid">
              {tagsWithCounts.map((tag) => {
                const isEditing = editingId === tag.id;
                return (
                  <article className="tag-card" key={tag.id}>
                    {isEditing ? (
                      <form
                        className="tag-edit-form"
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelEdit();
                          }
                        }}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveEdit(tag.id);
                        }}
                      >
                        <IconBadge icon={Hash} color={editingDraft.color} />
                        <input
                          ref={editNameInputRef}
                          aria-label={t('tagsPage.name')}
                          value={editingDraft.name}
                          onChange={(event) => setEditingDraft((draft) => ({ ...draft, name: event.target.value }))}
                        />
                        <ColorPicker
                          ariaLabel={t('tagsPage.color')}
                          onChange={(color) => setEditingDraft((draft) => ({ ...draft, color }))}
                          value={editingDraft.color}
                        />
                        <div className="tag-card-actions">
                          <button className="tag-action-button" disabled={!editingDraft.name.trim()} type="submit">
                            <Check />
                            {t('common.save')}
                          </button>
                          <button className="tag-action-button" type="button" onClick={cancelEdit}>
                            <X />
                            {t('common.cancel')}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="tag-card-header">
                        <Link
                          className="tag-card-link-overlay"
                          to={`/notes?tag=${tag.id}`}
                          aria-label={tag.name}
                        />
                        <div className="tag-card-main">
                          <IconBadge icon={Hash} color={tag.color} />
                          <div>
                            <div className="stat-label">{tag.name}</div>
                            <div className="stat-delta">{formatTagCount(tag.count, t)}</div>
                          </div>
                        </div>
                        <div className="tag-card-actions">
                          <button className="tag-action-button" type="button" aria-label={t('tagsPage.edit')} onClick={() => beginEdit(tag)}>
                            <Edit3 />
                          </button>
                          <button
                            className="tag-action-button danger"
                            type="button"
                            aria-label={t('tagsPage.delete')}
                            onClick={() => setDeleteCandidate(tag)}
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="tags-empty">{t('tagsPage.emptyAll')}</p>
          )}
        </section>

        <aside className="tags-side-panel">
          <form
            className="settings-card tag-create-card"
            onSubmit={(event) => {
              event.preventDefault();
              void createLabel();
            }}
          >
            <h2 className="settings-title">{t('tagsPage.addNewTag')}</h2>
            <input
              aria-label={t('tagsPage.name')}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={t('tagsPage.name')}
            />
            <div className="tag-create-actions">
              <ColorPicker
                ariaLabel={t('tagsPage.color')}
                onChange={setNewColor}
                value={newColor}
              />
              <button disabled={!newName.trim()} type="submit">
                <Plus />
                {t('tagsPage.create')}
              </button>
            </div>
          </form>

          <section className="settings-card tags-quick-access-card">
            <div className="tags-side-card-header">
              <span>
                <h2 className="settings-title">{t('tagsPage.quickAccess')}</h2>
                <span className="tags-section-description">
                  {t('tagsPage.favoriteTagsDescription', {
                    count: appLimits.favoriteTags,
                  })}
                </span>
              </span>
              <div className="tags-favorites-add" ref={favoritePickerRef}>
                <button
                  className="tags-action-button"
                  type="button"
                  aria-disabled={!canAddFavoriteTag}
                  aria-expanded={favoritePickerOpen}
                  aria-haspopup="listbox"
                  onClick={() => {
                    if (!canAddFavoriteTag) {
                      pushToast(
                        t('tagsPage.favoriteTagsLimit', {
                          count: appLimits.favoriteTags,
                        }),
                        'warning',
                      );
                      return;
                    }

                    setFavoritePickerOpen((value) => !value);
                  }}
                >
                  <Plus />
                  {t('common.add')}
                </button>
                {favoritePickerOpen ? (
                  <div className="tags-favorite-picker-menu">
                    <label className="tags-favorite-picker-search">
                      <Search />
                      <input
                        ref={favoriteSearchRef}
                        type="search"
                        value={favoriteQuery}
                        onChange={(event) => setFavoriteQuery(event.target.value)}
                        onKeyDown={favoritePickerNavigation.onKeyDown}
                        placeholder={t('tagsPage.searchFavoriteTags')}
                      />
                    </label>
                    <div className="tags-favorite-picker-options" role="listbox">
                      {filteredFavoriteOptions.length ? (
                        filteredFavoriteOptions.map((tag, index) => (
                          <button
                            className={favoritePickerNavigation.activeIndex === index ? 'active' : undefined}
                            key={tag.id}
                            type="button"
                            role="option"
                            aria-selected={favoritePickerNavigation.activeIndex === index}
                            onClick={() => void addFavoriteTag(tag.id)}
                            onMouseEnter={() => favoritePickerNavigation.setActiveIndex(index)}
                          >
                            <TagChip tag={tag} />
                          </button>
                        ))
                      ) : (
                        <span className="tags-favorite-picker-empty">
                          {t('tagsPage.noFavoriteTagOptions')}
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {favoriteTags.length ? (
              <SortableTagList
                ariaLabel={t('tagsPage.reorderFavoriteTags')}
                className="tag-row"
                getHref={(tag) => `/notes?tag=${tag.id}`}
                onRemove={(tagId) => {
                  void toggleFavoriteTag(tagId).then(() =>
                    pushToast(t('tagsPage.favoriteTagsUpdated'), 'success'),
                  );
                }}
                onReorder={(tagIds) => reorderFavoriteTags(tagIds)}
                removable
                tags={favoriteTags}
              />
            ) : (
              <span className="tags-empty">{t('tagsPage.emptyFavorites')}</span>
            )}
          </section>

          <section className="panel tags-popular-card">
            <div className="panel-header">
              <h2 className="panel-title">{t('tagsPage.popular')}</h2>
            </div>
            <PopularTagList emptyText={t('tagsPage.emptyPopular')} tags={popularTags} />
          </section>
        </aside>
      </div>
      {deleteCandidate ? (
        <DeleteConfirmModal
          cancelLabel={t('common.cancel')}
          confirmLabel={t('common.delete')}
          description={t('tagsPage.deleteConfirm')}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={() => void confirmRemoveTag()}
          title={t('tagsPage.deleteTitle', { name: deleteCandidate.name })}
        />
      ) : null}
    </div>
  );
}

function PopularTagList({
  emptyText,
  tags,
}: {
  emptyText: string;
  tags: TagWithCount[];
}) {
  if (!tags.length) {
    return <p className="tags-empty">{emptyText}</p>;
  }

  return (
    <div className="tag-list">
      {tags.map((tag) => (
        <PopularTagRow key={tag.id} tag={tag} />
      ))}
    </div>
  );
}

function PopularTagRow({ tag }: { tag: TagWithCount }) {
  return (
    <Link className="tag-popular-row" to={`/notes?tag=${tag.id}`}>
      <strong className={`tag-chip ${tag.color ?? 'neutral'}`}># {tag.name}</strong>
      <span>{tag.count}</span>
    </Link>
  );
}

function formatTagCount(count: number, t: ReturnType<typeof useI18n>['t']) {
  return t(count === 1 ? 'tagsPage.noteCountSingular' : 'tagsPage.noteCount', { count });
}

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
