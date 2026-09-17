import type { TransferState } from './transferEngine';

type Translate = (key: string, values?: Record<string, string | number>) => string;

export function cloudStatusLabel(state: TransferState, t: Translate): string {
  return state.error ? t(state.error === 'CLOUD_OFFLINE' ? 'cloud.offline' : state.error === 'GOOGLE_REAUTHORIZE' ? 'google.errors.GOOGLE_REAUTHORIZE' : 'cloud.error')
    : state.phase !== 'idle' ? t(`cloud.${state.phase}`, { done: state.completed, total: state.total })
    : state.conflicts.length ? t('cloud.conflicts', { count: state.conflicts.length })
    : state.pending ? t('cloud.pending', { count: state.pending })
    : state.downloads ? t(state.paused ? 'cloud.paused' : 'cloud.remaining', { count: state.downloads })
    : !state.catalog ? t('cloud.checking') : t('cloud.idle');
}

export function hasCloudWork(state: TransferState): boolean {
  return state.phase === 'uploading' || state.phase === 'downloading' || state.pending > 0 || state.downloads > 0;
}
