import {
  Check,
  ChevronLeft,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  Lightbulb,
  Link as LinkIcon,
  MoreVertical,
  Pencil,
  Pin,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EditableUsageExamplesTable } from '../components/editing/EditableUsageExamplesTable';
import { EditorToolbarProvider, type EditorToolbarMode } from '../components/editing/EditorToolbarContext';
import { GlobalEditorToolbar } from '../components/editing/GlobalEditorToolbar';
import { InlineFormattedText } from '../components/editing/InlineFormattedText';
import { MarkdownEditor } from '../components/editing/MarkdownEditor';
import { MarkdownPreview } from '../components/editing/MarkdownPreview';
import { StyledTextField } from '../components/editing/TextStyleToolbar';
import { ColorPicker } from '../components/ui/ColorPicker';
import { CustomSelect } from '../components/ui/CustomSelect';
import { EmptyState } from '../components/ui/EmptyState';
import { NoteThumbnail } from '../components/ui/NoteThumbnail';
import { Panel } from '../components/ui/Panel';
import { SortableTagList } from '../components/ui/SortableTagList';
import { TagChip } from '../components/ui/TagChip';
import {
  appLimits,
  cloudSyncEnabled,
  defaultNewNoteType,
  defaultNewTagColor,
  defaultNoteThumbnailVariant,
  noteTypeOptions,
  thumbnailOptions,
} from '../config/appSettings';
import type { Collection, Note, NoteThumbnail as NoteThumbnailModel, NoteType, RichTextBlock, TagColor } from '../core/models/models';
import { openExternalUrl } from '../core/services/externalLinks';
import { normalizeExternalHref, titleFromExternalHref } from '../core/utils/linkUtils';
import { stripInlineFormatting } from '../core/utils/inlineFormatting';
import { sortTagsByFavoriteOrder } from '../core/utils/tagSorting';
import { useClickOutside } from '../core/utils/useClickOutside';
import { useKeyboardListNavigation } from '../core/utils/useKeyboardListNavigation';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useKnowledgeStore, type NoteEditDraft } from '../store/useKnowledgeStore';
import { useSyncStore } from '../store/useSyncStore';
import { useToastStore } from '../store/useToastStore';

