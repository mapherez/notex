import { Plus, X } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import type { Note } from '../../core/models/models';
import { richTextToPlainText } from '../../core/utils/richText';
import { isPrimaryShortcut } from '../../core/utils/keyboardShortcuts';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppStore } from '../../store/useAppStore';
import { useNotesStore } from '../../store/useNotesStore';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { WindowTitleBar } from './WindowTitleBar';

export function AppShell() {
  const { t } = useI18n();
  const hasWindowTitleBar = isTauri();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmNewNoteOpen, setConfirmNewNoteOpen] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const primaryCollectionId = useAppStore((state) => state.settings.primaryCollectionId);
  const notes = useNotesStore((state) => state.notes);
  const createNote = useNotesStore((state) => state.createNote);

  const getCurrentNote = useCallback(() => {
    const match = location.pathname.match(/^\/notes\/([^/]+)$/);
    const noteId = match?.[1];
    if (!noteId || noteId === 'new') {
      return undefined;
    }

    return notes.find((note) => note.id === noteId);
  }, [location.pathname, notes]);

  const createAndOpenNote = useCallback(async () => {
    if (creatingNote) {
      return;
    }

    setCreatingNote(true);
    try {
      const note = await createNote({
        collectionId: primaryCollectionId || undefined,
      });
      navigate(`/notes/${note.id}`);
    } finally {
      setCreatingNote(false);
      setConfirmNewNoteOpen(false);
    }
  }, [createNote, creatingNote, navigate, primaryCollectionId]);

  const requestNewNote = useCallback(async () => {
    const currentNote = getCurrentNote();
    if (currentNote) {
      if (!noteHasContent(currentNote)) {
        return;
      }

      setConfirmNewNoteOpen(true);
      return;
    }

    await createAndOpenNote();
  }, [createAndOpenNote, getCurrentNote]);

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      if (isPrimaryShortcut(event, 'n')) {
        event.preventDefault();
        void requestNewNote();
      }

      if (isPrimaryShortcut(event, 'p')) {
        event.preventDefault();
        navigate('/profile');
      }
    }

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [navigate, requestNewNote]);

  return (
    <div className={hasWindowTitleBar ? 'app-frame app-frame--custom-titlebar' : 'app-frame'}>
      <WindowTitleBar />
      <div className="app-shell">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onCreateNote={() => void requestNewNote()} />
        <main className="main-shell">
          <TopBar showSearch onMenuClick={() => setSidebarOpen(true)} />
          <Outlet />
        </main>
        {confirmNewNoteOpen ? (
          <div className="modal-backdrop">
            <section className="choice-modal" role="dialog" aria-modal="true" aria-labelledby="new-note-confirm-title">
              <h2 id="new-note-confirm-title">{t('notes.newNoteConfirmTitle')}</h2>
              <p>{t('notes.newNoteConfirmDescription')}</p>
              <div className="choice-modal-actions two-column-actions">
                <button type="button" onClick={() => setConfirmNewNoteOpen(false)}>
                  <X />
                  <span>{t('common.cancel')}</span>
                </button>
                <button type="button" disabled={creatingNote} onClick={() => void createAndOpenNote()}>
                  <Plus />
                  <span>{t('navigation.newNote')}</span>
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function noteHasContent(note: Note) {
  const text = [
    richTextToPlainText(note.title),
    richTextToPlainText(note.subtitle),
    ...(note.additionalExamples ?? []),
    ...(note.relatedLinks?.flatMap((link) => [link.title, link.href]) ?? []),
    ...(note.blocks?.flatMap((block) => [richTextToPlainText(block.title), block.contentText]) ?? []),
    ...(note.files?.map((file) => file.originalName) ?? []),
  ].join(' ');

  return Boolean(text.trim());
}
