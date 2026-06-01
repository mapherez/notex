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
  DynamicInlineTiptapEditor,
  DynamicTiptapEditor,
  DynamicTiptapToolbar,
  type DynamicTiptapInsertTextRequest,
  type DynamicTiptapToolbarTarget,
} from '../components/dynamic/DynamicTiptapEditor';
import { ColorPicker } from '../components/ui/ColorPicker';
import { CustomSelect } from '../components/ui/CustomSelect';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { NoteThumbnail } from '../components/ui/NoteThumbnail';
import { Panel } from '../components/ui/Panel';
import { SortableTagList } from '../components/ui/SortableTagList';
import { TagChip } from '../components/ui/TagChip';
import { appLimits, defaultNewTagColor, defaultNoteThumbnailVariant, thumbnailOptions } from '../config/appSettings';
import type { Collection, DynamicNote, DynamicNoteBlock, DynamicNoteFile, NoteThumbnail as NoteThumbnailModel, Tag, TagColor, TiptapDocument } from '../core/models/models';
import { chooseDynamicAttachment, exportDynamicAttachment, openDynamicAttachment } from '../core/services/dynamicFiles';
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
import { useDynamicNotesStore, emptyTiptapDocument } from '../store/useDynamicNotesStore';
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

type DynamicTocEntry = {
  id: string;
  label: string;
  level: 1 | 2 | 3;
};

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
  const deleteDynamicFile = useDynamicNotesStore((state) => state.deleteDynamicFile);
  const updateLinkedNotes = useDynamicNotesStore((state) => state.updateDynamicNoteLinkedNotes);
  const addAdditionalExample = useDynamicNotesStore((state) => state.addDynamicAdditionalExample);
  const updateAdditionalExample = useDynamicNotesStore((state) => state.updateDynamicAdditionalExample);
  const deleteAdditionalExample = useDynamicNotesStore((state) => state.deleteDynamicAdditionalExample);
  const addRelatedLink = useDynamicNotesStore((state) => state.addDynamicRelatedLink);
  const deleteRelatedLink = useDynamicNotesStore((state) => state.deleteDynamicRelatedLink);
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const createTag = useKnowledgeStore((state) => state.createTag);
  const user = useKnowledgeStore((state) => state.user);
  const settings = useAppStore((state) => state.settings);
  const favoriteTagIds = useAppStore((state) => state.settings.favoriteTagIds);
  const pushToast = useToastStore((state) => state.pushToast);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [deleteBlockState, setDeleteBlockState] = useState<DeleteBlockState>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragBlockIds, setDragBlockIds] = useState<string[] | null>(null);
  const [headerTypingRequest, setHeaderTypingRequest] = useState<HeaderTypingRequest | null>(null);
  const [firstBlockTypingRequest, setFirstBlockTypingRequest] = useState<DynamicTiptapInsertTextRequest | null>(null);
  const [tocEntries, setTocEntries] = useState<DynamicTocEntry[]>([]);
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
  const tocEntriesRef = useRef<DynamicTocEntry[]>([]);
  const tocRefreshFrameRef = useRef<number | null>(null);
  const [toolbarTarget, setToolbarTarget] = useState<DynamicTiptapToolbarTarget | null>(null);
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
  const linkedDynamicNotes = useMemo(
    () => note?.linkedNoteIds.flatMap((linkedId) => dynamicNotes.find((item) => item.id === linkedId && !item.isTrashed) ?? []) ?? [],
    [dynamicNotes, note?.linkedNoteIds],
  );
  const backlinkDynamicNotes = useMemo(
    () => (note ? dynamicNotes.filter((item) => item.id !== note.id && item.linkedNoteIds.includes(note.id)) : []),
    [dynamicNotes, note],
  );
  const linkSearchActive = linkInput.trim().startsWith('/');
  const linkSearchQuery = linkSearchActive ? linkInput.trim().slice(1).toLowerCase() : '';
  const linkableDynamicNotes = dynamicNotes
    .filter((item) => item.id !== note?.id && !item.isTrashed && !note?.linkedNoteIds.includes(item.id))
    .filter((item) => !linkSearchQuery || richTextToPlainText(stripInlineFormatting(item.title)).toLowerCase().includes(linkSearchQuery))
    .slice(0, appLimits.linkedNoteSuggestions);
  const linkableNoteNavigation = useKeyboardListNavigation({
    enabled: linkOpen && linkSearchActive,
    itemCount: linkableDynamicNotes.length,
    onEscape: () => setLinkOpen(false),
    onSelect: (index) => {
      const linkableNote = linkableDynamicNotes[index];
      if (linkableNote) {
        selectLinkedNote(linkableNote.id);
      }
    },
  });

  const refreshTocEntries = useCallback(() => {
    if (tocRefreshFrameRef.current) {
      window.cancelAnimationFrame(tocRefreshFrameRef.current);
    }

    tocRefreshFrameRef.current = window.requestAnimationFrame(() => {
      tocRefreshFrameRef.current = null;
      const nextEntries = collectDynamicTocEntries();
      tocEntriesRef.current = nextEntries;
      setTocEntries((currentEntries) => (sameTocEntries(currentEntries, nextEntries) ? currentEntries : nextEntries));
      setActiveTocId(findActiveTocEntryId(nextEntries));
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
    const blockList = document.querySelector('.dynamic-block-list');
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
      setActiveTocId(findActiveTocEntryId(tocEntriesRef.current));
    }

    window.addEventListener('scroll', updateActiveTocEntry, { passive: true });
    window.addEventListener('resize', updateActiveTocEntry);

    return () => {
      window.removeEventListener('scroll', updateActiveTocEntry);
      window.removeEventListener('resize', updateActiveTocEntry);
      if (tocRefreshFrameRef.current) {
        window.cancelAnimationFrame(tocRefreshFrameRef.current);
      }
    };
  }, []);

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
      const blockList = document.querySelector('.dynamic-block-list');
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-dynamic-block-id]');
      if (!blockList || !target || !blockList.contains(target)) {
        return;
      }

      const overBlockId = target.dataset.dynamicBlockId;
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
    const selected = dynamicNotes.find((item) => item.id === linkedNoteId);
    if (!selected) {
      return;
    }

    setSelectedLinkedNoteId(selected.id);
    setLinkInput(richTextToPlainText(stripInlineFormatting(selected.title)) || t('dynamicNotes.untitled'));
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

      <div className="dynamic-global-toolbar-shell">
        <DynamicTiptapToolbar
          target={toolbarTarget}
          t={t}
        />
      </div>

      <div className="dynamic-document-shell">
        <aside className="dynamic-toc" aria-label={t('dynamicNotes.tableOfContents')}>
          <div className="dynamic-toc-dashes" aria-hidden="true">
            {tocEntries.map((entry) => (
              <span
                className={[
                  'dynamic-toc-dash',
                  `dynamic-toc-dash--level-${entry.level}`,
                  activeTocId === entry.id && 'is-active',
                ].filter(Boolean).join(' ')}
                key={entry.id}
              />
            ))}
          </div>
          <div className="dynamic-toc-content">
            {tocEntries.length ? (
              <nav>
                {tocEntries.map((entry) => (
                  <button
                    className={[
                      'dynamic-toc-link',
                      `dynamic-toc-link--level-${entry.level}`,
                      activeTocId === entry.id && 'is-active',
                    ].filter(Boolean).join(' ')}
                    key={entry.id}
                    type="button"
                    onClick={(event) => {
                      event.currentTarget.blur();
                      scrollToTocEntry(entry.id);
                    }}
                  >
                    {entry.label}
                  </button>
                ))}
              </nav>
            ) : (
              <span className="dynamic-toc-empty">{t('dynamicNotes.emptyToc')}</span>
            )}
          </div>
        </aside>

        <main className="dynamic-document-main">
          <DynamicNoteHeader
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

          <section className={draggedBlockId ? 'dynamic-block-list is-reordering' : 'dynamic-block-list'}>
            {visibleBlocks.map((block) => (
              <DynamicBlockEditor
                block={block}
                contentTypingRequest={block.id === firstBlockId ? firstBlockTypingRequest : null}
                dragged={draggedBlockId === block.id}
                key={block.id}
                noteId={note.id}
                onDelete={() => setDeleteBlockState({ blockId: block.id, title: richTextToPlainText(block.title).trim() || t('dynamicNotes.untitledBlock') })}
                onDragStart={(event) => startBlockDrag(event, block.id)}
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
                onToolbarTargetChange={setToolbarTarget}
                onTocChange={refreshTocEntries}
              />
            ))}
          </section>

          <div className="dynamic-add-block-row">
            <button type="button" aria-label={t('dynamicNotes.addContentBlock')} title={t('dynamicNotes.addContentBlock')} onClick={() => void addContentBlock('content')}>
              +
            </button>
          </div>
        </main>

        <aside className="document-aside dynamic-document-aside">
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
            <DynamicTagEditor
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
              {linkedDynamicNotes.map((linkedNote) => (
                <DynamicLinkedNoteRow
                  key={linkedNote.id}
                  noteId={linkedNote.id}
                  title={linkedNote.title}
                  onRemove={() => void updateLinkedNotes(note.id, note.linkedNoteIds.filter((linkedId) => linkedId !== linkedNote.id)).then(() => pushToast(t('noteDetail.linkDeleted'), 'warning'))}
                />
              ))}
              {note.relatedLinks?.map((link) => (
                <DynamicRelatedLinkRow
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
                    {linkableDynamicNotes.length ? (
                      linkableDynamicNotes.map((linkableNote, linkIndex) => (
                        <button
                          className={linkIndex === linkableNoteNavigation.activeIndex ? 'active' : undefined}
                          key={linkableNote.id}
                          type="button"
                          onClick={() => selectLinkedNote(linkableNote.id)}
                          onMouseEnter={() => linkableNoteNavigation.setActiveIndex(linkIndex)}
                        >
                          <FileText />
                          <InlineFormattedText value={richTextToPlainText(stripInlineFormatting(linkableNote.title))} />
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
            {backlinkDynamicNotes.length ? (
              <div className="backlink-section">
                <h3>{t('noteDetail.backlinks')}</h3>
                <div className="side-list">
                  {backlinkDynamicNotes.map((backlink) => (
                    <DynamicLinkedNoteRow key={backlink.id} noteId={backlink.id} title={backlink.title} />
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel title={t('dynamicNotes.files')}>
            {note.files?.length ? (
              <ul className="side-list dynamic-file-side-list">
                {note.files.map((file) => (
                  <li key={file.id}>
                    {file.kind === 'image' ? <ImageIcon /> : <FileText />}
                    <span>{file.originalName}</span>
                    <span className="side-list-actions">
                      <button className="icon-button" type="button" aria-label={t('common.open')} onClick={() => void openDynamicAttachment(file.relativePath)}>
                        <FileText />
                      </button>
                      <button className="icon-button" type="button" aria-label={t('common.export')} onClick={() => void exportDynamicAttachment(file)}>
                        <Download />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        aria-label={t('common.delete')}
                        onClick={() => void deleteDynamicFile(note.id, file.id).then(() => pushToast(t('noteDetail.linkDeleted'), 'warning'))}
                      >
                        <Trash2 />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="inline-help">{t('dynamicNotes.noFiles')}</p>
            )}
          </Panel>
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
  noteTags,
  onChange,
  onTagsChange,
  onThumbnailChange,
  onToolbarTargetChange,
  t,
  typingRequest,
}: {
  collections: Collection[];
  note: DynamicNote;
  noteTags: Tag[];
  onChange: (input: { collectionId?: string | null; subtitle?: string; title?: string }) => void;
  onTagsChange: (tagIds: string[]) => void;
  onThumbnailChange: (thumbnail: NoteThumbnailModel) => void;
  onToolbarTargetChange: (target: DynamicTiptapToolbarTarget) => void;
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
    <section className="document-heading dynamic-document-heading">
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
          <DynamicInlineTiptapEditor
            className="document-title-input dynamic-title-input"
            id={`dynamic-note-title-${note.id}`}
            insertTextRequest={typingRequest?.field === 'title' ? typingRequest : null}
            onChange={(nextTitle) => setTitle(nextTitle)}
            onToolbarTargetChange={onToolbarTargetChange}
            placeholder={t('noteDetail.titlePlaceholder')}
            value={title}
          />
        </div>
        <DynamicThumbnailPicker current={note.thumbnail} onSelect={onThumbnailChange} t={t} />
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

      <DynamicInlineTiptapEditor
        className="document-intro-input dynamic-subtitle-input"
        id={`dynamic-note-subtitle-${note.id}`}
        insertTextRequest={typingRequest?.field === 'subtitle' ? typingRequest : null}
        onChange={(nextSubtitle) => setSubtitle(nextSubtitle)}
        onToolbarTargetChange={onToolbarTargetChange}
        placeholder={t('dynamicNotes.subtitlePlaceholder')}
        value={subtitle}
      />
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

function DynamicBlockEditor({
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
  block: DynamicNoteBlock;
  contentTypingRequest?: DynamicTiptapInsertTextRequest | null;
  dragged: boolean;
  noteId: string;
  onDelete: () => void;
  onDragStart: (event: PointerEvent<HTMLButtonElement>) => void;
  onRequestFileUpload: () => Promise<DynamicNoteFile | null>;
  onTocChange: () => void;
  onToolbarTargetChange: (target: DynamicTiptapToolbarTarget) => void;
}) {
  const { t } = useI18n();
  const updateBlock = useDynamicNotesStore((state) => state.updateDynamicBlock);
  const [title, setTitle] = useState(block.title);
  const [contentJson, setContentJson] = useState<TiptapDocument | null>(block.contentJson);
  const [contentText, setContentText] = useState(block.contentText);
  const [titleActive, setTitleActive] = useState(false);
  const [contentActive, setContentActive] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastTypingNonceRef = useRef<number | null>(null);
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

  return (
    <article
      className={dragged ? 'dynamic-block is-dragging' : 'dynamic-block'}
      data-dynamic-block-id={block.id}
      id={`block-${block.id}`}
      data-empty={blockIsEmpty ? 'true' : undefined}
    >
      <button
        className="dynamic-block-handle"
        type="button"
        aria-label={t('dynamicNotes.reorderBlock')}
        aria-grabbed={dragged}
        title={t('dynamicNotes.reorderBlock')}
        onPointerDown={onDragStart}
      >
        <GripVertical />
      </button>
      <div className="dynamic-block-body">
        {titleVisible ? (
          <DynamicInlineTiptapEditor
            autoFocus={titleActive && !titleHasContent}
            blockId={block.id}
            className="dynamic-block-title"
            id={`dynamic-block-title-${block.id}`}
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
            className="dynamic-block-zone-add dynamic-block-zone-add-title"
            type="button"
            aria-label={t('dynamicNotes.addTitleBlock')}
            title={t('dynamicNotes.addTitleBlock')}
            onClick={() => setTitleActive(true)}
          >
            <Plus />
          </button>
        )}
        {contentVisible ? (
          <DynamicTiptapEditor
            autoFocus={contentActive && !contentHasContent}
            blockId={block.id}
            insertTextRequest={contentTypingRequest}
            onBlur={() => {
              if (!hasTiptapContent(contentJson, contentText)) {
                setContentActive(false);
              }
            }}
            onChange={(nextJson, nextText) => {
              setContentJson(nextJson);
              setContentText(nextText);
              onTocChange();
            }}
            onFocus={() => setContentActive(true)}
            onRequestFileUpload={onRequestFileUpload}
            onToolbarTargetChange={onToolbarTargetChange}
            value={contentJson ?? emptyTiptapDocument}
          />
        ) : (
          <button
            className="dynamic-block-zone-add dynamic-block-zone-add-content"
            type="button"
            aria-label={t('dynamicNotes.addContentBlock')}
            title={t('dynamicNotes.addContentBlock')}
            onClick={() => {
              setContentJson((current) => current ?? emptyTiptapDocument);
              setContentActive(true);
            }}
          >
            <Plus />
          </button>
        )}
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
            <div className="inline-picker dynamic-tag-picker">
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

function DynamicLinkedNoteRow({ noteId, onRemove, title }: { noteId: string; onRemove?: () => void; title: string }) {
  const plainTitle = richTextToPlainText(stripInlineFormatting(title));

  return (
    <span className="linked-row-shell">
      <Link className="linked-row" to={`/notes/${noteId}`}>
        <span className="inline-actions">
          <FileText />
          <InlineFormattedText value={plainTitle} />
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

function DynamicRelatedLinkRow({ href, onRemove, title }: { href: string; onRemove?: () => void; title: string }) {
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
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function collectDynamicTocEntries() {
  const entries: DynamicTocEntry[] = [];
  const blockElements = Array.from(document.querySelectorAll<HTMLElement>('.dynamic-block-list [data-dynamic-block-id]'));

  blockElements.forEach((blockElement) => {
    const blockId = blockElement.dataset.dynamicBlockId;
    if (!blockId) {
      return;
    }

    const titleElement = blockElement.querySelector<HTMLElement>('.dynamic-block-title');
    const title = titleElement?.textContent?.trim();
    if (title && titleElement) {
      const id = `block-title-${blockId}`;
      titleElement.dataset.dynamicTocId = id;
      entries.push({ id, label: title, level: 1 });
    }

    const headings = Array.from(blockElement.querySelectorAll<HTMLHeadingElement>('.dynamic-tiptap-prosemirror h1, .dynamic-tiptap-prosemirror h2, .dynamic-tiptap-prosemirror h3'));
    headings.forEach((heading, index) => {
      const label = heading.textContent?.trim();
      if (!label) {
        return;
      }

      const level = Number(heading.tagName.slice(1)) as 1 | 2 | 3;
      const id = `heading-${blockId}-${index}`;
      heading.dataset.dynamicTocId = id;
      entries.push({ id, label, level });
    });
  });

  return entries;
}

function sameTocEntries(left: DynamicTocEntry[], right: DynamicTocEntry[]) {
  return (
    left.length === right.length &&
    left.every((entry, index) => {
      const other = right[index];
      return entry.id === other.id && entry.label === other.label && entry.level === other.level;
    })
  );
}

function findActiveTocEntryId(entries: DynamicTocEntry[]) {
  if (!entries.length) {
    return null;
  }

  const triggerY = window.innerHeight / 2;
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

function scrollToTocEntry(entryId: string) {
  const element = findTocTarget(entryId);
  if (!element) {
    return;
  }

  const toolbar = document.querySelector<HTMLElement>('.dynamic-global-toolbar-shell');
  const stickyBottom = toolbar?.getBoundingClientRect().bottom ?? 0;
  const targetTop = window.scrollY + element.getBoundingClientRect().top - stickyBottom - 16;
  window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
}

function findTocTarget(entryId: string) {
  return document.querySelector<HTMLElement>(`[data-dynamic-toc-id="${entryId}"]`);
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

  if (node.type === 'dynamicFile' || node.type === 'dynamicTip' || node.type === 'image' || node.type === 'table') {
    return true;
  }

  return Boolean(node.content?.some((child) => hasMeaningfulTiptapNode(child)));
}