export function NoteDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const isNewNote = id === 'new';
  const initialType = parseNoteType(searchParams.get('type'));
  const initialCollectionId = searchParams.get('collection') || null;
  const linkInputRef = useRef<HTMLInputElement>(null);
  const documentActionsRef = useRef<HTMLDivElement>(null);
  const thumbnailPickerRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [thumbnailPickerOpen, setThumbnailPickerOpen] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [exampleText, setExampleText] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<TagColor>(defaultNewTagColor);
  const [editingExampleIndex, setEditingExampleIndex] = useState<number | null>(null);
  const [editingExampleText, setEditingExampleText] = useState('');
  const [selectedLinkedNoteId, setSelectedLinkedNoteId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isNewNote);
  const [editorMode, setEditorMode] = useState<EditorToolbarMode>('text');
  const [savingPage, setSavingPage] = useState(false);
  const [draft, setDraft] = useState<NoteEditDraft>(() => buildEmptyDraft(initialType, initialCollectionId, t('noteDetail.tip')));
  const favoriteTagIds = useAppStore((state) => state.settings.favoriteTagIds);
  const setPinnedNoteState = useAppStore((state) => state.setPinnedNoteState);
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const user = useKnowledgeStore((state) => state.user);
  const syncConnected = useSyncStore((state) => Boolean(state.syncState?.connected));
  const accountConnected = cloudSyncEnabled && syncConnected;
  const isReady = useKnowledgeStore((state) => state.isReady);
  const toggleFavorite = useKnowledgeStore((state) => state.toggleFavorite);
  const togglePinned = useKnowledgeStore((state) => state.togglePinned);
  const moveToTrash = useKnowledgeStore((state) => state.moveToTrash);
  const duplicateNote = useKnowledgeStore((state) => state.duplicateNote);
  const markNoteOpened = useKnowledgeStore((state) => state.markNoteOpened);
  const saveNoteDraft = useKnowledgeStore((state) => state.saveNoteDraft);
  const createNoteFromDraft = useKnowledgeStore((state) => state.createNoteFromDraft);
  const updateNoteTags = useKnowledgeStore((state) => state.updateNoteTags);
  const updateNoteThumbnail = useKnowledgeStore((state) => state.updateNoteThumbnail);
  const createTag = useKnowledgeStore((state) => state.createTag);
  const addAdditionalExample = useKnowledgeStore((state) => state.addAdditionalExample);
  const updateAdditionalExample = useKnowledgeStore((state) => state.updateAdditionalExample);
  const deleteAdditionalExample = useKnowledgeStore((state) => state.deleteAdditionalExample);
  const addRelatedLink = useKnowledgeStore((state) => state.addRelatedLink);
  const deleteRelatedLink = useKnowledgeStore((state) => state.deleteRelatedLink);
  const addLinkedNote = useKnowledgeStore((state) => state.addLinkedNote);
  const deleteLinkedNote = useKnowledgeStore((state) => state.deleteLinkedNote);
  const pushToast = useToastStore((state) => state.pushToast);
  const note = isNewNote ? undefined : notes.find((item) => item.id === id);

  useClickOutside(documentActionsRef, moreOpen, () => setMoreOpen(false));
  useClickOutside(thumbnailPickerRef, thumbnailPickerOpen, () => setThumbnailPickerOpen(false));

  useEffect(() => {
    if (isReady && note && !isNewNote) {
      void markNoteOpened(note.id);
    }
  }, [isNewNote, isReady, markNoteOpened, note?.id]);

  useEffect(() => {
    if (isNewNote) {
      setIsEditing(true);
      setEditorMode('text');
      setDraft(buildEmptyDraft(initialType, initialCollectionId, t('noteDetail.tip')));
      return;
    }

    if (note && !isEditing) {
      setDraft(buildDraftFromNote(note, t('noteDetail.tip')));
    }
  }, [initialCollectionId, initialType, isEditing, isNewNote, note, t]);

  useEffect(() => {
    if (linkOpen) {
      requestAnimationFrame(() => linkInputRef.current?.focus());
    }
  }, [linkOpen]);

  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const noteTags = note ? note.tagIds.flatMap((tagId) => tagById.get(tagId) ?? []) : [];
  const collectionId = isEditing ? draft.collectionId : note?.collectionId ?? null;
  const collection = collections.find((item) => item.id === collectionId);
  const savedCollection = note ? collections.find((item) => item.id === note.collectionId) : undefined;
  const availableTags = note ? sortTagsByFavoriteOrder(tags.filter((tag) => !note.tagIds.includes(tag.id)), favoriteTagIds) : [];
  const linkedNotes = note ? note.linkedNoteIds.flatMap((linkedId) => notes.find((item) => item.id === linkedId) ?? []) : [];
  const backlinkNotes = note ? notes.filter((item) => item.id !== note.id && item.linkedNoteIds.includes(note.id)) : [];
  const linkSearchActive = linkInput.trim().startsWith('/');
  const linkSearchQuery = linkSearchActive ? linkInput.trim().slice(1).toLowerCase() : '';
  const linkableNotes = notes
    .filter((item) => item.id !== note?.id && !item.isTrashed && !note?.linkedNoteIds.includes(item.id))
    .filter((item) => !linkSearchQuery || stripInlineFormatting(item.title).toLowerCase().includes(linkSearchQuery))
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
  const saveStatusLabel = getSaveStatusLabel({ isEditing, isNewNote, note, saving: savingPage, t });

  if (!isReady) {
    return null;
  }

  if (!isNewNote && !note) {
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

  function updateDraft(input: Partial<NoteEditDraft>) {
    setDraft((current) => ({ ...current, ...input }));
  }

  function beginPageEdit() {
    if (!note) {
      return;
    }

    setDraft(buildDraftFromNote(note, t('noteDetail.tip')));
    setEditorMode('text');
    setIsEditing(true);
  }

  function cancelPageEdit() {
    if (isNewNote) {
      navigate(-1);
      return;
    }

    if (note) {
      setDraft(buildDraftFromNote(note, t('noteDetail.tip')));
    }
    setEditorMode('text');
    setIsEditing(false);
  }

  async function savePageEdit() {
    if (!draft.title.trim()) {
      pushToast(t('noteDetail.titleRequired'), 'warning');
      return;
    }

    setSavingPage(true);
    try {
      if (isNewNote) {
        const created = await createNoteFromDraft(draft);
        if (!created) {
          pushToast(t('noteDetail.titleRequired'), 'warning');
          return;
        }

        pushToast(t('noteDetail.noteCreated'), 'success');
        setIsEditing(false);
        navigate(`/notes/${created.id}`, { replace: true });
        return;
      }

      if (!note) {
        return;
      }

      const updated = await saveNoteDraft(note.id, draft);
      if (!updated) {
        pushToast(t('noteDetail.titleRequired'), 'warning');
        return;
      }

      setDraft(buildDraftFromNote(updated, t('noteDetail.tip')));
      setIsEditing(false);
      pushToast(t('noteDetail.noteSaved'), 'success');
    } finally {
      setSavingPage(false);
    }
  }

  async function copyText(text: string, message: string) {
    await navigator.clipboard?.writeText(text);
    pushToast(message, 'success');
  }

  async function removeTag(tagId: string) {
    if (!note) {
      return;
    }

    await updateNoteTags(note.id, note.tagIds.filter((tag) => tag !== tagId));
    pushToast(t('noteDetail.tagUpdated'), 'success');
  }

  async function addTag(tagId: string) {
    if (!note) {
      return;
    }

    await updateNoteTags(note.id, [...note.tagIds, tagId]);
    setTagPickerOpen(false);
    pushToast(t('noteDetail.tagUpdated'), 'success');
  }

  async function reorderNoteTags(tagIds: string[]) {
    if (!note) {
      return;
    }

    await updateNoteTags(note.id, tagIds);
  }

  async function createAndAddTag() {
    if (!note) {
      return;
    }

    const created = await createTag(newTagName, newTagColor);
    if (!created) {
      return;
    }

    await updateNoteTags(note.id, [...note.tagIds, created.id]);
    setNewTagName('');
    setNewTagColor(defaultNewTagColor);
    setTagPickerOpen(false);
    pushToast(t('noteDetail.tagCreated'), 'success');
  }

  async function selectThumbnail(variant: NoteThumbnailModel['variant']) {
    if (!note) {
      return;
    }

    await updateNoteThumbnail(note.id, { variant });
    setThumbnailPickerOpen(false);
    pushToast(t('noteDetail.thumbnailUpdated'), 'success');
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
    setLinkInput(stripInlineFormatting(selected.title));
  }

  async function saveRelatedLink() {
    if (!note) {
      return;
    }

    if (selectedLinkedNoteId) {
      await addLinkedNote(note.id, selectedLinkedNoteId);
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

  return (
    <EditorToolbarProvider mode={editorMode} onModeChange={setEditorMode}>
      {isEditing ? <GlobalEditorToolbar saving={savingPage} onCancel={cancelPageEdit} onSave={savePageEdit} /> : null}
      <header className="document-top">
        <button className="back-button" type="button" onClick={() => navigate(-1)}>
          <ChevronLeft />
          {t('common.back')}
        </button>
        <div className="document-actions" ref={documentActionsRef}>
          {note ? (
            <button
              className={note.isFavorite ? 'icon-button document-actions__favorite is-active' : 'icon-button document-actions__favorite'}
              type="button"
              aria-label={note.isFavorite ? t('common.unfavorite') : t('common.favorite')}
              aria-pressed={note.isFavorite}
              onClick={() => {
                void toggleFavorite(note.id).then(() => pushToast(t('notes.favoriteChanged'), 'success'));
              }}
            >
              <Star />
            </button>
          ) : null}
          <span className="inline-actions">
            <FileText />
            {saveStatusLabel}
          </span>
          {note ? (
            <>
              <button className="icon-button" type="button" aria-label={t('common.more')} onClick={() => setMoreOpen((value) => !value)}>
                <MoreVertical />
              </button>
              {moreOpen ? (
                <div className="floating-menu document-menu">
                  <button
                    type="button"
                    onClick={() => {
                      void togglePinned(note.id).then(() => setPinnedNoteState(note.id, !note.isPinned)).then(() => pushToast(t('notes.pinChanged'), 'success'));
                      setMoreOpen(false);
                    }}
                  >
                    <Pin />
                    {note.isPinned ? t('common.unpin') : t('common.pin')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void duplicateNote(note.id, `${stripInlineFormatting(note.title)} (${t('common.copy')})`).then((created) => {
                        pushToast(t('notes.duplicated'), 'success');
                        if (created) {
                          navigate(`/notes/${created.id}`);
                        }
                      });
                      setMoreOpen(false);
                    }}
                  >
                    <Copy />
                    {t('common.duplicate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void copyText(window.location.href, t('noteDetail.copiedLink'));
                      setMoreOpen(false);
                    }}
                  >
                    <LinkIcon />
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
                    <Trash2 />
                    {t('notes.moveToTrash')}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </header>

      <div className={note ? 'document-shell' : 'document-shell single-column'}>
        <article className="document-main">
          <div className="document-heading">
            <div className="document-meta-row">
              {isEditing ? (
                <CollectionSelect collections={collections} value={draft.collectionId} onChange={(collectionId) => updateDraft({ collectionId })} />
              ) : (
                <CollectionBreadcrumb collection={collection} emptyText={t('noteDetail.noCollection')} />
              )}

              {!isEditing ? (
                <div className="document-edit-actions">
                  <button className="editor-cancel-button" type="button" onClick={beginPageEdit}>
                    <Pencil />
                    {t('editor.edit')}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="document-title-row">
              <div className="document-title-stack">
                {isEditing ? (
                  <StyledTextField
                    className="document-title-styled-field"
                    controlClassName="editable-control document-title-input"
                    disabled={savingPage}
                    multiline
                    onChange={(title) => updateDraft({ title })}
                    placeholder={t('noteDetail.titlePlaceholder')}
                    rows={3}
                    value={draft.title}
                  />
                ) : (
                  <h1 className="document-title">
                    <InlineFormattedText value={note?.title} />
                  </h1>
                )}
              </div>

              {note ? (
                <ThumbnailPicker
                  current={note.thumbnail}
                  onOpenChange={setThumbnailPickerOpen}
                  onSelect={(variant) => void selectThumbnail(variant)}
                  open={thumbnailPickerOpen}
                  pickerRef={thumbnailPickerRef}
                  t={t}
                />
              ) : null}
            </div>

            {noteTags.length ? (
              <div className="tag-row document-title-tags">
                {noteTags.map((tag) => (
                  <TagChip key={tag.id} tag={tag} href={`/notes?tag=${tag.id}`} />
                ))}
              </div>
            ) : null}

            {isEditing ? (
              <StyledTextField
                className="document-intro-styled-field"
                controlClassName="editable-control document-intro-input"
                disabled={savingPage}
                multiline
                onChange={(intro) => updateDraft({ intro })}
                placeholder={t('noteDetail.introPlaceholder')}
                value={draft.intro}
              />
            ) : (
              <p className="document-intro">
                <InlineFormattedText value={note?.content.intro} />
              </p>
            )}
          </div>

          <section className="content-section">
            <h2 className="section-title">{t('noteDetail.summary')}</h2>
            {isEditing ? (
              <MarkdownEditor
                bare
                label={t('noteDetail.summary')}
                onChange={(summaryMarkdown) => updateDraft({ summaryMarkdown })}
                placeholder={t('noteDetail.summaryPlaceholder')}
                rows={8}
                showActions={false}
                showTabs={false}
                showToolbar={false}
                value={draft.summaryMarkdown}
              />
            ) : (
              <MarkdownPreview emptyText={t('noteDetail.emptySummary')} value={blocksToMarkdown(note?.content.summary)} />
            )}
          </section>

          <section className="content-section">
            <h2 className="section-title">{t('noteDetail.explanation')}</h2>
            {isEditing ? (
              <MarkdownEditor
                bare
                label={t('noteDetail.explanation')}
                onChange={(explanationMarkdown) => updateDraft({ explanationMarkdown })}
                placeholder={t('noteDetail.explanationPlaceholder')}
                rows={10}
                showActions={false}
                showTabs={false}
                showToolbar={false}
                value={draft.explanationMarkdown}
              />
            ) : (
              <MarkdownPreview emptyText={t('noteDetail.emptyExplanation')} value={blocksToMarkdown(note?.content.explanation)} />
            )}
          </section>

          <section className="content-section">
            <h2 className="section-title">{t('noteDetail.usageExamples')}</h2>
            <EditableUsageExamplesTable
              controlledEditing={isEditing}
              onRowsChange={(usageExamples) => updateDraft({ usageExamples })}
              readOnly
              rows={isEditing ? draft.usageExamples : note?.content.usageExamples?.rows ?? []}
            />
          </section>

          {isEditing ? (
            <EditableDraftTip
              body={draft.tipBody}
              onChange={(tipBody) => updateDraft({ tipBody, tipTitle: draft.tipTitle || t('noteDetail.tip') })}
              title={draft.tipTitle || t('noteDetail.tip')}
            />
          ) : note?.content.tip ? (
            <TipPreview body={note.content.tip.body} title={note.content.tip.title} />
          ) : null}

          {note ? (
            <footer className="document-footer-stats">
              <span>
                {note.stats.wordCount} {t('noteDetail.words')} • {note.stats.characterCount} {t('noteDetail.characters')} •{' '}
                {t('noteDetail.readingTime', { count: note.stats.readingTimeMinutes })}
              </span>
              <span>{t('noteDetail.lastEdit')}</span>
            </footer>
          ) : null}
        </article>

        {note ? (
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
                  <span className="meta-value">{savedCollection?.name}</span>
                </div>
                <div className="meta-row">
                  <span>{t('noteDetail.author')}</span>
                  <span className="meta-value">{accountConnected ? user?.name : t('profile.localUser')}</span>
                </div>
              </div>
            </Panel>

            <Panel title={t('noteDetail.tags')}>
              {noteTags.length ? (
                <SortableTagList
                  ariaLabel={t('noteDetail.reorderTags')}
                  className="document-tag-sortable-list"
                  getHref={(tag) => `/notes?tag=${tag.id}`}
                  onRemove={(tagId) => void removeTag(tagId)}
                  onReorder={(tagIds) => reorderNoteTags(tagIds)}
                  removable
                  tags={noteTags}
                />
              ) : null}
              <button className="nav-item nav-item--spaced" type="button" onClick={() => setTagPickerOpen((value) => !value)}>
                <Plus />
                {t('noteDetail.addTag')}
              </button>
              {tagPickerOpen ? (
                <div className="tag-picker-panel">
                  {availableTags.length ? (
                    <div className="inline-picker">
                      {availableTags.map((tag) => (
                        <button key={tag.id} type="button" onClick={() => void addTag(tag.id)}>
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
                      void createAndAddTag();
                    }}
                  >
                    <input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder={t('noteDetail.newTagPlaceholder')} />
                    <ColorPicker
                      ariaLabel={t('profile.labels.color')}
                      onChange={setNewTagColor}
                      value={newTagColor}
                    />
                    <button type="submit">{t('noteDetail.createAndAddTag')}</button>
                  </form>
                </div>
              ) : null}
            </Panel>

            <Panel title={t('noteDetail.additionalExamples')}>
              <ul className="side-list">
                {note.content.additionalExamples?.map((example, index) => (
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
                            onClick={() => {
                              void deleteAdditionalExample(note.id, index).then(() => pushToast(t('noteDetail.exampleDeleted'), 'warning'));
                            }}
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
                    onRemove={() => {
                      void deleteLinkedNote(note.id, linkedNote.id).then(() => pushToast(t('noteDetail.linkDeleted'), 'warning'));
                    }}
                  />
                ))}
                {note.relatedLinks?.map((link) => (
                  <RelatedLinkRow
                    key={link.id}
                    href={link.href}
                    title={link.title}
                    onRemove={() => {
                      void deleteRelatedLink(note.id, link.id).then(() => pushToast(t('noteDetail.linkDeleted'), 'warning'));
                    }}
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
                            <InlineFormattedText value={linkableNote.title} />
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
          </aside>
        ) : null}
      </div>
    </EditorToolbarProvider>
  );
}

function ThumbnailPicker({
  current,
  onOpenChange,
  onSelect,
  open,
  pickerRef,
  t,
}: {
  current?: NoteThumbnailModel;
  onOpenChange: (open: boolean) => void;
  onSelect: (variant: NoteThumbnailModel['variant']) => void;
  open: boolean;
  pickerRef: RefObject<HTMLDivElement>;
  t: (key: string) => string;
}) {
  const currentThumbnail = current ?? { variant: defaultNoteThumbnailVariant };

  return (
    <div className="thumbnail-picker" ref={pickerRef}>
      <button
        className="thumbnail-picker-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('noteDetail.changeThumbnail')}
        title={t('noteDetail.changeThumbnail')}
        onClick={() => onOpenChange(!open)}
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
              onClick={() => onSelect(variant)}
            >
              <NoteThumbnail thumbnail={{ variant }} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildEmptyDraft(type: NoteType, collectionId: string | null, tipTitle: string): NoteEditDraft {
  return {
    type,
    title: '',
    collectionId,
    intro: '',
    summaryMarkdown: '',
    explanationMarkdown: '',
    usageExamples: [emptyUsageRow()],
    tipTitle,
    tipBody: '',
  };
}

function buildDraftFromNote(note: Note, fallbackTipTitle: string): NoteEditDraft {
  return {
    type: note.type,
    title: note.title,
    collectionId: note.collectionId,
    intro: note.content.intro ?? '',
    summaryMarkdown: blocksToMarkdown(note.content.summary),
    explanationMarkdown: blocksToMarkdown(note.content.explanation),
    usageExamples: note.content.usageExamples?.rows.length ? note.content.usageExamples.rows : [emptyUsageRow()],
    tipTitle: note.content.tip?.title ?? fallbackTipTitle,
    tipBody: note.content.tip?.body ?? '',
    tagIds: note.tagIds,
  };
}

function emptyUsageRow() {
  return {
    id: `usage-${crypto.randomUUID()}`,
    expression: '',
    meaning: '',
    example: '',
  };
}

function getSaveStatusLabel({
  isEditing,
  isNewNote,
  note,
  saving,
  t,
}: {
  isEditing: boolean;
  isNewNote: boolean;
  note?: Note;
  saving: boolean;
  t: (key: string) => string;
}) {
  if (saving) {
    return t('noteDetail.saving');
  }

  if (isNewNote) {
    return t('noteDetail.unsavedDraft');
  }

  if (isEditing) {
    return t('noteDetail.editingDraft');
  }

  if (note?.saveState === 'draft') {
    return t('noteDetail.localDraft');
  }

  if (note?.syncStatus === 'local') {
    return t('noteDetail.savedLocal');
  }

  return t('common.saved');
}

function CollectionBreadcrumb({ collection, emptyText }: { collection?: Collection; emptyText: string }) {
  if (!collection) {
    return (
      <span className="breadcrumb">
        <Folder />
        {emptyText}
      </span>
    );
  }

  return (
    <Link className="breadcrumb" to={`/notes?collection=${collection.id}`}>
      <Folder />
      {collection.name}
    </Link>
  );
}

function CollectionSelect({
  collections,
  onChange,
  value,
}: {
  collections: Collection[];
  onChange: (collectionId: string | null) => void;
  value: string | null;
}) {
  const { t } = useI18n();

  return (
    <div className="editable-collection-field editing">
      <Folder />
      <CustomSelect
        ariaLabel={t('noteDetail.collectionLabel')}
        emptyText={t('notes.filters.noCollections')}
        onChange={(collectionId) => onChange(collectionId || null)}
        options={[
          {
            label: t('noteDetail.noCollection'),
            value: '',
          },
          ...collections.map((item) => ({
            color: item.color,
            label: item.name,
            value: item.id,
          })),
        ]}
        value={value ?? ''}
      />
    </div>
  );
}

function EditableDraftTip({
  body,
  onChange,
  title,
}: {
  body: string;
  onChange: (body: string) => void;
  title: string;
}) {
  const { t } = useI18n();

  return (
    <section className="content-section">
      <div className="tip-box editable-tip-box">
        <Lightbulb />
        <div>
          <h2 className="section-title">
            <InlineFormattedText value={title} />
          </h2>
          <MarkdownEditor
            bare
            compact
            label={t('noteDetail.tip')}
            onChange={onChange}
            placeholder={t('noteDetail.tipPlaceholder')}
            rows={5}
            showActions={false}
            showTabs={false}
            showToolbar={false}
            value={body}
          />
        </div>
      </div>
    </section>
  );
}

function TipPreview({ body, title }: { body: string; title: string }) {
  const { t } = useI18n();

  return (
    <section className="content-section">
      <div className="tip-box">
        <Lightbulb />
        <div>
          <h2 className="section-title">
            <InlineFormattedText value={title} />
          </h2>
          <MarkdownPreview emptyText={t('noteDetail.emptyTip')} value={body} />
        </div>
      </div>
    </section>
  );
}

function blocksToMarkdown(blocks?: RichTextBlock[]) {
  return blocks?.map((block) => block.text).filter(Boolean).join('\n\n') ?? '';
}

function LinkedNoteRow({ noteId, onRemove, title }: { noteId: string; onRemove?: () => void; title: string }) {
  const plainTitle = stripInlineFormatting(title);

  return (
    <span className="linked-row-shell">
      <Link className="linked-row" to={`/notes/${noteId}`}>
        <span className="inline-actions">
          <FileText />
          <InlineFormattedText value={title} />
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

function parseNoteType(value: string | null): NoteType {
  return noteTypeOptions.includes(value as NoteType) ? (value as NoteType) : defaultNewNoteType;
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

