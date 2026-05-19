import { ArrowRight, FileText, Folder, Star, Tag, Timer } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { IconBadge } from '../components/ui/IconBadge';
import { NoteRow } from '../components/ui/NoteRow';
import { Panel } from '../components/ui/Panel';
import { SearchBox } from '../components/ui/SearchBox';
import { filterNotes } from '../core/utils/noteFilters';
import { useI18n } from '../i18n/I18nProvider';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';
import type { Collection, Note, Tag as TagModel, TagColor } from '../core/models/models';

type CaptureForm = {
  capture: string;
};

export function DashboardPage() {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const createQuickNote = useKnowledgeStore((state) => state.createQuickNote);
  const pushToast = useToastStore((state) => state.pushToast);
  const { register, handleSubmit, reset } = useForm<CaptureForm>();

  const activeNotes = notes.filter((note) => !note.isTrashed);
  const recentNoteFeed = filterNotes(notes, { mode: 'recent' });
  const recentNotes = recentNoteFeed.filter((note) => note.id !== 'note-linguistic').slice(0, 5);
  const recentActivityNotes = recentNoteFeed.slice(0, 3);
  const favoriteCount = activeNotes.filter((note) => note.isFavorite).length;
  const activeNotesThisWeek = activeNotes.filter((note) => isThisWeek(note.createdAt) || isThisWeek(note.updatedAt));
  const tagCounts = countTags(activeNotes);
  const popularTags = tags
    .map((tag) => ({ ...tag, count: tagCounts.get(tag.id) ?? 0 }))
    .filter((tag) => tag.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5);

  const stats = [
    {
      label: t('dashboard.stats.notes'),
      value: activeNotes.length,
      delta: formatWeekDelta(activeNotes.filter((note) => isThisWeek(note.createdAt)).length, t),
      icon: FileText,
      color: 'blue',
      to: '/notes',
    },
    {
      label: t('dashboard.stats.favorites'),
      value: favoriteCount,
      delta: formatWeekDelta(activeNotes.filter((note) => note.isFavorite && isThisWeek(note.updatedAt)).length, t),
      icon: Star,
      color: 'amber',
      to: '/favorites',
    },
    {
      label: t('dashboard.stats.collections'),
      value: collections.length,
      delta: formatWeekDelta(countTouchedCollections(activeNotesThisWeek, collections), t),
      icon: Folder,
      color: 'green',
      to: '/collections',
    },
    {
      label: t('dashboard.stats.tags'),
      value: tags.length,
      delta: formatWeekDelta(countTouchedTags(activeNotesThisWeek, tags), t),
      icon: Tag,
      color: 'purple',
      to: '/tags',
    },
  ] as const;

  return (
    <div className="page-content">
      <div className="dashboard-layout">
        <section className="dashboard-main">
          <SearchBox className="dashboard-search-box" />

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
                  timeValue={getRecentTimestamp(note)}
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
                const note = await createQuickNote(capture, t('dashboard.quickCapture.title'));
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
              {popularTags.map((tag) => (
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
              {recentActivityNotes.map((note) => (
                <Link className="activity-row" key={note.id} to={`/notes/${note.id}`}>
                  <Timer size={15} />
                  <span className="activity-copy">
                    <span>{note.title}</span>
                    <span>{formatRecentTimestamp(getRecentTimestamp(note), locale, t)}</span>
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

function getRecentTimestamp(note: Note) {
  return note.lastOpenedAt ?? note.updatedAt;
}

function countTags(notes: Note[]) {
  const counts = new Map<string, number>();
  notes.forEach((note) => {
    new Set(note.tagIds).forEach((tagId) => {
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
    });
  });
  return counts;
}

function countTouchedCollections(notes: Note[], collections: Collection[]) {
  const collectionIds = new Set(collections.map((collection) => collection.id));
  return new Set(notes.flatMap((note) => (note.collectionId && collectionIds.has(note.collectionId) ? [note.collectionId] : []))).size;
}

function countTouchedTags(notes: Note[], tags: TagModel[]) {
  const tagIds = new Set(tags.map((tag) => tag.id));
  return new Set(notes.flatMap((note) => note.tagIds.filter((tagId) => tagIds.has(tagId)))).size;
}

function formatWeekDelta(count: number, t: ReturnType<typeof useI18n>['t']) {
  return t('dashboard.stats.weekDelta', { count });
}

function isThisWeek(value?: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function startOfWeek(value: Date) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function formatRecentTimestamp(value: string, locale: string, t: ReturnType<typeof useI18n>['t']) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const localeCode = locale === 'pt' ? 'pt-PT' : 'en-US';
  const time = new Intl.DateTimeFormat(localeCode, { hour: '2-digit', minute: '2-digit' }).format(date);

  if (date.toDateString() === now.toDateString()) {
    return `${t('common.today')}, ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `${t('common.yesterday')}, ${time}`;
  }

  return new Intl.DateTimeFormat(localeCode, {
    day: '2-digit',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

function PopularTagRow({ tag }: { tag: TagModel }) {
  return (
    <Link className="tag-popular-row" to={`/notes?tag=${tag.id}`}>
      <strong className={`tag-chip ${tag.color ?? 'neutral'}`}># {tag.name}</strong>
      <span>{tag.count}</span>
    </Link>
  );
}
