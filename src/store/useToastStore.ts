import { create } from 'zustand';

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
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }].slice(-4) }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, 3200);
    return id;
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));
