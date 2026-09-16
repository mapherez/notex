import { contentHash, digest, emptyCatalog, parseCatalog, type DriveCatalog } from './backupFormat';
import type { CloudStorage } from './cloudStorage';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export type DriveFile = { id: string; name: string; createdTime?: string; parents?: string[]; mimeType?: string; modifiedTime?: string; appProperties?: Record<string, string> };
type FileList = { files: DriveFile[]; nextPageToken?: string };
type UploadSession = { location: string; completedId?: string };
export class DriveError extends Error {
  constructor(public readonly status: number, public readonly reason: string) { super(reason); }
}

export class DriveClient {
  constructor(private readonly accessToken: () => Promise<string>, readonly signal: AbortSignal,
    private readonly sessions?: Pick<CloudStorage, 'getState' | 'putState'>) {}

  private async request(url: string, init: RequestInit = {}, retrySafe = true, acceptResume = false): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      this.signal.throwIfAborted();
      const token = await this.accessToken();
      let response: Response;
      try {
        const timeout = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(120_000) : undefined;
        const signal = timeout && typeof AbortSignal.any === 'function' ? AbortSignal.any([this.signal, timeout]) : this.signal;
        response = await fetch(url, { ...init, signal,
          headers: { ...init.headers, Authorization: `Bearer ${token}` } });
      } catch (error) {
        if (!retrySafe || attempt >= 4 || this.signal.aborted) throw error;
        await this.delay(attempt); continue;
      }
      if (response.ok || (acceptResume && response.status === 308)) return response;
      if (response.status === 401) throw new DriveError(401, 'GOOGLE_REAUTHORIZE');
      const body = await response.json().catch(() => null);
      const reason = body?.error?.errors?.[0]?.reason ?? `DRIVE_HTTP_${response.status}`;
      if (retrySafe && attempt < 4 && (response.status === 429 || response.status >= 500
        || ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reason))) {
        await this.delay(attempt); continue;
      }
      throw new DriveError(response.status, reason);
    }
  }

  private delay(attempt: number) {
    return new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(this.signal.reason); };
      const timer = setTimeout(() => { this.signal.removeEventListener('abort', abort); resolve(); }, Math.min(32_000, 1000 * 2 ** attempt) + Math.random() * 750);
      this.signal.addEventListener('abort', abort, { once: true });
      if (this.signal.aborted) abort();
    });
  }

  async list(query: string): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ spaces: 'appDataFolder', q: query, pageSize: '1000', fields: 'nextPageToken,files(id,name,createdTime,parents,mimeType,modifiedTime,appProperties)' });
      if (pageToken) params.set('pageToken', pageToken);
      const page: FileList = await (await this.request(`${API}/files?${params}`)).json();
      files.push(...page.files); pageToken = page.nextPageToken;
    } while (pageToken);
    return files;
  }

  async catalog(): Promise<{ id?: string; catalog: DriveCatalog }> {
    const files = await this.list("'appDataFolder' in parents and name = 'metadata.json' and trashed = false");
    if (!files.length) return { catalog: emptyCatalog() };
    // Two simultaneous first-time clients are outside the agreed usage model.
    // Do not silently choose one catalog and hide notes from the other.
    if (files.length !== 1) throw new Error('CLOUD_MULTIPLE_CATALOGS');
    return { id: files[0].id, catalog: parseCatalog(await this.json(files[0].id)) };
  }

  async json(id: string): Promise<unknown> { return (await this.request(`${API}/files/${encodeURIComponent(id)}?alt=media`)).json(); }
  async blob(id: string): Promise<Blob> { return (await this.request(`${API}/files/${encodeURIComponent(id)}?alt=media`)).blob(); }

  async folder(name: string, parent = 'appDataFolder', noteId?: string): Promise<string> {
    // No automatic retry for creates: an ambiguous response can otherwise
    // duplicate a file. The next transfer can safely create a new staging set.
    const response = await this.request(`${API}/files?fields=id`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent],
        ...(noteId ? { appProperties: { notexBackup: '1', noteId } } : {}) }) }, false);
    return (await response.json()).id;
  }

  async upload(name: string, content: Blob, parent = 'appDataFolder', id?: string, checksum?: string): Promise<string> {
    if (id) {
      await this.request(`${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media`, { method: 'PATCH',
        headers: { 'Content-Type': content.type || 'application/octet-stream' }, body: content });
      return id;
    }
    if (content.size > 5 * 1024 * 1024) return this.resumable(name, content, parent, checksum);
    const boundary = `notex_${crypto.randomUUID()}`;
    const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify({ name, parents: [parent] }), `\r\n--${boundary}\r\nContent-Type: ${content.type || 'application/octet-stream'}\r\n\r\n`,
      content, `\r\n--${boundary}--`]);
    const response = await this.request(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    }, false);
    return (await response.json()).id;
  }

  private async resumable(name: string, content: Blob, parent: string, checksum?: string): Promise<string> {
    const key = `uploadSession:${await contentHash({ parent, name, size: content.size, type: content.type,
      hash: checksum ?? await digest(await content.arrayBuffer()) })}`;
    let session = await this.sessions?.getState<UploadSession | null>(key);
    const validLocation = (location: string) => {
      const url = new URL(location);
      if (url.origin !== 'https://www.googleapis.com' || !url.pathname.startsWith('/upload/drive/')
        || url.username || url.password) throw new Error('CLOUD_UPLOAD_SESSION_INVALID');
    };
    const finish = async (response: Response) => {
      const { id } = await response.json();
      if (typeof id !== 'string' || !id) throw new Error('CLOUD_UPLOAD_SESSION_INVALID');
      await this.sessions?.putState(key, { ...session!, completedId: id });
      return id;
    };
    const offsetFrom = (response: Response) => {
      const range = response.headers.get('Range');
      const match = range?.match(/^bytes=0-(\d+)$/);
      const offset = match ? Number(match[1]) + 1 : 0;
      if ((range && !match) || !Number.isSafeInteger(offset) || offset >= content.size) throw new Error('CLOUD_UPLOAD_SESSION_INVALID');
      return offset;
    };
    let offset = 0;
    if (session) {
      validLocation(session.location);
      if (session.completedId) return session.completedId;
      try {
        // The server is authoritative: the final chunk may have arrived before
        // the previous process closed, even without a local acknowledgment.
        const status = await this.request(session.location, { method: 'PUT',
          headers: { 'Content-Range': `bytes */${content.size}` }, body: '' }, true, true);
        if (status.status !== 308) return finish(status);
        offset = offsetFrom(status);
      } catch (error) {
        if (!(error instanceof DriveError && [404, 410].includes(error.status))) throw error;
        await this.sessions?.putState(key, null);
        session = null;
      }
    }
    if (!session) {
    const response = await this.request(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': content.type || 'application/octet-stream', 'X-Upload-Content-Length': String(content.size) },
      body: JSON.stringify({ name, parents: [parent] }),
    }, false);
    const location = response.headers.get('Location');
    if (!location) throw new Error('CLOUD_UPLOAD_SESSION_INVALID');
    validLocation(location);
    session = { location };
    // Save before sending the first byte; storage is scoped to this account.
    await this.sessions?.putState(key, session);
    }
    const location = session.location;
    let failures = 0;
    while (offset < content.size) {
      const end = Math.min(content.size, offset + 8 * 1024 * 1024);
      let uploaded: Response;
      try {
        uploaded = await this.request(location, { method: 'PUT', headers: {
          'Content-Type': content.type || 'application/octet-stream', 'Content-Range': `bytes ${offset}-${end - 1}/${content.size}`,
        }, body: content.slice(offset, end) }, false, true);
      } catch (error) {
        if (error instanceof DriveError && [404, 410].includes(error.status)) {
          await this.sessions?.putState(key, null);
          throw new TypeError('CLOUD_UPLOAD_SESSION_EXPIRED');
        }
        if (this.signal.aborted || failures++ >= 4 || (error instanceof DriveError && error.status < 500 && error.status !== 429)) throw error;
        await this.delay(failures);
        // The server may have received the last chunk despite a lost response.
        // Ask which bytes are committed before retrying it.
        uploaded = await this.request(location, { method: 'PUT', headers: { 'Content-Range': `bytes */${content.size}` }, body: '' }, true, true);
      }
      if (uploaded.status !== 308) return finish(uploaded);
      const next = offsetFrom(uploaded);
      if (next < offset || next > content.size || (next === offset && failures++ >= 4)) throw new Error('CLOUD_UPLOAD_SESSION_INVALID');
      offset = next;
    }
    throw new Error('CLOUD_UPLOAD_SESSION_INVALID');
  }

  uploadJson(name: string, value: unknown, parent = 'appDataFolder', id?: string) {
    return this.upload(name, new Blob([JSON.stringify(value)], { type: 'application/json' }), parent, id);
  }

  async delete(id: string) {
    try { await this.request(`${API}/files/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
    catch (error) { if (!(error instanceof DriveError && error.status === 404)) throw error; }
  }
}
