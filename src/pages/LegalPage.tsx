type LegalPageKind = 'privacy' | 'terms';

const legalCopy: Record<LegalPageKind, { title: string; body: string[] }> = {
  privacy: {
    title: 'Privacy Policy',
    body: [
      'NoteX is a local/offline-first desktop app. Your notes, tags, collections, settings, and app data are stored in a local SQLite database on your device.',
      'NoteX does not require an account and does not send your knowledge base to a NoteX server.',
      'When you export your data, NoteX creates a .notex package locally with your database and attached files. You are responsible for where you store or share that exported package.',
      'When you import a package, NoteX replaces the current local database and files folder with the selected .notex package.',
      'NoteX does not sell your data, use your notes for advertising, or share your local database with third parties.',
    ],
  },
  terms: {
    title: 'Terms of Service',
    body: [
      'NoteX is provided as local desktop software for personal knowledge management.',
      'You are responsible for your notes, backups, exported packages, and any data you choose to import or replace.',
      'Importing a .notex package replaces the current local database and files folder. Review your backups before importing.',
      'You should keep your own backups if your notes are important. NoteX cannot recover data that is deleted, overwritten, or lost outside the app.',
      'The app is provided as-is, without a guarantee that it will be error-free or suitable for every workflow.',
      'By using NoteX, you agree to use it responsibly and to maintain your own backup routine.',
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
