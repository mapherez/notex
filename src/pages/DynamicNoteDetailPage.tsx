import {
  ChevronLeft,
  EyeOff,
  FileText,
  Folder,
  GripVertical,
  Image as ImageIcon,
  Plus,
  Star,
  Tag as TagIcon,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DynamicTiptapEditor } from '../components/dynamic/DynamicTiptapEditor';
import { ColorPicker } from '../components/ui/ColorPicker';
import { CustomSelect } from '../components/ui/CustomSelect';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { NoteThumbnail } from '../components/ui/NoteThumbnail';
import { Panel } from '../components/ui/Panel';
import { TagChip } from '../components/ui/TagChip';
import { defaultNewTagColor, thumbnailOptions } from '../config/appSettings';
import type { DynamicNote, DynamicNoteBlock, DynamicNoteFile, NoteThumbnail as NoteThumbnailModel, TagColor, TiptapDocument } from '../core/models/models';
import { chooseDynamicAttachment } from '../core/services/dynamicFiles';
import { useClickOutside } from '../core/utils/useClickOutside';
import { sortTagsByFavoriteOrder } from '../core/utils/tagSorting';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useDynamicNotesStore, emptyTiptapDocument } from '../store/useDynamicNotesStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';

type DeleteBlockState = null | {
  blockId: string;
  title: string;
};

const sidePanels = ['metadata', 'tags', 'files'] as const;

