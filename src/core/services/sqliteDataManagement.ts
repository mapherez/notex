import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

export type SqliteDatabaseInfo = {
  initialized: boolean;
  databasePath: string;
  filesDirectory: string;
  localDataDirectory: string;
  backupDirectory: string;
  tempDirectory: string;
};

export type SqliteExportInfo = {
  tempPath: string;
  fileName: string;
  createdAt: string;
};

const sqliteFilters = [
  {
    name: 'SQLite database',
    extensions: ['sqlite', 'sqlite3', 'db'],
  },
];

export function readSqliteDatabaseInfo() {
  return invoke<SqliteDatabaseInfo>('notex_sqlite_status');
}

export function createSqliteTempExport() {
  return invoke<SqliteExportInfo>('notex_sqlite_create_temp_export');
}

export async function chooseSqliteExportDestination(exportInfo: SqliteExportInfo) {
  const destinationPath = await save({
    defaultPath: exportInfo.fileName,
    filters: sqliteFilters,
  });

  if (!destinationPath) {
    return null;
  }

  return invoke<string>('notex_sqlite_copy_export_to', {
    tempPath: exportInfo.tempPath,
    destinationPath,
  });
}

export async function chooseSqliteImportFile() {
  const selected = await open({
    multiple: false,
    filters: sqliteFilters,
  });

  return typeof selected === 'string' ? selected : null;
}

export function replaceSqliteDatabaseFromFile(sourcePath: string) {
  return invoke<void>('notex_sqlite_replace_database_from_file', { sourcePath });
}

export function openSqliteDatabaseFolder() {
  return invoke<void>('notex_sqlite_open_database_folder');
}

export function openSqliteLocalDataFolder() {
  return invoke<void>('notex_sqlite_open_local_data_folder');
}

export function openSqliteFilesFolder() {
  return invoke<void>('notex_sqlite_open_files_folder');
}
