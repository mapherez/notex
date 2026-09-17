import { invoke } from '@tauri-apps/api/core';

let libraryId: string | null = null;
let accepting = true;
const pending = new Set<Promise<unknown>>();
export function currentDesktopLibrary() { return libraryId; }

export function desktopInvoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  return desktopInvokeForLibrary<T>(libraryId, command, args);
}

export function desktopInvokeForLibrary<T>(expectedLibraryId: string | null, command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!accepting) return Promise.reject(new Error('The account library is changing'));
  const operation = Promise.resolve(invoke<T>(command, { ...args, libraryId: expectedLibraryId }));
  pending.add(operation);
  void operation.finally(() => pending.delete(operation)).catch(() => undefined);
  return operation;
}

export async function pauseDesktopStorage() {
  accepting = false;
  await Promise.allSettled([...pending]);
}

export function selectDesktopLibrary(accountId: string | null) {
  libraryId = accountId;
  accepting = true;
}
