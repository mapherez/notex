import { ChevronLeft, Copy, ExternalLink, FileText, Folder, Lightbulb, MoreVertical, Plus, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { Panel } from '../components/ui/Panel';
import { TagChip } from '../components/ui/TagChip';
import { useI18n } from '../i18n/I18nProvider';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';

export function NoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [exampleText, setExampleText] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkHref, setLinkHref] = useState('');
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const user = useKnowledgeStore((state) => state.user);
  const isReady = useKnowledgeStore((state) => state.isReady);
  const toggleFavorite = useKnowledgeStore((state) => state.toggleFavorite);
  const togglePinned = useKnowledgeStore((state) => state.togglePinned);
  const moveToTrash = useKnowledgeStore((state) => state.moveToTrash);
  const duplicateNote = useKnowledgeStore((state) => state.duplicateNote);
  const markNoteOpened = useKnowledgeStore((state) => state.markNoteOpened);
  const updateNoteTags = useKnowledgeStore((state) => state.updateNoteTags);
  const addAdditionalExample = useKnowledgeStore((state) => state.addAdditionalExample);
  const addRelatedLink = useKnowledgeStore((state) => state.addRelatedLink);
  const pushToast = useToastStore((state) => state.pushToast);
  const note = notes.find((item) => item.id === id);

  useEffect(() => {
    if (note) {
      void markNoteOpened(note.id);
    }
  }, [markNoteOpened, note?.id]);

  if (!isReady) {
    return null;
  }

  if (!note) {
    return (
      <div className="page-content list-page-grid">
        <button className="back-button" type="button" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
          {t('common.back')}
        </button>
        <EmptyState />
      </div>
    );
  }

  const noteTags = tags.filter((tag) => note.tagIds.includes(tag.id));
  const collection = collections.find((item) => item.id === note.collectionId);
  const availableTags = tags.filter((tag) => !note.tagIds.includes(tag.id));
  const currentNote = note;

  async function copyText(text: string, message: string) {
    await navigator.clipboard?.writeText(text);
    pushToast(message, 'success');
  }

  async function removeTag(tagId: string) {
    await updateNoteTags(currentNote.id, currentNote.tagIds.filter((tag) => tag !== tagId));
    pushToast(t('noteDetail.tagUpdated'), 'success');
  }

  async function addTag(tagId: string) {
    await updateNoteTags(currentNote.id, [...currentNote.tagIds, tagId]);
    setTagPickerOpen(false);
    pushToast(t('noteDetail.tagUpdated'), 'success');
  }

  return (
    <>
      <header className="document-top">
        <button className="back-button" type="button" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
          {t('common.back')}
        </button>
        <div className="document-actions">
          <button
            className="icon-button"
            type="button"
            aria-label={note.isFavorite ? t('common.unfavorite') : t('common.favorite')}
            onClick={() => {
              void toggleFavorite(note.id).then(() => pushToast(t('notes.favoriteChanged'), 'success'));
            }}
          >
            <Star size={20} fill={note.isFavorite ? 'var(--color-warning)' : 'transparent'} color="var(--color-warning)" />
          </button>
          <span className="inline-actions">
            <FileText size={17} color="var(--color-text-muted)" />
            {t('common.saved')}
          </span>
          <button className="icon-button" type="button" aria-label={t('common.more')} onClick={() => setMoreOpen((value) => !value)}>
            <MoreVertical size={20} />
          </button>
          {moreOpen ? (
            <div className="floating-menu document-menu">
              <button
                type="button"
                onClick={() => {
                  void togglePinned(note.id).then(() => pushToast(t('notes.pinChanged'), 'success'));
                  setMoreOpen(false);
                }}
              >
                {note.isPinned ? t('common.unpin') : t('common.pin')}
              </button>
              <button
                type="button"
                onClick={() => {
                  void duplicateNote(note.id, `${note.title} (${t('common.copy')})`).then((created) => {
                    pushToast(t('notes.duplicated'), 'success');
                    if (created) {
                      navigate(`/notes/${created.id}`);
                    }
                  });
                  setMoreOpen(false);
                }}
              >
                {t('common.duplicate')}
              </button>
              <button
                type="button"
                onClick={() => {
                  void copyText(window.location.href, t('noteDetail.copiedLink'));
                  setMoreOpen(false);
                }}
              >
                {t('common.copyLink')}
              </button>
              <button
                type="button"
                onClick={() => {
                  void moveToTrash(note.id).then(() => {
                    pushToast(t('notes.trashChanged'), 'warning');
                    navigate('/trash');
                  });
                }}
              >
                {t('notes.moveToTrash')}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="document-shell">
        <article className="document-main">
          {collection ? (
            <Link className="breadcrumb" to="/collections">
              <Folder size={20} />
              {collection.name}
            </Link>
          ) : null}

          <h1 className="document-title">{note.title}</h1>
          <div className="tag-row">
            {noteTags.map((tag) => (
              <TagChip key={tag.id} tag={tag} removable onRemove={() => void removeTag(tag.id)} />
            ))}
          </div>
          <p className="document-intro">{note.content.intro}</p>

          <section className="content-section">
            <h2 className="section-title">{t('noteDetail.summary')}</h2>
            <div className="section-copy">
              {note.content.summary?.map((block) => <p key={block.id}>{block.text}</p>)}
            </div>
          </section>

          <section className="content-section">
            <h2 className="section-title">{t('noteDetail.explanation')}</h2>
            <div className="section-copy">
              {note.content.explanation?.map((block) => <p key={block.id}>{block.text}</p>)}
            </div>
          </section>

          {note.content.usageExamples?.rows.length ? (
            <section className="content-section">
              <h2 className="section-title">{t('noteDetail.usageExamples')}</h2>
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>{t('noteDetail.table.expression')}</th>
                    <th>{t('noteDetail.table.meaning')}</th>
                    <th>{t('noteDetail.table.example')}</th>
                  </tr>
                </thead>
                <tbody>
                  {note.content.usageExamples.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.expression}</td>
                      <td>{row.meaning}</td>
                      <td>
                        {row.example.split('\n').map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                        <button
                          className="copy-row-button"
                          type="button"
                          aria-label={t('noteDetail.copyExample')}
                          onClick={() => void copyText(row.example, t('noteDetail.copiedExample'))}
                        >
                          <Copy size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {note.content.tip ? (
            <section className="content-section">
              <div className="tip-box">
                <Lightbulb size={22} color="var(--color-accent-strong)" />
                <div>
                  <h2 className="section-title">{note.content.tip.title}</h2>
                  <p className="section-copy">{note.content.tip.body}</p>
                </div>
              </div>
            </section>
          ) : null}

          <footer className="document-footer-stats">
            <span>
              {note.stats.wordCount} {t('noteDetail.words')} • {note.stats.characterCount} {t('noteDetail.characters')} •{' '}
              {t('noteDetail.readingTime', { count: note.stats.readingTimeMinutes })}
            </span>
            <span>{t('noteDetail.lastEdit')}</span>
          </footer>
        </article>

        <aside className="document-aside">
          <Panel title={t('noteDetail.metadata')}>
            <div className="meta-list">
              <div className="meta-row">
                <span>{t('noteDetail.createdAt')}</span>
                <span className="meta-value">{formatDate(note.createdAt, locale)}</span>
              </div>
              <div className="meta-row">
                <span>{t('noteDetail.updatedAt')}</span>
                <span className="meta-value">{formatDate(note.updatedAt, locale)}</span>
              </div>
              <div className="meta-row">
                <span>{t('noteDetail.collectionLabel')}</span>
                <span className="meta-value">{collection?.name}</span>
              </div>
              <div className="meta-row">
                <span>{t('noteDetail.author')}</span>
                <span className="meta-value">{user?.name}</span>
              </div>
            </div>
          </Panel>

          <Panel title={t('noteDetail.tags')}>
            <div className="tag-row">
              {noteTags.map((tag) => (
                <TagChip key={tag.id} tag={tag} removable onRemove={() => void removeTag(tag.id)} />
              ))}
            </div>
            <button className="nav-item mt-4" type="button" onClick={() => setTagPickerOpen((value) => !value)}>
              <Plus size={18} />
              {t('noteDetail.addTag')}
            </button>
            {tagPickerOpen ? (
              <div className="inline-picker">
                {availableTags.map((tag) => (
                  <button key={tag.id} type="button" onClick={() => void addTag(tag.id)}>
                    <TagChip tag={tag} />
                  </button>
                ))}
              </div>
            ) : null}
          </Panel>

          <Panel title={t('noteDetail.additionalExamples')}>
            <ul className="side-list">
              {note.content.additionalExamples?.map((example) => <li key={example}>{example}</li>)}
            </ul>
            <button className="nav-item mt-4" type="button" onClick={() => setExampleOpen((value) => !value)}>
              <Plus size={18} />
              {t('noteDetail.addExample')}
            </button>
            {exampleOpen ? (
              <form
                className="inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addAdditionalExample(note.id, exampleText).then(() => {
                    setExampleText('');
                    setExampleOpen(false);
                    pushToast(t('noteDetail.exampleAdded'), 'success');
                  });
                }}
              >
                <textarea value={exampleText} onChange={(event) => setExampleText(event.target.value)} placeholder={t('noteDetail.examplePlaceholder')} />
                <button type="submit">{t('common.save')}</button>
              </form>
            ) : null}
          </Panel>

          <Panel title={t('noteDetail.relatedLinks')}>
            <div className="side-list">
              {note.relatedLinks?.map((link) => (
                <RelatedLinkRow key={link.id} href={link.href} title={link.title} />
              ))}
            </div>
            <button className="nav-item mt-4" type="button" onClick={() => setLinkOpen((value) => !value)}>
              <Plus size={18} />
              {t('noteDetail.addLink')}
            </button>
            {linkOpen ? (
              <form
                className="inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addRelatedLink(note.id, linkTitle, linkHref).then(() => {
                    setLinkTitle('');
                    setLinkHref('');
                    setLinkOpen(false);
                    pushToast(t('noteDetail.linkAdded'), 'success');
                  });
                }}
              >
                <input value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} placeholder={t('noteDetail.linkTitlePlaceholder')} />
                <input value={linkHref} onChange={(event) => setLinkHref(event.target.value)} placeholder={t('noteDetail.linkUrlPlaceholder')} />
                <button type="submit">{t('common.save')}</button>
              </form>
            ) : null}
          </Panel>
        </aside>
      </div>
    </>
  );
}

function RelatedLinkRow({ href, title }: { href: string; title: string }) {
  const content = (
    <>
      <span className="inline-actions">
        <FileText size={17} />
        {title}
      </span>
      <ExternalLink size={15} />
    </>
  );

  if (href.startsWith('/')) {
    return (
      <Link className="linked-row" to={href}>
        {content}
      </Link>
    );
  }

  return (
    <a className="linked-row" href={href}>
      {content}
    </a>
  );
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
