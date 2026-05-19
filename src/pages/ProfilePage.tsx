import {
  CalendarClock,
  ChevronRight,
  Crown,
  Download,
  Edit3,
  FileText,
  Folder,
  Globe2,
  Grid2X2,
  HardDrive,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Settings2,
  Shield,
  Star,
  Tag as TagIcon,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconBadge } from '../components/ui/IconBadge';
import { LabelManager } from '../components/ui/LabelManager';
import { NoteThumbnail } from '../components/ui/NoteThumbnail';
import { Panel } from '../components/ui/Panel';
import { TagChip } from '../components/ui/TagChip';
import { appSettings } from '../config/appSettings';
import { createExportFile, readImportFile } from '../core/services/exportImport';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';
import type { Locale, PreferredLayout, ThemePreference } from '../core/models/models';

export function ProfilePage() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const settings = useAppStore((state) => state.settings);
  const setTheme = useAppStore((state) => state.setTheme);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setPreferredLayout = useAppStore((state) => state.setPreferredLayout);
  const setStartupPage = useAppStore((state) => state.setStartupPage);
  const setPrimaryCollection = useAppStore((state) => state.setPrimaryCollection);
  const toggleFavoriteTag = useAppStore((state) => state.toggleFavoriteTag);
  const toggleQuickPin = useAppStore((state) => state.toggleQuickPin);
  const replaceSettings = useAppStore((state) => state.replaceSettings);
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const user = useKnowledgeStore((state) => state.user);
  const exportPayload = useKnowledgeStore((state) => state.exportPayload);
  const importPayload = useKnowledgeStore((state) => state.importPayload);
  const resetDemoData = useKnowledgeStore((state) => state.resetDemoData);
  const createTag = useKnowledgeStore((state) => state.createTag);
  const updateTag = useKnowledgeStore((state) => state.updateTag);
  const deleteTag = useKnowledgeStore((state) => state.deleteTag);
  const pushToast = useToastStore((state) => state.pushToast);
  const activeNotes = notes.filter((note) => !note.isTrashed);
  const favoriteNotes = activeNotes.filter((note) => note.isFavorite);
  const favoriteTags = tags.filter((tag) => settings.favoriteTagIds.includes(tag.id));
  const remainingTags = tags.filter((tag) => !settings.favoriteTagIds.includes(tag.id));
  const quickPins = activeNotes.filter((note) => settings.quickPinNoteIds.includes(note.id));
  const remainingPins = activeNotes.filter((note) => !settings.quickPinNoteIds.includes(note.id)).slice(0, 6);

  return (
    <div className="page-content list-page-grid">
      <header>
        <h1 className="page-title">{t('profile.title')}</h1>
        <p className="page-subtitle">{t('profile.subtitle')}</p>
      </header>

      <div className="profile-layout">
        <section className="profile-left">
          <article className="profile-card">
            <div className="profile-avatar">
              <img src="/assets/avatar-ricardo.svg" alt="" />
              <button
                className="icon-button profile-edit"
                type="button"
                aria-label={t('common.more')}
                onClick={() => pushToast(t('profile.actions.avatarUpdated'), 'info')}
              >
                <Edit3 size={16} />
              </button>
            </div>
            <h2 className="panel-title">{user?.name}</h2>
            <div className="handle">{user?.handle}</div>
            <div className="connected">
              <span className="logo-mark h-5 w-5 text-xs">G</span>
              {t('profile.connectedWith')}
            </div>
          </article>

          <Panel title={t('profile.statistics')}>
            <div className="meta-list">
              <Metric icon={FileText} color="purple" label={t('profile.stats.notes')} value={String(activeNotes.length)} />
              <Metric icon={Folder} color="green" label={t('profile.stats.collections')} value={String(collections.length)} />
              <Metric icon={Star} color="amber" label={t('profile.stats.favorites')} value={String(favoriteNotes.length)} />
              <Metric icon={CalendarClock} color="blue" label={t('profile.stats.lastActivity')} value={t('profile.values.lastActivity')} />
              <Metric icon={UserCheck} color="pink" label={t('profile.stats.streak')} value={t('profile.values.streak')} />
              <Metric
                icon={HardDrive}
                color="blue"
                label={t('profile.stats.storage')}
                value={`${appSettings.storage.usedGb} GB ${t('navigation.storageLimit')} (${t('navigation.storagePercent')})`}
              />
            </div>
          </Panel>
        </section>

        <section className="profile-center">
          <section className="settings-card">
            <h2 className="settings-title">
              <Settings2 size={20} color="var(--color-accent-strong)" />
              {t('profile.preferences.title')}
            </h2>
            <PreferenceSelect
              icon={<IconBadge icon={CalendarClock} color="purple" />}
              label={t('profile.preferences.theme')}
              description={t('profile.preferences.themeDescription')}
              value={settings.theme}
              onChange={(value) => void setTheme(value as ThemePreference).then(() => pushToast(t('common.done'), 'success'))}
              options={[
                { value: 'dark', label: t('profile.preferences.dark') },
                { value: 'light', label: t('profile.preferences.light') },
              ]}
            />
            <PreferenceSelect
              icon={<IconBadge icon={Globe2} color="green" />}
              label={t('profile.preferences.language')}
              description={t('profile.preferences.languageDescription')}
              value={settings.language}
              onChange={(value) => void setLanguage(value as Locale).then(() => pushToast(t('common.done'), 'success'))}
              options={[
                { value: 'pt', label: t('profile.preferences.portuguese') },
                { value: 'en', label: t('profile.preferences.english') },
              ]}
            />
            <PreferenceSelect
              icon={<IconBadge icon={Grid2X2} color="amber" />}
              label={t('profile.preferences.layout')}
              description={t('profile.preferences.layoutDescription')}
              value={settings.preferredLayout}
              onChange={(value) => void setPreferredLayout(value as PreferredLayout).then(() => pushToast(t('common.done'), 'success'))}
              options={[
                { value: 'list', label: t('profile.preferences.list') },
                { value: 'grid', label: t('profile.preferences.grid') },
              ]}
            />
            <PreferenceSelect
              icon={<IconBadge icon={FileText} color="blue" />}
              label={t('profile.preferences.startup')}
              description={t('profile.preferences.startupDescription')}
              value={settings.startupPage}
              onChange={(value) => void setStartupPage(value).then(() => pushToast(t('common.done'), 'success'))}
              options={[
                { value: '/', label: t('navigation.home') },
                { value: '/notes', label: t('profile.preferences.latestNotes') },
              ]}
            />
          </section>

          <section className="settings-card">
            <h2 className="settings-title">
              <Folder size={20} color="var(--color-blue)" />
              {t('profile.organization.title')}
            </h2>
            <div className="settings-row">
              <IconBadge icon={Star} color="purple" />
              <div>
                <div className="settings-label">{t('profile.organization.favoriteTags')}</div>
                <div className="settings-description">{t('profile.organization.favoriteTagsDescription')}</div>
                <div className="chip-stack mt-3">
                  {favoriteTags.map((tag) => (
                    <TagChip
                      key={tag.id}
                      tag={tag}
                      removable
                      onRemove={() => {
                        void toggleFavoriteTag(tag.id).then(() => pushToast(t('profile.actions.tagUpdated'), 'success'));
                      }}
                    />
                  ))}
                  <button className="icon-button" type="button" aria-label={t('common.add')} onClick={() => setTagPickerOpen((value) => !value)}>
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
                          void toggleFavoriteTag(tag.id).then(() => pushToast(t('profile.actions.tagUpdated'), 'success'));
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
                <div className="settings-label">{t('profile.organization.primaryCollection')}</div>
                <div className="settings-description">{t('profile.organization.primaryCollectionDescription')}</div>
              </div>
              <select
                className="select-control"
                value={settings.primaryCollectionId}
                onChange={(event) => {
                  void setPrimaryCollection(event.target.value).then(() => pushToast(t('profile.actions.primaryCollectionUpdated'), 'success'));
                }}
              >
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-row">
              <IconBadge icon={Star} color="orange" />
              <div>
                <div className="settings-label">{t('profile.organization.quickPins')}</div>
                <div className="settings-description">{t('profile.organization.quickPinsDescription')}</div>
                <div className="quick-pins mt-3">
                  {quickPins.map((note) => (
                    <span className="mini-note-shell" key={note.id}>
                      <Link className="mini-note" to={`/notes/${note.id}`}>
                        <NoteThumbnail thumbnail={note.thumbnail} />
                        <span>{note.title}</span>
                      </Link>
                      <button
                        className="mini-remove"
                        type="button"
                        aria-label={t('common.remove')}
                        onClick={() => {
                          void toggleQuickPin(note.id).then(() => pushToast(t('profile.actions.pinUpdated'), 'success'));
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button className="icon-button" type="button" aria-label={t('common.add')} onClick={() => setPinPickerOpen((value) => !value)}>
                    <Plus size={18} />
                  </button>
                </div>
                {pinPickerOpen ? (
                  <div className="inline-picker">
                    {remainingPins.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => {
                          void toggleQuickPin(note.id).then(() => pushToast(t('profile.actions.pinUpdated'), 'success'));
                          setPinPickerOpen(false);
                        }}
                      >
                        {note.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-title">
              <TagIcon size={20} color="var(--color-accent-strong)" />
              {t('profile.labels.title')}
            </h2>
            <p className="settings-description mb-4">{t('profile.labels.description')}</p>
            <LabelManager
              tags={tags}
              onCreate={async (name, color) => {
                const created = await createTag(name, color);
                if (created) {
                  pushToast(t('profile.labels.created'), 'success');
                }
              }}
              onUpdate={async (tagId, input) => {
                await updateTag(tagId, input);
                pushToast(t('profile.labels.updated'), 'success');
              }}
              onDelete={async (tagId) => {
                if (!window.confirm(t('profile.labels.deleteConfirm'))) {
                  return;
                }
                await deleteTag(tagId);
                pushToast(t('profile.labels.deleted'), 'warning');
              }}
            />
          </section>
        </section>

        <section className="profile-right">
          <Panel title={t('profile.security.title')}>
            <SecurityRow
              icon={UserCheck}
              label={t('profile.security.linkedAccount')}
              detail={t('profile.security.provider')}
              onClick={() => pushToast(t('profile.actions.accountPreview'), 'info')}
            />
            <SecurityRow
              icon={Mail}
              label={t('profile.security.email')}
              detail={user?.email ?? ''}
              onClick={() => {
                void navigator.clipboard?.writeText(user?.email ?? '');
                pushToast(t('common.copied'), 'success');
              }}
            />
            <SecurityRow
              icon={CalendarClock}
              label={t('profile.security.lastLogin')}
              detail={t('profile.security.lastLoginValue')}
              onClick={() => pushToast(t('topbar.localMode'), 'info')}
            />
            <SecurityRow
              icon={HardDrive}
              label={t('profile.security.activeSessions')}
              detail={t('profile.security.sessionCount')}
              onClick={() => pushToast(t('profile.actions.sessionsPreview'), 'info')}
            />
            <button className="security-row" type="button" onClick={() => createExportFile(exportPayload(settings))}>
              <Download size={20} color="var(--color-success)" />
              <span>
                <span>{t('profile.security.exportData')}</span>
                <span className="security-sub">{t('common.export')}</span>
              </span>
              <ChevronRight size={18} />
            </button>
            <button className="security-row" type="button" onClick={() => inputRef.current?.click()}>
              <Upload size={20} color="var(--color-blue)" />
              <span>
                <span>{t('profile.security.importData')}</span>
                <span className="security-sub">{t('common.import')}</span>
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
            <button
              className="security-row"
              type="button"
              onClick={() => {
                void resetDemoData(settings.language, settings).then(() => pushToast(t('profile.actions.demoReset'), 'success'));
              }}
            >
              <RefreshCw size={20} color="var(--color-warning)" />
              <span>
                <span>{t('profile.security.resetDemo')}</span>
                <span className="security-sub">{t('common.done')}</span>
              </span>
              <ChevronRight size={18} />
            </button>
            <SecurityRow
              icon={Trash2}
              label={t('profile.security.deleteAccount')}
              detail={t('profile.security.deleteWarning')}
              danger
              onClick={() => {
                setDeleteConfirmOpen(true);
                pushToast(t('profile.actions.deleteConfirm'), 'warning');
              }}
            />
            {deleteConfirmOpen ? (
              <div className="confirm-box">
                <span>{t('profile.security.deleteWarning')}</span>
                <div>
                  <button type="button" onClick={() => setDeleteConfirmOpen(false)}>
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      pushToast(t('profile.actions.deleteSkipped'), 'success');
                    }}
                  >
                    {t('common.done')}
                  </button>
                </div>
              </div>
            ) : null}
            <SecurityRow
              icon={LogOut}
              label={t('profile.security.logout')}
              detail={t('profile.security.logoutDescription')}
              onClick={() => pushToast(t('profile.actions.logout'), 'warning')}
            />
          </Panel>

          <Panel title={t('profile.plan.title')}>
            <div className="plan-card">
              <div className="plan-heading">
                <span className="plan-name">{t('profile.plan.name')}</span>
                <span className="plan-badge">{t('profile.plan.current')}</span>
              </div>
              <PlanRow icon={FileText} label={t('profile.plan.notes')} value={t('profile.plan.notesLimit')} />
              <PlanRow icon={HardDrive} label={t('profile.plan.storage')} value={t('profile.plan.storageLimit')} />
              <PlanRow icon={Folder} label={t('profile.plan.attachments')} value={t('profile.plan.attachmentLimit')} />
              <PlanRow icon={CalendarClock} label={t('profile.plan.history')} value={t('profile.plan.historyLimit')} />
              <button className="upgrade-button mt-4" type="button" onClick={() => pushToast(t('profile.actions.upgrade'), 'info')}>
                <Crown size={18} />
                {t('profile.plan.upgrade')}
              </button>
            </div>
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
  icon: typeof UserCheck;
  label: string;
  detail: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className={danger ? 'security-row danger' : 'security-row'} type="button" onClick={onClick}>
      <Icon size={20} />
      <span>
        <span>{label}</span>
        <span className="security-sub">{detail}</span>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}

function PlanRow({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="plan-row">
      <Icon size={17} />
      <span>{label}</span>
      <span className="plan-value">{value}</span>
    </div>
  );
}
