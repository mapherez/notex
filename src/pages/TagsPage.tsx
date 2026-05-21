import { Edit3, Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TagChip } from '../components/ui/TagChip';
import type { Tag, TagColor } from '../core/models/models';
import { tagColorOptions } from '../core/utils/tagColors';
import { sortTagsByName } from '../core/utils/tagSorting';
import { useI18n } from '../i18n/I18nProvider';
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
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, TagDraft>>({});
  const [deletedTagIds, setDeletedTagIds] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<TagColor>('purple');
  const tags = useKnowledgeStore((state) => state.tags);
  const notes = useKnowledgeStore((state) => state.notes);
  const createTag = useKnowledgeStore((state) => state.createTag);
  const updateTag = useKnowledgeStore((state) => state.updateTag);
  const deleteTag = useKnowledgeStore((state) => state.deleteTag);
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
        .slice(0, 5),
    [tagsWithCounts],
  );
  const visibleEditTags = tagsWithCounts.filter((tag) => !deletedTagIds.has(tag.id));
  const hasInvalidDraft = visibleEditTags.some((tag) => !getDraftForTag(tag, drafts).name.trim());
  const hasDraftChanges =
    deletedTagIds.size > 0 ||
    tagsWithCounts.some((tag) => {
      const draft = drafts[tag.id];
      return draft ? draft.name !== tag.name || draft.color !== (tag.color ?? 'neutral') : false;
    });

  useEffect(() => {
    if (!editing) {
      return;
    }

    setDrafts(buildDrafts(tagsWithCounts));
    setDeletedTagIds(new Set());
  }, [editing, tagsWithCounts]);

  function beginEdit() {
    setCreateOpen(false);
    setDrafts(buildDrafts(tagsWithCounts));
    setDeletedTagIds(new Set());
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDrafts({});
    setDeletedTagIds(new Set());
  }

  function updateDraft(tagId: string, input: Partial<TagDraft>) {
    setDrafts((current) => ({
      ...current,
      [tagId]: {
        ...getDraftForTag(tagsWithCounts.find((tag) => tag.id === tagId), current),
        ...input,
      },
    }));
  }

  function markDeleted(tagId: string) {
    if (!window.confirm(t('profile.labels.deleteConfirm'))) {
      return;
    }

    setDeletedTagIds((current) => new Set(current).add(tagId));
  }

  async function createLabel() {
    const created = await createTag(newName, newColor);
    if (!created) {
      return;
    }

    setNewName('');
    setNewColor('purple');
    pushToast(t('profile.labels.created'), 'success');
  }

  async function saveEdits() {
    if (hasInvalidDraft) {
      return;
    }

    for (const tagId of deletedTagIds) {
      await deleteTag(tagId);
    }

    for (const tag of tagsWithCounts) {
      if (deletedTagIds.has(tag.id)) {
        continue;
      }

      const draft = drafts[tag.id];
      if (!draft || (draft.name === tag.name && draft.color === (tag.color ?? 'neutral'))) {
        continue;
      }

      await updateTag(tag.id, draft);
    }

    setEditing(false);
    setDrafts({});
    setDeletedTagIds(new Set());
    pushToast(t('tagsPage.saved'), 'success');
  }

  return (
    <div className="page-content list-page-grid">
      <header>
        <h1 className="page-title">{t('tagsPage.title')}</h1>
        <p className="page-subtitle">{t('tagsPage.subtitle')}</p>
      </header>

      <section className="tags-page-section">
        <h2 className="tags-section-title">{t('tagsPage.popular')}</h2>
        <TagSummaryGrid emptyText={t('tagsPage.emptyPopular')} tags={popularTags} t={t} />
      </section>

      <section className="tags-page-section">
        <div className={editing ? 'tags-action-row editing' : 'tags-action-row'}>
          {editing ? (
            <div className="tags-edit-actions">
              <button
                className="tags-action-button primary"
                disabled={!hasDraftChanges || hasInvalidDraft}
                type="button"
                onClick={() => void saveEdits()}
              >
                <Save size={17} />
                {t('common.save')}
              </button>
              <button className="tags-action-button" type="button" onClick={cancelEdit}>
                <X size={17} />
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <>
              <button className="tags-action-button primary" type="button" onClick={() => setCreateOpen((value) => !value)}>
                <Plus size={17} />
                {t('tagsPage.newTag')}
              </button>
              <button className="tags-action-button" type="button" onClick={beginEdit}>
                <Edit3 size={17} />
                {t('tagsPage.edit')}
              </button>
            </>
          )}
        </div>

        {createOpen && !editing ? (
          <form
            className="label-create-row tags-create-row"
            onSubmit={(event) => {
              event.preventDefault();
              void createLabel();
            }}
          >
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={t('profile.labels.newPlaceholder')} />
            <select className="select-control" value={newColor} onChange={(event) => setNewColor(event.target.value as TagColor)}>
              {tagColorOptions.map((color) => (
                <option key={color} value={color}>
                  {t(`tags.colors.${color}`)}
                </option>
              ))}
            </select>
            <button disabled={!newName.trim()} type="submit">
              <Plus size={17} />
              {t('common.create')}
            </button>
          </form>
        ) : null}
      </section>

      <section className="tags-page-section">
        <h2 className="tags-section-title">{t('tagsPage.allTags')}</h2>
        {editing ? (
          <div className="tags-edit-list">
            {visibleEditTags.map((tag) => {
              const draft = getDraftForTag(tag, drafts);
              return (
                <div className="tag-edit-row" key={tag.id}>
                  <TagChip tag={{ name: draft.name || tag.name, color: draft.color }} />
                  <input
                    aria-label={t('profile.labels.name')}
                    value={draft.name}
                    onChange={(event) => updateDraft(tag.id, { name: event.target.value })}
                  />
                  <select
                    aria-label={t('profile.labels.color')}
                    className="select-control"
                    value={draft.color}
                    onChange={(event) => updateDraft(tag.id, { color: event.target.value as TagColor })}
                  >
                    {tagColorOptions.map((color) => (
                      <option key={color} value={color}>
                        {t(`tags.colors.${color}`)}
                      </option>
                    ))}
                  </select>
                  <button className="icon-button danger" type="button" aria-label={t('common.remove')} onClick={() => markDeleted(tag.id)}>
                    <Trash2 size={17} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <TagSummaryGrid emptyText={t('tagsPage.emptyAll')} tags={tagsWithCounts} t={t} />
        )}
      </section>
    </div>
  );
}

function TagSummaryGrid({
  emptyText,
  tags,
  t,
}: {
  emptyText: string;
  tags: TagWithCount[];
  t: ReturnType<typeof useI18n>['t'];
}) {
  if (!tags.length) {
    return <p className="tags-empty">{emptyText}</p>;
  }

  return (
    <div className="tags-chip-grid">
      {tags.map((tag) => (
        <Link className="tag-summary-card" key={tag.id} to={`/notes?tag=${tag.id}`}>
          <TagChip tag={tag} />
          <span>{formatTagCount(tag.count, t)}</span>
        </Link>
      ))}
    </div>
  );
}

function buildDrafts(tags: TagWithCount[]) {
  return tags.reduce<Record<string, TagDraft>>((nextDrafts, tag) => {
    nextDrafts[tag.id] = {
      color: tag.color ?? 'neutral',
      name: tag.name,
    };
    return nextDrafts;
  }, {});
}

function getDraftForTag(tag: TagWithCount | undefined, drafts: Record<string, TagDraft>) {
  if (!tag) {
    return { color: 'neutral' as TagColor, name: '' };
  }

  return drafts[tag.id] ?? { color: tag.color ?? 'neutral', name: tag.name };
}

function formatTagCount(count: number, t: ReturnType<typeof useI18n>['t']) {
  return t(count === 1 ? 'tagsPage.noteCountSingular' : 'tagsPage.noteCount', { count });
}
