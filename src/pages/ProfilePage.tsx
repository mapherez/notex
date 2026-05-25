import {
  CalendarClock,
  ChevronRight,
  Cloud,
  Database,
  Download,
  FileText,
  Folder,
  FolderOpen,
  Globe2,
  HardDrive,
  Loader2,
  Star,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from 'react';
import { CustomSelect } from '../components/ui/CustomSelect';
import { IconBadge } from '../components/ui/IconBadge';
import { Panel } from '../components/ui/Panel';
import { cloudSyncEnabled } from '../config/appSettings';
import {
  chooseSqliteExportDestination,
  chooseSqliteImportFile,
  createSqliteTempExport,
  openSqliteDatabaseFolder,
  openSqliteLocalDataFolder,
  readSqliteDatabaseInfo,
  replaceSqliteDatabaseFromFile,
  type SqliteDatabaseInfo,
  type SqliteExportInfo,
} from '../core/services/sqliteDataManagement';
import { themeRegistry } from '../core/theme/themeRegistry';
import { filterNotes } from '../core/utils/noteFilters';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useSyncStore } from '../store/useSyncStore';
import { useToastStore } from '../store/useToastStore';
import type {
  Locale,
  Note,
  ThemePreference,
} from "../core/models/models";

type ExportModalState =
  | null
  | { phase: 'confirm' }
  | { phase: 'exporting' }
  | { phase: 'ready'; exportInfo: SqliteExportInfo };

export function ProfilePage() {
  const { locale, t } = useI18n();
  const [databaseInfo, setDatabaseInfo] = useState<SqliteDatabaseInfo | null>(null);
  const [exportModal, setExportModal] = useState<ExportModalState>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isImportingDatabase, setIsImportingDatabase] = useState(false);
  const settings = useAppStore((state) => state.settings);
  const hydrateSettings = useAppStore((state) => state.hydrateSettings);
  const setTheme = useAppStore((state) => state.setTheme);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const notes = useKnowledgeStore((state) => state.notes);
  const collections = useKnowledgeStore((state) => state.collections);
  const user = useKnowledgeStore((state) => state.user);
  const refreshKnowledge = useKnowledgeStore((state) => state.refreshKnowledge);
  const syncState = useSyncStore((state) => state.syncState);
  const pushToast = useToastStore((state) => state.pushToast);
  const activeNotes = notes.filter((note) => !note.isTrashed);
  const favoriteNotes = activeNotes.filter((note) => note.isFavorite);
  const mostRecentNote = filterNotes(notes, { mode: 'recent' })[0];
  const lastActivityValue = mostRecentNote
    ? formatRecentActivityTimestamp(getRecentTimestamp(mostRecentNote), locale, t)
    : t('profile.values.noActivity');
  const accountConnected = cloudSyncEnabled && Boolean(syncState?.connected);

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
          pushToast(error instanceof Error ? error.message : t('profile.dataManagement.databasePathError'), 'warning');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pushToast, t]);

  async function handleCreateDatabaseExport() {
    setExportModal({ phase: 'exporting' });
    try {
      const exportInfo = await createSqliteTempExport();
      setExportModal({ phase: 'ready', exportInfo });
      pushToast(t('profile.dataManagement.exportReady'), 'success');
    } catch (error) {
      setExportModal(null);
      pushToast(error instanceof Error ? error.message : t('profile.dataManagement.exportFailed'), 'warning');
    }
  }

  async function handleSaveDatabaseExport(exportInfo: SqliteExportInfo) {
    try {
      const destinationPath = await chooseSqliteExportDestination(exportInfo);
      if (destinationPath) {
        setExportModal(null);
        pushToast(t('profile.dataManagement.exportSaved'), 'success');
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t('profile.dataManagement.exportFailed'), 'warning');
    }
  }

  async function handleImportDatabase() {
    setIsImportingDatabase(true);
    try {
      const sourcePath = await chooseSqliteImportFile();
      if (!sourcePath) {
        setIsImportingDatabase(false);
        return;
      }

      await replaceSqliteDatabaseFromFile(sourcePath);
      await Promise.all([refreshKnowledge(), hydrateSettings(), readSqliteDatabaseInfo().then(setDatabaseInfo)]);
      setImportModalOpen(false);
      pushToast(t('profile.dataManagement.importComplete'), 'success');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t('profile.dataManagement.importFailed'), 'warning');
    } finally {
      setIsImportingDatabase(false);
    }
  }

  async function handleOpenDatabaseFolder() {
    try {
      await openSqliteDatabaseFolder();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t('profile.dataManagement.openFolderFailed'), 'warning');
    }
  }

  async function handleOpenLocalDataFolder() {
    try {
      await openSqliteLocalDataFolder();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t('profile.dataManagement.openFolderFailed'), 'warning');
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
                accountConnected && user?.avatarUrl
                  ? "profile-avatar"
                  : "profile-avatar profile-card__avatar--placeholder"
              }
            >
              {accountConnected && user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <UserRound strokeWidth={1.6} />
              )}
            </div>
            <h2 className="panel-title">{accountConnected ? user?.name : t("profile.localUser")}</h2>
            {accountConnected && user?.handle ? <div className="handle">{user.handle}</div> : null}
            <div className="connected">
              {accountConnected ? (
                <>
                  <span className="logo-mark logo-mark--google">G</span>
                  {t("profile.connectedWith")}
                </>
              ) : (
                t("profile.localAccount")
              )}
            </div>
          </article>
        </section>

        <section className="profile-main">
          <div className="profile-top-row">
            <section className="settings-card profile-top-card">
              <h2 className="settings-title">{t("profile.preferences.title")}</h2>
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
                options={themeRegistry.map((theme) => ({ value: theme.id, label: t(theme.labelKey) }))}
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
                onClick={() => setExportModal({ phase: 'confirm' })}
              >
                <Download className="security-row__icon security-row__icon--success" />
                <span>
                  <span>{t("profile.dataManagement.exportData")}</span>
                  <span className="security-sub">{t("profile.dataManagement.exportDescription")}</span>
                </span>
                <ChevronRight />
              </button>
              <button
                className="security-row"
                type="button"
                onClick={() => setImportModalOpen(true)}
              >
                <Upload className="security-row__icon security-row__icon--blue" />
                <span>
                  <span>{t("profile.dataManagement.importData")}</span>
                  <span className="security-sub">{t("profile.dataManagement.importDescription")}</span>
                </span>
                <ChevronRight />
              </button>
            </Panel>
          </div>

          <section className="settings-card profile-wide-section database-management-card">
            <h2 className="settings-title">{t("profile.databaseManagement.title")}</h2>
            <div className="database-management-grid">
              <DatabasePathRow
                databasePath={databaseInfo?.databasePath ?? t("profile.dataManagement.databasePathLoading")}
                icon={Database}
                label={t("profile.databaseManagement.currentDatabase")}
                onOpen={handleOpenDatabaseFolder}
                openLabel={t("profile.dataManagement.openDatabaseFolder")}
              />
              <DatabasePathRow
                databasePath={databaseInfo?.localDataDirectory ?? t("profile.databaseManagement.localDataPathLoading")}
                icon={HardDrive}
                label={t("profile.databaseManagement.localDataPath")}
                onOpen={handleOpenLocalDataFolder}
                openLabel={t("profile.databaseManagement.openLocalDataFolder")}
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
    </div>
  );
}

