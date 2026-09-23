import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Check,
  Cloud,
  ExternalLink,
  FileText,
  Folder,
  GripVertical,
  Image as ImageIcon,
  MoreVertical,
  Pencil,
  Plus,
  Download,
  Star,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useMenuOptionFocus } from '../core/utils/useMenuOptionFocus';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InlineFormattedText } from '../components/editing/InlineFormattedText';
import { NoteHeaderDraftProvider, useNoteHeaderDraft } from '../components/notes/NoteHeaderDraft';
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
import { AppModal } from '../components/ui/AppModal';
import { EmptyState } from '../components/ui/EmptyState';
import { NoteThumbnail } from '../components/ui/NoteThumbnail';
import { Panel } from '../components/ui/Panel';
import { ResponsiveSidePanel } from '../components/ui/ResponsiveSidePanel';
import { SortableTagList } from '../components/ui/SortableTagList';
import { TagChip } from '../components/ui/TagChip';
import { appLimits, defaultNewTagColor, defaultNoteThumbnailVariant, editorSettings, thumbnailOptions } from '../config/appSettings';
import type { Collection, Note, NoteBlock, NoteFile, NoteFileKind, NoteThumbnail as NoteThumbnailModel, Tag, TagColor, TiptapDocument } from '../core/models/models';
import { beginLocalSave, setLocalDraftPending } from '../core/mcp/noteMutationCoordinator';
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
import { useAdaptedContent, useTouchInputAvailable } from '../core/utils/useAdaptedContent';
import { useFloatingPopover } from '../core/utils/useFloatingPopover';
import { useKeyboardListNavigation } from '../core/utils/useKeyboardListNavigation';
import { sortTagsByFavoriteOrder } from '../core/utils/tagSorting';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useNotesStore, emptyTiptapDocument } from '../store/useNotesStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';
import { useCloudStore } from '../store/useCloudStore';
import { isTauri } from '@tauri-apps/api/core';

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

