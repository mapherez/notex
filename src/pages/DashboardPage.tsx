import { ArrowRight, Edit3, FileText, Folder, Plus, Search, Star, Tag, Timer, Trash, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { IconBadge } from '../components/ui/IconBadge';
import { InlineFormattedText } from '../components/editing/InlineFormattedText';
import { NoteThumbnail } from '../components/ui/NoteThumbnail';
import { NoteRow } from '../components/ui/NoteRow';
import { Panel } from "../components/ui/Panel";
import { appLimits, demoSettings } from '../config/appSettings';
import { stripInlineFormatting } from '../core/utils/inlineFormatting';
import { filterNotes } from '../core/utils/noteFilters';
import { useClickOutside } from '../core/utils/useClickOutside';
import { useKeyboardListNavigation } from '../core/utils/useKeyboardListNavigation';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';
import type { Collection, Note, Tag as TagModel, TagColor } from '../core/models/models';

type CaptureForm = {
  capture: string;
};

export function DashboardPage() {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const quickPinPickerRef = useRef<HTMLDivElement>(null);
  const quickPinInputRef = useRef<HTMLInputElement>(null);
  const [activeQuickPinIndex, setActiveQuickPinIndex] = useState<number | null>(null);
  const [quickPinQuery, setQuickPinQuery] = useState('');
  const settings = useAppStore((state) => state.settings);
  const setQuickPinAt = useAppStore((state) => state.setQuickPinAt);
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const createQuickNote = useKnowledgeStore((state) => state.createQuickNote);
  const pushToast = useToastStore((state) => state.pushToast);
  const { register, handleSubmit, reset } = useForm<CaptureForm>();

  const activeNotes = notes.filter((note) => !note.isTrashed);
  const quickPinNotes = settings.quickPinNoteIds
    .slice(0, appLimits.quickPins)
    .flatMap((noteId) => activeNotes.find((note) => note.id === noteId) ?? []);
  const quickPinSlots = Array.from({ length: appLimits.quickPins }, (_, index) => quickPinNotes[index] ?? null);
  const pinnedNoteIds = new Set(quickPinNotes.map((note) => note.id));
  const activeQuickPinNote = activeQuickPinIndex === null ? null : quickPinSlots[activeQuickPinIndex];
  const quickPinOptions = activeNotes
    .filter((note) => note.id === activeQuickPinNote?.id || !pinnedNoteIds.has(note.id))
    .filter((note) => !quickPinQuery.trim() || normalizeSearchValue(note.title).includes(normalizeSearchValue(quickPinQuery)))
    .sort((a, b) => stripInlineFormatting(a.title).localeCompare(stripInlineFormatting(b.title), undefined, { numeric: true, sensitivity: 'base' }))
    .slice(0, appLimits.quickPinSuggestions);
  const trashedNotes = notes.filter((note) => note.isTrashed);
  const recentNoteFeed = filterNotes(notes, { mode: 'recent' });
  const recentNotes = recentNoteFeed.filter((note) => !demoSettings.demoNoteIds.includes(note.id)).slice(0, appLimits.dashboardRecentNotes);
  const recentActivityNotes = recentNoteFeed.slice(0, appLimits.dashboardRecentActivity);
  const favoriteCount = activeNotes.filter((note) => note.isFavorite).length;
  const activeNotesThisWeek = activeNotes.filter((note) => isThisWeek(note.createdAt) || isThisWeek(note.updatedAt));
  const tagCounts = countTags(activeNotes);
  const popularTags = tags
    .map((tag) => ({ ...tag, count: tagCounts.get(tag.id) ?? 0 }))
    .filter((tag) => tag.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, appLimits.popularTags);

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
      color: 'red',
      to: '/tags',
    },
    {
      label: t('dashboard.stats.trash'),
      value: trashedNotes.length,
      delta: formatWeekDelta(trashedNotes.filter((note) => isThisWeek(note.updatedAt)).length, t),
      icon: trashedNotes.length ? Trash2 : Trash,
      color: 'orange',
      to: '/trash',
    },
  ] as const;
  const quickPinNavigation = useKeyboardListNavigation({
    enabled: activeQuickPinIndex !== null,
    itemCount: quickPinOptions.length,
    onEscape: closeQuickPinPicker,
    onSelect: (index) => {
      const option = quickPinOptions[index];
      if (!option || activeQuickPinIndex === null) {
        return;
      }

      void selectQuickPin(activeQuickPinIndex, option.id);
    },
  });

  useClickOutside(quickPinPickerRef, activeQuickPinIndex !== null, () => closeQuickPinPicker());

  useEffect(() => {
    if (activeQuickPinIndex !== null) {
      requestAnimationFrame(() => quickPinInputRef.current?.focus());
    }
  }, [activeQuickPinIndex]);

  function openQuickPinPicker(index: number) {
    setActiveQuickPinIndex(index);
    setQuickPinQuery('');
  }

  function closeQuickPinPicker() {
    setActiveQuickPinIndex(null);
    setQuickPinQuery('');
  }

  async function selectQuickPin(index: number, noteId: string | null) {
    await setQuickPinAt(index, noteId);
    closeQuickPinPicker();
    pushToast(t('dashboard.quickPins.updated'), 'success');
  }

  return (
    <div className="page-content">
      <div className="dashboard-layout">
        <section className="dashboard-main">
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

          <section className="dashboard-quick-pins" ref={quickPinPickerRef}>
            <div className="panel-header">
              <h2 className="panel-title">{t("dashboard.quickPins.title")}</h2>
            </div>
            <div className="quick-pin-row">
              {quickPinSlots.map((note, index) => (
                <div
                  className="quick-pin-slot"
                  key={note?.id ?? `quick-pin-empty-${index}`}
                >
                  <button
                    className={note ? "quick-pin-card" : "quick-pin-card empty"}
                    type="button"
                    aria-label={
                      note ? stripInlineFormatting(note.title) : t("dashboard.quickPins.add")
                    }
                    title={stripInlineFormatting(note?.title)}
                    onClick={() => {
                      if (note) {
                        navigate(`/notes/${note.id}`);
                        return;
                      }

                      openQuickPinPicker(index);
                    }}
                  >
                    {note ? (
                      <>
                        <NoteThumbnail thumbnail={note.thumbnail} />
                        <span className="quick-pin-copy">
                          <strong>
                            <InlineFormattedText value={note.title} />
                          </strong>
                          <span>
                            {note.content.intro ? <InlineFormattedText value={note.content.intro} /> : t("dashboard.quickPins.noteFallback")}
                          </span>
                        </span>
                      </>
                    ) : (
                      <Plus />
                    )}
                  </button>
                  {note ? (
                    <button
                      className="quick-pin-edit"
                      type="button"
                      aria-label={t("dashboard.quickPins.change")}
                      title={t("dashboard.quickPins.change")}
                      onClick={(event) => {
                        event.stopPropagation();
                        openQuickPinPicker(index);
                      }}
                    >
                      <Edit3 />
                    </button>
                  ) : null}
                  {activeQuickPinIndex === index ? (
                    <div className="quick-pin-picker">
                      <label className="quick-pin-search">
                        <Search />
                        <input
                          ref={quickPinInputRef}
                          value={quickPinQuery}
                          onChange={(event) =>
                            setQuickPinQuery(event.target.value)
                          }
                          onKeyDown={quickPinNavigation.onKeyDown}
                          placeholder={t(
                            "dashboard.quickPins.searchPlaceholder",
                          )}
                        />
                      </label>
                      <div className="quick-pin-options">
                        {quickPinOptions.length ? (
                          quickPinOptions.map((option, optionIndex) => (
                            <button
                              className={optionIndex === quickPinNavigation.activeIndex ? 'active' : undefined}
                              key={option.id}
                              type="button"
                              onClick={() =>
                                void selectQuickPin(index, option.id)
                              }
                              onMouseEnter={() => quickPinNavigation.setActiveIndex(optionIndex)}
                            >
                              <NoteThumbnail thumbnail={option.thumbnail} />
                              <span>
                                <strong>
                                  <InlineFormattedText value={option.title} />
                                </strong>
                                <span>
                                  {option.content.intro ? <InlineFormattedText value={option.content.intro} /> : t("dashboard.quickPins.noteFallback")}
                                </span>
                              </span>
                            </button>
                          ))
                        ) : (
                          <span className="inline-help">
                            {t("dashboard.quickPins.noMatches")}
                          </span>
                        )}
                      </div>
                      {note ? (
                        <button
                          className="quick-pin-clear"
                          type="button"
                          onClick={() => void selectQuickPin(index, null)}
                        >
                          <X />
                          {t("dashboard.quickPins.clear")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="panel-header">
              <h2 className="panel-title">{t("dashboard.recentNotes")}</h2>
              <Link className="link-accent" to="/notes">
                {t("common.viewAll")}
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
          <Panel title={t("dashboard.quickCapture.title")}>
            <form
              className="quick-capture"
              onSubmit={handleSubmit(async ({ capture }) => {
                const note = await createQuickNote(
                  capture,
                  t("dashboard.quickCapture.title"),
                );
                if (note) {
                  pushToast(t("notes.draftCreated"), "success");
                  navigate(`/notes/${note.id}`);
                }
                reset();
              })}
            >
              <div className="capture-box">
                <textarea
                  {...register("capture")}
                  placeholder={t("dashboard.quickCapture.placeholder")}
                />
                <div className="capture-actions">
                  <button
                    className="submit-button"
                    type="submit"
                    aria-label={t("dashboard.quickCapture.submit")}
                  >
                    <ArrowRight />
                  </button>
                </div>
              </div>
            </form>
          </Panel>

          <Panel
            title={t("dashboard.popularTags")}
            action={
              <Link className="link-accent" to="/tags">
                {t("common.viewAll")}
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
            title={t("dashboard.recentActivity")}
            action={
              <Link className="link-accent" to="/recent">
                {t("common.viewAll")}
              </Link>
            }
          >
            <div className="activity-list">
              {recentActivityNotes.map((note) => (
                <Link
                  className="activity-row"
                  key={note.id}
                  to={`/notes/${note.id}`}
                >
                  <Timer />
                  <span className="activity-copy">
                    <span>
                      <InlineFormattedText value={note.title} />
                    </span>
                    <span>
                      {formatRecentTimestamp(
                        getRecentTimestamp(note),
                        locale,
                        t,
                      )}
                    </span>
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

function normalizeSearchValue(value: string) {
  return stripInlineFormatting(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

