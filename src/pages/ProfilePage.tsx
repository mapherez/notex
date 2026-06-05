import {
  CalendarClock,
  ChevronRight,
  Database,
  Download,
  FileText,
  Folder,
  FolderOpen,
  Globe2,
  HardDrive,
  Keyboard,
  Loader2,
  Star,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CustomSelect } from "../components/ui/CustomSelect";
import { IconBadge } from "../components/ui/IconBadge";
import { Panel } from "../components/ui/Panel";
import { appLimits, editorSettings } from "../config/appSettings";
import {
  openSqliteDatabaseFolder,
  openSqliteFilesFolder,
  openSqliteLocalDataFolder,
  readSqliteDatabaseInfo,
  type SqliteDatabaseInfo,
  type SqliteExportInfo,
} from "../core/services/sqliteDataManagement";
import {
  chooseNotexPackageExportDestination,
  chooseNotexPackageImportFile,
  createNotexPackageTempExport,
  replaceFromNotexPackage,
} from "../core/services/notexPackage";
import {
  chooseNotexNoteImportFile,
  importNotexNotePackage,
  type NotexNoteImportInfo,
} from "../core/services/notexNotePackage";
import { themeRegistry } from "../core/theme/themeRegistry";
import { filterNotes } from "../core/utils/noteFilters";
import { richTextToPlainText } from "../core/utils/richText";
import { formatShortcutForDisplay } from "../core/utils/shortcutFormatting";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/useAppStore";
import { useNotesStore } from "../store/useNotesStore";
import { useKnowledgeStore } from "../store/useKnowledgeStore";
import { useToastStore } from "../store/useToastStore";
import type { Note, Locale, ThemePreference } from "../core/models/models";

type ExportModalState =
  | null
  | { phase: "confirm" }
  | { phase: "exporting" }
  | { phase: "ready"; exportInfo: SqliteExportInfo };

