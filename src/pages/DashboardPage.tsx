import { ArrowRight, CheckSquare, FileText, Folder, Image, List, Mic, Sparkles, Star, Tag, Timer } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { IconBadge } from '../components/ui/IconBadge';
import { NoteRow } from '../components/ui/NoteRow';
import { Panel } from '../components/ui/Panel';
import { useI18n } from '../i18n/I18nProvider';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import type { Tag as TagModel, TagColor } from '../core/models/models';

type CaptureForm = {
  capture: string;
};

export function DashboardPage() {
  const { t } = useI18n();
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const activities = useKnowledgeStore((state) => state.activities);
  const createQuickNote = useKnowledgeStore((state) => state.createQuickNote);
  const toggleFavorite = useKnowledgeStore((state) => state.toggleFavorite);
  const { register, handleSubmit, reset } = useForm<CaptureForm>();

  const activeNotes = notes.filter((note) => !note.isTrashed);
  const recentNotes = activeNotes.slice(0, 5);
  const favoriteCount = activeNotes.filter((note) => note.isFavorite).length;

  const stats = [
    { label: t('dashboard.stats.notes'), value: activeNotes.length, delta: t('dashboard.stats.notesDelta'), icon: FileText, color: 'blue' },
    { label: t('dashboard.stats.favorites'), value: favoriteCount, delta: t('dashboard.stats.favoritesDelta'), icon: Star, color: 'amber' },
    { label: t('dashboard.stats.collections'), value: collections.length, delta: t('dashboard.stats.collectionsDelta'), icon: Folder, color: 'green' },
    { label: t('dashboard.stats.tags'), value: tags.length, delta: t('dashboard.stats.tagsDelta'), icon: Tag, color: 'purple' },
  ] as const;

  return (
    <div className="page-content">
      <div className="dashboard-layout">
        <section className="dashboard-main">
          <header>
            <h1 className="page-title">{t('dashboard.greeting')}</h1>
            <p className="page-subtitle">{t('dashboard.subtitle')}</p>
          </header>

          <div className="stats-grid">
            {stats.map((stat) => (
              <article className="stat-card" key={stat.label}>
                <IconBadge icon={stat.icon} color={stat.color as TagColor} />
                <div>
                  <div className="stat-label">{stat.label}</div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-delta">{stat.delta}</div>
                </div>
              </article>
            ))}
          </div>

          <section>
            <div className="panel-header">
              <h2 className="panel-title">{t('dashboard.recentNotes')}</h2>
              <Link className="link-accent" to="/notes">
                {t('common.viewAll')}
              </Link>
            </div>
            <div className="note-list">
              {recentNotes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  tags={tags}
                  collections={collections}
                  onToggleFavorite={(noteId) => void toggleFavorite(noteId)}
                />
              ))}
            </div>
          </section>
        </section>

        <aside className="dashboard-side">
          <Panel title={t('dashboard.quickCapture.title')}>
            <form
              className="quick-capture"
              onSubmit={handleSubmit(async ({ capture }) => {
                await createQuickNote(capture);
                reset();
              })}
            >
              <div className="capture-box">
                <textarea {...register('capture')} placeholder={t('dashboard.quickCapture.placeholder')} />
                <div className="capture-actions">
                  <div className="capture-tools">
                    <button className="icon-button" type="button" aria-label={t('dashboard.quickCapture.format')}>
                      <List size={18} />
                    </button>
                    <button className="icon-button" type="button" aria-label={t('dashboard.quickCapture.image')}>
                      <Image size={18} />
                    </button>
                    <button className="icon-button" type="button" aria-label={t('dashboard.quickCapture.task')}>
                      <CheckSquare size={18} />
                    </button>
                    <button className="icon-button" type="button" aria-label={t('dashboard.quickCapture.voice')}>
                      <Mic size={18} />
                    </button>
                  </div>
                  <button className="submit-button" type="submit" aria-label={t('dashboard.quickCapture.submit')}>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </form>
          </Panel>

          <Panel
            title={t('dashboard.popularTags')}
            action={
              <Link className="link-accent" to="/notes">
                {t('common.viewAllTags')}
              </Link>
            }
          >
            <div className="tag-list">
              {[...tags]
                .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
                .slice(0, 5)
                .map((tag) => (
                  <PopularTagRow key={tag.id} tag={tag} />
                ))}
            </div>
          </Panel>

          <Panel
            title={t('dashboard.recentActivity')}
            action={
              <Link className="link-accent" to="/recent">
                {t('common.viewAllActivity')}
              </Link>
            }
          >
            <div className="activity-list">
              {activities.slice(0, 3).map((activity) => (
                <div className="activity-row" key={activity.id}>
                  <Timer size={15} />
                  <span className="activity-copy">
                    <span>{activity.label}</span>
                    <span>{activity.time}</span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function PopularTagRow({ tag }: { tag: TagModel }) {
  return (
    <div className="tag-popular-row">
      <strong className={`tag-chip ${tag.color ?? 'neutral'}`}># {tag.name}</strong>
      <span>{tag.count}</span>
    </div>
  );
}
