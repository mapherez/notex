import {
  CalendarClock,
  ChevronRight,
  Cloud,
  Computer,
  Download,
  Edit3,
  FileText,
  Folder,
  Globe2,
  Grid2X2,
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
import { useRef, useState } from 'react';
import { IconBadge } from '../components/ui/IconBadge';
import { Panel } from '../components/ui/Panel';
import { TagChip } from '../components/ui/TagChip';
import { createExportFile, readImportFile } from '../core/services/exportImport';
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

export function ProfilePage() {
  const { locale, t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [syncDevicesOpen, setSyncDevicesOpen] = useState(false);
  const [clearCloudConfirmOpen, setClearCloudConfirmOpen] = useState(false);
  const settings = useAppStore((state) => state.settings);
  const setTheme = useAppStore((state) => state.setTheme);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setPreferredLayout = useAppStore((state) => state.setPreferredLayout);
  const setStartupPage = useAppStore((state) => state.setStartupPage);
  const setPrimaryCollection = useAppStore((state) => state.setPrimaryCollection);
  const toggleFavoriteTag = useAppStore((state) => state.toggleFavoriteTag);
  const replaceSettings = useAppStore((state) => state.replaceSettings);
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const user = useKnowledgeStore((state) => state.user);
  const exportPayload = useKnowledgeStore((state) => state.exportPayload);
  const importPayload = useKnowledgeStore((state) => state.importPayload);
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
  const accountConnected = Boolean(syncState?.connected);
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
                  : "profile-avatar profile-avatar-placeholder"
              }
            >
              {accountConnected && user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <UserRound size={56} strokeWidth={1.6} />
              )}
              <button
                className="icon-button profile-edit"
                type="button"
                aria-label={t("common.more")}
                onClick={() =>
                  pushToast(t("profile.actions.avatarUpdated"), "info")
                }
              >
                <Edit3 size={16} />
              </button>
            </div>
            <h2 className="panel-title">{accountConnected ? user?.name : t("profile.localUser")}</h2>
            {accountConnected && user?.handle ? <div className="handle">{user.handle}</div> : null}
            <div className="connected">
              {accountConnected ? (
                <>
                  <span className="logo-mark h-5 w-5 text-xs">G</span>
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
              <Settings2 size={20} color="var(--color-accent-strong)" />
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
              options={[
                { value: "dark", label: t("profile.preferences.dark") },
                { value: "light", label: t("profile.preferences.light") },
              ]}
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
              <Folder size={20} color="var(--color-blue)" />
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
                <div className="chip-stack mt-3">
                  {favoriteTags.map((tag) => (
                    <TagChip
                      key={tag.id}
                      tag={tag}
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
                    <Plus size={18} />
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
          <Panel title={t("profile.security.title")}>
            <SecurityRow
              icon={RefreshCw}
              label={isSyncing ? t("sync.syncing") : t("sync.syncStatus")}
              detail={syncStatusDetail}
            />
            {accountConnected ? (
              <SecurityRow
                icon={Mail}
                label={t("profile.security.email")}
                detail={accountEmail}
              />
            ) : null}
            <SecurityRow
              icon={CalendarClock}
              label={t("profile.security.lastLogin")}
              detail={lastLoginValue}
            />
            {accountConnected ? (
              <SecurityRow
                icon={Computer}
                label={t("profile.security.syncDevices")}
                detail={sessionCountValue}
                onClick={() => setSyncDevicesOpen((value) => !value)}
              />
            ) : null}
            {accountConnected && syncDevicesOpen ? (
              <SyncDevicesPanel
                currentDeviceId={currentDeviceId}
                locale={locale}
                onRemove={(deviceId) => {
                  void removeDeviceSession(deviceId).then(() =>
                    pushToast(t("sync.deviceRemoved"), "warning"),
                  );
                }}
                sessions={sessions}
                t={t}
              />
            ) : null}
            {accountConnected ? null : (
              <SecurityRow
                icon={Cloud}
                label={isConnecting ? t("sync.connecting") : t("sync.connect")}
                detail={t("sync.connectDescription")}
                onClick={handleConnectGoogle}
              />
            )}
            <button
              className="security-row"
              type="button"
              onClick={() => createExportFile(exportPayload(settings))}
            >
              <Download size={20} color="var(--color-success)" />
              <span>
                <span>{t("profile.security.exportData")}</span>
                <span className="security-sub">{t("common.export")}</span>
              </span>
              <ChevronRight size={18} />
            </button>
            <button
              className="security-row"
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={20} color="var(--color-blue)" />
              <span>
                <span>{t("profile.security.importData")}</span>
                <span className="security-sub">{t("common.import")}</span>
              </span>
              <ChevronRight size={18} />
            </button>
            <input
              ref={inputRef}
              hidden
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) {
                  return;
                }
                void readImportFile(file).then(async (payload) => {
                  const importedSettings = await importPayload(payload);
                  await replaceSettings(importedSettings);
                });
              }}
            />
            {accountConnected ? (
              <>
                <button
                  className="security-row danger"
                  type="button"
                  onClick={() => setClearCloudConfirmOpen(true)}
                >
                  <Trash2 size={20} />
                  <span>
                    <span>{t("sync.clearCloudData")}</span>
                    <span className="security-sub">
                      {t("sync.clearCloudDataDescription")}
                    </span>
                  </span>
                  <ChevronRight size={18} />
                </button>
                {clearCloudConfirmOpen ? (
                  <div className="confirm-box">
                    <span>{t("sync.clearCloudDataConfirm")}</span>
                    <div>
                      <button
                        type="button"
                        onClick={() => setClearCloudConfirmOpen(false)}
                      >
                        {t("common.cancel")}
                      </button>
                      <button type="button" onClick={handleClearCloudData}>
                        {t("common.clear")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </Panel>
        </section>
      </div>
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
      <Icon size={20} />
      <span>
        <span>{label}</span>
        <span className="security-sub">{detail}</span>
      </span>
      {onClick ? <ChevronRight size={18} /> : null}
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
                <Computer size={18} />
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
                    <Trash2 size={16} />
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