export function DynamicNoteDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const createStartedRef = useRef(false);
  const isNewNote = id === 'new';
  const dynamicNotes = useDynamicNotesStore((state) => state.dynamicNotes);
  const dynamicReady = useDynamicNotesStore((state) => state.isReady);
  const createDynamicNote = useDynamicNotesStore((state) => state.createDynamicNote);
  const markOpened = useDynamicNotesStore((state) => state.markDynamicNoteOpened);
  const updateHeader = useDynamicNotesStore((state) => state.updateDynamicNoteHeader);
  const updateTags = useDynamicNotesStore((state) => state.updateDynamicNoteTags);
  const updateThumbnail = useDynamicNotesStore((state) => state.updateDynamicNoteThumbnail);
  const toggleFavorite = useDynamicNotesStore((state) => state.toggleDynamicFavorite);
  const addBlock = useDynamicNotesStore((state) => state.addDynamicBlock);
  const reorderBlocks = useDynamicNotesStore((state) => state.reorderDynamicBlocks);
  const deleteBlock = useDynamicNotesStore((state) => state.deleteDynamicBlock);
  const moveToTrash = useDynamicNotesStore((state) => state.moveDynamicNoteToTrash);
  const importFileForBlock = useDynamicNotesStore((state) => state.importFileForBlock);
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const createTag = useKnowledgeStore((state) => state.createTag);
  const settings = useAppStore((state) => state.settings);
  const setPanelHidden = useAppStore((state) => state.setDynamicNotePanelHidden);
  const favoriteTagIds = useAppStore((state) => state.settings.favoriteTagIds);
  const pushToast = useToastStore((state) => state.pushToast);
  const [deleteBlockState, setDeleteBlockState] = useState<DeleteBlockState>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const note = isNewNote ? undefined : dynamicNotes.find((item) => item.id === id);
  const classicNote = !isNewNote && !note ? notes.find((item) => item.id === id) : undefined;

  useEffect(() => {
    if (!dynamicReady || !isNewNote || createStartedRef.current) {
      return;
    }
    createStartedRef.current = true;
    void createDynamicNote({
      collectionId: searchParams.get('collection') || settings.primaryCollectionId,
    }).then((created) => navigate(`/notes/${created.id}`, { replace: true }));
  }, [createDynamicNote, dynamicReady, isNewNote, navigate, searchParams, settings.primaryCollectionId]);

  useEffect(() => {
    if (classicNote) {
      navigate(`/classic-notes/${classicNote.id}`, { replace: true });
    }
  }, [classicNote, navigate]);

  useEffect(() => {
    if (note && !isNewNote) {
      void markOpened(note.id);
    }
  }, [isNewNote, markOpened, note?.id]);

  const noteTags = useMemo(() => {
    const tagById = new Map(tags.map((tag) => [tag.id, tag]));
    return note ? note.tagIds.flatMap((tagId) => tagById.get(tagId) ?? []) : [];
  }, [note, tags]);
  const hiddenPanels = new Set(settings.dynamicNoteHiddenPanelIds ?? []);

  if (!dynamicReady || isNewNote) {
    return null;
  }

  if (!note) {
    return (
      <div className="page-content list-page-grid">
        <button className="back-button" type="button" onClick={() => navigate(-1)}>
          <ChevronLeft />
          {t('common.back')}
        </button>
        <EmptyState />
      </div>
    );
  }

  async function addContentBlock(kind: DynamicNoteBlock['kind']) {
    if (!note) {
      return;
    }
    const block = await addBlock(note.id, {
      kind,
      contentJson: kind === 'content' ? emptyTiptapDocument : null,
    });
    if (block) {
      requestAnimationFrame(() => document.getElementById(`block-${block.id}`)?.scrollIntoView({ block: 'center' }));
    }
  }

  async function confirmDeleteBlock() {
    if (!note || !deleteBlockState) {
      return;
    }
    await deleteBlock(note.id, deleteBlockState.blockId);
    setDeleteBlockState(null);
    pushToast(t('dynamicNotes.blockDeleted'), 'warning');
  }

  function moveDraggedBlock(overBlockId: string) {
    if (!note || !draggedBlockId || draggedBlockId === overBlockId) {
      return;
    }
    const blockIds = (note.blocks ?? []).map((block) => block.id);
    const fromIndex = blockIds.indexOf(draggedBlockId);
    const toIndex = blockIds.indexOf(overBlockId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    const nextIds = [...blockIds];
    const [moved] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, moved);
    void reorderBlocks(note.id, nextIds);
  }

  return (
    <>
      <header className="document-top">
        <button className="back-button" type="button" onClick={() => navigate(-1)}>
          <ChevronLeft />
          {t('common.back')}
        </button>
        <div className="document-actions">
          <button
            className={note.isFavorite ? 'icon-button document-actions__favorite is-active' : 'icon-button document-actions__favorite'}
            type="button"
            aria-label={note.isFavorite ? t('common.unfavorite') : t('common.favorite')}
            aria-pressed={note.isFavorite}
            onClick={() => void toggleFavorite(note.id)}
          >
            <Star />
          </button>
          <span className="inline-actions">
            <FileText />
            {t('noteDetail.savedLocal')}
          </span>
          <button
            className="icon-button danger"
            type="button"
            aria-label={t('notes.moveToTrash')}
            onClick={() => {
              void moveToTrash(note.id).then(() => {
                pushToast(t('notes.trashChanged'), 'warning');
                navigate('/trash');
              });
            }}
          >
            <Trash2 />
          </button>
        </div>
      </header>

      <div className="dynamic-document-shell">
        <aside className="dynamic-toc">
          <span className="dynamic-toc-title">{t('dynamicNotes.tableOfContents')}</span>
          {(note.blocks ?? []).length ? (
            <nav>
              {(note.blocks ?? []).map((block, index) => (
                <a key={block.id} href={`#block-${block.id}`}>
                  <span>{index + 1}</span>
                  {block.title.trim() || t('dynamicNotes.untitledBlock')}
                </a>
              ))}
            </nav>
          ) : (
            <span className="dynamic-toc-empty">{t('dynamicNotes.emptyToc')}</span>
          )}
        </aside>

        <main className="dynamic-document-main">
          <DynamicNoteHeader
            collections={collections}
            note={note}
            onChange={(input) => void updateHeader(note.id, input)}
            onThumbnailChange={(thumbnail) => void updateThumbnail(note.id, thumbnail)}
            t={t}
          />

          <section className="dynamic-block-list">
            {(note.blocks ?? []).map((block) => (
              <DynamicBlockEditor
                block={block}
                dragged={draggedBlockId === block.id}
                key={block.id}
                noteId={note.id}
                onDelete={() => setDeleteBlockState({ blockId: block.id, title: block.title.trim() || t('dynamicNotes.untitledBlock') })}
                onDragEnd={() => setDraggedBlockId(null)}
                onDragOver={() => moveDraggedBlock(block.id)}
                onDragStart={() => setDraggedBlockId(block.id)}
                onRequestFileUpload={async () => {
                  const sourcePath = await chooseDynamicAttachment();
                  if (!sourcePath) {
                    return null;
                  }
                  const file = await importFileForBlock(sourcePath, note.id, block.id);
                  if (file) {
                    pushToast(t('dynamicNotes.fileAdded'), 'success');
                  }
                  return file;
                }}
              />
            ))}
          </section>

          <div className="dynamic-add-block-row">
            <button type="button" onClick={() => void addContentBlock('content')}>
              <Plus />
              {t('dynamicNotes.addContentBlock')}
            </button>
            <button type="button" onClick={() => void addContentBlock('title')}>
              <Plus />
              {t('dynamicNotes.addTitleBlock')}
            </button>
          </div>
        </main>

        <aside className="document-aside dynamic-document-aside">
          <Panel title={t('dynamicNotes.panels.title')}>
            <div className="dynamic-panel-toggle-list">
              {sidePanels.map((panelId) => (
                <label key={panelId}>
                  <input
                    type="checkbox"
                    checked={!hiddenPanels.has(panelId)}
                    onChange={(event) => void setPanelHidden(panelId, !event.currentTarget.checked)}
                  />
                  <span>{t(`dynamicNotes.panels.${panelId}`)}</span>
                </label>
              ))}
            </div>
          </Panel>

          {!hiddenPanels.has('metadata') ? (
            <HideablePanel panelId="metadata" title={t('noteDetail.metadata')} onHide={() => void setPanelHidden('metadata', true)}>
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
                  <span>{t('noteDetail.words')}</span>
                  <span className="meta-value">{note.stats.wordCount}</span>
                </div>
              </div>
            </HideablePanel>
          ) : null}

          {!hiddenPanels.has('tags') ? (
            <HideablePanel panelId="tags" title={t('noteDetail.tags')} onHide={() => void setPanelHidden('tags', true)}>
              <DynamicTagEditor
                favoriteTagIds={favoriteTagIds}
                note={note}
                noteTags={noteTags}
                onCreateTag={createTag}
                onTagsChange={(tagIds) => void updateTags(note.id, tagIds)}
                tags={tags}
              />
            </HideablePanel>
          ) : null}

          {!hiddenPanels.has('files') ? (
            <HideablePanel panelId="files" title={t('dynamicNotes.files')} onHide={() => void setPanelHidden('files', true)}>
              {note.files?.length ? (
                <ul className="side-list dynamic-file-side-list">
                  {note.files.map((file) => (
                    <li key={file.id}>
                      {file.kind === 'image' ? <ImageIcon /> : <FileText />}
                      <span>{file.originalName}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="inline-help">{t('dynamicNotes.noFiles')}</p>
              )}
            </HideablePanel>
          ) : null}
        </aside>
      </div>

      {deleteBlockState ? (
        <DeleteConfirmModal
          cancelLabel={t('common.cancel')}
          confirmLabel={t('common.delete')}
          description={t('dynamicNotes.deleteBlockDescription', { title: deleteBlockState.title })}
          onCancel={() => setDeleteBlockState(null)}
          onConfirm={() => void confirmDeleteBlock()}
          title={t('dynamicNotes.deleteBlockTitle')}
        />
      ) : null}
    </>
  );
}

function DynamicNoteHeader({
  collections,
  note,
  onChange,
  onThumbnailChange,
  t,
}: {
  collections: Array<{ id: string; name: string; color?: TagColor }>;
  note: DynamicNote;
  onChange: (input: { collectionId?: string | null; subtitle?: string; title?: string }) => void;
  onThumbnailChange: (thumbnail: NoteThumbnailModel) => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const [title, setTitle] = useState(note.title);
  const [subtitle, setSubtitle] = useState(note.subtitle);
  const [collectionId, setCollectionId] = useState(note.collectionId ?? '');
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setTitle(note.title);
    setSubtitle(note.subtitle);
    setCollectionId(note.collectionId ?? '');
  }, [note.id, note.title, note.subtitle, note.collectionId]);

  useEffect(() => {
    if (title === note.title && subtitle === note.subtitle && collectionId === (note.collectionId ?? '')) {
      return undefined;
    }
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      onChange({ title, subtitle, collectionId: collectionId || null });
    }, 650);
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [collectionId, note.collectionId, note.subtitle, note.title, onChange, subtitle, title]);

  return (
    <section className="dynamic-document-heading">
      <div className="document-meta-row">
        <div className="editable-collection-field editing">
          <Folder />
          <CustomSelect
            ariaLabel={t('noteDetail.collectionLabel')}
            emptyText={t('notes.filters.noCollections')}
            onChange={setCollectionId}
            options={[
              { label: t('noteDetail.noCollection'), value: '' },
              ...collections.map((collection) => ({
                color: collection.color,
                label: collection.name,
                value: collection.id,
              })),
            ]}
            value={collectionId}
          />
        </div>
        <DynamicThumbnailPicker current={note.thumbnail} onSelect={onThumbnailChange} t={t} />
      </div>
      <textarea className="dynamic-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('noteDetail.titlePlaceholder')} rows={2} />
      <textarea className="dynamic-subtitle-input" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder={t('dynamicNotes.subtitlePlaceholder')} rows={3} />
    </section>
  );
}

