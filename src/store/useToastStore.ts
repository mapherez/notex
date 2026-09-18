import { create } from 'zustand';
import { uiSettings } from '../config/appSettings';
import { createUuid } from '../core/utils/createUuid';

export type ToastTone = 'info' | 'success' | 'warning';

export type ToastMessage = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastStore = {
  toasts: ToastMessage[];
  pushToast: (message: string, tone?: ToastTone) => string;
  dismissToast: (id: string) => void;
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  pushToast: (message, tone = 'info') => {
    const id = createUuid();
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }].slice(-uiSettings.toastMaxVisible) }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, uiSettings.toastDurationMs);
    return id;
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));
