import { ChevronDown, ChevronUp, Cloud } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cloudStatusLabel, hasCloudWork } from '../../core/cloud/transferStatus';
import { richTextToPlainText } from '../../core/utils/richText';
import { useI18n } from '../../i18n/I18nProvider';
import { useCloudStore } from '../../store/useCloudStore';
import { useGoogleAccountStore } from '../../store/useGoogleAccountStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { useToastStore } from '../../store/useToastStore';

export function CloudTransferBanner() {
  const { t } = useI18n();
  const state = useCloudStore();
  const showLogin = useGoogleAccountStore((state) => state.showLogin);
  const collections = useKnowledgeStore((state) => state.collections);
  const tags = useKnowledgeStore((state) => state.tags);
  const pushToast = useToastStore((state) => state.pushToast);
  const observed = useRef({ accountId: state.accountId, hadWork: false });
  const work = hasCloudWork(state);
  const settled = state.phase === 'idle' && Boolean(state.catalog) && !work && !state.error && !state.conflicts.length;
  useEffect(() => {
    if (observed.current.accountId !== state.accountId) observed.current = { accountId: state.accountId, hadWork: false };
    if (!state.accountId) return;
    if (work) observed.current.hadWork = true;
    if (settled && observed.current.hadWork) {
      observed.current.hadWork = false;
      pushToast(t('cloud.idle'), 'success');
      const current = useCloudStore.getState();
      if (current.expanded) current.toggleExpanded();
    }
  }, [state.accountId, work, settled, pushToast, t]);
  // Background catalog polling must not flash a banner every minute.
  if (!state.accountId || (!work && !state.error && !state.conflicts.length && !(state.phase === 'checking' && !state.catalog))) return null;
  const busy = ['checking', 'uploading', 'downloading'].includes(state.phase);
  const requiresAuthorization = state.error === 'GOOGLE_REAUTHORIZE';
  const label = cloudStatusLabel(state, t);
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
      {!requiresAuthorization && (state.pending > 0 || state.phase === 'uploading') && <p>{t('cloud.keepOpen')}</p>}
      {!requiresAuthorization && state.currentTitle && <p className="cloud-transfer-banner__title">{richTextToPlainText(state.currentTitle)}</p>}
      {!requiresAuthorization && busy && state.total > 0 && <progress className="app-update-progress-bar" max={state.total} value={state.completed} />}
      <div className="cloud-transfer-banner__actions">
        {!requiresAuthorization && <button type="button" className="secondary-button" disabled={busy} onClick={() => void state.backupNow()}>{t('cloud.backupNow')}</button>}
        {!requiresAuthorization && state.downloads > 0 && <button type="button" className="secondary-button" onClick={() => state.pause(!state.paused)}>{t(state.paused ? 'cloud.resume' : 'cloud.pause')}</button>}
        {requiresAuthorization && <button type="button" className="secondary-button" onClick={showLogin}>{t('cloud.reauthorize')}</button>}
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
        <p>{t('cloud.conflict', { title: richTextToPlainText(conflict.title) })}</p>
        <div className="cloud-transfer-banner__actions">
          <button type="button" className="secondary-button" onClick={() => state.resolve(conflict.id, 'local')}>{t('cloud.keepLocal')}</button>
          <button type="button" className="secondary-button" onClick={() => state.resolve(conflict.id, 'remote')}>{t('cloud.keepRemote')}</button>
        </div>
      </div>)}
    </div>}
  </aside>;
}