type TouchHoldState = {
  anchorRatio: number;
  blockId: string;
  dragging: boolean;
  dropIndex: number;
  ghostLeft: number;
  ghostWidth: number;
  lineLeft: number;
  lineTop: number;
  lineWidth: number;
  menuDeleteSide: 'left' | 'right';
  menuLeft: number;
  menuOpen: boolean;
  menuTop: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

type DesktopDragState = {
  anchorRatio: number;
  anchorY: number;
  blockId: string;
  dropIndex: number;
  ghostLeft: number;
  ghostWidth: number;
  grabOffsetX: number;
  lineLeft: number;
  lineTop: number;
  lineWidth: number;
  pointerId: number;
  x: number;
  y: number;
};

export function NoteDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const adapted = useAdaptedContent();
  const touchInputAvailable = useTouchInputAvailable();
  const touchAdapted = adapted && touchInputAvailable;
  const [panelsOpen, setPanelsOpen] = useState(false);
  const panelsTriggerRef = useRef<HTMLButtonElement>(null);
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
  const draggedBlockIdRef = useRef<string | null>(null);
  const [desktopDragState, setDesktopDragState] = useState<DesktopDragState | null>(null);
  const desktopDragStateRef = useRef<DesktopDragState | null>(null);
  const desktopInitialBlockIdsRef = useRef<string[]>([]);
  const desktopDragCompactionPendingRef = useRef(false);
  const desktopDragReleaseAnchorRef = useRef<DesktopDragState | null>(null);
  const desktopDragPersistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const desktopDragPersistRevisionRef = useRef(0);
  const desktopDragGhostRef = useRef<HTMLDivElement>(null);
  const desktopDropIndicatorRef = useRef<HTMLDivElement>(null);
  const keyboardReorderPendingRef = useRef(false);
  const typingRequestNonceRef = useRef(0);
  const tocEntriesRef = useRef<TocEntry[]>([]);
  const tocRefreshFrameRef = useRef<number | null>(null);
  const [toolbarTarget, setToolbarTarget] = useState<NoteTiptapToolbarTarget | null>(null);
  const [touchActiveBlockId, setTouchActiveBlockId] = useState<string | null>(null);
  const [touchHoldState, setTouchHoldState] = useState<TouchHoldState | null>(null);
  const touchHoldStateRef = useRef<TouchHoldState | null>(null);
  const touchInitialBlockIdsRef = useRef<string[]>([]);
  const touchMenuBlockIdsRef = useRef<string[]>([]);
  const touchMenuMoveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const touchMenuMoveRevisionRef = useRef(0);
  const touchReleaseAnchorRef = useRef<TouchHoldState | null>(null);
  const finishTouchDragRef = useRef<(cancelled: boolean) => void>(() => undefined);
  const touchDragGhostRef = useRef<HTMLDivElement>(null);
  const touchDropIndicatorRef = useRef<HTMLDivElement>(null);
  const touchBlockMenuRef = useRef<HTMLDivElement>(null);
  const touchViewportHeightRef = useRef(0);
  const touchKeyboardSeenRef = useRef(false);
  const [noteActionsOpen, setNoteActionsOpen] = useState(false);
  const noteActionsRef = useRef<HTMLDivElement>(null);
  const noteActionsMenu = useMenuOptionFocus(noteActionsOpen, () => setNoteActionsOpen(false));
  useFloatingPopover(
    noteActionsOpen,
    noteActionsMenu.triggerRef,
    noteActionsMenu.menuRef,
    'bottom-end',
  );
  const note = isNewNote ? undefined : notes.find((item) => item.id === id);
  const ensureAvailable = useCloudStore((state) => state.ensureAvailable);
  const transferError = useCloudStore((state) => state.error);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const cloudAccountId = useCloudStore((state) => state.accountId);
  const excludedNotes = useCloudStore((state) => state.excludedNotes);
  const toggleExcluded = useCloudStore((state) => state.toggleExcluded);
  useClickOutside(noteActionsRef, noteActionsOpen, () => setNoteActionsOpen(false));
  useEffect(() => { setPanelsOpen(false); }, [adapted, id]);
  useEffect(() => {
    if (!touchAdapted) setNoteActionsOpen(false);
  }, [id, touchAdapted]);
  useEffect(() => {
    setTouchActiveBlockId(null);
    desktopDragStateRef.current = null;
    desktopInitialBlockIdsRef.current = [];
    desktopDragReleaseAnchorRef.current = null;
    draggedBlockIdRef.current = null;
    setDesktopDragState(null);
    setDraggedBlockId(null);
    setDragBlockIds(null);
    touchHoldStateRef.current = null;
    touchInitialBlockIdsRef.current = [];
    touchMenuBlockIdsRef.current = [];
    setTouchHoldState(null);
    setToolbarTarget(null);
    touchKeyboardSeenRef.current = false;
  }, [id, touchAdapted]);
  useEffect(() => {
    let active = true;
    setDownloadError(null);
    if (note?.cloudOnly) void ensureAvailable(note.id).catch((error) => {
      if (active) setDownloadError(error instanceof Error ? error.message : String(error));
    });
    return () => { active = false; };
  }, [note?.id, note?.cloudOnly, ensureAvailable]);

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
    if (note && !note.cloudOnly && !isNewNote) {
      void markOpened(note.id);
    }
  }, [isNewNote, markOpened, note?.id, note?.cloudOnly]);

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
  const touchHeldBlock = touchHoldState
    ? (note?.blocks ?? []).find((block) => block.id === touchHoldState.blockId) ?? null
    : null;
  const desktopDraggedBlock = desktopDragState
    ? (note?.blocks ?? []).find((block) => block.id === desktopDragState.blockId) ?? null
    : null;
  const touchMenuBlockIds = dragBlockIds ?? (note?.blocks ?? []).map((block) => block.id);
  const touchMenuBlockIndex = touchHoldState?.menuOpen
    ? touchMenuBlockIds.indexOf(touchHoldState.blockId)
    : -1;
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
    if (!isTauri()) return;
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

  const activateTouchBlock = useCallback((blockId: string) => {
    if (!touchAdapted) return;
    if (!touchActiveBlockId) {
      touchViewportHeightRef.current = window.visualViewport?.height ?? window.innerHeight;
      touchKeyboardSeenRef.current = false;
    }
    setTouchActiveBlockId(blockId);
  }, [touchActiveBlockId, touchAdapted]);

  const deactivateTouchBlock = useCallback((blockId?: string) => {
    setTouchActiveBlockId((current) => (blockId && current !== blockId ? current : null));
    setToolbarTarget((current) => (!blockId || current?.blockId === blockId ? null : current));
  }, []);

  const beginTouchBlockHold = useCallback((blockId: string, x: number, y: number) => {
    const block = document.getElementById(`block-${blockId}`);
    const rect = block?.getBoundingClientRect();
    const blockList = block?.closest<HTMLElement>('.note-block-list');
    const listRect = blockList?.getBoundingClientRect();
    const blockIds = (note?.blocks ?? []).map((item) => item.id);
    const sourceIndex = Math.max(0, blockIds.indexOf(blockId));
    const anchorRatio = rect && rect.height > 0
      ? Math.min(1, Math.max(0, (y - rect.top) / rect.height))
      : 0.5;
    const nextState: TouchHoldState = {
      anchorRatio,
      blockId,
      dragging: false,
      dropIndex: sourceIndex,
      ghostLeft: listRect?.left ?? rect?.left ?? 0,
      ghostWidth: listRect?.width ?? rect?.width ?? 0,
      lineLeft: listRect?.left ?? rect?.left ?? 0,
      lineTop: rect?.top ?? y,
      lineWidth: listRect?.width ?? rect?.width ?? 0,
      menuDeleteSide: 'right',
      menuLeft: x,
      menuOpen: false,
      menuTop: y,
      startX: x,
      startY: y,
      x,
      y,
    };
    touchHoldStateRef.current = nextState;
    touchInitialBlockIdsRef.current = blockIds;
    touchMenuBlockIdsRef.current = blockIds;
    setTouchHoldState(nextState);
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(editorSettings.blockTouch.holdHapticMs);
    }
  }, [note?.blocks]);

  const endTouchBlockHold = useCallback((blockId: string) => {
    const current = touchHoldStateRef.current;
    if (current?.blockId !== blockId) return;
    if (current.dragging) {
      finishTouchDragRef.current(false);
      return;
    }
    if (current.menuOpen) return;
    touchReleaseAnchorRef.current = current;
    touchHoldStateRef.current = null;
    setTouchHoldState(null);
  }, []);

  const openTouchBlockMenu = useCallback((blockId: string, x: number, y: number) => {
    const current = touchHoldStateRef.current;
    if (!current || current.blockId !== blockId || current.dragging) return;
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const actionExtent = 84;
    const viewportPadding = 12;
    const canShowDeleteRight = x + actionExtent <= viewportRight - viewportPadding;
    const canShowDeleteLeft = x - actionExtent >= viewportLeft + viewportPadding;
    const menuDeleteSide: TouchHoldState['menuDeleteSide'] = canShowDeleteRight || !canShowDeleteLeft
      ? 'right'
      : 'left';
    const horizontalStartEdge = menuDeleteSide === 'left' ? actionExtent + viewportPadding : 32;
    const horizontalEndEdge = menuDeleteSide === 'right' ? actionExtent + viewportPadding : 32;
    const verticalEdge = actionExtent + viewportPadding;
    const nextState: TouchHoldState = {
      ...current,
      menuLeft: Math.min(
        viewportLeft + viewportWidth - horizontalEndEdge,
        Math.max(viewportLeft + horizontalStartEdge, x),
      ),
      menuDeleteSide,
      menuOpen: true,
      menuTop: Math.min(
        viewportTop + viewportHeight - verticalEdge,
        Math.max(viewportTop + verticalEdge, y),
      ),
    };
    touchHoldStateRef.current = nextState;
    setTouchHoldState(nextState);
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(editorSettings.blockTouch.menuHapticPatternMs);
    }
  }, []);

  const closeTouchBlockMenu = useCallback(() => {
    const current = touchHoldStateRef.current;
    if (!current?.menuOpen) return;
    touchReleaseAnchorRef.current = current;
    touchHoldStateRef.current = null;
    setTouchHoldState(null);
  }, []);

  useLayoutEffect(() => {
    const anchor = touchHoldState ?? touchReleaseAnchorRef.current;
    if (!anchor) return;
    if (touchHoldState?.dragging) return;
    const heldBlock = document.getElementById(`block-${anchor.blockId}`);
    if (!heldBlock) return;
    const rect = heldBlock.getBoundingClientRect();
    const targetY = touchHoldState
      ? rect.top + rect.height / 2
      : rect.top + rect.height * anchor.anchorRatio;
    const offset = targetY - anchor.y;
    if (Math.abs(offset) > 1) {
      window.scrollBy({ top: offset, behavior: 'instant' });
    }
    if (!touchHoldState) touchReleaseAnchorRef.current = null;
  }, [touchHoldState]);

  useLayoutEffect(() => {
    if (!touchHoldState?.dragging) return;
    touchDragGhostRef.current?.style.setProperty('--nx-touch-drag-left', `${touchHoldState.ghostLeft}px`);
    touchDragGhostRef.current?.style.setProperty('--nx-touch-drag-top', `${touchHoldState.y}px`);
    touchDragGhostRef.current?.style.setProperty('--nx-touch-drag-width', `${touchHoldState.ghostWidth}px`);
    touchDropIndicatorRef.current?.style.setProperty('--nx-touch-drop-left', `${touchHoldState.lineLeft}px`);
    touchDropIndicatorRef.current?.style.setProperty('--nx-touch-drop-top', `${touchHoldState.lineTop}px`);
    touchDropIndicatorRef.current?.style.setProperty('--nx-touch-drop-width', `${touchHoldState.lineWidth}px`);
  }, [touchHoldState]);

  useLayoutEffect(() => {
    const current = desktopDragState;
    if (current && desktopDragCompactionPendingRef.current) {
      const heldBlock = document.getElementById(`block-${current.blockId}`);
      if (!heldBlock) return;
      const rect = heldBlock.getBoundingClientRect();
      const targetY = rect.top + rect.height * current.anchorRatio;
      const offset = targetY - current.anchorY;
      desktopDragCompactionPendingRef.current = false;
      if (Math.abs(offset) > 1) window.scrollBy({ top: offset, behavior: 'instant' });
      updateDesktopDragPosition(current.x, current.y);
      return;
    }
    if (current) return;

    const releaseAnchor = desktopDragReleaseAnchorRef.current;
    if (!releaseAnchor) return;
    const heldBlock = document.getElementById(`block-${releaseAnchor.blockId}`);
    if (!heldBlock) {
      desktopDragReleaseAnchorRef.current = null;
      return;
    }
    const rect = heldBlock.getBoundingClientRect();
    const targetY = rect.top + rect.height * releaseAnchor.anchorRatio;
    const offset = targetY - releaseAnchor.anchorY;
    if (Math.abs(offset) > 1) window.scrollBy({ top: offset, behavior: 'instant' });
    desktopDragReleaseAnchorRef.current = null;
  }, [desktopDragState, dragBlockIds]);

  useLayoutEffect(() => {
    if (!desktopDragState) return;
    desktopDragGhostRef.current?.style.setProperty('--nx-touch-drag-left', `${desktopDragState.ghostLeft}px`);
    desktopDragGhostRef.current?.style.setProperty('--nx-touch-drag-top', `${desktopDragState.y}px`);
    desktopDragGhostRef.current?.style.setProperty('--nx-touch-drag-width', `${desktopDragState.ghostWidth}px`);
    desktopDropIndicatorRef.current?.style.setProperty('--nx-touch-drop-left', `${desktopDragState.lineLeft}px`);
    desktopDropIndicatorRef.current?.style.setProperty('--nx-touch-drop-top', `${desktopDragState.lineTop}px`);
    desktopDropIndicatorRef.current?.style.setProperty('--nx-touch-drop-width', `${desktopDragState.lineWidth}px`);
  }, [desktopDragState]);

  useLayoutEffect(() => {
    if (!touchHoldState?.menuOpen) return;
    touchBlockMenuRef.current?.style.setProperty('--nx-touch-menu-left', `${touchHoldState.menuLeft}px`);
    touchBlockMenuRef.current?.style.setProperty('--nx-touch-menu-top', `${touchHoldState.menuTop}px`);
  }, [touchHoldState]);

  useEffect(() => {
    if (!touchAdapted || !note) return undefined;
    const noteId = note.id;
    let animationFrame: number | null = null;
    let lastFrameTime = performance.now();

    function updateDragPosition(clientX: number, clientY: number, forceDragging = false) {
      const current = touchHoldStateRef.current;
      if (!current) return false;
      if (current.menuOpen) return false;
      const moved = Math.hypot(clientX - current.startX, clientY - current.startY);
      if (!current.dragging && !forceDragging && moved <= editorSettings.blockTouch.tapMovementTolerance) {
        return false;
      }

      const blockList = document.querySelector<HTMLElement>('.note-block-list');
      if (!blockList) return false;
      const listRect = blockList.getBoundingClientRect();
      const candidates = Array.from(blockList.querySelectorAll<HTMLElement>('[data-note-block-id]'))
        .filter((element) => element.dataset.noteBlockId !== current.blockId)
        .map((element) => ({ element, rect: element.getBoundingClientRect() }));
      let dropIndex = candidates.findIndex(({ rect }) => clientY < rect.top + rect.height / 2);
      if (dropIndex < 0) dropIndex = candidates.length;

      let lineTop = listRect.top;
      if (candidates.length > 0) {
        if (dropIndex === 0) {
          lineTop = candidates[0].rect.top;
        } else if (dropIndex === candidates.length) {
          lineTop = candidates[candidates.length - 1].rect.bottom;
        } else {
          lineTop = (candidates[dropIndex - 1].rect.bottom + candidates[dropIndex].rect.top) / 2;
        }
      }

      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const sourceBlock = document.getElementById(`block-${current.blockId}`);
      const sourceRect = sourceBlock?.getBoundingClientRect();
      const grabOffsetX = current.startX - (sourceRect?.left ?? listRect.left);
      const ghostWidth = Math.min(listRect.width, viewportWidth - 16);
      const desiredLeft = clientX - grabOffsetX;
      const ghostLeft = Math.min(
        viewportLeft + viewportWidth - ghostWidth - 8,
        Math.max(viewportLeft + 8, desiredLeft),
      );
      const nextState: TouchHoldState = {
        ...current,
        dragging: true,
        dropIndex,
        ghostLeft,
        ghostWidth,
        lineLeft: listRect.left,
        lineTop,
        lineWidth: listRect.width,
        x: clientX,
        y: clientY,
      };
      touchHoldStateRef.current = nextState;
      setTouchHoldState(nextState);
      if (animationFrame === null) {
        lastFrameTime = performance.now();
        animationFrame = window.requestAnimationFrame(runAutoScroll);
      }
      return true;
    }

    function finishTouchDrag(cancelled: boolean) {
      const current = touchHoldStateRef.current;
      if (!current) return;
      if (current.menuOpen) return;
      touchReleaseAnchorRef.current = current;
      touchHoldStateRef.current = null;

      if (cancelled || !current.dragging) {
        setTouchHoldState(null);
        return;
      }

      const initialBlockIds = touchInitialBlockIdsRef.current;
      const remainingIds = initialBlockIds.filter((blockId) => blockId !== current.blockId);
      const targetIndex = Math.min(remainingIds.length, Math.max(0, current.dropIndex));
      const nextIds = [...remainingIds];
      nextIds.splice(targetIndex, 0, current.blockId);
      setDragBlockIds(nextIds);
      setTouchHoldState(null);
      if (arraysEqual(nextIds, initialBlockIds)) {
        setDragBlockIds(null);
        return;
      }
      void reorderBlocks(noteId, nextIds).finally(() => setDragBlockIds(null));
    }

    function handleTouchMove(event: globalThis.TouchEvent) {
      if (!touchHoldStateRef.current) return;
      if (event.touches.length !== 1) {
        finishTouchDrag(true);
        return;
      }
      if (touchHoldStateRef.current?.menuOpen) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target?.closest('.note-touch-block-menu-action') && event.cancelable) {
          event.preventDefault();
        }
        return;
      }
      if (event.cancelable) event.preventDefault();
      const touch = event.touches[0];
      updateDragPosition(touch.clientX, touch.clientY);
    }

    function handleTouchEnd(event: globalThis.TouchEvent) {
      const current = touchHoldStateRef.current;
      if (current?.menuOpen) return;
      if (current?.dragging && event.cancelable) event.preventDefault();
      finishTouchDrag(false);
    }

    function handleTouchCancel() {
      finishTouchDrag(true);
    }

    function runAutoScroll(frameTime: number) {
      const current = touchHoldStateRef.current;
      if (!current?.dragging) {
        animationFrame = null;
        return;
      }
      const elapsedSeconds = Math.min(0.05, Math.max(0, frameTime - lastFrameTime) / 1000);
      lastFrameTime = frameTime;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportBottom = viewportTop + viewportHeight;
      const zone = Math.min(editorSettings.blockTouch.autoScrollEdgeZone, viewportHeight / 3);
      let velocity = 0;
      if (current.y < viewportTop + zone) {
        const intensity = Math.min(1, Math.max(0, (viewportTop + zone - current.y) / zone));
        velocity = -editorSettings.blockTouch.autoScrollMaxPxPerSecond * intensity;
      } else if (current.y > viewportBottom - zone) {
        const intensity = Math.min(1, Math.max(0, (current.y - (viewportBottom - zone)) / zone));
        velocity = editorSettings.blockTouch.autoScrollMaxPxPerSecond * intensity;
      }
      if (velocity !== 0) {
        window.scrollBy(0, velocity * elapsedSeconds);
        updateDragPosition(current.x, current.y, true);
      }
      animationFrame = window.requestAnimationFrame(runAutoScroll);
    }

    window.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
    window.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
    window.addEventListener('touchcancel', handleTouchCancel, { capture: true, passive: true });
    finishTouchDragRef.current = finishTouchDrag;
    return () => {
      window.removeEventListener('touchmove', handleTouchMove, true);
      window.removeEventListener('touchend', handleTouchEnd, true);
      window.removeEventListener('touchcancel', handleTouchCancel, true);
      if (finishTouchDragRef.current === finishTouchDrag) {
        finishTouchDragRef.current = () => undefined;
      }
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [note?.id, reorderBlocks, touchAdapted]);

  useEffect(() => {
    if (!touchAdapted || !touchActiveBlockId) return undefined;
    const visualViewport = window.visualViewport;

    function updateKeyboardState() {
      const currentHeight = visualViewport?.height ?? window.innerHeight;
      const heightLoss = touchViewportHeightRef.current - currentHeight;
      if (heightLoss >= editorSettings.blockTouch.keyboardThreshold) {
        touchKeyboardSeenRef.current = true;
        return;
      }
      if (touchKeyboardSeenRef.current && heightLoss <= editorSettings.blockTouch.keyboardThreshold / 2) {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
          activeElement.blur();
        }
        deactivateTouchBlock(touchActiveBlockId ?? undefined);
        touchKeyboardSeenRef.current = false;
      }
    }

    visualViewport?.addEventListener('resize', updateKeyboardState);
    window.addEventListener('resize', updateKeyboardState);
    return () => {
      visualViewport?.removeEventListener('resize', updateKeyboardState);
      window.removeEventListener('resize', updateKeyboardState);
    };
  }, [deactivateTouchBlock, touchActiveBlockId, touchAdapted]);

  useEffect(() => {
    if (!touchAdapted || !touchActiveBlockId) return undefined;

    function handlePointerDown(event: globalThis.PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest('.note-block, .document-top-toolbar, .note-toolbar-popover')) return;
      deactivateTouchBlock(touchActiveBlockId ?? undefined);
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [deactivateTouchBlock, touchActiveBlockId, touchAdapted]);

  useEffect(() => {
    refreshTocEntries();
  }, [refreshTocEntries, note?.id, visibleBlocks]);

  useLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>('.note-document-shell');
    const documentTop = document.querySelector<HTMLElement>('.document-top');
    const topbar = document.querySelector<HTMLElement>('.topbar');
    if (!shell || !documentTop) return;
    const visualViewport = window.visualViewport;
    const topbarBaseTop = topbar
      ? Math.max(0, Number.parseFloat(window.getComputedStyle(topbar).top) || 0)
      : 0;
    const bars = Array.from(document.querySelectorAll<HTMLElement>('.topbar, .document-top, .note-edit-toolbar-shell'));
    function updateOffset() {
      if (topbar) {
        const visualViewportTop = touchAdapted
          ? Math.max(0, visualViewport?.offsetTop ?? 0)
          : 0;
        topbar.style.setProperty('--nx-visual-viewport-top', `${visualViewportTop}px`);
        const documentTopOffset = topbarBaseTop + visualViewportTop + topbar.getBoundingClientRect().height;
        documentTop!.style.setProperty('--nx-document-top-offset', `${documentTopOffset}px`);
      }
      const bottom = Math.max(0, ...bars.map((bar) => bar.getBoundingClientRect().bottom));
      shell!.style.setProperty('--nx-note-navigation-top', `${bottom + 16}px`);
    }
    const observer = new ResizeObserver(updateOffset);
    bars.forEach((bar) => observer.observe(bar));
    updateOffset();
    window.addEventListener('resize', updateOffset);
    visualViewport?.addEventListener('resize', updateOffset);
    visualViewport?.addEventListener('scroll', updateOffset);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateOffset);
      visualViewport?.removeEventListener('resize', updateOffset);
      visualViewport?.removeEventListener('scroll', updateOffset);
      topbar?.style.removeProperty('--nx-visual-viewport-top');
      documentTop.style.removeProperty('--nx-document-top-offset');
    };
  }, [note?.id, touchAdapted]);

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
        panelsOpen ||
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
  }, [deleteBlockState, draggedBlockId, firstBlockId, note, panelsOpen]);

  useEffect(() => {
    if (!draggedBlockId) {
      return undefined;
    }

    let animationFrame: number | null = null;
    let lastFrameTime = performance.now();

    function handlePointerMove(event: globalThis.PointerEvent) {
      const current = desktopDragStateRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (event.cancelable) event.preventDefault();
      updateDesktopDragPosition(event.clientX, event.clientY);
    }

    function handlePointerEnd(event: globalThis.PointerEvent) {
      const current = desktopDragStateRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      finishDesktopBlockDrag(false);
    }

    function handlePointerCancel(event: globalThis.PointerEvent) {
      const current = desktopDragStateRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      finishDesktopBlockDrag(true);
    }

    function handleLostPointerCapture(event: globalThis.PointerEvent) {
      const current = desktopDragStateRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      finishDesktopBlockDrag(true);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !desktopDragStateRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      finishDesktopBlockDrag(true);
    }

    function runAutoScroll(frameTime: number) {
      const current = desktopDragStateRef.current;
      if (!current) {
        animationFrame = null;
        return;
      }
      const elapsedSeconds = Math.min(0.05, Math.max(0, frameTime - lastFrameTime) / 1000);
      lastFrameTime = frameTime;
      const viewportTop = 0;
      const viewportBottom = window.innerHeight;
      const zone = Math.min(editorSettings.blockTouch.autoScrollEdgeZone, window.innerHeight / 3);
      let velocity = 0;
      if (current.y < viewportTop + zone) {
        const intensity = Math.min(1, Math.max(0, (viewportTop + zone - current.y) / zone));
        velocity = -editorSettings.blockTouch.autoScrollMaxPxPerSecond * intensity;
      } else if (current.y > viewportBottom - zone) {
        const intensity = Math.min(1, Math.max(0, (current.y - (viewportBottom - zone)) / zone));
        velocity = editorSettings.blockTouch.autoScrollMaxPxPerSecond * intensity;
      }
      if (velocity !== 0) {
        window.scrollBy(0, velocity * elapsedSeconds);
        updateDesktopDragPosition(current.x, current.y);
      }
      animationFrame = window.requestAnimationFrame(runAutoScroll);
    }

    window.addEventListener('pointermove', handlePointerMove, { capture: true });
    window.addEventListener('pointerup', handlePointerEnd, { capture: true });
    window.addEventListener('pointercancel', handlePointerCancel, { capture: true });
    window.addEventListener('lostpointercapture', handleLostPointerCapture, { capture: true });
    window.addEventListener('keydown', handleEscape, { capture: true });
    animationFrame = window.requestAnimationFrame(runAutoScroll);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', handlePointerEnd, true);
      window.removeEventListener('pointercancel', handlePointerCancel, true);
      window.removeEventListener('lostpointercapture', handleLostPointerCapture, true);
      window.removeEventListener('keydown', handleEscape, true);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [draggedBlockId]);

  if (!notesReady || isNewNote) {
    return null;
  }
  if (note?.cloudOnly) return <div className="page-content">
    <button className="back-button" type="button" onClick={() => navigate(-1)}><ChevronLeft />{t('common.back')}</button>
    <p role="status">{t(transferError || downloadError ? 'cloud.noteUnavailable' : 'cloud.loadingNote')}</p>
    {(transferError || downloadError) && <button className="secondary-button" type="button" onClick={() => {
      setDownloadError(null);
      void ensureAvailable(note.id).catch((error) => setDownloadError(String(error)));
    }}>{t('google.retry')}</button>}
  </div>;

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

  async function handleDeleteFile(fileId: string) {
    const exists = useNotesStore.getState().notes
      .find((item) => item.id === note?.id)?.files?.some((file) => file.id === fileId);
    if (!note || !exists) return;
    try {
      await deleteFile(note.id, fileId);
      pushToast(t('notes.fileDeleted'), 'warning');
    } catch {
      pushToast(t('notes.fileDeleteFailed'), 'warning');
    }
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
    if (!note || event.button !== 0 || event.pointerType === 'touch') return;
    const block = document.getElementById(`block-${blockId}`);
    const blockList = block?.closest<HTMLElement>('.note-block-list');
    const rect = block?.getBoundingClientRect();
    const listRect = blockList?.getBoundingClientRect();
    if (!rect || !listRect) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const blockIds = dragBlockIds ?? (note.blocks ?? []).map((block) => block.id);
    const sourceIndex = Math.max(0, blockIds.indexOf(blockId));
    const nextState: DesktopDragState = {
      anchorRatio: rect.height > 0
        ? Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
        : 0.5,
      anchorY: event.clientY,
      blockId,
      dropIndex: sourceIndex,
      ghostLeft: listRect.left,
      ghostWidth: listRect.width,
      grabOffsetX: event.clientX - listRect.left,
      lineLeft: listRect.left,
      lineTop: rect.top,
      lineWidth: listRect.width,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    desktopInitialBlockIdsRef.current = blockIds;
    desktopDragCompactionPendingRef.current = true;
    desktopDragStateRef.current = nextState;
    draggedBlockIdRef.current = blockId;
    setDesktopDragState(nextState);
    setDraggedBlockId(blockId);
  }

  async function moveBlockWithKeyboard(blockId: string, direction: -1 | 1) {
    if (!note || draggedBlockIdRef.current || keyboardReorderPendingRef.current) return;
    const current = useNotesStore.getState().notes.find((item) => item.id === note.id);
    const ids = (current?.blocks ?? []).map((block) => block.id);
    const index = ids.indexOf(blockId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    keyboardReorderPendingRef.current = true;
    try {
      await reorderBlocks(note.id, ids);
      requestAnimationFrame(() => {
        const element = document.getElementById(`block-${blockId}`);
        if (!element) return;
        const handle = element.querySelector<HTMLButtonElement>('.note-block-handle');
        handle?.focus({ preventScroll: true });
        const rect = element.getBoundingClientRect();
        const headerBottom = Math.max(0, ...Array.from(document.querySelectorAll<HTMLElement>('.topbar, .document-top, .note-edit-toolbar-shell'))
          .map((bar) => bar.getBoundingClientRect().bottom)) + 16;
        const available = Math.max(0, window.innerHeight - headerBottom - 16);
        // Very tall blocks cannot fit: keep their heading and reorder handle
        // visible while centering shorter blocks in the unobscured viewport.
        const height = Math.min(rect.height, available);
        const desiredTop = headerBottom + (available - height) / 2;
        window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - desiredTop), behavior: 'instant' });
      });
    } finally { keyboardReorderPendingRef.current = false; }
  }

  function updateDesktopDragPosition(clientX: number, clientY: number) {
    const current = desktopDragStateRef.current;
    if (!current) return;
    const blockList = document.querySelector<HTMLElement>('.note-block-list');
    if (!blockList) return;
    const listRect = blockList.getBoundingClientRect();
    const candidates = Array.from(blockList.querySelectorAll<HTMLElement>('[data-note-block-id]'))
      .filter((element) => element.dataset.noteBlockId !== current.blockId)
      .map((element) => element.getBoundingClientRect());
    let dropIndex = candidates.findIndex((rect) => clientY < rect.top + rect.height / 2);
    if (dropIndex < 0) dropIndex = candidates.length;

    let lineTop = listRect.top;
    if (candidates.length > 0) {
      if (dropIndex === 0) {
        lineTop = candidates[0].top;
      } else if (dropIndex === candidates.length) {
        lineTop = candidates[candidates.length - 1].bottom;
      } else {
        lineTop = (candidates[dropIndex - 1].bottom + candidates[dropIndex].top) / 2;
      }
    }

    const viewportWidth = window.innerWidth;
    const ghostWidth = Math.min(listRect.width, viewportWidth - 16);
    const desiredLeft = clientX - current.grabOffsetX;
    const nextState: DesktopDragState = {
      ...current,
      dropIndex,
      ghostLeft: Math.min(viewportWidth - ghostWidth - 8, Math.max(8, desiredLeft)),
      ghostWidth,
      lineLeft: listRect.left,
      lineTop,
      lineWidth: listRect.width,
      x: clientX,
      y: clientY,
    };
    desktopDragStateRef.current = nextState;
    setDesktopDragState(nextState);
  }

  function finishDesktopBlockDrag(cancelled: boolean) {
    const current = desktopDragStateRef.current;
    if (!note || !current) return;
    const initialBlockIds = desktopInitialBlockIdsRef.current;
    desktopDragReleaseAnchorRef.current = current;
    desktopDragStateRef.current = null;
    desktopDragCompactionPendingRef.current = false;
    setDraggedBlockId(null);
    setDesktopDragState(null);
    draggedBlockIdRef.current = null;

    if (cancelled) return;

    const remainingIds = initialBlockIds.filter((blockId) => blockId !== current.blockId);
    const targetIndex = Math.min(remainingIds.length, Math.max(0, current.dropIndex));
    const nextIds = [...remainingIds];
    nextIds.splice(targetIndex, 0, current.blockId);
    if (arraysEqual(nextIds, initialBlockIds)) return;

    setDragBlockIds(nextIds);
    const revision = ++desktopDragPersistRevisionRef.current;
    const persistMove = desktopDragPersistQueueRef.current
      .catch(() => undefined)
      .then(() => reorderBlocks(note.id, nextIds));
    desktopDragPersistQueueRef.current = persistMove;
    void persistMove.finally(() => {
      if (desktopDragPersistRevisionRef.current === revision) setDragBlockIds(null);
    });
  }

  function moveTouchMenuBlock(direction: -1 | 1) {
    const current = touchHoldStateRef.current;
    if (!note || !current?.menuOpen) return;
    const blockIds = touchMenuBlockIdsRef.current.length > 0
      ? [...touchMenuBlockIdsRef.current]
      : (note.blocks ?? []).map((block) => block.id);
    const index = blockIds.indexOf(current.blockId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= blockIds.length) return;
    [blockIds[index], blockIds[targetIndex]] = [blockIds[targetIndex], blockIds[index]];
    touchMenuBlockIdsRef.current = blockIds;
    touchInitialBlockIdsRef.current = blockIds;
    setDragBlockIds(blockIds);

    const revision = ++touchMenuMoveRevisionRef.current;
    const persistMove = touchMenuMoveQueueRef.current
      .catch(() => undefined)
      .then(() => reorderBlocks(note.id, blockIds));
    touchMenuMoveQueueRef.current = persistMove;
    void persistMove.finally(() => {
      if (touchMenuMoveRevisionRef.current === revision) setDragBlockIds(null);
    });

    requestAnimationFrame(() => {
      const element = document.getElementById(`block-${current.blockId}`);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const headerBottom = Math.max(0, ...Array.from(document.querySelectorAll<HTMLElement>('.topbar, .document-top, .note-edit-toolbar-shell'))
        .map((bar) => bar.getBoundingClientRect().bottom)) + 16;
      const viewport = window.visualViewport;
      const viewportBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 16;
      if (rect.top < headerBottom) {
        window.scrollBy({ top: rect.top - headerBottom, behavior: 'smooth' });
      } else if (rect.bottom > viewportBottom) {
        window.scrollBy({ top: rect.bottom - viewportBottom, behavior: 'smooth' });
      }
    });
  }

  function moveCurrentNoteToTrash() {
    if (!note) return;
    void moveToTrash(note.id).then(() => {
      pushToast(t('notes.trashChanged'), 'warning');
      navigate('/trash');
    });
  }

  return (
    <>
      <header className={[
        'document-top',
        touchAdapted ? 'document-top--touch-adapted' : '',
        adapted && !touchAdapted ? 'document-top--narrow-desktop' : '',
      ].filter(Boolean).join(' ')}>
        <button className="back-button" type="button" onClick={() => navigate(-1)}>
          <ChevronLeft />
          {t('common.back')}
        </button>
        <div className="document-top-toolbar">
          <NoteTiptapToolbar
            floatingMenus={touchAdapted}
            scrollAffordances={touchAdapted}
            target={toolbarTarget}
            t={t}
          />
        </div>
        {touchAdapted ? (
          <div className="note-document-actions-menu" ref={noteActionsRef} onKeyDown={noteActionsMenu.onKeyDown}>
            <button
              className="icon-button"
              type="button"
              aria-label={t('notes.openMenu')}
              aria-expanded={noteActionsOpen}
              aria-haspopup="menu"
              ref={noteActionsMenu.triggerRef}
              onClick={() => setNoteActionsOpen((open) => !open)}
            >
              <MoreVertical />
            </button>
            {noteActionsOpen ? (
              <div
                className="floating-menu note-document-actions-popover responsive-popover"
                role="menu"
                ref={noteActionsMenu.menuRef}
                onClick={noteActionsMenu.closeAndFocus}
              >
                {cloudAccountId ? (
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={!excludedNotes.includes(note.id)}
                    onClick={() => void toggleExcluded(note.id)}
                  >
                    <Cloud />
                    {excludedNotes.includes(note.id)
                      ? t('noteDetail.includeInBackup')
                      : t('noteDetail.excludeFromBackup')}
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={note.isFavorite}
                  onClick={() => void toggleFavorite(note.id)}
                >
                  <Star />
                  {note.isFavorite ? t('common.unfavorite') : t('common.favorite')}
                </button>
                <button className="danger" type="button" role="menuitem" onClick={moveCurrentNoteToTrash}>
                  <Trash2 />
                  {t('notes.moveToTrash')}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
        <div className="document-actions">
          {cloudAccountId && <button className="icon-button" type="button"
            aria-label={excludedNotes.includes(note.id) ? t('noteDetail.includeInBackup') : t('noteDetail.excludeFromBackup')}
            title={excludedNotes.includes(note.id) ? t('noteDetail.includeInBackup') : t('noteDetail.excludeFromBackup')}
            aria-pressed={!excludedNotes.includes(note.id)}
            onClick={() => void toggleExcluded(note.id)}><Cloud /></button>}
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
            hidden={!isTauri()}
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
            onClick={moveCurrentNoteToTrash}
          >
            <Trash2 />
          </button>
        </div>
        )}
      </header>

      <NoteHeaderDraftProvider key={note.id} note={note} onSave={updateHeader}>
      <div className={[
        'note-document-shell',
        adapted ? 'note-document-shell--adapted' : '',
        touchAdapted ? 'note-document-shell--touch' : '',
      ].filter(Boolean).join(' ')}>
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
                      scrollToTocEntry(entry.id);
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

        <main className="note-document-main">
          <NoteHeader
            note={note}
            noteTags={noteTags}
            onTagsChange={(tagIds) => void updateTags(note.id, tagIds)}
            onThumbnailChange={(thumbnail) => void updateThumbnail(note.id, thumbnail)}
            onToolbarTargetChange={setToolbarTarget}
            t={t}
            typingRequest={headerTypingRequest}
          />

          <section className={[
            'note-block-list',
            draggedBlockId ? 'is-reordering' : '',
            desktopDragState ? 'is-desktop-drag-compacted' : '',
            touchHoldState ? 'is-touch-compacted' : '',
          ].filter(Boolean).join(' ')}>
            {visibleBlocks.map((block) => (
              <BlockEditor
                block={block}
                bubbleMenuEnabled={!touchAdapted}
                contentTypingRequest={block.id === firstBlockId ? firstBlockTypingRequest : null}
                dragged={draggedBlockId === block.id}
                key={block.id}
                noteId={note.id}
                onDelete={() => setDeleteBlockState({ blockId: block.id, title: richTextToPlainText(block.title).trim() || t('notes.untitledBlock') })}
                onDeleteFile={handleDeleteFile}
                onDragStart={(event) => startBlockDrag(event, block.id)}
                onKeyboardReorder={(direction) => void moveBlockWithKeyboard(block.id, direction)}
                onRequestFileUpload={async (kind) => {
                  try {
                    const sourcePath = await chooseNoteAttachment(kind);
                    if (!sourcePath) {
                      return null;
                    }
                    const file = await importFileForBlock(sourcePath, note.id, block.id);
                    if (file) {
                      pushToast(t('notes.fileAdded'), 'success');
                    }
                    return file;
                  } catch {
                    pushToast(t('notes.fileAddFailed'), 'warning');
                    return null;
                  }
                }}
                onTouchHoldEnd={() => endTouchBlockHold(block.id)}
                onTouchHoldStart={(x, y) => beginTouchBlockHold(block.id, x, y)}
                onTouchMenuOpen={(x, y) => openTouchBlockMenu(block.id, x, y)}
                onTouchActivate={() => activateTouchBlock(block.id)}
                onToolbarTargetChange={setToolbarTarget}
                onTocChange={refreshTocEntries}
                touchActive={touchActiveBlockId === block.id}
                touchCompacted={Boolean(touchHoldState || desktopDragState)}
                touchDragging={touchHoldState?.blockId === block.id && touchHoldState.dragging}
                touchHeld={touchHoldState?.blockId === block.id}
                touchHoldEnabled={touchAdapted && !touchActiveBlockId && !draggedBlockId}
                touchMenuOpen={touchHoldState?.blockId === block.id && touchHoldState.menuOpen}
                touchMode={touchAdapted}
              />
            ))}
          </section>

          {touchHoldState?.dragging && touchHeldBlock ? (
            <>
              <div className="note-touch-drag-ghost" ref={touchDragGhostRef} aria-hidden="true">
                {richTextToPlainText(touchHeldBlock.title).trim() ? (
                  <div className="note-block-compact-title">{richTextToPlainText(touchHeldBlock.title).trim()}</div>
                ) : null}
                {touchHeldBlock.contentText.trim() ? (
                  <div className="note-block-compact-content">{touchHeldBlock.contentText.trim()}</div>
                ) : null}
              </div>
              <div className="note-touch-drop-indicator" ref={touchDropIndicatorRef} aria-hidden="true" />
            </>
          ) : null}

          {desktopDragState && desktopDraggedBlock ? (
            <>
              <div
                className="note-touch-drag-ghost note-desktop-drag-ghost"
                ref={desktopDragGhostRef}
                aria-hidden="true"
              >
                {richTextToPlainText(desktopDraggedBlock.title).trim() ? (
                  <div className="note-block-compact-title">{richTextToPlainText(desktopDraggedBlock.title).trim()}</div>
                ) : null}
                {desktopDraggedBlock.contentText.trim() ? (
                  <div className="note-block-compact-content">{desktopDraggedBlock.contentText.trim()}</div>
                ) : null}
              </div>
              <div
                className="note-touch-drop-indicator note-desktop-drop-indicator"
                ref={desktopDropIndicatorRef}
                aria-hidden="true"
              />
            </>
          ) : null}

          {touchHoldState?.menuOpen && touchHeldBlock ? (
            <div
              className="note-touch-block-menu-layer"
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) closeTouchBlockMenu();
              }}
            >
              <div
                className="note-touch-block-menu"
                ref={touchBlockMenuRef}
                role="menu"
                aria-label={t('notes.reorderBlock')}
              >
                <button
                  className="note-touch-block-menu-action is-up"
                  type="button"
                  role="menuitem"
                  aria-label={t('notes.moveBlockUp')}
                  title={t('notes.moveBlockUp')}
                  disabled={touchMenuBlockIndex <= 0}
                  onClick={() => moveTouchMenuBlock(-1)}
                >
                  <ChevronUp aria-hidden="true" />
                </button>
                <button
                  className="note-touch-block-menu-action is-down"
                  type="button"
                  role="menuitem"
                  aria-label={t('notes.moveBlockDown')}
                  title={t('notes.moveBlockDown')}
                  disabled={touchMenuBlockIndex < 0 || touchMenuBlockIndex >= touchMenuBlockIds.length - 1}
                  onClick={() => moveTouchMenuBlock(1)}
                >
                  <ChevronDown aria-hidden="true" />
                </button>
                <button
                  className={`note-touch-block-menu-action is-delete is-${touchHoldState.menuDeleteSide}`}
                  type="button"
                  role="menuitem"
                  aria-label={t('common.delete')}
                  title={t('common.delete')}
                  onClick={() => {
                    closeTouchBlockMenu();
                    setDeleteBlockState({
                      blockId: touchHeldBlock.id,
                      title: richTextToPlainText(touchHeldBlock.title).trim() || t('notes.untitledBlock'),
                    });
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="note-add-block-row">
            <button type="button" aria-label={t('notes.addContentBlock')} title={t('notes.addContentBlock')} onClick={() => void addContentBlock('content')}>
              +
            </button>
          </div>
        </main>

        {adapted ? (
          <div className="note-panels-navigation">
            <button ref={panelsTriggerRef} className="icon-button" type="button" aria-label={t('noteDetail.openPanels')}
              title={t('noteDetail.openPanels')} aria-controls="note-detail-panels" aria-expanded={panelsOpen}
              onClick={() => setPanelsOpen(true)}>
              <ChevronLeft aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <ResponsiveSidePanel compact={adapted} id="note-detail-panels" label={t('noteDetail.panels')}
          open={panelsOpen} onClose={() => setPanelsOpen(false)} triggerRef={panelsTriggerRef}>
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
              <div className="meta-row meta-row--collection">
                <span>{t('noteDetail.collectionLabel')}</span>
                <span className="meta-value">{collections.find((collection) => collection.id === note.collectionId)?.name ?? t('noteDetail.noCollection')}</span>
              </div>
              <div className="meta-row">
                <span>{t('noteDetail.author')}</span>
                <span className="meta-value">{user?.name || note.authorId || 'Local user'}</span>
              </div>
            </div>
          </Panel>

          <Panel title={t('noteDetail.collectionLabel')}>
            <NoteCollectionField collections={collections} t={t} />
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
                    <button
                      className="note-file-name"
                      type="button"
                      title={file.originalName}
                      onClick={() => void openNoteAttachment(file.relativePath)}
                    >
                      {file.originalName}
                    </button>
                    <span className="side-list-actions">
                      <button className="icon-button note-file-export" type="button" aria-label={t('common.export')} onClick={() => void exportNoteAttachment(file)}>
                        <Download />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        aria-label={t('common.delete')}
                        onClick={() => void handleDeleteFile(file.id)}
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
        </ResponsiveSidePanel>
      </div>
      </NoteHeaderDraftProvider>

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
    </>
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
    <AppModal
      className="choice-modal"
      dismissible={!disabled}
      labelledBy="export-note-title"
      onClose={onCancel}
      open={open}
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
    </AppModal>
  );
}

function NoteHeader({
  note,
  noteTags,
  onTagsChange,
  onThumbnailChange,
  onToolbarTargetChange,
  t,
  typingRequest,
}: {
  note: Note;
  noteTags: Tag[];
  onTagsChange: (tagIds: string[]) => void;
  onThumbnailChange: (thumbnail: NoteThumbnailModel) => void;
  onToolbarTargetChange: (target: NoteTiptapToolbarTarget) => void;
  t: ReturnType<typeof useI18n>['t'];
  typingRequest?: HeaderTypingRequest | null;
}) {
  const { title, subtitle, setTitle, setSubtitle } = useNoteHeaderDraft();

  return (
    <section className="document-heading note-document-heading">
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

function NoteCollectionField({ collections, t }: {
  collections: Collection[];
  t: ReturnType<typeof useI18n>['t'];
}) {
  const { collectionId, setCollectionId } = useNoteHeaderDraft();
  const selectedCollection = collections.find((collection) => collection.id === collectionId);
  return (
    <div className={`editable-collection-field editing note-collection-field ${selectedCollection?.color ?? 'neutral'}`}>
      <Folder aria-hidden="true" />
      <CustomSelect
        ariaLabel={t('noteDetail.collectionLabel')}
        emptyText={t('notes.filters.noCollections')}
        onChange={setCollectionId}
        options={[
          { label: t('noteDetail.noCollection'), value: '' },
          ...collections.map((collection) => ({ color: collection.color, label: collection.name, value: collection.id })),
        ]}
        value={collectionId}
      />
    </div>
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
  const menu = useMenuOptionFocus(open, () => setOpen(false), 3);
  const currentThumbnail = current ?? { variant: defaultNoteThumbnailVariant };

  useClickOutside(pickerRef, open, () => setOpen(false));
  useFloatingPopover(open, menu.triggerRef, menu.menuRef, 'bottom-end');

  return (
    <div className="thumbnail-picker" ref={pickerRef} onKeyDown={menu.onKeyDown}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <button
        className="thumbnail-picker-trigger"
        ref={menu.triggerRef}
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
        <div className="thumbnail-picker-menu" ref={menu.menuRef} role="menu" aria-label={t('noteDetail.thumbnail')}>
          {thumbnailOptions.map(({ id: variant }) => (
            <button
              className={variant === currentThumbnail.variant ? 'thumbnail-option active' : 'thumbnail-option'}
              key={variant}
              type="button"
              role="menuitemradio"
              tabIndex={-1}
              aria-checked={variant === currentThumbnail.variant}
              aria-label={`${t('noteDetail.changeThumbnail')}: ${variant}`}
              onClick={() => {
                onSelect({ variant });
                menu.closeAndFocus();
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
  bubbleMenuEnabled,
  contentTypingRequest,
  dragged,
  noteId,
  onDelete,
  onDeleteFile,
  onDragStart,
  onKeyboardReorder,
  onRequestFileUpload,
  onTouchHoldEnd,
  onTouchHoldStart,
  onTouchMenuOpen,
  onTouchActivate,
  onTocChange,
  onToolbarTargetChange,
  touchActive,
  touchCompacted,
  touchDragging,
  touchHeld,
  touchHoldEnabled,
  touchMenuOpen,
  touchMode,
}: {
  block: NoteBlock;
  bubbleMenuEnabled: boolean;
  contentTypingRequest?: NoteTiptapInsertTextRequest | null;
  dragged: boolean;
  noteId: string;
  onDelete: () => void;
  onDeleteFile: (fileId: string) => Promise<void>;
  onDragStart: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyboardReorder: (direction: -1 | 1) => void;
  onRequestFileUpload: (kind: NoteFileKind) => Promise<NoteFile | null>;
  onTouchHoldEnd: () => void;
  onTouchHoldStart: (x: number, y: number) => void;
  onTouchMenuOpen: (x: number, y: number) => void;
  onTouchActivate: () => void;
  onTocChange: () => void;
  onToolbarTargetChange: (target: NoteTiptapToolbarTarget) => void;
  touchActive: boolean;
  touchCompacted: boolean;
  touchDragging: boolean;
  touchHeld: boolean;
  touchHoldEnabled: boolean;
  touchMenuOpen: boolean;
  touchMode: boolean;
}) {
  const { t } = useI18n();
  const updateBlock = useNotesStore((state) => state.updateBlock);
  const [title, setTitle] = useState(block.title);
  const [contentJson, setContentJson] = useState<TiptapDocument | null>(block.contentJson);
  const [contentText, setContentText] = useState(block.contentText);
  const [titleActive, setTitleActive] = useState(false);
  const [contentActive, setContentActive] = useState(false);
  const [touchEditingRegion, setTouchEditingRegion] = useState<'content' | 'title' | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const draftRevisionRef = useRef(0);
  const lastTypingNonceRef = useRef<number | null>(null);
  const contentJsonRef = useRef<TiptapDocument | null>(contentJson);
  const contentTextRef = useRef(contentText);
  const fileInsertPendingRef = useRef(false);
  const touchHoldTimerRef = useRef<number | null>(null);
  const touchMenuTimerRef = useRef<number | null>(null);
  const touchHoldPointerRef = useRef<{
    activated: boolean;
    id: number;
    menuOpened: boolean;
    pointerType: string;
    x: number;
    y: number;
  } | null>(null);
  const suppressHoldClickRef = useRef(false);
  const suppressHoldClickTimerRef = useRef<number | null>(null);
  const titleHasContent = richTextToPlainText(title).trim().length > 0;
  const contentHasContent = hasTiptapContent(contentJson, contentText);
  const titleVisible = titleHasContent || titleActive;
  const contentVisible = contentHasContent || contentActive;
  const blockIsEmpty = !titleVisible && !contentVisible;
  const draftSourceId = `block:${block.id}`;

  function clearTouchHoldTimer() {
    if (touchHoldTimerRef.current !== null) {
      window.clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
  }

  function clearTouchMenuTimer() {
    if (touchMenuTimerRef.current !== null) {
      window.clearTimeout(touchMenuTimerRef.current);
      touchMenuTimerRef.current = null;
    }
  }

  function handleTouchHoldPointerDown(event: PointerEvent<HTMLElement>) {
    if (!touchHoldEnabled || !event.isPrimary || event.pointerType === 'mouse') return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('a, button, input, select, textarea, [role="button"]')) return;
    clearTouchHoldTimer();
    clearTouchMenuTimer();
    touchHoldPointerRef.current = {
      activated: false,
      id: event.pointerId,
      menuOpened: false,
      pointerType: event.pointerType,
      x: event.clientX,
      y: event.clientY,
    };
    touchHoldTimerRef.current = window.setTimeout(() => {
      const pointer = touchHoldPointerRef.current;
      if (!pointer || pointer.id !== event.pointerId) return;
      pointer.activated = true;
      touchHoldTimerRef.current = null;
      onTouchHoldStart(pointer.x, pointer.y);
      touchMenuTimerRef.current = window.setTimeout(() => {
        const heldPointer = touchHoldPointerRef.current;
        if (!heldPointer || heldPointer.id !== event.pointerId || !heldPointer.activated) return;
        heldPointer.menuOpened = true;
        touchMenuTimerRef.current = null;
        onTouchMenuOpen(heldPointer.x, heldPointer.y);
      }, editorSettings.blockTouch.menuDelayMs);
    }, editorSettings.blockTouch.holdDelayMs);
  }

  function handleTouchHoldPointerMove(event: PointerEvent<HTMLElement>) {
    const pointer = touchHoldPointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.activated && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > editorSettings.blockTouch.tapMovementTolerance) {
      clearTouchHoldTimer();
      clearTouchMenuTimer();
      touchHoldPointerRef.current = null;
      return;
    }
    if (pointer.activated) {
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > editorSettings.blockTouch.tapMovementTolerance) {
        clearTouchMenuTimer();
      }
      event.preventDefault();
    }
  }

  function suppressClickAfterHold() {
    suppressHoldClickRef.current = true;
    if (suppressHoldClickTimerRef.current !== null) {
      window.clearTimeout(suppressHoldClickTimerRef.current);
    }
    suppressHoldClickTimerRef.current = window.setTimeout(() => {
      suppressHoldClickRef.current = false;
      suppressHoldClickTimerRef.current = null;
    }, 400);
  }

  function handleTouchHoldPointerUp(event: PointerEvent<HTMLElement>) {
    const pointer = touchHoldPointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const activated = pointer.activated || touchHeld;
    clearTouchHoldTimer();
    clearTouchMenuTimer();
    touchHoldPointerRef.current = null;
    if (!activated) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickAfterHold();
    if (pointer.menuOpened || touchMenuOpen) return;
    onTouchHoldEnd();
  }

  function handleTouchHoldPointerCancel(event: PointerEvent<HTMLElement>) {
    const pointer = touchHoldPointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const activated = pointer.activated || touchHeld;
    clearTouchHoldTimer();
    clearTouchMenuTimer();
    touchHoldPointerRef.current = null;
    if (activated && pointer.pointerType === 'touch') return;
    if (activated) onTouchHoldEnd();
  }

  function beginTouchEditing(region: 'content' | 'title') {
    if (!touchMode) return;
    setTouchEditingRegion(region);
    onTouchActivate();
  }

  useEffect(() => {
    setTitle(block.title);
    setContentJson(block.contentJson);
    setContentText(block.contentText);
  }, [block.id, block.title, block.contentJson, block.contentText]);

  useEffect(() => {
    if (!touchActive) setTouchEditingRegion(null);
  }, [touchActive]);

  useEffect(() => () => {
    draftRevisionRef.current += 1;
    setLocalDraftPending(noteId, draftSourceId, false);
    clearTouchHoldTimer();
    clearTouchMenuTimer();
    if (suppressHoldClickTimerRef.current !== null) {
      window.clearTimeout(suppressHoldClickTimerRef.current);
    }
  }, [draftSourceId, noteId]);

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
    beginTouchEditing('content');
  }, [contentTypingRequest]);

  useEffect(() => {
    const contentChanged = JSON.stringify(contentJson) !== JSON.stringify(block.contentJson);
    if (title === block.title && contentText === block.contentText && !contentChanged) {
      draftRevisionRef.current += 1;
      setLocalDraftPending(noteId, draftSourceId, false);
      return undefined;
    }
    const draftRevision = ++draftRevisionRef.current;
    setLocalDraftPending(noteId, draftSourceId, true);
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      const finishSave = beginLocalSave(noteId, draftSourceId);
      void (async () => {
        let saved = false;
        try {
          await updateBlock(noteId, block.id, {
            kind: contentHasContent || contentJson ? 'content' : block.kind,
            title,
            contentJson,
            contentText,
          });
          saved = true;
        } catch {
          // Keep the draft registered so a remote mutation cannot overwrite it.
        } finally {
          finishSave();
          if (saved && draftRevisionRef.current === draftRevision) {
            setLocalDraftPending(noteId, draftSourceId, false);
          }
        }
      })();
    }, 700);
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [block.contentJson, block.contentText, block.id, block.kind, block.title, contentHasContent, contentJson, contentText, draftSourceId, noteId, title, updateBlock]);

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
      className={[
        'note-block',
        dragged ? 'is-dragging' : '',
        touchActive ? 'is-touch-active' : '',
        touchDragging ? 'is-touch-dragging-source' : '',
        touchHeld ? 'is-touch-held' : '',
      ].filter(Boolean).join(' ')}
      data-note-block-id={block.id}
      id={`block-${block.id}`}
      data-empty={blockIsEmpty ? 'true' : undefined}
      onContextMenuCapture={(event) => {
        if (touchHoldEnabled || touchHeld) event.preventDefault();
      }}
      onClickCapture={(event) => {
        if (!suppressHoldClickRef.current) return;
        suppressHoldClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerCancelCapture={handleTouchHoldPointerCancel}
      onPointerDownCapture={handleTouchHoldPointerDown}
      onPointerMoveCapture={handleTouchHoldPointerMove}
      onPointerUpCapture={handleTouchHoldPointerUp}
    >
      <button
        className="note-block-handle"
        type="button"
        aria-label={t('notes.reorderBlock')}
        aria-grabbed={dragged}
        title={t('notes.reorderBlock')}
        onPointerDown={onDragStart}
        onClick={(event) => event.currentTarget.focus({ preventScroll: true })}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault(); event.stopPropagation();
          onKeyboardReorder(event.key === 'ArrowUp' ? -1 : 1);
        }}
      >
        <GripVertical />
      </button>
      <div className="note-block-compact-preview" hidden={!touchCompacted}>
        {richTextToPlainText(title).trim() ? (
          <div className="note-block-compact-title">{richTextToPlainText(title).trim()}</div>
        ) : null}
        {contentText.trim() ? (
          <div className="note-block-compact-content">{contentText.trim()}</div>
        ) : null}
      </div>
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
            onTouchEditStart={() => beginTouchEditing('title')}
            placeholder=""
            touchEditing={touchActive && touchEditingRegion === 'title'}
            touchMode={touchMode}
            value={title}
          />
        ) : (
          <button
            className="note-block-zone-add note-block-zone-add-title"
            type="button"
            aria-label={t('notes.addTitleBlock')}
            title={t('notes.addTitleBlock')}
            onClick={() => {
              setTitleActive(true);
              beginTouchEditing('title');
            }}
          >
            <Plus />
          </button>
        )}
        {contentVisible ? (
          <NoteTiptapEditor
            autoFocus={contentActive && !contentHasContent}
            blockId={block.id}
            bubbleMenuEnabled={bubbleMenuEnabled}
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
            onDeleteFile={onDeleteFile}
            onFocus={() => setContentActive(true)}
            onPendingFileInsertChange={setFileInsertPending}
            onRequestFileUpload={onRequestFileUpload}
            onTouchEditStart={() => beginTouchEditing('content')}
            onToolbarTargetChange={onToolbarTargetChange}
            touchEditing={touchActive && touchEditingRegion === 'content'}
            touchMode={touchMode}
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
              beginTouchEditing('content');
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

function findActiveTocEntryId(entries: TocEntry[]) {
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
