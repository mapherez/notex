import { Cloud, CloudUpload, LogIn } from 'lucide-react';
import { cloudStatusLabel } from '../../core/cloud/transferStatus';
import { useI18n } from '../../i18n/I18nProvider';
import { useCloudStore } from '../../store/useCloudStore';
import { useGoogleAccountStore } from '../../store/useGoogleAccountStore';

export function GoogleDriveStatus() {
  const { t } = useI18n();
  const state = useCloudStore();
  const showLogin = useGoogleAccountStore((state) => state.showLogin);
  if (!state.accountId) return null;
  const busy = ['checking', 'uploading', 'downloading'].includes(state.phase);
  const requiresAuthorization = state.error === 'GOOGLE_REAUTHORIZE';
  const ActionIcon = requiresAuthorization ? LogIn : CloudUpload;
  return (
    <div className="profile-drive-status">
      <div className="profile-drive-status__label" role="status">
        <Cloud aria-hidden="true" />
        <span>{cloudStatusLabel(state, t)}</span>
      </div>
      <button className="profile-backup-button" type="button" disabled={busy && !requiresAuthorization}
        onClick={() => requiresAuthorization ? showLogin() : void state.backupNow()}>
        <ActionIcon aria-hidden="true" />
        <span>{t(requiresAuthorization ? 'cloud.reauthorize' : 'cloud.backupNow')}</span>
      </button>
    </div>
  );
}
