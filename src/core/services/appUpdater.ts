import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';

export type AppUpdateInfo = {
  currentVersion: string;
  date?: string;
  update: Update;
  version: string;
};

export type UpdateInstallProgress = {
  downloadedBytes: number;
  percent: number | null;
  totalBytes: number | null;
};

export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  if (!isTauri()) {
    return null;
  }

  const update = await check();
  if (!update) {
    return null;
  }

  return {
    currentVersion: update.currentVersion || (await getCurrentAppVersion()),
    date: update.date,
    update,
    version: update.version,
  };
}

export async function installAppUpdate(
  update: Update,
  onProgress?: (progress: UpdateInstallProgress) => void,
) {
  let downloadedBytes = 0;
  let totalBytes: number | null = null;

  await update.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === 'Started') {
      downloadedBytes = 0;
      totalBytes = event.data.contentLength ?? null;
    }

    if (event.event === 'Progress') {
      downloadedBytes += event.data.chunkLength;
    }

    if (event.event === 'Finished' && totalBytes !== null) {
      downloadedBytes = totalBytes;
    }

    onProgress?.({
      downloadedBytes,
      percent: totalBytes && totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : null,
      totalBytes,
    });
  });

  await relaunch();
}

export async function closeAppUpdate(update: Update) {
  await update.close();
}

async function getCurrentAppVersion() {
  try {
    return await getVersion();
  } catch {
    return '';
  }
}
