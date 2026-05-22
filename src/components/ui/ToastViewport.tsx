import { CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '../../i18n/I18nProvider';
import { useToastStore, type ToastTone } from '../../store/useToastStore';

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
} satisfies Record<ToastTone, typeof Info>;

export function ToastViewport() {
  const { t } = useI18n();
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = icons[toast.tone];
        return (
          <div className={clsx('toast', toast.tone)} key={toast.id}>
            <Icon />
            <span>{toast.message}</span>
            <button className="icon-button" type="button" aria-label={t('common.dismiss')} onClick={() => dismissToast(toast.id)}>
              <X />
            </button>
          </div>
        );
      })}
    </div>
  );
}

