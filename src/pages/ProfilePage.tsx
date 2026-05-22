import {
  CalendarClock,
  ChevronRight,
  Cloud,
  Computer,
  Database,
  Download,
  Edit3,
  FileText,
  Folder,
  FolderOpen,
  Globe2,
  Grid2X2,
  HardDrive,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Settings2,
  Star,
  Trash2,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from 'react';
import { IconBadge } from '../components/ui/IconBadge';
import { Panel } from '../components/ui/Panel';
import { TagChip } from '../components/ui/TagChip';
import { cloudSyncEnabled } from '../config/appSettings';
import {
  chooseSqliteExportDestination,
  chooseSqliteImportFile,
  createSqliteTempExport,
  openSqliteDatabaseFolder,
  readSqliteDatabaseInfo,
  replaceSqliteDatabaseFromFile,
  type SqliteDatabaseInfo,
  type SqliteExportInfo,
} from '../core/services/sqliteDataManagement';
import { themeRegistry } from '../core/theme/themeRegistry';
import { filterNotes } from '../core/utils/noteFilters';
import { sortTagsByFavoriteOrder, sortTagsByName } from '../core/utils/tagSorting';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useSyncStore } from '../store/useSyncStore';
import { useToastStore } from '../store/useToastStore';
import type {
  DeviceSession,
  Locale,
  Note,
  PreferredLayout,
  ThemePreference,
} from "../core/models/models";

type ExportModalState =
  | null
  | { phase: 'confirm' }
  | { phase: 'exporting' }
  | { phase: 'ready'; exportInfo: SqliteExportInfo };