export function ProfilePage() {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const [databaseInfo, setDatabaseInfo] = useState<SqliteDatabaseInfo | null>(
    null,
  );
  const [exportModal, setExportModal] = useState<ExportModalState>(null);
  const [importChoiceModalOpen, setImportChoiceModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isImportingDatabase, setIsImportingDatabase] = useState(false);
  const [isImportingNote, setIsImportingNote] = useState(false);
  const [noteImportSummary, setNoteImportSummary] =
    useState<NotexNoteImportInfo | null>(null);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const settings = useAppStore((state) => state.settings);
  const hydrateSettings = useAppStore((state) => state.hydrateSettings);
  const setTheme = useAppStore((state) => state.setTheme);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const notes = useNotesStore((state) => state.notes);
  const collections = useKnowledgeStore((state) => state.collections);
  const user = useKnowledgeStore((state) => state.user);
  const refreshKnowledge = useKnowledgeStore((state) => state.refreshKnowledge);
  const refreshNotes = useNotesStore((state) => state.refreshNotes);
  const pushToast = useToastStore((state) => state.pushToast);
  const activeNotes = notes.filter((note) => !note.isTrashed);
  const favoriteNotes = activeNotes.filter((note) => note.isFavorite);
  const mostRecentNote = filterNotes(notes, { mode: "recent" })[0];
  const lastActivityValue = mostRecentNote
    ? formatRecentActivityTimestamp(
        getRecentTimestamp(mostRecentNote),
        locale,
        t,
      )
    : t("profile.values.noActivity");

  useEffect(() => {
    let cancelled = false;

    void readSqliteDatabaseInfo()
      .then((info) => {
        if (!cancelled) {
          setDatabaseInfo(info);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          pushToast(
            error instanceof Error
              ? error.message
              : t("profile.dataManagement.databasePathError"),
            "warning",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pushToast, t]);

  async function handleCreateDatabaseExport() {
    setExportModal({ phase: "exporting" });
    try {
      const exportInfo = await createNotexPackageTempExport();
      setExportModal({ phase: "ready", exportInfo });
      pushToast(t("profile.dataManagement.exportReady"), "success");
    } catch (error) {
      setExportModal(null);
      pushToast(
        error instanceof Error
          ? error.message
          : t("profile.dataManagement.exportFailed"),
        "warning",
      );
    }
  }

  async function handleSaveDatabaseExport(exportInfo: SqliteExportInfo) {
    try {
      const destinationPath =
        await chooseNotexPackageExportDestination(exportInfo);
      if (destinationPath) {
        setExportModal(null);
        pushToast(t("profile.dataManagement.exportSaved"), "success");
      }
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : t("profile.dataManagement.exportFailed"),
        "warning",
      );
    }
  }

  async function handleImportDatabase() {
    setIsImportingDatabase(true);
    try {
      const sourcePath = await chooseNotexPackageImportFile();
      if (!sourcePath) {
        setIsImportingDatabase(false);
        return;
      }

      await replaceFromNotexPackage(sourcePath);
      await Promise.all([
        refreshKnowledge(),
        refreshNotes(),
        hydrateSettings(),
        readSqliteDatabaseInfo().then(setDatabaseInfo),
      ]);
      setImportModalOpen(false);
      pushToast(t("profile.dataManagement.importComplete"), "success");
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : t("profile.dataManagement.importFailed"),
        "warning",
      );
    } finally {
      setIsImportingDatabase(false);
    }
  }

  async function handleImportNotePackage() {
    setIsImportingNote(true);
    try {
      const sourcePath = await chooseNotexNoteImportFile();
      if (!sourcePath) {
        return;
      }

      const importInfo = await importNotexNotePackage(sourcePath);
      await Promise.all([refreshKnowledge(), refreshNotes()]);
      setImportChoiceModalOpen(false);
      if (hasSkippedNoteImportItems(importInfo)) {
        setNoteImportSummary(importInfo);
      } else {
        pushToast(t("profile.dataManagement.noteImportComplete"), "success");
        navigate(`/notes/${importInfo.noteId}`);
      }
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : t("profile.dataManagement.noteImportFailed"),
        "warning",
      );
    } finally {
      setIsImportingNote(false);
    }
  }

  async function handleOpenDatabaseFolder() {
    try {
      await openSqliteDatabaseFolder();
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : t("profile.dataManagement.openFolderFailed"),
        "warning",
      );
    }
  }

  async function handleOpenLocalDataFolder() {
    try {
      await openSqliteLocalDataFolder();
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : t("profile.dataManagement.openFolderFailed"),
        "warning",
      );
    }
  }

  async function handleOpenFilesFolder() {
    try {
      await openSqliteFilesFolder();
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : t("profile.dataManagement.openFolderFailed"),
        "warning",
      );
    }
  }

  return (
    <div className="page-content list-page-grid">
      <header>
        <h1 className="page-title">{t("profile.title")}</h1>
        <p className="page-subtitle">{t("profile.subtitle")}</p>
      </header>

      <div className="profile-layout">
        <section className="profile-left">
          <article className="profile-card">
            <div
              className={
                user?.avatarUrl
                  ? "profile-avatar"
                  : "profile-avatar profile-card__avatar--placeholder"
              }
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <UserRound strokeWidth={1.6} />
              )}
            </div>
            <h2 className="panel-title">
              {user?.name ?? t("profile.localUser")}
            </h2>
            {user?.handle ? <div className="handle">{user.handle}</div> : null}
            <div className="connected">{t("profile.localAccount")}</div>
          </article>

          <Panel title={t("profile.shortcuts.title")}>
            <button
              className="security-row shortcuts-button"
              type="button"
              onClick={() => setShortcutHelpOpen(true)}
            >
              <Keyboard className="security-row__icon security-row__icon--blue" />
              <span className="security-sub">
                {t("profile.shortcuts.description")}
              </span>
              <ChevronRight />
            </button>
          </Panel>
        </section>

        <section className="profile-main">
          <div className="profile-top-row">
            <section className="settings-card profile-top-card">
              <h2 className="settings-title">
                {t("profile.preferences.title")}
              </h2>
              <PreferenceSelect
                icon={<IconBadge icon={CalendarClock} color="red" />}
                label={t("profile.preferences.theme")}
                description={t("profile.preferences.themeDescription")}
                value={settings.theme}
                onChange={(value) =>
                  void setTheme(value as ThemePreference).then(() =>
                    pushToast(t("common.done"), "success"),
                  )
                }
                options={themeRegistry.map((theme) => ({
                  value: theme.id,
                  label: t(theme.labelKey),
                }))}
              />
              <PreferenceSelect
                icon={<IconBadge icon={Globe2} color="green" />}
                label={t("profile.preferences.language")}
                description={t("profile.preferences.languageDescription")}
                value={settings.language}
                onChange={(value) =>
                  void setLanguage(value as Locale).then(() =>
                    pushToast(t("common.done"), "success"),
                  )
                }
                options={[
                  { value: "pt", label: t("profile.preferences.portuguese") },
                  { value: "en", label: t("profile.preferences.english") },
                ]}
              />
            </section>

            <Panel title={t("profile.dataManagement.title")}>
              <button
                className="security-row"
                type="button"
                onClick={() => setExportModal({ phase: "confirm" })}
              >
                <Download className="security-row__icon security-row__icon--success" />
                <span>
                  <span>{t("profile.dataManagement.exportData")}</span>
                  <span className="security-sub">
                    {t("profile.dataManagement.exportDescription")}
                  </span>
                </span>
                <ChevronRight />
              </button>
              <button
                className="security-row"
                type="button"
                onClick={() => setImportChoiceModalOpen(true)}
              >
                <Upload className="security-row__icon security-row__icon--blue" />
                <span>
                  <span>{t("profile.dataManagement.importData")}</span>
                  <span className="security-sub">
                    {t("profile.dataManagement.importDescription")}
                  </span>
                </span>
                <ChevronRight />
              </button>
            </Panel>
          </div>

          <section className="settings-card profile-wide-section database-management-card">
            <h2 className="settings-title">
              {t("profile.databaseManagement.title")}
            </h2>
            <div className="database-management-grid">
              <DatabasePathRow
                databasePath={
                  databaseInfo?.databasePath ??
                  t("profile.dataManagement.databasePathLoading")
                }
                icon={Database}
                label={t("profile.databaseManagement.currentDatabase")}
                onOpen={handleOpenDatabaseFolder}
                openLabel={t("profile.dataManagement.openDatabaseFolder")}
              />
              <DatabasePathRow
                databasePath={
                  databaseInfo?.localDataDirectory ??
                  t("profile.databaseManagement.localDataPathLoading")
                }
                icon={HardDrive}
                label={t("profile.databaseManagement.localDataPath")}
                onOpen={handleOpenLocalDataFolder}
                openLabel={t("profile.databaseManagement.openLocalDataFolder")}
              />
              <DatabasePathRow
                databasePath={
                  databaseInfo?.filesDirectory ??
                  t("profile.databaseManagement.filesPathLoading")
                }
                icon={Folder}
                label={t("profile.databaseManagement.filesPath")}
                onOpen={handleOpenFilesFolder}
                openLabel={t("profile.databaseManagement.openFilesFolder")}
              />
            </div>
          </section>

          <Panel title={t("profile.statistics")}>
            <div className="meta-list profile-stat-grid">
              <Metric
                icon={CalendarClock}
                color="blue"
                label={t("profile.stats.lastActivity")}
                value={lastActivityValue}
              />
              <Metric
                icon={FileText}
                color="red"
                label={t("profile.stats.notes")}
                value={String(activeNotes.length)}
              />
              <Metric
                icon={Star}
                color="amber"
                label={t("profile.stats.favorites")}
                value={String(favoriteNotes.length)}
              />
              <Metric
                icon={Folder}
                color="green"
                label={t("profile.stats.collections")}
                value={String(collections.length)}
              />
            </div>
          </Panel>
        </section>
      </div>
      <ExportDatabaseModal
        modal={exportModal}
        onCancel={() => setExportModal(null)}
        onConfirm={handleCreateDatabaseExport}
        onSave={handleSaveDatabaseExport}
        t={t}
      />
      <ImportChoiceModal
        isImportingNote={isImportingNote}
        open={importChoiceModalOpen}
        onCancel={() => {
          if (!isImportingNote) {
            setImportChoiceModalOpen(false);
          }
        }}
        onImportNote={() => void handleImportNotePackage()}
        onImportPackage={() => {
          setImportChoiceModalOpen(false);
          setImportModalOpen(true);
        }}
        t={t}
      />
      <ImportDatabaseModal
        isImporting={isImportingDatabase}
        open={importModalOpen}
        onCancel={() => {
          if (!isImportingDatabase) {
            setImportModalOpen(false);
          }
        }}
        onExportCurrent={() => {
          setImportModalOpen(false);
          void handleCreateDatabaseExport();
        }}
        onImport={handleImportDatabase}
        t={t}
      />
      <NoteImportSummaryModal
        importInfo={noteImportSummary}
        onClose={() => {
          const importedNoteId = noteImportSummary?.noteId;
          setNoteImportSummary(null);
          if (importedNoteId) {
            navigate(`/notes/${importedNoteId}`);
          }
        }}
        t={t}
      />
      <ShortcutHelpModal
        open={shortcutHelpOpen}
        onClose={() => setShortcutHelpOpen(false)}
        t={t}
      />
    </div>
  );
}

