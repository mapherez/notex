import {
  ChevronLeft,
  Check,
  ExternalLink,
  FileText,
  Folder,
  GripVertical,
  Image as ImageIcon,
  Pencil,
  Plus,
  Download,
  Star,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InlineFormattedText } from '../components/editing/InlineFormattedText';
import { StyledTextField } from '../components/editing/TextStyleToolbar';
import {
  NoteInlineTiptapEditor,
  NoteTiptapEditor,
  NoteTiptapToolbar,
  type NoteTiptapInsertTextRequest,
  type NoteTiptapToolbarTarget,
} from '../components/notes/NoteTiptapEditor';
import { ColorPicker } from '../components/ui/ColorPicker';
import { CustomSelect } from '../components/ui/CustomSelect';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { NoteThumbnail } from '../components/ui/NoteThumbnail';
import { Panel } from '../components/ui/Panel';
import { SortableTagList } from '../components/ui/SortableTagList';
import { TagChip } from '../components/ui/TagChip';
import { appLimits, defaultNewTagColor, defaultNoteThumbnailVariant, thumbnailOptions } from '../config/appSettings';
import type { Collection, Note, NoteBlock, NoteFile, NoteThumbnail as NoteThumbnailModel, Tag, TagColor, TiptapDocument } from '../core/models/models';
import { chooseNoteAttachment, exportNoteAttachment, openNoteAttachment } from '../core/services/noteFiles';
import { chooseNotexNoteExportDestination, createNotexNoteTempExport } from '../core/services/notexNotePackage';
import { openExternalUrl } from '../core/services/externalLinks';
import { stripInlineFormatting } from '../core/utils/inlineFormatting';
import {
  isEditableShortcutTarget,
  isPlainLetterShortcut,
} from '../core/utils/keyboardShortcuts';
import { normalizeExternalHref, titleFromExternalHref } from '../core/utils/linkUtils';
import { richTextToPlainText } from '../core/utils/richText';
import { useClickOutside } from '../core/utils/useClickOutside';
import { useKeyboardListNavigation } from '../core/utils/useKeyboardListNavigation';
import { sortTagsByFavoriteOrder } from '../core/utils/tagSorting';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useNotesStore, emptyTiptapDocument } from '../store/useNotesStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';

type DeleteBlockState = null | {
  blockId: string;
  title: string;
};

type HeaderTypingRequest = {
  field: 'subtitle' | 'title';
  nonce: number;
  text: string;
};

type TocEntry = {
  id: string;
  label: string;
  level: 1 | 2 | 3;
};