export function ProfilePage() {
  const { locale, t } = useI18n();
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [syncDevicesOpen, setSyncDevicesOpen] = useState(false);
  const [clearCloudConfirmOpen, setClearCloudConfirmOpen] = useState(false);
  const [databaseInfo, setDatabaseInfo] = useState<SqliteDatabaseInfo | null>(null);
  const [exportModal, setExportModal] = useState<ExportModalState>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isImportingDatabase, setIsImportingDatabase] = useState(false);
  const settings = useAppStore((state) => state.settings);
  const hydrateSettings = useAppStore((state) => state.hydrateSettings);
  const setTheme = useAppStore((state) => state.setTheme);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setPreferredLayout = useAppStore((state) => state.setPreferredLayout);
  const setStartupPage = useAppStore((state) => state.setStartupPage);
  const setPrimaryCollection = useAppStore((state) => state.setPrimaryCollection);
  const toggleFavoriteTag = useAppStore((state) => state.toggleFavoriteTag);
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const user = useKnowledgeStore((state) => state.user);
  const refreshKnowledge = useKnowledgeStore((state) => state.refreshKnowledge);
  const syncState = useSyncStore((state) => state.syncState);
  const sessions = useSyncStore((state) => state.sessions);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const conflictCount = useSyncStore((state) => state.conflictCount);
  const isConnecting = useSyncStore((state) => state.isConnecting);
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const clearCloudData = useSyncStore((state) => state.clearCloudData);
  const connectGoogle = useSyncStore((state) => state.connectGoogle);
  const removeDeviceSession = useSyncStore(
    (state) => state.removeDeviceSession,
  );
  const pushToast = useToastStore((state) => state.pushToast);
  const activeNotes = notes.filter((note) => !note.isTrashed);
  const favoriteNotes = activeNotes.filter((note) => note.isFavorite);
  const favoriteTags = sortTagsByFavoriteOrder(
    tags.filter((tag) => settings.favoriteTagIds.includes(tag.id)),
    settings.favoriteTagIds,
  );
  const remainingTags = sortTagsByName(tags.filter((tag) => !settings.favoriteTagIds.includes(tag.id)));
  const mostRecentNote = filterNotes(notes, { mode: 'recent' })[0];
  const lastActivityValue = mostRecentNote
    ? formatRecentActivityTimestamp(getRecentTimestamp(mostRecentNote), locale, t)
    : t('profile.values.noActivity');
  const accountConnected = cloudSyncEnabled && Boolean(syncState?.connected);
  const accountEmail = accountConnected ? syncState?.email ?? user?.email ?? t('sync.notConnected') : '';
  const lastLoginAt = syncState?.lastLoginAt ?? user?.lastLoginAt;
  const lastLoginValue = lastLoginAt
    ? formatRecentActivityTimestamp(lastLoginAt, locale, t)
    : t('sync.notConnected');
  const activeSessionCount = getActiveSessionCount(sessions);
  const sessionCountValue = t("profile.security.deviceCount", {
    count: activeSessionCount,
  });
  const currentDeviceId = syncState?.deviceId;
  const syncStatusDetail = getSyncStatusDetail({
    connected: accountConnected,
    isConnecting,
    isSyncing,
    pendingCount,
    conflictCount,
    lastSyncAt: syncState?.lastSyncAt,
    lastError: syncState?.lastError,
    locale,
    t,
  });

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

  async function handleConnectGoogle() {
    try {
      await connectGoogle();
      pushToast(t('sync.connected'), 'success');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t('sync.failed'), 'warning');
    }
  }

  async function handleClearCloudData() {
    try {
      await clearCloudData();
      setClearCloudConfirmOpen(false);
      pushToast(t("sync.cloudDataCleared"), "warning");
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : t("sync.failed"),
        "warning",
      );
    }
  }

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
              <button
                className="icon-button profile-edit"
                type="button"
                aria-label={t("common.more")}
                onClick={() =>
                  pushToast(t("profile.actions.avatarUpdated"), "info")
                }
              >
                <Edit3 />
              </button>
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

          <Panel title={t("profile.statistics")}>
            <div className="meta-list">
              <Metric
                icon={CalendarClock}
                color="blue"
                label={t("profile.stats.lastActivity")}
                value={lastActivityValue}
              />
              <Metric
                icon={FileText}
                color="purple"
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

        <section className="profile-center">
          <section className="settings-card">
            <h2 className="settings-title">
              <Settings2 className="settings-title__icon" />
              {t("profile.preferences.title")}
            </h2>
            <PreferenceSelect
              icon={<IconBadge icon={CalendarClock} color="purple" />}
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
            <PreferenceSelect
              icon={<IconBadge icon={Grid2X2} color="amber" />}
              label={t("profile.preferences.layout")}
              description={t("profile.preferences.layoutDescription")}
              value={settings.preferredLayout}
              onChange={(value) =>
                void setPreferredLayout(value as PreferredLayout).then(() =>
                  pushToast(t("common.done"), "success"),
                )
              }
              options={[
                { value: "list", label: t("profile.preferences.list") },
                { value: "grid", label: t("profile.preferences.grid") },
              ]}
            />
            <PreferenceSelect
              icon={<IconBadge icon={FileText} color="blue" />}
              label={t("profile.preferences.startup")}
              description={t("profile.preferences.startupDescription")}
              value={settings.startupPage}
              onChange={(value) =>
                void setStartupPage(value).then(() =>
                  pushToast(t("common.done"), "success"),
                )
              }
              options={[
                { value: "/", label: t("navigation.home") },
                {
                  value: "/notes",
                  label: t("profile.preferences.latestNotes"),
                },
              ]}
            />
          </section>

          <section className="settings-card">
            <h2 className="settings-title">
              <Folder className="settings-title__icon settings-title__icon--blue" />
              {t("profile.organization.title")}
            </h2>
            <div className="settings-row">
              <IconBadge icon={Star} color="purple" />
              <div>
                <div className="settings-label">
                  {t("profile.organization.favoriteTags")}
                </div>
                <div className="settings-description">
                  {t("profile.organization.favoriteTagsDescription")}
                </div>
                <div className="chip-stack chip-stack--spaced">
                  {favoriteTags.map((tag) => (
                    <TagChip
                      key={tag.id}
                      tag={tag}
                      href={`/notes?tag=${tag.id}`}
                      removable
                      onRemove={() => {
                        void toggleFavoriteTag(tag.id).then(() =>
                          pushToast(t("profile.actions.tagUpdated"), "success"),
                        );
                      }}
                    />
                  ))}
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t("common.add")}
                    onClick={() => setTagPickerOpen((value) => !value)}
                  >
                    <Plus />
                  </button>
                </div>
                {tagPickerOpen ? (
                  <div className="inline-picker">
                    {remainingTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          void toggleFavoriteTag(tag.id).then(() =>
                            pushToast(
                              t("profile.actions.tagUpdated"),
                              "success",
                            ),
                          );
                          setTagPickerOpen(false);
                        }}
                      >
                        <TagChip tag={tag} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="settings-row">
              <IconBadge icon={Folder} color="green" />
              <div>
                <div className="settings-label">
                  {t("profile.organization.primaryCollection")}
                </div>
                <div className="settings-description">
                  {t("profile.organization.primaryCollectionDescription")}
                </div>
              </div>
              <select
                className="select-control"
                value={settings.primaryCollectionId}
                onChange={(event) => {
                  void setPrimaryCollection(event.target.value).then(() =>
                    pushToast(
                      t("profile.actions.primaryCollectionUpdated"),
                      "success",
                    ),
                  );
                }}
              >
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </div>
          </section>
        </section>

        <section className="profile-right">
          <Panel title={t("profile.dataManagement.title")}>
            <DatabasePathRow
              databasePath={databaseInfo?.databasePath ?? t("profile.dataManagement.databasePathLoading")}
              label={t("profile.dataManagement.databasePath")}
              onOpen={handleOpenDatabaseFolder}
              openLabel={t("profile.dataManagement.openDatabaseFolder")}
            />
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
      <select className="select-control" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DatabasePathRow({
  databasePath,
  label,
  onOpen,
  openLabel,
}: {
  databasePath: string;
  label: string;
  onOpen: () => void;
  openLabel: string;
}) {
  return (
    <div className="database-path-row">
      <Database className="database-path-row__icon" />
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

function SecurityRow({
  icon: Icon,
  label,
  detail,
  danger = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <Icon />
      <span>
        <span>{label}</span>
        <span className="security-sub">{detail}</span>
      </span>
      {onClick ? <ChevronRight /> : null}
    </>
  );

  if (!onClick) {
    return (
      <div className={danger ? "security-row danger" : "security-row"}>
        {content}
      </div>
    );
  }

  return (
    <button
      className={danger ? "security-row danger" : "security-row"}
      type="button"
      onClick={onClick}
    >
      {content}
    </button>
  );
}

function SyncDevicesPanel({
  currentDeviceId,
  locale,
  onRemove,
  sessions,
  t,
}: {
  currentDeviceId?: string;
  locale: Locale;
  onRemove: (deviceId: string) => void;
  sessions: DeviceSession[];
  t: ReturnType<typeof useI18n>["t"];
}) {
  const activeSessions = [...sessions]
    .filter((session) => isActiveSession(session.lastSeenAt))
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

  return (
    <div className="sync-devices-panel">
      <p>{t("sync.devicesDescription")}</p>
      <div className="sync-device-list">
        {activeSessions.length ? (
          activeSessions.map((session) => {
            const isCurrent = session.id === currentDeviceId;
            return (
              <div className="sync-device-row" key={session.id}>
                <Computer />
                <span>
                  <span className="settings-label">
                    {session.name}
                    {isCurrent ? (
                      <span className="sync-device-badge">
                        {t("sync.currentDevice")}
                      </span>
                    ) : null}
                  </span>
                  <span className="security-sub">
                    {t("sync.lastSeen", {
                      date: formatRecentActivityTimestamp(
                        session.lastSeenAt,
                        locale,
                        t,
                      ),
                    })}
                  </span>
                  {session.userAgent ? (
                    <span className="security-sub">
                      {formatUserAgent(session.userAgent)}
                    </span>
                  ) : null}
                </span>
                {!isCurrent ? (
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t("sync.removeDevice")}
                    onClick={() => onRemove(session.id)}
                  >
                    <Trash2 />
                  </button>
                ) : null}
              </div>
            );
          })
        ) : (
          <span className="security-sub">{t("sync.noDevices")}</span>
        )}
      </div>
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

function getActiveSessionCount(sessions: Array<{ lastSeenAt: string }>) {
  return sessions.filter((session) => isActiveSession(session.lastSeenAt))
    .length;
}

function isActiveSession(lastSeenAt: string) {
  const activeAfter = Date.now() - 1000 * 60 * 60 * 24 * 30;
  const time = new Date(lastSeenAt).getTime();
  return Number.isFinite(time) && time >= activeAfter;
}

function formatUserAgent(userAgent: string) {
  const browser = userAgent.includes("Edg/")
    ? "Edge"
    : userAgent.includes("Chrome/")
      ? "Chrome"
      : userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Browser";
  const os = userAgent.includes("Windows")
    ? "Windows"
    : userAgent.includes("Mac OS X")
      ? "macOS"
      : userAgent.includes("Linux")
        ? "Linux"
        : userAgent.includes("Android")
          ? "Android"
          : userAgent.includes("iPhone") || userAgent.includes("iPad")
            ? "iOS"
            : "";

  return os ? `${browser} on ${os}` : browser;
}

function getSyncStatusDetail({
  connected,
  isConnecting,
  isSyncing,
  pendingCount,
  conflictCount,
  lastSyncAt,
  lastError,
  locale,
  t,
}: {
  connected: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncAt?: string;
  lastError?: string;
  locale: string;
  t: ReturnType<typeof useI18n>['t'];
}) {
  if (lastError) {
    return lastError;
  }

  if (isConnecting) {
    return t('sync.connecting');
  }

  if (!connected) {
    return t('sync.localOnly');
  }

  if (isSyncing) {
    return t('sync.syncing');
  }

  if (conflictCount) {
    return t('sync.conflictCount', { count: conflictCount });
  }

  if (pendingCount) {
    return t('sync.pendingCount', { count: pendingCount });
  }

  if (lastSyncAt) {
    return t('sync.lastSynced', { date: formatRecentActivityTimestamp(lastSyncAt, locale, t) });
  }

  return t('sync.connected');
}

