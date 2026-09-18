import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { editorSettings } from '../../config/appSettings';
import type { Note } from '../../core/models/models';
import { beginLocalSave, setLocalDraftPending } from '../../core/mcp/noteMutationCoordinator';

type HeaderNote = Pick<Note, 'id' | 'title' | 'subtitle' | 'collectionId'>;
type HeaderValues = { title: string; subtitle: string; collectionId: string };
type HeaderPatch = { title?: string; subtitle?: string; collectionId?: string | null };
type HeaderDraft = HeaderValues & {
  setTitle: (value: string) => void;
  setSubtitle: (value: string) => void;
  setCollectionId: (value: string) => void;
};

const HeaderDraftContext = createContext<HeaderDraft | null>(null);
const sourceId = 'header';

function valuesOf(note: HeaderNote): HeaderValues {
  return { title: note.title, subtitle: note.subtitle, collectionId: note.collectionId ?? '' };
}

/** Header and collection panel share the same draft, debounce and MCP guard. */
export function NoteHeaderDraftProvider({ children, note, onSave }: {
  children: ReactNode;
  note: HeaderNote;
  onSave: (noteId: string, input: HeaderPatch) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => valuesOf(note));
  const storedRef = useRef(valuesOf(note));
  const revisionRef = useRef(0);

  useLayoutEffect(() => {
    const previous = storedRef.current;
    const incoming = valuesOf(note);
    storedRef.current = incoming;
    // Refresh clean fields without replacing a newer edit while a save finishes.
    setDraft((current) => ({
      title: current.title === previous.title ? incoming.title : current.title,
      subtitle: current.subtitle === previous.subtitle ? incoming.subtitle : current.subtitle,
      collectionId: current.collectionId === previous.collectionId ? incoming.collectionId : current.collectionId,
    }));
  }, [note.title, note.subtitle, note.collectionId]);

  useEffect(() => () => {
    revisionRef.current += 1;
    setLocalDraftPending(note.id, sourceId, false);
  }, [note.id]);

  useEffect(() => {
    const patch: HeaderPatch = {};
    if (draft.title !== note.title) patch.title = draft.title;
    if (draft.subtitle !== note.subtitle) patch.subtitle = draft.subtitle;
    if (draft.collectionId !== (note.collectionId ?? '')) patch.collectionId = draft.collectionId || null;
    const revision = ++revisionRef.current;
    if (!Object.keys(patch).length) {
      setLocalDraftPending(note.id, sourceId, false);
      return;
    }
    setLocalDraftPending(note.id, sourceId, true);
    const timeout = window.setTimeout(() => {
      const finishSave = beginLocalSave(note.id, sourceId);
      void (async () => {
        let saved = false;
        try {
          await onSave(note.id, patch);
          saved = true;
        } catch {
          // Keep the draft registered so a remote mutation cannot overwrite it.
        } finally {
          finishSave();
          if (saved && revisionRef.current === revision) setLocalDraftPending(note.id, sourceId, false);
        }
      })();
    }, editorSettings.headerSaveDebounceMs);
    return () => window.clearTimeout(timeout);
  }, [draft.title, draft.subtitle, draft.collectionId, note.id, note.title, note.subtitle, note.collectionId, onSave]);

  function edit(field: keyof HeaderValues, value: string) {
    if (draft[field] === value) return;
    revisionRef.current += 1;
    // Register before React renders so MCP cannot slip between tap and effect.
    setLocalDraftPending(note.id, sourceId, true);
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return <HeaderDraftContext.Provider value={{
    ...draft,
    setTitle: (value) => edit('title', value),
    setSubtitle: (value) => edit('subtitle', value),
    setCollectionId: (value) => edit('collectionId', value),
  }}>{children}</HeaderDraftContext.Provider>;
}

export function useNoteHeaderDraft() {
  const draft = useContext(HeaderDraftContext);
  if (!draft) throw new Error('Missing NoteHeaderDraftProvider');
  return draft;
}
