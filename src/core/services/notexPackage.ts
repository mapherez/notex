import { desktopInvoke as invoke } from '../storage/desktopInvoke';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { SqliteExportInfo } from './sqliteDataManagement';

const packageFilters = [
  {
    name: 'NoteX package',
    extensions: ['notex'],
  },
];

export function createNotexPackageTempExport() {
  return invoke<SqliteExportInfo>('notex_package_create_temp_export');
}

export async function chooseNotexPackageExportDestination(exportInfo: SqliteExportInfo) {
  const destinationPath = await save({
    defaultPath: exportInfo.fileName,
    filters: packageFilters,
  });

  if (!destinationPath) {
    return null;
  }

  return invoke<string>('notex_package_copy_export_to', {
    tempPath: exportInfo.tempPath,
    destinationPath,
  });
}

export async function chooseNotexPackageImportFile() {
  const selected = await open({
    multiple: false,
    filters: packageFilters,
  });

  return typeof selected === 'string' ? selected : null;
}

export async function replaceFromNotexPackage(sourcePath: string) {
  const { replaceDesktopLibrary } = await import('./replaceDesktopLibrary');
  await replaceDesktopLibrary('notex_package_replace_from_file', sourcePath);
}
