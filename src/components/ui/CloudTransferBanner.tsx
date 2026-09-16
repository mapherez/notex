import { ChevronDown, ChevronUp, Cloud } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useCloudStore } from '../../store/useCloudStore';
import { useGoogleAccountStore } from '../../store/useGoogleAccountStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';

export function CloudTransferBanner() {
  const { t } = useI18n();
  const state = useCloudStore();
  const showLogin = useGoogleAccountStore((state) => state.showLogin);
  const collections = useKnowledgeStore((state) => state.collections);
  const tags = useKnowledgeStore((state) => state.tags);
  if (!state.accountId) return null;
  const busy = ['checking', 'uploading', 'downloading'].includes(state.phase);
  const label = state.error ? t(state.error === 'CLOUD_OFFLINE' ? 'cloud.offline' : state.error === 'GOOGLE_REAUTHORIZE' ? 'google.errors.GOOGLE_REAUTHORIZE' : 'cloud.error')
    : state.phase !== 'idle' ? t(`cloud.${state.phase}`, { done: state.completed, total: state.total })
    : state.conflicts.length ? t('cloud.conflicts', { count: state.conflicts.length })
    : state.pending ? t('cloud.pending', { count: state.pending })
    : state.downloads ? t(state.paused ? 'cloud.paused' : 'cloud.remaining', { count: state.downloads }) : t('cloud.idle');
  const Chevron = state.expanded ? ChevronDown : ChevronUp;
  const prioritize = (value: string) => {
    const [kind, ...parts] = value.split(':'); const id = parts.join(':');
    const entries = Object.values(state.catalog?.notes ?? {}).filter((entry) => !entry.deleted);
    state.prioritize(entries.filter((entry) => kind === 'all' || (kind === 'collection' ? entry.metadata?.collectionId === id : entry.metadata?.tagIds.includes(id))).map((entry) => entry.id));
  };
  return <aside className="cloud-transfer-banner" aria-label="Google Drive">
    <div className="cloud-transfer-banner__summary">
      <Cloud aria-hidden="true" />
      <span role="status" aria-live="polite">{label}</span>
      <button type="button" className="icon-button" onClick={state.toggleExpanded} aria-expanded={state.expanded} aria-controls="cloud-transfer-details"
        aria-label={t(state.expanded ? 'cloud.collapse' : 'cloud.expand')}><Chevron /></button>
    </div>
    {state.expanded && <div id="cloud-transfer-details" className="cloud-transfer-banner__details">
      {(state.pending > 0 || state.phase === 'uploading') && <p>{t('cloud.keepOpen')}</p>}
      {state.currentTitle && <p className="cloud-transfer-banner__title">{state.currentTitle}</p>}
      {busy && state.total > 0 && <progress className="app-update-progress-bar" max={state.total} value={state.completed} />}
      <div className="cloud-transfer-banner__actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void state.backupNow()}>{t('cloud.backupNow')}</button>
        {state.downloads > 0 && <button type="button" className="secondary-button" onClick={() => state.pause(!state.paused)}>{t(state.paused ? 'cloud.resume' : 'cloud.pause')}</button>}
        {state.error === 'GOOGLE_REAUTHORIZE' && <button type="button" className="secondary-button" onClick={showLogin}>{t('cloud.reauthorize')}</button>}
      </div>
      {state.downloads > 0 && <>
        <p>{t('cloud.remaining', { count: state.downloads })}</p>
        <label>{t('cloud.priority')}<select defaultValue="" onChange={(event) => prioritize(event.target.value)}>
          <option value="" disabled>{t('cloud.priority')}</option><option value="all:">{t('cloud.all')}</option>
          <optgroup label={t('cloud.collection')}>{collections.map((item) => <option key={item.id} value={`collection:${item.id}`}>{item.name}</option>)}</optgroup>
          <optgroup label={t('cloud.tag')}>{tags.map((item) => <option key={item.id} value={`tag:${item.id}`}>{item.name}</option>)}</optgroup>
        </select></label>
        <p>{t('cloud.searchPartial')}</p>
      </>}
      {state.conflicts.map((conflict) => <div key={conflict.id}>
        <p>{t('cloud.conflict', { title: conflict.title })}</p>
        <div className="cloud-transfer-banner__actions">
          <button type="button" className="secondary-button" onClick={() => state.resolve(conflict.id, 'local')}>{t('cloud.keepLocal')}</button>
          <button type="button" className="secondary-button" onClick={() => state.resolve(conflict.id, 'remote')}>{t('cloud.keepRemote')}</button>
        </div>
      </div>)}
    </div>}
  </aside>;
}
