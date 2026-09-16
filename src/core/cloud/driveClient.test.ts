import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DriveClient } from './driveClient';
import { IndexedDbStorage } from '../storage/indexedDbStorage';

const opened: IndexedDbStorage[] = [];
afterEach(() => { opened.splice(0).forEach((storage) => storage.close()); vi.unstubAllGlobals(); });

describe('persistent resumable uploads', () => {
  const location = 'https://www.googleapis.com/upload/drive/v3/files?upload_id=session';
  const size = 10 * 1024 * 1024;
  const chunk = 8 * 1024 * 1024;
  async function interrupted() {
    const { webcrypto } = await vi.importActual<{ webcrypto: Crypto }>('node:crypto');
    vi.stubGlobal('crypto', webcrypto);
    const account = crypto.randomUUID();
    const storage = await IndexedDbStorage.open(account);
    opened.push(storage);
    const controller = new AbortController();
    const file = new Blob([new Uint8Array(size)]);
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 200, headers: { Location: location } }))
      .mockImplementationOnce(async () => {
        controller.abort();
        return new Response(null, { status: 308, headers: { Range: `bytes=0-${chunk - 1}` } });
      });
    vi.stubGlobal('fetch', fetch);
    await expect(new DriveClient(async () => 'token', controller.signal, storage)
      .upload('file.bin', file, 'folder', undefined, 'hash-a')).rejects.toBeDefined();
    storage.close();
    const reopened = await IndexedDbStorage.open(account);
    opened.push(reopened);
    return { storage: reopened, file };
  }

  it('queries committed bytes after reopening and sends only the remaining chunk', async () => {
    const { storage, file } = await interrupted();
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 308, headers: { Range: `bytes=0-${chunk - 1}` } }))
      .mockResolvedValueOnce(Response.json({ id: 'finished' }));
    vi.stubGlobal('fetch', fetch);
    const client = new DriveClient(async () => 'token', new AbortController().signal, storage);
    expect(await client.upload('file.bin', file, 'folder', undefined, 'hash-a')).toBe('finished');
    expect(fetch.mock.calls[0][1].headers['Content-Range']).toBe(`bytes */${size}`);
    expect(fetch.mock.calls[1][1].headers['Content-Range']).toBe(`bytes ${chunk}-${size - 1}/${size}`);
    expect(fetch.mock.calls[1][1].body.size).toBe(size - chunk);
    expect(await new DriveClient(async () => 'token', new AbortController().signal, storage)
      .upload('file.bin', file, 'folder', undefined, 'hash-a')).toBe('finished');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('recovers a completed upload without sending any content again', async () => {
    const { storage, file } = await interrupted();
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: 'already-finished' }));
    vi.stubGlobal('fetch', fetch);
    expect(await new DriveClient(async () => 'token', new AbortController().signal, storage)
      .upload('file.bin', file, 'folder', undefined, 'hash-a')).toBe('already-finished');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].body).toBe('');
  });

  it('starts a new session when Drive reports the saved session expired', async () => {
    const { storage, file } = await interrupted();
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { headers: { Location: location + '-new' } }))
      .mockResolvedValueOnce(new Response(null, { status: 308, headers: { Range: `bytes=0-${chunk - 1}` } }))
      .mockResolvedValueOnce(Response.json({ id: 'replacement' }));
    vi.stubGlobal('fetch', fetch);
    expect(await new DriveClient(async () => 'token', new AbortController().signal, storage)
      .upload('file.bin', file, 'folder', undefined, 'hash-a')).toBe('replacement');
    expect(fetch.mock.calls[1][1].method).toBe('POST');
    expect(fetch.mock.calls[2][1].headers['Content-Range']).toBe(`bytes 0-${chunk - 1}/${size}`);
  });

  it('does not reuse a session for different file contents', async () => {
    const { storage, file } = await interrupted();
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { headers: { Location: location + '-different' } }))
      .mockResolvedValueOnce(new Response(null, { status: 308, headers: { Range: `bytes=0-${chunk - 1}` } }))
      .mockResolvedValueOnce(Response.json({ id: 'different' }));
    vi.stubGlobal('fetch', fetch);
    await new DriveClient(async () => 'token', new AbortController().signal, storage)
      .upload('file.bin', file, 'folder', undefined, 'hash-b');
    expect(fetch.mock.calls[0][1].method).toBe('POST');
  });
});
