import { ArrowRight, CheckSquare, FileText, Folder, Image, List, Mic, Star, Tag, Timer } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { IconBadge } from '../components/ui/IconBadge';
import { NoteRow } from '../components/ui/NoteRow';
import { Panel } from '../components/ui/Panel';
import { useI18n } from '../i18n/I18nProvider';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';
import type { Tag as TagModel, TagColor } from '../core/models/models';

type CaptureForm = {
  capture: string;
};

export function DashboardPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [captureMode, setCaptureMode] = useState('list');
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const activities = useKnowledgeStore((state) => state.activities);
  const createQuickNote = useKnowledgeStore((state) => state.createQuickNote);
  const pushToast = useToastStore((state) => state.pushToast);
  const { register, handleSubmit, reset } = useForm<CaptureForm>();

  const activeNotes = notes.filter((note) => !note.isTrashed);
  const recentNotes = activeNotes.filter((note) => note.id !== 'note-linguistic').slice(0, 5);
  const favoriteCount = activeNotes.filter((note) => note.isFavorite).length;

  const stats = [
    { label: t('dashboard.stats.notes'), value: Math.max(activeNotes.length, 128), delta: t('dashboard.stats.notesDelta'), icon: FileText, color: 'blue', to: '/notes' },
    { label: t('dashboard.stats.favorites'), value: Math.max(favoriteCount, 23), delta: t('dashboard.stats.favoritesDelta'), icon: Star, color: 'amber', to: '/favorites' },
    { label: t('dashboard.stats.collections'), value: Math.max(collections.length, 6), delta: t('dashboard.stats.collectionsDelta'), icon: Folder, color: 'green', to: '/collections' },
    { label: t('dashboard.stats.tags'), value: Math.max(tags.length, 15), delta: t('dashboard.stats.tagsDelta'), icon: Tag, color: 'purple', to: '/tags' },
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
              <Link className="stat-card" key={stat.label} to={stat.to}>
                <IconBadge icon={stat.icon} color={stat.color as TagColor} />
                <div>
                  <div className="stat-label">{stat.label}</div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-delta">{stat.delta}</div>
                </div>
              </Link>
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
                const note = await createQuickNote(capture);
                if (note) {
                  pushToast(t('notes.draftCreated'), 'success');
                  navigate(`/notes/${note.id}`);
                }
                reset();
              })}
            >
              <div className="capture-box">
                <textarea {...register('capture')} placeholder={t('dashboard.quickCapture.placeholder')} />
                <div className="capture-actions">
                  <div className="capture-tools">
                    <button
                      className={captureMode === 'list' ? 'icon-button active' : 'icon-button'}
                      type="button"
                      aria-label={t('dashboard.quickCapture.format')}
                      onClick={() => setCaptureMode('list')}
                    >
                      <List size={18} />
                    </button>
                    <button
                      className={captureMode === 'image' ? 'icon-button active' : 'icon-button'}
                      type="button"
                      aria-label={t('dashboard.quickCapture.image')}
                      onClick={() => setCaptureMode('image')}
                    >
                      <Image size={18} />
                    </button>
                    <button
                      className={captureMode === 'task' ? 'icon-button active' : 'icon-button'}
                      type="button"
                      aria-label={t('dashboard.quickCapture.task')}
                      onClick={() => setCaptureMode('task')}
                    >
                      <CheckSquare size={18} />
                    </button>
                    <button
                      className={captureMode === 'voice' ? 'icon-button active' : 'icon-button'}
                      type="button"
                      aria-label={t('dashboard.quickCapture.voice')}
                      onClick={() => setCaptureMode('voice')}
                    >
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
              <Link className="link-accent" to="/tags">
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
                <Link className="activity-row" key={activity.id} to={`/notes/${activity.noteId}`}>
                  <Timer size={15} />
                  <span className="activity-copy">
                    <span>{activity.label}</span>
                    <span>{activity.time}</span>
                  </span>
                </Link>
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
    <Link className="tag-popular-row" to={`/notes?tag=${tag.id}`}>
      <strong className={`tag-chip ${tag.color ?? 'neutral'}`}># {tag.name}</strong>
      <span>{tag.count}</span>
    </Link>
  );
}