function DynamicThumbnailPicker({
  current,
  onSelect,
  t,
}: {
  current?: NoteThumbnailModel;
  onSelect: (thumbnail: NoteThumbnailModel) => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const currentThumbnail = current ?? { variant: 'text' as const };

  useClickOutside(pickerRef, open, () => setOpen(false));

  return (
    <div className="thumbnail-picker" ref={pickerRef}>
      <button className="thumbnail-picker-trigger" type="button" aria-label={t('noteDetail.changeThumbnail')} onClick={() => setOpen((value) => !value)}>
        <NoteThumbnail thumbnail={currentThumbnail} />
      </button>
      {open ? (
        <div className="thumbnail-picker-menu">
          {thumbnailOptions.map(({ id: variant }) => (
            <button
              className={variant === currentThumbnail.variant ? 'thumbnail-option active' : 'thumbnail-option'}
              key={variant}
              type="button"
              aria-label={`${t('noteDetail.changeThumbnail')}: ${variant}`}
              onClick={() => {
                onSelect({ variant });
                setOpen(false);
              }}
            >
              <NoteThumbnail thumbnail={{ variant }} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DynamicBlockEditor({
  block,
  dragged,
  noteId,
  onDelete,
  onDragEnd,
  onDragOver,
  onDragStart,
  onRequestFileUpload,
}: {
  block: DynamicNoteBlock;
  dragged: boolean;
  noteId: string;
  onDelete: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDragStart: () => void;
  onRequestFileUpload: () => Promise<DynamicNoteFile | null>;
}) {
  const { t } = useI18n();
  const updateBlock = useDynamicNotesStore((state) => state.updateDynamicBlock);
  const [title, setTitle] = useState(block.title);
  const [contentJson, setContentJson] = useState<TiptapDocument | null>(block.contentJson);
  const [contentText, setContentText] = useState(block.contentText);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setTitle(block.title);
    setContentJson(block.contentJson);
    setContentText(block.contentText);
  }, [block.id, block.title, block.contentJson, block.contentText]);

  useEffect(() => {
    const contentChanged = JSON.stringify(contentJson) !== JSON.stringify(block.contentJson);
    if (title === block.title && contentText === block.contentText && !contentChanged) {
      return undefined;
    }
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      void updateBlock(noteId, block.id, {
        title,
        contentJson,
        contentText,
      });
    }, 700);
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [block.contentJson, block.contentText, block.id, block.title, contentJson, contentText, noteId, title, updateBlock]);

  return (
    <article
      className={dragged ? 'dynamic-block is-dragging' : 'dynamic-block'}
      draggable
      id={`block-${block.id}`}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
    >
      <button className="dynamic-block-handle" type="button" aria-label={t('dynamicNotes.reorderBlock')} title={t('dynamicNotes.reorderBlock')}>
        <GripVertical />
      </button>
      <div className="dynamic-block-body">
        <input className="dynamic-block-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('dynamicNotes.blockTitlePlaceholder')} />
        {block.kind === 'content' ? (
          <DynamicTiptapEditor
            onChange={(nextJson, nextText) => {
              setContentJson(nextJson);
              setContentText(nextText);
            }}
            onRequestFileUpload={onRequestFileUpload}
            placeholder={t('dynamicNotes.blockContentPlaceholder')}
            value={contentJson ?? emptyTiptapDocument}
          />
        ) : null}
      </div>
      <button className="dynamic-block-delete" type="button" aria-label={t('common.delete')} title={t('common.delete')} onClick={onDelete}>
        <Trash2 />
      </button>
    </article>
  );
}

function DynamicTagEditor({
  favoriteTagIds,
  note,
  noteTags,
  onCreateTag,
  onTagsChange,
  tags,
}: {
  favoriteTagIds: string[];
  note: DynamicNote;
  noteTags: ReturnType<typeof sortTagsByFavoriteOrder>;
  onCreateTag: (name: string, color?: TagColor) => Promise<{ id: string } | null>;
  onTagsChange: (tagIds: string[]) => void;
  tags: ReturnType<typeof sortTagsByFavoriteOrder>;
}) {
  const { t } = useI18n();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<TagColor>(defaultNewTagColor);
  const availableTags = sortTagsByFavoriteOrder(tags.filter((tag) => !note.tagIds.includes(tag.id)), favoriteTagIds);

  async function createAndAttachTag() {
    const created = await onCreateTag(newTagName, newTagColor);
    if (!created) {
      return;
    }
    onTagsChange([...note.tagIds, created.id]);
    setNewTagName('');
    setNewTagColor(defaultNewTagColor);
  }

  return (
    <div className="dynamic-tags-editor">
      <div className="tag-row">
        {noteTags.map((tag) => (
          <button key={tag.id} className="tag-chip-button" type="button" onClick={() => onTagsChange(note.tagIds.filter((tagId) => tagId !== tag.id))}>
            <TagChip tag={tag} />
          </button>
        ))}
      </div>
      {availableTags.length ? (
        <div className="inline-picker dynamic-tag-picker">
          {availableTags.map((tag) => (
            <button key={tag.id} type="button" onClick={() => onTagsChange([...note.tagIds, tag.id])}>
              <TagChip tag={tag} />
            </button>
          ))}
        </div>
      ) : null}
      <form
        className="inline-form tag-create-form"
        onSubmit={(event) => {
          event.preventDefault();
          void createAndAttachTag();
        }}
      >
        <TagIcon />
        <input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder={t('noteDetail.newTagPlaceholder')} />
        <ColorPicker ariaLabel={t('profile.labels.color')} onChange={setNewTagColor} value={newTagColor} />
        <button type="submit">{t('noteDetail.createAndAddTag')}</button>
      </form>
    </div>
  );
}

function HideablePanel({
  children,
  onHide,
  title,
}: {
  children: ReactNode;
  onHide: () => void;
  panelId: string;
  title: string;
}) {
  return (
    <Panel
      title={title}
      action={
        <button className="icon-button" type="button" aria-label={title} onClick={onHide}>
          <EyeOff />
        </button>
      }
    >
      {children}
    </Panel>
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