function Metric({
  icon,
  color,
  label,
  value,
}: {
  icon: Parameters<typeof IconBadge>[0]['icon'];
  color: Parameters<typeof IconBadge>[0]['color'];
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
      <CustomSelect ariaLabel={label} onChange={onChange} options={options} value={value} />
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
      <button className="icon-button" type="button" aria-label={openLabel} onClick={onOpen}>
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
      <section className="choice-modal" role="dialog" aria-modal="true" aria-labelledby="export-db-title">
        <h2 id="export-db-title">{t("profile.dataManagement.exportModalTitle")}</h2>
        {modal.phase === 'confirm' ? (
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
        {modal.phase === 'exporting' ? (
          <div className="choice-modal-status">
            <Loader2 />
            <span>{t("profile.dataManagement.exporting")}</span>
          </div>
        ) : null}
        {modal.phase === 'ready' ? (
          <>
            <p>{t("profile.dataManagement.exportReadyDescription")}</p>
            <div className="choice-modal-path" title={modal.exportInfo.tempPath}>
              {modal.exportInfo.tempPath}
            </div>
            <div className="choice-modal-actions">
              <button type="button" disabled>
                <Cloud />
                <span>
                  <span>{t("profile.dataManagement.exportToGoogleDrive")}</span>
                  <span>{t("profile.dataManagement.exportToGoogleDrivePlaceholder")}</span>
                </span>
              </button>
              <button type="button" onClick={() => onSave(modal.exportInfo)}>
                <FolderOpen />
                <span>
                  <span>{t("profile.dataManagement.downloadExport")}</span>
                  <span>{t("profile.dataManagement.downloadExportDescription")}</span>
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
      <section className="choice-modal" role="dialog" aria-modal="true" aria-labelledby="import-db-title">
        <h2 id="import-db-title">{t("profile.dataManagement.importModalTitle")}</h2>
        <p>{t("profile.dataManagement.importModalDescription")}</p>
        {isImporting ? (
          <div className="choice-modal-status">
            <Loader2 />
            <span>{t("profile.dataManagement.importing")}</span>
          </div>
        ) : null}
        <div className="choice-modal-actions">
          <button type="button" disabled={isImporting} onClick={onExportCurrent}>
            <Download />
            <span>
              <span>{t("profile.dataManagement.exportCurrentBeforeImport")}</span>
              <span>{t("profile.dataManagement.exportCurrentBeforeImportDescription")}</span>
            </span>
          </button>
          <button type="button" disabled={isImporting} onClick={onImport}>
            <Upload />
            <span>
              <span>{t("profile.dataManagement.chooseImportDatabase")}</span>
              <span>{t("profile.dataManagement.chooseImportDatabaseDescription")}</span>
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
