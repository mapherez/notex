type LegalPageKind = 'privacy' | 'terms';

const legalCopy: Record<LegalPageKind, { title: string; body: string[] }> = {
  privacy: {
    title: 'Privacy Policy',
    body: [
      'NoteX stores your notes locally on your device.',
      'If you connect your Google account, NoteX uses Google Drive app data to sync your notes.',
      'NoteX does not access your personal Google Drive files.',
      'NoteX does not sell or share your data.',
    ],
  },
  terms: {
    title: 'Terms of Service',
    body: [
      'NoteX is provided as-is.',
      'You are responsible for your data and backups.',
      'Use at your own risk.',
    ],
  },
};

export function LegalPage({ kind }: { kind: LegalPageKind }) {
  const copy = legalCopy[kind];

  return (
    <div className="page-content legal-page">
      <article className="settings-card legal-card">
        <h1 className="page-title">{copy.title}</h1>
        <div className="legal-copy">
          {copy.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
