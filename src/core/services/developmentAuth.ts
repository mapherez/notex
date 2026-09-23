import { isTauri } from '@tauri-apps/api/core';

// Browser layout testing only: never bypass the desktop or production login.
export function isDevAuthBypassEnabled(): boolean {
  return import.meta.env.DEV
    && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'
    && !isTauri();
}
