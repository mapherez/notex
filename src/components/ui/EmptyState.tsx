import { useI18n } from '../../i18n/I18nProvider';

export function EmptyState() {
  const { t } = useI18n();

  return (
    <section className="panel">
      <p className="page-subtitle empty">{t("common.empty")}</p>
    </section>
  );
}
