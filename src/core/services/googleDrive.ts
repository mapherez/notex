const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export type DriveFileMetadata = {
  id: string;
  name: string;
  modifiedTime?: string;
  md5Checksum?: string;
  size?: string;
  trashed?: boolean;
  appProperties?: Record<string, string>;
};

type DriveListResponse = {
  files?: DriveFileMetadata[];
  nextPageToken?: string;
};

export async function listAppDataFiles(accessToken: string) {
  const files: DriveFileMetadata[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      fields: 'nextPageToken,files(id,name,modifiedTime,md5Checksum,size,trashed,appProperties)',
      q: 'trashed = false',
      orderBy: 'modifiedTime desc',
      pageSize: '1000',
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const payload = await driveFetch<DriveListResponse>(`${DRIVE_API_BASE}/files?${params.toString()}`, accessToken);
    files.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return files;
}

export async function getJsonFile<T>(accessToken: string, fileId: string): Promise<T> {
  return driveFetch<T>(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, accessToken);
}

export async function createJsonFile(
  accessToken: string,
  name: string,
  payload: unknown,
  appProperties?: Record<string, string>,
) {
  return uploadJsonFile(accessToken, 'POST', `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,modifiedTime,md5Checksum`, {
    name,
    parents: ['appDataFolder'],
    appProperties,
  }, payload);
}

export async function updateJsonFile(
  accessToken: string,
  fileId: string,
  payload: unknown,
  appProperties?: Record<string, string>,
) {
  return uploadJsonFile(
    accessToken,
    'PATCH',
    `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=multipart&fields=id,name,modifiedTime,md5Checksum`,
    { appProperties },
    payload,
  );
}

export async function deleteDriveFile(accessToken: string, fileId: string) {
  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Google Drive delete failed (${response.status})`);
  }
}

async function driveFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google Drive request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

async function uploadJsonFile(
  accessToken: string,
  method: 'POST' | 'PATCH',
  url: string,
  metadata: Record<string, unknown>,
  payload: unknown,
) {
  const boundary = `notex-${crypto.randomUUID()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(payload),
    `--${boundary}--`,
  ].join('\r\n');

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google Drive upload failed (${response.status})`);
  }

  return response.json() as Promise<DriveFileMetadata>;
}
