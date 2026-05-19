import { Check, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Tag, TagColor } from '../../core/models/models';
import { tagColorOptions } from '../../core/utils/tagColors';
import { useI18n } from '../../i18n/I18nProvider';
import { TagChip } from './TagChip';

type TagDraft = {
  color: TagColor;
  name: string;
};

export function LabelManager({
  getTagHref,
  onCreate,
  onDelete,
  onUpdate,
  tags,
}: {
  getTagHref?: (tag: Tag) => string;
  onCreate: (name: string, color: TagColor) => Promise<void> | void;
  onDelete: (tagId: string) => Promise<void> | void;
  onUpdate: (tagId: string, input: TagDraft) => Promise<void> | void;
  tags: Tag[];
}) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<Record<string, TagDraft>>({});
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<TagColor>('purple');

  useEffect(() => {
    setDrafts(
      tags.reduce<Record<string, TagDraft>>((nextDrafts, tag) => {
        nextDrafts[tag.id] = {
          name: tag.name,
          color: tag.color ?? 'neutral',
        };
        return nextDrafts;
      }, {}),
    );
  }, [tags]);

  function updateDraft(tagId: string, draft: Partial<TagDraft>) {
    setDrafts((current) => ({
      ...current,
      [tagId]: {
        name: current[tagId]?.name ?? '',
        color: current[tagId]?.color ?? 'neutral',
        ...draft,
      },
    }));
  }

  async function createLabel() {
    await onCreate(newName, newColor);
    setNewName('');
    setNewColor('purple');
  }

  return (
    <div className="label-manager">
      <form
        className="label-create-row"
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
        <button type="submit">
          <Plus size={17} />
          {t('common.create')}
        </button>
      </form>

      <div className="label-list">
        {tags.map((tag) => {
          const draft = drafts[tag.id] ?? { name: tag.name, color: tag.color ?? 'neutral' };
          const changed = draft.name !== tag.name || draft.color !== (tag.color ?? 'neutral');
          const chip = <TagChip tag={{ name: draft.name || tag.name, color: draft.color }} />;
          const tagHref = getTagHref?.(tag);

          return (
            <div className="label-row" key={tag.id}>
              {tagHref ? (
                <Link className="label-tag-link" to={tagHref}>
                  {chip}
                </Link>
              ) : (
                chip
              )}
              <input
                aria-label={t('profile.labels.name')}
                value={draft.name}
                onChange={(event) => updateDraft(tag.id, { name: event.target.value })}
              />
              <select aria-label={t('profile.labels.color')} className="select-control" value={draft.color} onChange={(event) => updateDraft(tag.id, { color: event.target.value as TagColor })}>
                {tagColorOptions.map((color) => (
                  <option key={color} value={color}>
                    {t(`tags.colors.${color}`)}
                  </option>
                ))}
              </select>
              <button
                className="icon-button"
                disabled={!changed || !draft.name.trim()}
                type="button"
                aria-label={t('common.save')}
                onClick={() => void onUpdate(tag.id, draft)}
              >
                <Check size={17} />
              </button>
              <button className="icon-button danger" type="button" aria-label={t('common.remove')} onClick={() => void onDelete(tag.id)}>
                <Trash2 size={17} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
