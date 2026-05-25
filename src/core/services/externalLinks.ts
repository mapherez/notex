import { invoke, isTauri } from '@tauri-apps/api/core';

export async function openExternalUrl(url: string) {
  if (!isTauri()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  await invoke<void>('notex_open_external_url', { url });
}
