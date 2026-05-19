import { Tag as TagIcon } from 'lucide-react';
import { LabelManager } from '../components/ui/LabelManager';
import { useI18n } from '../i18n/I18nProvider';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';

export function TagsPage() {
  const { t } = useI18n();
  const tags = useKnowledgeStore((state) => state.tags);
  const notes = useKnowledgeStore((state) => state.notes);
  const createTag = useKnowledgeStore((state) => state.createTag);
  const updateTag = useKnowledgeStore((state) => state.updateTag);
  const deleteTag = useKnowledgeStore((state) => state.deleteTag);
  const pushToast = useToastStore((state) => state.pushToast);
  const tagsWithCounts = tags.map((tag) => ({
    ...tag,
    count: notes.filter((note) => !note.isTrashed && note.tagIds.includes(tag.id)).length,
  }));

  return (
    <div className="page-content list-page-grid">
      <header>
        <h1 className="page-title">{t('tagsPage.title')}</h1>
        <p className="page-subtitle">{t('tagsPage.subtitle')}</p>
      </header>

      <section className="settings-card">
        <h2 className="settings-title">
          <TagIcon size={20} color="var(--color-accent-strong)" />
          {t('tagsPage.managerTitle')}
        </h2>
        <p className="settings-description mb-4">{t('tagsPage.description')}</p>
        <LabelManager
          tags={tagsWithCounts}
          onCreate={async (name, color) => {
            const created = await createTag(name, color);
            if (created) {
              pushToast(t('profile.labels.created'), 'success');
            }
          }}
          onUpdate={async (tagId, input) => {
            await updateTag(tagId, input);
            pushToast(t('profile.labels.updated'), 'success');
          }}
          onDelete={async (tagId) => {
            if (!window.confirm(t('profile.labels.deleteConfirm'))) {
              return;
            }
            await deleteTag(tagId);
            pushToast(t('profile.labels.deleted'), 'warning');
          }}
        />
      </section>
    </div>
  );
}
