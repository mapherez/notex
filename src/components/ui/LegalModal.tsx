import { useI18n } from '../../i18n/I18nProvider';
import { AppModal } from './AppModal';

export type LegalModalKind = 'privacy' | 'terms';

export function LegalModal({
  kind,
  onClose,
}: {
  kind: LegalModalKind | null;
  onClose: () => void;
}) {
  const { raw, t } = useI18n();

  if (!kind) {
    return null;
  }

  const titleId = `legal-${kind}-title`;
  const paragraphs = raw<string[]>(`legal.${kind}.paragraphs`);

  return (
    <AppModal
      className="legal-modal"
      labelledBy={titleId}
      onClose={onClose}
      open
    >
      <h2 id={titleId}>{t(`legal.${kind}.title`)}</h2>
      <div className="legal-copy">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </AppModal>
  );
}
