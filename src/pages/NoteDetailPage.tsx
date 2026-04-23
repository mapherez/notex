import { ChevronLeft, Copy, ExternalLink, FileText, Folder, Lightbulb, MoreVertical, Plus, Star } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Panel } from '../components/ui/Panel';
import { TagChip } from '../components/ui/TagChip';
import { useI18n } from '../i18n/I18nProvider';
import { useKnowledgeStore } from '../store/useKnowledgeStore';

export function NoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const user = useKnowledgeStore((state) => state.user);
  const toggleFavorite = useKnowledgeStore((state) => state.toggleFavorite);
  const note = notes.find((item) => item.id === id) ?? notes.find((item) => !item.isTrashed);

  if (!note) {
    return null;
  }

  const noteTags = tags.filter((tag) => note.tagIds.includes(tag.id));
  const collection = collections.find((item) => item.id === note.collectionId);

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
            onClick={() => void toggleFavorite(note.id)}
          >
            <Star size={20} fill={note.isFavorite ? 'var(--color-warning)' : 'transparent'} color="var(--color-warning)" />
          </button>
          <span className="inline-actions">
            <FileText size={17} color="var(--color-text-muted)" />
            {t('common.saved')}
          </span>
          <button className="icon-button" type="button" aria-label={t('common.more')}>
            <MoreVertical size={20} />
          </button>
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
              <TagChip key={tag.id} tag={tag} removable />
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
                <TagChip key={tag.id} tag={tag} removable />
              ))}
            </div>
            <button className="nav-item mt-4" type="button">
              <Plus size={18} />
              {t('noteDetail.addTag')}
            </button>
          </Panel>

          <Panel title={t('noteDetail.additionalExamples')}>
            <ul className="side-list">
              {note.content.additionalExamples?.map((example) => <li key={example}>{example}</li>)}
            </ul>
            <button className="nav-item mt-4" type="button">
              <Plus size={18} />
              {t('noteDetail.addExample')}
            </button>
          </Panel>

          <Panel title={t('noteDetail.relatedLinks')}>
            <div className="side-list">
              {note.relatedLinks?.map((link) => (
                <a className="linked-row" href={link.href} key={link.id}>
                  <span className="inline-actions">
                    <FileText size={17} />
                    {link.title}
                  </span>
                  <ExternalLink size={15} />
                </a>
              ))}
            </div>
            <button className="nav-item mt-4" type="button">
              <Plus size={18} />
              {t('noteDetail.addLink')}
            </button>
          </Panel>
        </aside>
      </div>
    </>
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