function Metric({
  icon,
  color,
  label,
  value,
}: {
  icon: Parameters<typeof IconBadge>[0]["icon"];
  color: Parameters<typeof IconBadge>[0]["color"];
  label: string;
  value: string;
}) {
  return (
    <div className="settings-row">
      <IconBadge icon={icon} color={color} />
      <span>
        <span className="settings-label">{value}</span>
        <span className="settings-description">{label}</span>
      </span>
    </div>
  );
}

function PreferenceSelect({
  icon,
  label,
  description,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="settings-row">
      {icon}
      <span>
        <span className="settings-label">{label}</span>
        <span className="settings-description">{description}</span>
      </span>
      <CustomSelect
        ariaLabel={label}
        onChange={onChange}
        options={options}
        value={value}
      />
    </div>
  );
}

function DatabasePathRow({
  databasePath,
  icon: Icon,
  label,
  onOpen,
  openLabel,
}: {
  databasePath: string;
  icon: LucideIcon;
  label: string;
  onOpen: () => void;
  openLabel: string;
}) {
  return (
    <div className="database-path-row">
      <Icon className="database-path-row__icon" />
      <span>
        <span className="settings-label">{label}</span>
        <span className="database-path-value" title={databasePath}>
          {databasePath}
        </span>
      </span>
      <button
        className="icon-button"
        type="button"
        aria-label={openLabel}
        onClick={onOpen}
      >
        <FolderOpen />
      </button>
    </div>
  );
}

