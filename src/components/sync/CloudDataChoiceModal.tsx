import { Cloud, HardDrive, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useSyncStore } from '../../store/useSyncStore';
import { useToastStore } from '../../store/useToastStore';

export function CloudDataChoiceModal() {
  const { t } = useI18n();
  const cloudChoice = useSyncStore((state) => state.cloudChoice);
  const isResolvingCloudChoice = useSyncStore((state) => state.isResolvingCloudChoice);
  const resolveCloudChoice = useSyncStore((state) => state.resolveCloudChoice);
  const pushToast = useToastStore((state) => state.pushToast);

  if (!cloudChoice) {
    return null;
  }

  function chooseData(choice: 'local' | 'cloud') {
    void resolveCloudChoice(choice)
      .then(() => pushToast(choice === 'cloud' ? t('sync.cloudDataLoaded') : t('sync.localDataUploaded'), 'success'))
      .catch((error) => pushToast(error instanceof Error ? error.message : t('sync.failed'), 'warning'));
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="choice-modal" role="dialog" aria-modal="true" aria-labelledby="cloud-data-choice-title">
        <h2 id="cloud-data-choice-title">{t('sync.cloudChoiceTitle')}</h2>
        <p>{t('sync.cloudChoiceDescription', { email: cloudChoice.email })}</p>
        {isResolvingCloudChoice ? (
          <div className="choice-modal-status" role="status" aria-live="polite">
            <Loader2 size={18} />
            <span>{t('sync.resolvingCloudChoice')}</span>
          </div>
        ) : null}
        <div className="choice-modal-actions">
          <button type="button" onClick={() => chooseData('local')} disabled={isResolvingCloudChoice}>
            <HardDrive size={20} />
            <span>
              <span>{t('sync.useLocalData')}</span>
              <span>{t('sync.useLocalDataDescription')}</span>
            </span>
          </button>
          <button type="button" onClick={() => chooseData('cloud')} disabled={isResolvingCloudChoice}>
            <Cloud size={20} />
            <span>
              <span>{t('sync.useCloudData')}</span>
              <span>{t('sync.useCloudDataDescription')}</span>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