export function NoteDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const createStartedRef = useRef(false);
  const isNewNote = id === 'new';
  const notes = useNotesStore((state) => state.notes);
  const notesReady = useNotesStore((state) => state.isReady);
  const createNote = useNotesStore((state) => state.createNote);
  const markOpened = useNotesStore((state) => state.markNoteOpened);
  const updateHeader = useNotesStore((state) => state.updateNoteHeader);
  const updateTags = useNotesStore((state) => state.updateNoteTags);
  const updateThumbnail = useNotesStore((state) => state.updateNoteThumbnail);
  const toggleFavorite = useNotesStore((state) => state.toggleFavorite);
  const addBlock = useNotesStore((state) => state.addBlock);
  const reorderBlocks = useNotesStore((state) => state.reorderBlocks);
  const deleteBlock = useNotesStore((state) => state.deleteBlock);
  const moveToTrash = useNotesStore((state) => state.moveNoteToTrash);
  const importFileForBlock = useNotesStore((state) => state.importFileForBlock);
  const deleteFile = useNotesStore((state) => state.deleteFile);
  const updateLinkedNotes = useNotesStore((state) => state.updateNoteLinkedNotes);
  const addAdditionalExample = useNotesStore((state) => state.addAdditionalExample);
  const updateAdditionalExample = useNotesStore((state) => state.updateAdditionalExample);
  const deleteAdditionalExample = useNotesStore((state) => state.deleteAdditionalExample);
  const addRelatedLink = useNotesStore((state) => state.addRelatedLink);
  const deleteRelatedLink = useNotesStore((state) => state.deleteRelatedLink);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const createTag = useKnowledgeStore((state) => state.createTag);
  const user = useKnowledgeStore((state) => state.user);
  const settings = useAppStore((state) => state.settings);
  const setConfirmNoteExport = useAppStore((state) => state.setConfirmNoteExport);
  const favoriteTagIds = useAppStore((state) => state.settings.favoriteTagIds);
  const pushToast = useToastStore((state) => state.pushToast);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const noteScrollRef = useRef<HTMLElement>(null);
  const [deleteBlockState, setDeleteBlockState] = useState<DeleteBlockState>(null);
  const [noteExportConfirmOpen, setNoteExportConfirmOpen] = useState(false);
  const [noteExportSkipConfirm, setNoteExportSkipConfirm] = useState(false);
  const [isExportingNote, setIsExportingNote] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragBlockIds, setDragBlockIds] = useState<string[] | null>(null);
  const [headerTypingRequest, setHeaderTypingRequest] = useState<HeaderTypingRequest | null>(null);
  const [firstBlockTypingRequest, setFirstBlockTypingRequest] = useState<NoteTiptapInsertTextRequest | null>(null);
  const [tocEntries, setTocEntries] = useState<TocEntry[]>([]);
  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [exampleText, setExampleText] = useState('');
  const [editingExampleIndex, setEditingExampleIndex] = useState<number | null>(null);
  const [editingExampleText, setEditingExampleText] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [selectedLinkedNoteId, setSelectedLinkedNoteId] = useState<string | null>(null);
  const dragBlockIdsRef = useRef<string[] | null>(null);
  const draggedBlockIdRef = useRef<string | null>(null);
  const typingRequestNonceRef = useRef(0);
  const tocEntriesRef = useRef<TocEntry[]>([]);
  const tocRefreshFrameRef = useRef<number | null>(null);
  const [toolbarTarget, setToolbarTarget] = useState<NoteTiptapToolbarTarget | null>(null);
  const note = isNewNote ? undefined : notes.find((item) => item.id === id);

  useEffect(() => {
    if (!notesReady || !isNewNote || createStartedRef.current) {
      return;
    }
    createStartedRef.current = true;
    void createNote({
      collectionId: searchParams.get('collection') || settings.primaryCollectionId,
    }).then((created) => navigate(`/notes/${created.id}`, { replace: true }));
  }, [createNote, notesReady, isNewNote, navigate, searchParams, settings.primaryCollectionId]);

  useEffect(() => {
    if (note && !isNewNote) {
      void markOpened(note.id);
    }
  }, [isNewNote, markOpened, note?.id]);

  useEffect(() => {
    if (linkOpen) {
      requestAnimationFrame(() => linkInputRef.current?.focus());
    }
  }, [linkOpen]);

  const noteTags = useMemo(() => {
    const tagById = new Map(tags.map((tag) => [tag.id, tag]));
    return note ? note.tagIds.flatMap((tagId) => tagById.get(tagId) ?? []) : [];
  }, [note, tags]);
  const visibleBlocks = useMemo(() => {
    const blocks = note?.blocks ?? [];
    if (!dragBlockIds) {
      return blocks;
    }

    const blockMap = new Map(blocks.map((block) => [block.id, block]));
    const ordered = dragBlockIds.flatMap((blockId) => blockMap.get(blockId) ?? []);
    const orderedIds = new Set(ordered.map((block) => block.id));
    return [...ordered, ...blocks.filter((block) => !orderedIds.has(block.id))];
  }, [dragBlockIds, note?.blocks]);
  const firstBlockId = (note?.blocks ?? [])[0]?.id ?? null;
  const linkedNotes = useMemo(
    () => note?.linkedNoteIds.flatMap((linkedId) => notes.find((item) => item.id === linkedId && !item.isTrashed) ?? []) ?? [],
    [notes, note?.linkedNoteIds],
  );
  const backlinkNotes = useMemo(
    () => (note ? notes.filter((item) => item.id !== note.id && item.linkedNoteIds.includes(note.id)) : []),
    [notes, note],
  );
  const linkSearchActive = linkInput.trim().startsWith('/');
  const linkSearchQuery = linkSearchActive ? linkInput.trim().slice(1).toLowerCase() : '';
  const linkableNotes = notes
    .filter((item) => item.id !== note?.id && !item.isTrashed && !note?.linkedNoteIds.includes(item.id))
    .filter((item) => !linkSearchQuery || richTextToPlainText(stripInlineFormatting(item.title)).toLowerCase().includes(linkSearchQuery))
    .slice(0, appLimits.linkedNoteSuggestions);
  const linkableNoteNavigation = useKeyboardListNavigation({
    enabled: linkOpen && linkSearchActive,
    itemCount: linkableNotes.length,
    onEscape: () => setLinkOpen(false),
    onSelect: (index) => {
      const linkableNote = linkableNotes[index];
      if (linkableNote) {
        selectLinkedNote(linkableNote.id);
      }
    },
  });

  function handleExportNote() {
    if (settings.confirmNoteExport) {
      setNoteExportConfirmOpen(true);
      return;
    }

    void performExportNote(false);
  }

  async function performExportNote(skipFutureConfirmation: boolean) {
    if (!note) {
      return;
    }

    setIsExportingNote(true);
    try {
      if (skipFutureConfirmation && settings.confirmNoteExport) {
        await setConfirmNoteExport(false);
      }
      const exportInfo = await createNotexNoteTempExport(note.id);
      const destinationPath = await chooseNotexNoteExportDestination(exportInfo);
      if (destinationPath) {
        pushToast(t('notes.noteExported'), 'success');
      }
      setNoteExportConfirmOpen(false);
      setNoteExportSkipConfirm(false);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t('notes.noteExportFailed'), 'warning');
    } finally {
      setIsExportingNote(false);
    }
  }

  const refreshTocEntries = useCallback(() => {
    if (tocRefreshFrameRef.current) {
      window.cancelAnimationFrame(tocRefreshFrameRef.current);
    }

    tocRefreshFrameRef.current = window.requestAnimationFrame(() => {
      tocRefreshFrameRef.current = null;
      const nextEntries = collectNoteTocEntries();
      tocEntriesRef.current = nextEntries;
      setTocEntries((currentEntries) => (sameTocEntries(currentEntries, nextEntries) ? currentEntries : nextEntries));
      setActiveTocId(findActiveTocEntryId(nextEntries, noteScrollRef.current));
    });
  }, []);

  useEffect(() => {
    if (!toolbarTarget || !note) {
      return;
    }
    if (toolbarTarget.blockId && !(note.blocks ?? []).some((block) => block.id === toolbarTarget.blockId)) {
      setToolbarTarget(null);
    }
  }, [note, toolbarTarget]);

  useEffect(() => {
    refreshTocEntries();
  }, [refreshTocEntries, note?.id, visibleBlocks]);

  useEffect(() => {
    const blockList = document.querySelector('.note-block-list');
    if (!blockList) {
      return undefined;
    }

    const observer = new MutationObserver(refreshTocEntries);
    observer.observe(blockList, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [refreshTocEntries, note?.id]);

  useEffect(() => {
    function updateActiveTocEntry() {
      setActiveTocId(findActiveTocEntryId(tocEntriesRef.current, noteScrollRef.current));
    }

    const scrollContainer = noteScrollRef.current;
    scrollContainer?.addEventListener('scroll', updateActiveTocEntry, { passive: true });
    window.addEventListener('resize', updateActiveTocEntry);
    updateActiveTocEntry();

    return () => {
      scrollContainer?.removeEventListener('scroll', updateActiveTocEntry);
      window.removeEventListener('resize', updateActiveTocEntry);
      if (tocRefreshFrameRef.current) {
        window.cancelAnimationFrame(tocRefreshFrameRef.current);
      }
    };
  }, [note?.id]);

  useEffect(() => {
    function handleInitialTyping(event: globalThis.KeyboardEvent) {
      if (
        !note ||
        deleteBlockState ||
        draggedBlockId ||
        !isPlainTypingShortcut(event) ||
        isEditableShortcutTarget(event.target)
      ) {
        return;
      }

      const request = { nonce: ++typingRequestNonceRef.current, text: event.key };
      if (!richTextToPlainText(note.title).trim()) {
        event.preventDefault();
        setHeaderTypingRequest({ ...request, field: 'title' });
        return;
      }

      if (!richTextToPlainText(note.subtitle).trim()) {
        event.preventDefault();
        setHeaderTypingRequest({ ...request, field: 'subtitle' });
        return;
      }

      if (firstBlockId) {
        event.preventDefault();
        setFirstBlockTypingRequest(request);
      }
    }

    window.addEventListener('keydown', handleInitialTyping);
    return () => window.removeEventListener('keydown', handleInitialTyping);
  }, [deleteBlockState, draggedBlockId, firstBlockId, note]);

  useEffect(() => {
    if (!draggedBlockId) {
      return undefined;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      event.preventDefault();
      const blockList = document.querySelector('.note-block-list');
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-note-block-id]');
      if (!blockList || !target || !blockList.contains(target)) {
        return;
      }

      const overBlockId = target.dataset.noteBlockId;
      if (overBlockId) {
        previewBlockReorder(overBlockId);
      }
    }

    function handlePointerEnd() {
      finishBlockDrag();
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [draggedBlockId]);

  if (!notesReady || isNewNote) {
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

  async function addContentBlock(kind: NoteBlock['kind']) {
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
    pushToast(t('notes.blockDeleted'), 'warning');
  }

  function startExampleEdit(index: number, example: string) {
    setEditingExampleIndex(index);
    setEditingExampleText(example);
  }

  function cancelExampleEdit() {
    setEditingExampleIndex(null);
    setEditingExampleText('');
  }

  async function saveExampleEdit(index: number) {
    if (!note) {
      return;
    }

    await updateAdditionalExample(note.id, index, editingExampleText);
    cancelExampleEdit();
    pushToast(t('noteDetail.exampleUpdated'), 'success');
  }

  function selectLinkedNote(linkedNoteId: string) {
    const selected = notes.find((item) => item.id === linkedNoteId);
    if (!selected) {
      return;
    }

    setSelectedLinkedNoteId(selected.id);
    setLinkInput(richTextToPlainText(stripInlineFormatting(selected.title)) || t('notes.untitled'));
  }

  async function saveRelatedLink() {
    if (!note) {
      return;
    }

    if (selectedLinkedNoteId) {
      await updateLinkedNotes(note.id, [...note.linkedNoteIds, selectedLinkedNoteId]);
    } else {
      const href = normalizeExternalHref(linkInput);
      const title = titleFromExternalHref(linkInput);
      if (!href || !title) {
        pushToast(t('noteDetail.linkUrlRequired'), 'warning');
        return;
      }
      await addRelatedLink(note.id, title, href);
    }

    setLinkInput('');
    setSelectedLinkedNoteId(null);
    setLinkOpen(false);
    pushToast(t('noteDetail.linkAdded'), 'success');
  }

  function startBlockDrag(event: PointerEvent<HTMLButtonElement>, blockId: string) {
    if (!note) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const blockIds = (note.blocks ?? []).map((block) => block.id);
    dragBlockIdsRef.current = blockIds;
    draggedBlockIdRef.current = blockId;
    setDragBlockIds(blockIds);
    setDraggedBlockId(blockId);
  }

  function previewBlockReorder(overBlockId: string) {
    const activeBlockId = draggedBlockIdRef.current;
    if (!note || !activeBlockId || activeBlockId === overBlockId) {
      return;
    }
    setDragBlockIds((current) => {
      const blockIds = current ?? (note.blocks ?? []).map((block) => block.id);
      const fromIndex = blockIds.indexOf(activeBlockId);
      const toIndex = blockIds.indexOf(overBlockId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return current;
      }
      const nextIds = [...blockIds];
      const [moved] = nextIds.splice(fromIndex, 1);
      nextIds.splice(toIndex, 0, moved);
      dragBlockIdsRef.current = nextIds;
      return nextIds;
    });
  }

  function finishBlockDrag() {
    if (!note) {
      return;
    }
    const nextIds = dragBlockIdsRef.current;
    const currentIds = (note.blocks ?? []).map((block) => block.id);
    setDraggedBlockId(null);
    dragBlockIdsRef.current = null;
    draggedBlockIdRef.current = null;

    if (!nextIds || arraysEqual(nextIds, currentIds)) {
      setDragBlockIds(null);
      return;
    }

    void reorderBlocks(note.id, nextIds).finally(() => setDragBlockIds(null));
  }

  return (
    <div className="note-detail-page">
      <header className="document-top">
        <button className="back-button" type="button" onClick={() => navigate(-1)}>
          <ChevronLeft />
          {t('common.back')}
        </button>
        <div className="document-top-toolbar">
          <NoteTiptapToolbar
            target={toolbarTarget}
            t={t}
          />
        </div>
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
          <button
            className="icon-button"
            type="button"
            aria-label={t('notes.exportNote')}
            disabled={isExportingNote}
            onClick={() => void handleExportNote()}
          >
            <Download />
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

      <div className="note-document-shell">
        <aside className="note-toc" aria-label={t('notes.tableOfContents')}>
          <div className="note-toc-dashes" aria-hidden="true">
            {tocEntries.map((entry) => (
              <span
                className={[
                  'note-toc-dash',
                  `note-toc-dash--level-${entry.level}`,
                  activeTocId === entry.id && 'is-active',
                ].filter(Boolean).join(' ')}
                key={entry.id}
              />
            ))}
          </div>
          <div className="note-toc-content">
            {tocEntries.length ? (
              <nav>
                {tocEntries.map((entry) => (
                  <button
                    className={[
                      'note-toc-link',
                      `note-toc-link--level-${entry.level}`,
                      activeTocId === entry.id && 'is-active',
                    ].filter(Boolean).join(' ')}
                    key={entry.id}
                    type="button"
                    onClick={(event) => {
                      event.currentTarget.blur();
                      scrollToTocEntry(entry.id, noteScrollRef.current);
                    }}
                  >
                    {entry.label}
                  </button>
                ))}
              </nav>
            ) : (
              <span className="note-toc-empty">{t('notes.emptyToc')}</span>
            )}
          </div>
        </aside>

        <main className="note-document-main" ref={noteScrollRef}>
          <NoteHeader
            collections={collections}
            note={note}
            noteTags={noteTags}
            onChange={(input) => void updateHeader(note.id, input)}
            onTagsChange={(tagIds) => void updateTags(note.id, tagIds)}
            onThumbnailChange={(thumbnail) => void updateThumbnail(note.id, thumbnail)}
            onToolbarTargetChange={setToolbarTarget}
            t={t}
            typingRequest={headerTypingRequest}
          />

          <section className={draggedBlockId ? 'note-block-list is-reordering' : 'note-block-list'}>
            {visibleBlocks.map((block) => (
              <BlockEditor
                block={block}
                contentTypingRequest={block.id === firstBlockId ? firstBlockTypingRequest : null}
                dragged={draggedBlockId === block.id}
                key={block.id}
                noteId={note.id}
                onDelete={() => setDeleteBlockState({ blockId: block.id, title: richTextToPlainText(block.title).trim() || t('notes.untitledBlock') })}
                onDragStart={(event) => startBlockDrag(event, block.id)}
                onRequestFileUpload={async () => {
                  const sourcePath = await chooseNoteAttachment();
                  if (!sourcePath) {
                    return null;
                  }
                  const file = await importFileForBlock(sourcePath, note.id, block.id);
                  if (file) {
                    pushToast(t('notes.fileAdded'), 'success');
                  }
                  return file;
                }}
                onToolbarTargetChange={setToolbarTarget}
                onTocChange={refreshTocEntries}
              />
            ))}
          </section>

          <div className="note-add-block-row">
            <button type="button" aria-label={t('notes.addContentBlock')} title={t('notes.addContentBlock')} onClick={() => void addContentBlock('content')}>
              +
            </button>
          </div>
        </main>

        <aside className="document-aside note-document-aside">
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
                <span className="meta-value">{collections.find((collection) => collection.id === note.collectionId)?.name ?? t('noteDetail.noCollection')}</span>
              </div>
              <div className="meta-row">
                <span>{t('noteDetail.author')}</span>
                <span className="meta-value">{user?.name || note.authorId || 'Local user'}</span>
              </div>
            </div>
          </Panel>

          <Panel title={t('noteDetail.tags')}>
            <TagEditor
              favoriteTagIds={favoriteTagIds}
              note={note}
              noteTags={noteTags}
              onCreateTag={createTag}
              onTagsChange={(tagIds) => void updateTags(note.id, tagIds)}
              tags={tags}
            />
          </Panel>

          <Panel title={t('noteDetail.additionalExamples')}>
            <ul className="side-list">
              {note.additionalExamples?.map((example, index) => (
                <li className="side-edit-row" key={`${example}-${index}`}>
                  {editingExampleIndex === index ? (
                    <span className="side-edit-form">
                      <StyledTextField
                        className="side-styled-field"
                        controlClassName="side-styled-field__control"
                        multiline
                        value={editingExampleText}
                        onChange={setEditingExampleText}
                      />
                      <span className="side-row-actions">
                        <button className="icon-button" type="button" aria-label={t('editor.accept')} onClick={() => void saveExampleEdit(index)}>
                          <Check />
                        </button>
                        <button className="icon-button" type="button" aria-label={t('common.cancel')} onClick={cancelExampleEdit}>
                          <X />
                        </button>
                      </span>
                    </span>
                  ) : (
                    <>
                      <span>
                        <InlineFormattedText value={example} />
                      </span>
                      <span className="side-row-actions">
                        <button className="icon-button" type="button" aria-label={t('editor.edit')} onClick={() => startExampleEdit(index, example)}>
                          <Pencil />
                        </button>
                        <button
                          className="icon-button danger"
                          type="button"
                          aria-label={t('common.remove')}
                          onClick={() => void deleteAdditionalExample(note.id, index).then(() => pushToast(t('noteDetail.exampleDeleted'), 'warning'))}
                        >
                          <Trash2 />
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <button className="nav-item nav-item--spaced" type="button" onClick={() => setExampleOpen((value) => !value)}>
              <Plus />
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
                <StyledTextField
                  className="side-styled-field"
                  controlClassName="side-styled-field__control"
                  multiline
                  value={exampleText}
                  onChange={setExampleText}
                  placeholder={t('noteDetail.examplePlaceholder')}
                />
                <button type="submit">{t('common.save')}</button>
              </form>
            ) : null}
          </Panel>

          <Panel title={t('noteDetail.relatedLinks')}>
            <div className="side-list">
              {linkedNotes.map((linkedNote) => (
                <LinkedNoteRow
                  key={linkedNote.id}
                  noteId={linkedNote.id}
                  title={linkedNote.title}
                  onRemove={() => void updateLinkedNotes(note.id, note.linkedNoteIds.filter((linkedId) => linkedId !== linkedNote.id)).then(() => pushToast(t('noteDetail.linkDeleted'), 'warning'))}
                />
              ))}
              {note.relatedLinks?.map((link) => (
                <RelatedLinkRow
                  key={link.id}
                  href={link.href}
                  title={link.title}
                  onRemove={() => void deleteRelatedLink(note.id, link.id).then(() => pushToast(t('noteDetail.linkDeleted'), 'warning'))}
                />
              ))}
            </div>
            <button className="nav-item nav-item--spaced" type="button" onClick={() => setLinkOpen((value) => !value)}>
              <Plus />
              {t('noteDetail.addLink')}
            </button>
            {linkOpen ? (
              <form
                className="inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveRelatedLink();
                }}
              >
                <input
                  ref={linkInputRef}
                  value={linkInput}
                  onChange={(event) => {
                    setLinkInput(event.target.value);
                    setSelectedLinkedNoteId(null);
                  }}
                  onKeyDown={linkSearchActive ? linkableNoteNavigation.onKeyDown : undefined}
                  placeholder={t('noteDetail.linkInputPlaceholder')}
                  title={t('noteDetail.linkInputPlaceholder')}
                />
                {linkSearchActive ? (
                  <div className="note-link-picker">
                    {linkableNotes.length ? (
                      linkableNotes.map((linkableNote, linkIndex) => (
                        <button
                          className={linkIndex === linkableNoteNavigation.activeIndex ? 'active' : undefined}
                          key={linkableNote.id}
                          type="button"
                          onClick={() => selectLinkedNote(linkableNote.id)}
                          onMouseEnter={() => linkableNoteNavigation.setActiveIndex(linkIndex)}
                        >
                          <FileText />
                          {richTextToPlainText(linkableNote.title).trim() ? <InlineFormattedText value={linkableNote.title} /> : t('notes.untitled')}
                        </button>
                      ))
                    ) : (
                      <span>{t('noteDetail.noLinkableNotes')}</span>
                    )}
                  </div>
                ) : null}
                <button type="submit">{t('common.save')}</button>
              </form>
            ) : null}
            {backlinkNotes.length ? (
              <div className="backlink-section">
                <h3>{t('noteDetail.backlinks')}</h3>
                <div className="side-list">
                  {backlinkNotes.map((backlink) => (
                    <LinkedNoteRow key={backlink.id} noteId={backlink.id} title={backlink.title} />
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel title={t('notes.files')}>
            {note.files?.length ? (
              <ul className="side-list note-file-side-list">
                {note.files.map((file) => (
                  <li key={file.id}>
                    {file.kind === 'image' ? <ImageIcon /> : <FileText />}
                    <span>{file.originalName}</span>
                    <span className="side-list-actions">
                      <button className="icon-button" type="button" aria-label={t('common.open')} onClick={() => void openNoteAttachment(file.relativePath)}>
                        <FileText />
                      </button>
                      <button className="icon-button" type="button" aria-label={t('common.export')} onClick={() => void exportNoteAttachment(file)}>
                        <Download />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        aria-label={t('common.delete')}
                        onClick={() => void deleteFile(note.id, file.id).then(() => pushToast(t('noteDetail.linkDeleted'), 'warning'))}
                      >
                        <Trash2 />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="inline-help">{t('notes.noFiles')}</p>
            )}
          </Panel>
        </aside>
      </div>

      <ExportNoteConfirmModal
        disabled={isExportingNote}
        open={noteExportConfirmOpen}
        skipConfirm={noteExportSkipConfirm}
        onCancel={() => {
          if (!isExportingNote) {
            setNoteExportConfirmOpen(false);
            setNoteExportSkipConfirm(false);
          }
        }}
        onConfirm={() => void performExportNote(noteExportSkipConfirm)}
        onSkipConfirmChange={setNoteExportSkipConfirm}
        t={t}
      />

      {deleteBlockState ? (
        <DeleteConfirmModal
          cancelLabel={t('common.cancel')}
          confirmLabel={t('common.delete')}
          description={t('notes.deleteBlockDescription', { title: deleteBlockState.title })}
          onCancel={() => setDeleteBlockState(null)}
          onConfirm={() => void confirmDeleteBlock()}
          title={t('notes.deleteBlockTitle')}
        />
      ) : null}
    </div>
  );
}

function ExportNoteConfirmModal({
  disabled,
  open,
  skipConfirm,
  onCancel,
  onConfirm,
  onSkipConfirmChange,
  t,
}: {
  disabled: boolean;
  open: boolean;
  skipConfirm: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onSkipConfirmChange: (value: boolean) => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <section
        className="choice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-note-title"
      >
        <h2 id="export-note-title">{t('notes.exportNoteModalTitle')}</h2>
        <p>{t('notes.exportNoteModalDescription')}</p>
        <label className="choice-modal-checkbox">
          <input
            type="checkbox"
            checked={skipConfirm}
            disabled={disabled}
            onChange={(event) => onSkipConfirmChange(event.currentTarget.checked)}
          />
          <span>{t('notes.exportNoteDontShowAgain')}</span>
        </label>
        <div className="choice-modal-actions two-column-actions">
          <button type="button" disabled={disabled} onClick={onCancel}>
            <span>{t('common.cancel')}</span>
          </button>
          <button type="button" disabled={disabled} onClick={onConfirm}>
            <Download />
            <span>{t('common.export')}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function NoteHeader({
  collections,
  note,
  noteTags,
  onChange,
  onTagsChange,
  onThumbnailChange,
  onToolbarTargetChange,
  t,
  typingRequest,
}: {
  collections: Collection[];
  note: Note;
  noteTags: Tag[];
  onChange: (input: { collectionId?: string | null; subtitle?: string; title?: string }) => void;
  onTagsChange: (tagIds: string[]) => void;
  onThumbnailChange: (thumbnail: NoteThumbnailModel) => void;
  onToolbarTargetChange: (target: NoteTiptapToolbarTarget) => void;
  t: ReturnType<typeof useI18n>['t'];
  typingRequest?: HeaderTypingRequest | null;
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

  const selectedCollection = collections.find((collection) => collection.id === collectionId);

  return (
    <section className="document-heading note-document-heading">
      <div className="document-meta-row">
        <div className={`editable-collection-field editing ${selectedCollection?.color ?? 'neutral'}`}>
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
      </div>

      <div className="document-title-row">
        <div className="document-title-stack">
          <NoteInlineTiptapEditor
            className="document-title-input note-title-input"
            id={`note-title-${note.id}`}
            insertTextRequest={typingRequest?.field === 'title' ? typingRequest : null}
            onChange={(nextTitle) => setTitle(nextTitle)}
            onToolbarTargetChange={onToolbarTargetChange}
            placeholder={t('noteDetail.titlePlaceholder')}
            value={title}
          />
        </div>
        <ThumbnailPicker current={note.thumbnail} onSelect={onThumbnailChange} t={t} />
      </div>

      {noteTags.length ? (
        <SortableTagList
          ariaLabel={t('noteDetail.tags')}
          className="document-title-tags"
          getHref={(tag) => `/notes?tag=${tag.id}`}
          onReorder={onTagsChange}
          tags={noteTags}
        />
      ) : null}

      <NoteInlineTiptapEditor
        className="document-intro-input note-subtitle-input"
        id={`note-subtitle-${note.id}`}
        insertTextRequest={typingRequest?.field === 'subtitle' ? typingRequest : null}
        onChange={(nextSubtitle) => setSubtitle(nextSubtitle)}
        onToolbarTargetChange={onToolbarTargetChange}
        placeholder={t('notes.subtitlePlaceholder')}
        value={subtitle}
      />
    </section>
  );
}

function ThumbnailPicker({
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
  const currentThumbnail = current ?? { variant: defaultNoteThumbnailVariant };

  useClickOutside(pickerRef, open, () => setOpen(false));

  return (
    <div className="thumbnail-picker" ref={pickerRef}>
      <button
        className="thumbnail-picker-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('noteDetail.changeThumbnail')}
        title={t('noteDetail.changeThumbnail')}
        onClick={() => setOpen((value) => !value)}
      >
        <NoteThumbnail thumbnail={currentThumbnail} />
        <span className="thumbnail-picker-edit" aria-hidden="true">
          <Pencil />
        </span>
      </button>
      {open ? (
        <div className="thumbnail-picker-menu" role="menu" aria-label={t('noteDetail.thumbnail')}>
          {thumbnailOptions.map(({ id: variant }) => (
            <button
              className={variant === currentThumbnail.variant ? 'thumbnail-option active' : 'thumbnail-option'}
              key={variant}
              type="button"
              role="menuitemradio"
              aria-checked={variant === currentThumbnail.variant}
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

function BlockEditor({
  block,
  contentTypingRequest,
  dragged,
  noteId,
  onDelete,
  onDragStart,
  onRequestFileUpload,
  onTocChange,
  onToolbarTargetChange,
}: {
  block: NoteBlock;
  contentTypingRequest?: NoteTiptapInsertTextRequest | null;
  dragged: boolean;
  noteId: string;
  onDelete: () => void;
  onDragStart: (event: PointerEvent<HTMLButtonElement>) => void;
  onRequestFileUpload: () => Promise<NoteFile | null>;
  onTocChange: () => void;
  onToolbarTargetChange: (target: NoteTiptapToolbarTarget) => void;
}) {
  const { t } = useI18n();
  const updateBlock = useNotesStore((state) => state.updateBlock);
  const [title, setTitle] = useState(block.title);
  const [contentJson, setContentJson] = useState<TiptapDocument | null>(block.contentJson);
  const [contentText, setContentText] = useState(block.contentText);
  const [titleActive, setTitleActive] = useState(false);
  const [contentActive, setContentActive] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastTypingNonceRef = useRef<number | null>(null);
  const contentJsonRef = useRef<TiptapDocument | null>(contentJson);
  const contentTextRef = useRef(contentText);
  const fileInsertPendingRef = useRef(false);
  const titleHasContent = richTextToPlainText(title).trim().length > 0;
  const contentHasContent = hasTiptapContent(contentJson, contentText);
  const titleVisible = titleHasContent || titleActive;
  const contentVisible = contentHasContent || contentActive;
  const blockIsEmpty = !titleVisible && !contentVisible;

  useEffect(() => {
    setTitle(block.title);
    setContentJson(block.contentJson);
    setContentText(block.contentText);
  }, [block.id, block.title, block.contentJson, block.contentText]);

  useEffect(() => {
    contentJsonRef.current = contentJson;
    contentTextRef.current = contentText;
  }, [contentJson, contentText]);

  useEffect(() => {
    if (!contentTypingRequest || lastTypingNonceRef.current === contentTypingRequest.nonce) {
      return;
    }

    lastTypingNonceRef.current = contentTypingRequest.nonce;
    setContentJson((current) => current ?? emptyTiptapDocument);
    setContentActive(true);
  }, [contentTypingRequest]);

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
        kind: contentHasContent || contentJson ? 'content' : block.kind,
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
  }, [block.contentJson, block.contentText, block.id, block.kind, block.title, contentHasContent, contentJson, contentText, noteId, title, updateBlock]);

  function setFileInsertPending(pending: boolean) {
    fileInsertPendingRef.current = pending;
    if (pending) {
      setContentJson((current) => current ?? emptyTiptapDocument);
      setContentActive(true);
      return;
    }

    requestAnimationFrame(() => {
      if (!hasTiptapContent(contentJsonRef.current, contentTextRef.current)) {
        setContentActive(false);
      }
    });
  }

  return (
    <article
      className={dragged ? 'note-block is-dragging' : 'note-block'}
      data-note-block-id={block.id}
      id={`block-${block.id}`}
      data-empty={blockIsEmpty ? 'true' : undefined}
    >
      <button
        className="note-block-handle"
        type="button"
        aria-label={t('notes.reorderBlock')}
        aria-grabbed={dragged}
        title={t('notes.reorderBlock')}
        onPointerDown={onDragStart}
      >
        <GripVertical />
      </button>
      <div className="note-block-body">
        {titleVisible ? (
          <NoteInlineTiptapEditor
            autoFocus={titleActive && !titleHasContent}
            blockId={block.id}
            className="note-block-title"
            id={`note-block-title-${block.id}`}
            onBlur={() => {
              if (!richTextToPlainText(title).trim()) {
                setTitleActive(false);
              }
            }}
            onChange={(nextTitle) => {
              setTitle(nextTitle);
              onTocChange();
            }}
            onToolbarTargetChange={onToolbarTargetChange}
            placeholder=""
            value={title}
          />
        ) : (
          <button
            className="note-block-zone-add note-block-zone-add-title"
            type="button"
            aria-label={t('notes.addTitleBlock')}
            title={t('notes.addTitleBlock')}
            onClick={() => setTitleActive(true)}
          >
            <Plus />
          </button>
        )}
        {contentVisible ? (
          <NoteTiptapEditor
            autoFocus={contentActive && !contentHasContent}
            blockId={block.id}
            insertTextRequest={contentTypingRequest}
            onBlur={() => {
              if (fileInsertPendingRef.current) {
                return;
              }
              if (!hasTiptapContent(contentJson, contentText)) {
                setContentActive(false);
              }
            }}
            onChange={(nextJson, nextText) => {
              contentJsonRef.current = nextJson;
              contentTextRef.current = nextText;
              setContentJson(nextJson);
              setContentText(nextText);
              onTocChange();
            }}
            onFocus={() => setContentActive(true)}
            onPendingFileInsertChange={setFileInsertPending}
            onRequestFileUpload={onRequestFileUpload}
            onToolbarTargetChange={onToolbarTargetChange}
            value={contentJson ?? emptyTiptapDocument}
          />
        ) : (
          <button
            className="note-block-zone-add note-block-zone-add-content"
            type="button"
            aria-label={t('notes.addContentBlock')}
            title={t('notes.addContentBlock')}
            onClick={() => {
              setContentJson((current) => current ?? emptyTiptapDocument);
              setContentActive(true);
            }}
          >
            <Plus />
          </button>
        )}
      </div>
      <button className="note-block-delete" type="button" aria-label={t('common.delete')} title={t('common.delete')} onClick={onDelete}>
        <Trash2 />
      </button>
    </article>
  );
}

function TagEditor({
  favoriteTagIds,
  note,
  noteTags,
  onCreateTag,
  onTagsChange,
  tags,
}: {
  favoriteTagIds: string[];
  note: Note;
  noteTags: ReturnType<typeof sortTagsByFavoriteOrder>;
  onCreateTag: (name: string, color?: TagColor) => Promise<{ id: string } | null>;
  onTagsChange: (tagIds: string[]) => void;
  tags: ReturnType<typeof sortTagsByFavoriteOrder>;
}) {
  const { t } = useI18n();
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
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
    setTagPickerOpen(false);
  }

  return (
    <>
      <SortableTagList
        ariaLabel={t('noteDetail.tags')}
        className="tag-row"
        onRemove={(tagId) => onTagsChange(note.tagIds.filter((id) => id !== tagId))}
        onReorder={onTagsChange}
        removable
        tags={noteTags}
      />
      <button className="nav-item nav-item--spaced" type="button" onClick={() => setTagPickerOpen((value) => !value)}>
        <Plus />
        {t('noteDetail.addTag')}
      </button>
      {tagPickerOpen ? (
        <div className="note-tag-picker">
          {availableTags.length ? (
            <div className="inline-picker note-tag-picker">
              {availableTags.map((tag) => (
                <button key={tag.id} type="button" onClick={() => onTagsChange([...note.tagIds, tag.id])}>
                  <TagChip tag={tag} />
                </button>
              ))}
            </div>
          ) : (
            <p className="inline-help">{t('noteDetail.noTagsAvailable')}</p>
          )}
          <form
            className="inline-form tag-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              void createAndAttachTag();
            }}
          >
            <input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder={t('noteDetail.newTagPlaceholder')} />
            <ColorPicker ariaLabel={t('profile.labels.color')} onChange={setNewTagColor} value={newTagColor} />
            <button type="submit">{t('noteDetail.createAndAddTag')}</button>
          </form>
        </div>
      ) : null}
    </>
  );
}

function LinkedNoteRow({ noteId, onRemove, title }: { noteId: string; onRemove?: () => void; title: string }) {
  const plainTitle = richTextToPlainText(title).trim() || 'Untitled';

  return (
    <span className="linked-row-shell">
      <Link className="linked-row" to={`/notes/${noteId}`}>
        <span className="inline-actions">
          <FileText />
          {richTextToPlainText(title).trim() ? <InlineFormattedText value={title} /> : plainTitle}
        </span>
        <ExternalLink />
      </Link>
      {onRemove ? (
        <button className="icon-button danger" type="button" aria-label={plainTitle} onClick={onRemove}>
          <Trash2 />
        </button>
      ) : null}
    </span>
  );
}

function RelatedLinkRow({ href, onRemove, title }: { href: string; onRemove?: () => void; title: string }) {
  const content = (
    <>
      <span className="inline-actions">
        <FileText />
        {title}
      </span>
      <ExternalLink />
    </>
  );

  if (href.startsWith('/')) {
    return (
      <span className="linked-row-shell">
        <Link className="linked-row" to={href}>
          {content}
        </Link>
        {onRemove ? (
          <button className="icon-button danger" type="button" aria-label={title} onClick={onRemove}>
            <Trash2 />
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <span className="linked-row-shell">
      <a
        className="linked-row"
        href={href}
        onClick={(event) => {
          event.preventDefault();
          void openExternalUrl(href);
        }}
      >
        {content}
      </a>
      {onRemove ? (
        <button className="icon-button danger" type="button" aria-label={title} onClick={onRemove}>
          <Trash2 />
        </button>
      ) : null}
    </span>
  );
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function collectNoteTocEntries() {
  const entries: TocEntry[] = [];
  const blockElements = Array.from(document.querySelectorAll<HTMLElement>('.note-block-list [data-note-block-id]'));

  blockElements.forEach((blockElement) => {
    const blockId = blockElement.dataset.noteBlockId;
    if (!blockId) {
      return;
    }

    const titleElement = blockElement.querySelector<HTMLElement>('.note-block-title');
    const title = titleElement?.textContent?.trim();
    if (title && titleElement) {
      const id = `block-title-${blockId}`;
      titleElement.dataset.noteTocId = id;
      entries.push({ id, label: title, level: 1 });
    }

    const headings = Array.from(blockElement.querySelectorAll<HTMLHeadingElement>('.note-tiptap-prosemirror h1, .note-tiptap-prosemirror h2, .note-tiptap-prosemirror h3'));
    headings.forEach((heading, index) => {
      const label = heading.textContent?.trim();
      if (!label) {
        return;
      }

      const level = Number(heading.tagName.slice(1)) as 1 | 2 | 3;
      const id = `heading-${blockId}-${index}`;
      heading.dataset.noteTocId = id;
      entries.push({ id, label, level });
    });
  });

  return entries;
}

function sameTocEntries(left: TocEntry[], right: TocEntry[]) {
  return (
    left.length === right.length &&
    left.every((entry, index) => {
      const other = right[index];
      return entry.id === other.id && entry.label === other.label && entry.level === other.level;
    })
  );
}

function findActiveTocEntryId(entries: TocEntry[], scrollContainer?: HTMLElement | null) {
  if (!entries.length) {
    return null;
  }

  const scrollContainerRect = scrollContainer?.getBoundingClientRect();
  const triggerY = scrollContainerRect
    ? scrollContainerRect.top + scrollContainerRect.height / 2
    : window.innerHeight / 2;
  let activeId = entries[0].id;

  entries.forEach((entry) => {
    const element = findTocTarget(entry.id);
    if (!element) {
      return;
    }

    if (element.getBoundingClientRect().top <= triggerY) {
      activeId = entry.id;
    }
  });

  return activeId;
}

function scrollToTocEntry(entryId: string, scrollContainer?: HTMLElement | null) {
  const element = findTocTarget(entryId);
  if (!element) {
    return;
  }

  if (scrollContainer) {
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const targetTop = scrollContainer.scrollTop + element.getBoundingClientRect().top - scrollContainerRect.top - 16;
    scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    return;
  }

  const documentTop = document.querySelector<HTMLElement>('.document-top');
  const stickyBottom = documentTop?.getBoundingClientRect().bottom ?? 0;
  const targetTop = window.scrollY + element.getBoundingClientRect().top - stickyBottom - 16;
  window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
}

function findTocTarget(entryId: string) {
  return document.querySelector<HTMLElement>(`[data-note-toc-id="${entryId}"]`);
}

function isPlainTypingShortcut(event: globalThis.KeyboardEvent) {
  return (
    isPlainLetterShortcut(event) ||
    (!event.repeat &&
      !event.isComposing &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      event.key.length === 1)
  );
}

function hasTiptapContent(document: TiptapDocument | null, contentText: string) {
  if (contentText.trim()) {
    return true;
  }

  const content = document?.content as TiptapNodeLike[] | undefined;
  return Boolean(content?.some(hasMeaningfulTiptapNode));
}

type TiptapNodeLike = {
  content?: TiptapNodeLike[];
  text?: string;
  type?: string;
};

function hasMeaningfulTiptapNode(node: TiptapNodeLike): boolean {
  if (node.type === 'text') {
    return Boolean(node.text?.trim());
  }

  if (node.type === 'noteFile' || node.type === 'noteTip' || node.type === 'image' || node.type === 'table') {
    return true;
  }

  return Boolean(node.content?.some((child) => hasMeaningfulTiptapNode(child)));
}