function ExportDatabaseModal({
  modal,
  onCancel,
  onConfirm,
  onSave,
  t,
}: {
  modal: ExportModalState;
  onCancel: () => void;
  onConfirm: () => void;
  onSave: (exportInfo: SqliteExportInfo) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  if (!modal) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <section
        className="choice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-db-title"
      >
        <h2 id="export-db-title">
          {t("profile.dataManagement.exportModalTitle")}
        </h2>
        {modal.phase === "confirm" ? (
          <>
            <p>{t("profile.dataManagement.exportModalDescription")}</p>
            <div className="choice-modal-actions two-column-actions">
              <button type="button" onClick={onCancel}>
                <span>{t("common.no")}</span>
              </button>
              <button type="button" onClick={onConfirm}>
                <Download />
                <span>{t("common.yes")}</span>
              </button>
            </div>
          </>
        ) : null}
        {modal.phase === "exporting" ? (
          <div className="choice-modal-status">
            <Loader2 />
            <span>{t("profile.dataManagement.exporting")}</span>
          </div>
        ) : null}
        {modal.phase === "ready" ? (
          <>
            <p>{t("profile.dataManagement.exportReadyDescription")}</p>
            <div
              className="choice-modal-path"
              title={modal.exportInfo.tempPath}
            >
              {modal.exportInfo.tempPath}
            </div>
            <div className="choice-modal-actions">
              <button type="button" onClick={() => onSave(modal.exportInfo)}>
                <FolderOpen />
                <span>
                  <span>{t("profile.dataManagement.downloadExport")}</span>
                  <span>
                    {t("profile.dataManagement.downloadExportDescription")}
                  </span>
                </span>
              </button>
              <button type="button" onClick={onCancel}>
                <span>{t("common.close")}</span>
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function ImportChoiceModal({
  isImportingNote,
  open,
  onCancel,
  onImportNote,
  onImportPackage,
  t,
}: {
  isImportingNote: boolean;
  open: boolean;
  onCancel: () => void;
  onImportNote: () => void;
  onImportPackage: () => void;
  t: ReturnType<typeof useI18n>["t"];
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
        aria-labelledby="import-choice-title"
      >
        <h2 id="import-choice-title">
          {t("profile.dataManagement.importChoiceTitle")}
        </h2>
        <p>{t("profile.dataManagement.importChoiceDescription")}</p>
        {isImportingNote ? (
          <div className="choice-modal-status">
            <Loader2 />
            <span>{t("profile.dataManagement.importingNote")}</span>
          </div>
        ) : null}
        <div className="choice-modal-actions">
          <button
            type="button"
            disabled={isImportingNote}
            onClick={onImportNote}
          >
            <FileText />
            <span>
              <span>{t("profile.dataManagement.importNoteData")}</span>
              <span>{t("profile.dataManagement.importNoteDescription")}</span>
            </span>
          </button>
          <button
            type="button"
            disabled={isImportingNote}
            onClick={onImportPackage}
          >
            <Upload />
            <span>
              <span>{t("profile.dataManagement.chooseImportDatabase")}</span>
              <span>
                {t("profile.dataManagement.chooseImportDatabaseDescription")}
              </span>
            </span>
          </button>
          <button type="button" disabled={isImportingNote} onClick={onCancel}>
            <span>{t("common.cancel")}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function ImportDatabaseModal({
  isImporting,
  open,
  onCancel,
  onExportCurrent,
  onImport,
  t,
}: {
  isImporting: boolean;
  open: boolean;
  onCancel: () => void;
  onExportCurrent: () => void;
  onImport: () => void;
  t: ReturnType<typeof useI18n>["t"];
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
        aria-labelledby="import-db-title"
      >
        <h2 id="import-db-title">
          {t("profile.dataManagement.importModalTitle")}
        </h2>
        <p>{t("profile.dataManagement.importModalDescription")}</p>
        {isImporting ? (
          <div className="choice-modal-status">
            <Loader2 />
            <span>{t("profile.dataManagement.importing")}</span>
          </div>
        ) : null}
        <div className="choice-modal-actions">
          <button
            type="button"
            disabled={isImporting}
            onClick={onExportCurrent}
          >
            <Download />
            <span>
              <span>
                {t("profile.dataManagement.exportCurrentBeforeImport")}
              </span>
              <span>
                {t(
                  "profile.dataManagement.exportCurrentBeforeImportDescription",
                )}
              </span>
            </span>
          </button>
          <button type="button" disabled={isImporting} onClick={onImport}>
            <Upload />
            <span>
              <span>{t("profile.dataManagement.chooseImportDatabase")}</span>
              <span>
                {t("profile.dataManagement.chooseImportDatabaseDescription")}
              </span>
            </span>
          </button>
          <button type="button" disabled={isImporting} onClick={onCancel}>
            <span>{t("common.cancel")}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function NoteImportSummaryModal({
  importInfo,
  onClose,
  t,
}: {
  importInfo: NotexNoteImportInfo | null;
  onClose: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  if (!importInfo) {
    return null;
  }

  const skippedItems = [
    importInfo.droppedTags.length
      ? {
          label: t("profile.dataManagement.noteImportSkippedTags"),
          value: importInfo.droppedTags.join(", "),
        }
      : null,
    importInfo.droppedCollection
      ? {
          label: t("profile.dataManagement.noteImportSkippedCollection"),
          value: importInfo.droppedCollection,
        }
      : null,
    importInfo.droppedLinkedNotes.length
      ? {
          label: t("profile.dataManagement.noteImportSkippedLinks"),
          value: importInfo.droppedLinkedNotes.join(", "),
        }
      : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const title =
    richTextToPlainText(importInfo.title).trim() || t("notes.untitled");

  return (
    <div className="modal-backdrop">
      <section
        className="choice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-import-summary-title"
      >
        <h2 id="note-import-summary-title">
          {t("profile.dataManagement.noteImportSummaryTitle")}
        </h2>
        <p>
          {t("profile.dataManagement.noteImportSummaryDescription", {
            title,
          })}
        </p>
        <div className="choice-modal-summary-list">
          {skippedItems.map((item) => (
            <div className="choice-modal-summary-row" key={item.label}>
              <span>{item.label}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
        <div className="choice-modal-actions">
          <button type="button" onClick={onClose}>
            <span>{t("common.close")}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function ShortcutHelpModal({
  open,
  onClose,
  t,
}: {
  open: boolean;
  onClose: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const groups = buildShortcutHelpGroups(t);

  return (
    <div className="modal-backdrop">
      <section
        className="choice-modal shortcut-help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
      >
        <div>
          <h2 id="shortcut-help-title">{t("profile.shortcuts.modalTitle")}</h2>
          <p>{t("profile.shortcuts.modalDescription")}</p>
        </div>
        <div className="shortcut-help-list">
          {groups.map((group) => (
            <section className="shortcut-help-group" key={group.title}>
              <h3>{group.title}</h3>
              <div className="shortcut-help-rows">
                {group.items.map((item) => (
                  <div
                    className="shortcut-help-row"
                    key={`${group.title}-${item.description}`}
                  >
                    <span className="shortcut-help-keys">
                      {item.keys.map((key) => (
                        <kbd className="kbd" key={key}>
                          {key}
                        </kbd>
                      ))}
                    </span>
                    <span>{item.description}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="choice-modal-actions">
          <button type="button" onClick={onClose}>
            <span>{t("common.close")}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function buildShortcutHelpGroups(t: ReturnType<typeof useI18n>["t"]) {
  const toolbarShortcutItems = buildToolbarShortcutItems(t);

  return [
    {
      title: t("profile.shortcuts.groups.global"),
      items: [
        {
          keys: ["Ctrl / ⌘ + P"],
          description: t("profile.shortcuts.items.openProfile"),
        },
        {
          keys: ["Ctrl / ⌘ + N"],
          description: t("profile.shortcuts.items.newNote"),
        },
        {
          keys: ["Ctrl / ⌘ + F"],
          description: t("profile.shortcuts.items.focusSearch"),
        },
        {
          keys: ["↑ / ↓"],
          description: t("profile.shortcuts.items.moveSearchResults"),
        },
        {
          keys: ["Enter"],
          description: t("profile.shortcuts.items.selectHighlighted"),
        },
        {
          keys: ["Esc"],
          description: t("profile.shortcuts.items.closeSearchOrPicker"),
        },
      ],
    },
    {
      title: t("profile.shortcuts.groups.dashboard"),
      items: [
        {
          keys: [t("profile.shortcuts.keys.primaryDigitRange", { count: 5 })],
          description: t("profile.shortcuts.items.openDashboardStats"),
        },
        {
          keys: [
            t("profile.shortcuts.keys.shiftDigitRange", {
              count: appLimits.quickPins,
            }),
          ],
          description: t("profile.shortcuts.items.openQuickPins"),
        },
        {
          keys: [t("profile.shortcuts.keys.letter")],
          description: t("profile.shortcuts.items.startQuickCapture"),
        },
        {
          keys: ["Ctrl / ⌘ + S"],
          description: t("profile.shortcuts.items.saveQuickCapture"),
        },
        {
          keys: ["Esc"],
          description: t("profile.shortcuts.items.clearQuickCapture"),
        },
      ],
    },
    {
      title: t("profile.shortcuts.groups.notes"),
      items: [
        {
          keys: [t("profile.shortcuts.keys.letter")],
          description: t("profile.shortcuts.items.startNoteTyping"),
        },
        {
          keys: ["Enter", "Space"],
          description: t("profile.shortcuts.items.openFocusedTag"),
        },
        {
          keys: ["Ctrl / ⌘ / Alt + ← / →"],
          description: t("profile.shortcuts.items.reorderTags"),
        },
      ],
    },
    {
      title: t("profile.shortcuts.groups.noteToolbar"),
      items: [
        ...toolbarShortcutItems,
        {
          keys: [formatShortcutForDisplay("Mod+T"), "← / ↑ / ↓ / →"],
          description: t("profile.shortcuts.items.tableMode"),
        },
        {
          keys: ["1", "Space"],
          description: t("profile.shortcuts.items.orderedListTrigger"),
        },
        {
          keys: [".", "Space"],
          description: t("profile.shortcuts.items.bulletListTrigger"),
        },
        {
          keys: ["Enter"],
          description: t("profile.shortcuts.items.continueOrExitList"),
        },
      ],
    },
    {
      title: t("profile.shortcuts.groups.organization"),
      items: [
        {
          keys: [t("profile.shortcuts.keys.letter")],
          description: t("profile.shortcuts.items.startNewTag"),
        },
        {
          keys: [t("profile.shortcuts.keys.letter")],
          description: t("profile.shortcuts.items.startNewCollection"),
        },
        {
          keys: ["Esc"],
          description: t("profile.shortcuts.items.cancelOrganizationEdit"),
        },
        {
          keys: ["Esc"],
          description: t("profile.shortcuts.items.cancelReorder"),
        },
      ],
    },
    {
      title: t("profile.shortcuts.groups.pickers"),
      items: [
        {
          keys: ["↑ / ↓"],
          description: t("profile.shortcuts.items.movePickerOptions"),
        },
        {
          keys: ["Enter"],
          description: t("profile.shortcuts.items.selectPickerOption"),
        },
        {
          keys: ["Esc"],
          description: t("profile.shortcuts.items.closePicker"),
        },
        {
          keys: ["← / ↑ / ↓ / →"],
          description: t("profile.shortcuts.items.moveColorPicker"),
        },
        {
          keys: ["Enter"],
          description: t("profile.shortcuts.items.selectColorPicker"),
        },
        {
          keys: ["Esc", "Tab"],
          description: t("profile.shortcuts.items.closeColorPicker"),
        },
      ],
    },
  ];
}

function buildToolbarShortcutItems(t: ReturnType<typeof useI18n>["t"]) {
  const items = [];
  let imageFileAdded = false;

  for (const tool of editorSettings.noteTools) {
    if (tool.id === "image" || tool.id === "file") {
      if (imageFileAdded) {
        continue;
      }
      imageFileAdded = true;
      items.push({
        keys: [formatShortcutForDisplay(tool.shortcut)],
        description: t("profile.shortcuts.items.toolbar.imageFile"),
      });
      continue;
    }

    items.push({
      keys: [formatShortcutForDisplay(tool.shortcut)],
      description: t(`profile.shortcuts.items.toolbar.${tool.id}`),
    });
  }

  return items;
}

function hasSkippedNoteImportItems(importInfo: NotexNoteImportInfo) {
  return (
    importInfo.droppedTags.length > 0 ||
    Boolean(importInfo.droppedCollection) ||
    importInfo.droppedLinkedNotes.length > 0
  );
}

function getRecentTimestamp(note: Note) {
  return note.lastOpenedAt ?? note.updatedAt;
}

function formatRecentActivityTimestamp(value: string, locale: string, t: ReturnType<typeof useI18n>['t']) {
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
