import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Check, Cloud, Copy, GitMerge, HardDrive, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useSyncStore } from '../../store/useSyncStore';
import { useToastStore } from '../../store/useToastStore';
import type { Note, RichTextBlock, SyncItem, UsageExample } from '../../core/models/models';

type MergeDraft = {
  title: string;
  intro: string;
  summaryMarkdown: string;
  explanationMarkdown: string;
  tipTitle: string;
  tipBody: string;
  usageExamplesText: string;
  additionalExamplesText: string;
};

export function SyncConflictReviewModal() {
  const { t } = useI18n();
  const conflicts = useSyncStore((state) => state.conflicts);
  const open = useSyncStore((state) => state.conflictReviewOpen);
  const close = useSyncStore((state) => state.closeConflictReview);
  const resolveConflict = useSyncStore((state) => state.resolveConflict);
  const pushToast = useToastStore((state) => state.pushToast);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const selected = useMemo(
    () => conflicts.find((item) => item.entityKey === selectedKey) ?? conflicts[0],
    [conflicts, selectedKey],
  );
  const localNote = getNoteSnapshot(selected, 'local');
  const remoteNote = getNoteSnapshot(selected, 'remote');
  const baseNote = localNote ?? remoteNote;
  const [draft, setDraft] = useState<MergeDraft>(() => buildMergeDraft(baseNote));

  useEffect(() => {
    if (conflicts.length && !conflicts.some((item) => item.entityKey === selectedKey)) {
      setSelectedKey(conflicts[0].entityKey);
    }
  }, [conflicts, selectedKey]);

  useEffect(() => {
    setManualMode(false);
    setDraft(buildMergeDraft(baseNote));
  }, [selected?.entityKey]);

  if (!open || !conflicts.length || !selected) {
    return null;
  }

  async function resolve(action: 'local' | 'remote' | 'duplicate' | 'manual') {
    if (!selected) {
      return;
    }

    const manualNote = action === 'manual' && baseNote ? buildNoteFromDraft(baseNote, draft) : undefined;
    try {
      await resolveConflict(selected.entityKey, action, manualNote);
      pushToast(t('sync.conflictResolved'), 'success');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t('sync.failed'), 'warning');
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="sync-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title">
        <header className="sync-conflict-header">
          <div>
            <span className="sync-conflict-kicker">
              <AlertTriangle size={16} />
              {t('sync.conflictReview')}
            </span>
            <h2 id="sync-conflict-title">{t('sync.conflictReviewTitle')}</h2>
          </div>
          <button className="icon-button" type="button" aria-label={t('common.close')} onClick={close}>
            <X size={18} />
          </button>
        </header>

        <div className="sync-conflict-layout">
          <aside className="sync-conflict-list" aria-label={t('sync.conflictList')}>
            {conflicts.map((item) => (
              <button
                className={item.entityKey === selected.entityKey ? 'active' : undefined}
                key={item.entityKey}
                type="button"
                onClick={() => setSelectedKey(item.entityKey)}
              >
                <span>{getConflictTitle(item)}</span>
                <small>{item.entityType === 'workspace' ? t('sync.workspaceConflict') : t('sync.noteConflict')}</small>
              </button>
            ))}
          </aside>

          <div className="sync-conflict-detail">
            {selected.entityType === 'workspace' ? (
              <WorkspaceConflictActions onResolve={resolve} />
            ) : (
              <>
                <div className="sync-conflict-compare">
                  <ConflictSnapshot title={t('sync.keepLocal')} icon="local" note={localNote} emptyLabel={t('sync.deletedLocally')} />
                  <ConflictSnapshot title={t('sync.useRemote')} icon="remote" note={remoteNote} emptyLabel={t('sync.deletedRemotely')} />
                </div>

                <div className="sync-conflict-actions">
                  <button type="button" onClick={() => resolve('local')} disabled={!localNote}>
                    <HardDrive size={18} />
                    {t('sync.keepLocal')}
                  </button>
                  <button type="button" onClick={() => resolve('remote')} disabled={!remoteNote}>
                    <Cloud size={18} />
                    {t('sync.useRemote')}
                  </button>
                  <button type="button" onClick={() => resolve('duplicate')} disabled={!localNote || !remoteNote}>
                    <Copy size={18} />
                    {t('sync.duplicateBoth')}
                  </button>
                  <button type="button" onClick={() => setManualMode((value) => !value)} disabled={!baseNote}>
                    <GitMerge size={18} />
                    {t('sync.manualMerge')}
                  </button>
                </div>

                {manualMode && baseNote ? (
                  <ManualMergeEditor
                    draft={draft}
                    localNote={localNote}
                    remoteNote={remoteNote}
                    onDraftChange={setDraft}
                    onResolve={() => resolve('manual')}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function WorkspaceConflictActions({ onResolve }: { onResolve: (action: 'local' | 'remote') => void }) {
  const { t } = useI18n();

  return (
    <div className="workspace-conflict-panel">
      <h3>{t('sync.workspaceConflict')}</h3>
      <p>{t('sync.workspaceConflictDescription')}</p>
      <div className="sync-conflict-actions">
        <button type="button" onClick={() => onResolve('local')}>
          <HardDrive size={18} />
          {t('sync.keepLocal')}
        </button>
        <button type="button" onClick={() => onResolve('remote')}>
          <Cloud size={18} />
          {t('sync.useRemote')}
        </button>
      </div>
    </div>
  );
}

function ConflictSnapshot({
  title,
  icon,
  note,
  emptyLabel,
}: {
  title: string;
  icon: 'local' | 'remote';
  note: Note | null;
  emptyLabel: string;
}) {
  const Icon = icon === 'local' ? HardDrive : Cloud;

  return (
    <article className="sync-conflict-snapshot">
      <h3>
        <Icon size={17} />
        {title}
      </h3>
      {note ? (
        <>
          <strong>{note.title}</strong>
          <p>{note.content.intro || blocksToMarkdown(note.content.summary) || emptyLabel}</p>
        </>
      ) : (
        <p>{emptyLabel}</p>
      )}
    </article>
  );
}

function ManualMergeEditor({
  draft,
  localNote,
  remoteNote,
  onDraftChange,
  onResolve,
}: {
  draft: MergeDraft;
  localNote: Note | null;
  remoteNote: Note | null;
  onDraftChange: (draft: MergeDraft) => void;
  onResolve: () => void;
}) {
  const { t } = useI18n();

  function patchDraft(patch: Partial<MergeDraft>) {
    onDraftChange({ ...draft, ...patch });
  }

  return (
    <div className="manual-merge-editor">
      <MergeField
        label={t('sync.fieldTitle')}
        localValue={localNote?.title}
        remoteValue={remoteNote?.title}
        onPick={(value) => patchDraft({ title: value })}
      >
        <input value={draft.title} onChange={(event) => patchDraft({ title: event.target.value })} />
      </MergeField>
      <MergeField
        label={t('sync.fieldIntro')}
        localValue={localNote?.content.intro}
        remoteValue={remoteNote?.content.intro}
        onPick={(value) => patchDraft({ intro: value })}
      >
        <textarea value={draft.intro} onChange={(event) => patchDraft({ intro: event.target.value })} />
      </MergeField>
      <MergeField
        label={t('noteDetail.summary')}
        localValue={blocksToMarkdown(localNote?.content.summary)}
        remoteValue={blocksToMarkdown(remoteNote?.content.summary)}
        onPick={(value) => patchDraft({ summaryMarkdown: value })}
      >
        <textarea value={draft.summaryMarkdown} onChange={(event) => patchDraft({ summaryMarkdown: event.target.value })} />
      </MergeField>
      <MergeField
        label={t('noteDetail.explanation')}
        localValue={blocksToMarkdown(localNote?.content.explanation)}
        remoteValue={blocksToMarkdown(remoteNote?.content.explanation)}
        onPick={(value) => patchDraft({ explanationMarkdown: value })}
      >
        <textarea value={draft.explanationMarkdown} onChange={(event) => patchDraft({ explanationMarkdown: event.target.value })} />
      </MergeField>
      <MergeField
        label={t('noteDetail.usageExamples')}
        localValue={examplesToText(localNote?.content.usageExamples?.rows)}
        remoteValue={examplesToText(remoteNote?.content.usageExamples?.rows)}
        onPick={(value) => patchDraft({ usageExamplesText: value })}
      >
        <textarea value={draft.usageExamplesText} onChange={(event) => patchDraft({ usageExamplesText: event.target.value })} />
      </MergeField>
      <MergeField
        label={t('noteDetail.tip')}
        localValue={tipToText(localNote)}
        remoteValue={tipToText(remoteNote)}
        onPick={(value) => {
          const [tipTitle = '', ...body] = value.split('\n');
          patchDraft({ tipTitle, tipBody: body.join('\n') });
        }}
      >
        <input value={draft.tipTitle} onChange={(event) => patchDraft({ tipTitle: event.target.value })} />
        <textarea value={draft.tipBody} onChange={(event) => patchDraft({ tipBody: event.target.value })} />
      </MergeField>
      <MergeField
        label={t('noteDetail.additionalExamples')}
        localValue={(localNote?.content.additionalExamples ?? []).join('\n')}
        remoteValue={(remoteNote?.content.additionalExamples ?? []).join('\n')}
        onPick={(value) => patchDraft({ additionalExamplesText: value })}
      >
        <textarea value={draft.additionalExamplesText} onChange={(event) => patchDraft({ additionalExamplesText: event.target.value })} />
      </MergeField>
      <div className="manual-merge-actions">
        <button type="button" onClick={onResolve}>
          <Check size={18} />
          {t('sync.saveMerged')}
        </button>
      </div>
    </div>
  );
}

function MergeField({
  label,
  localValue,
  remoteValue,
  onPick,
  children,
}: {
  label: string;
  localValue?: string;
  remoteValue?: string;
  onPick: (value: string) => void;
  children: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <label className="merge-field">
      <span>
        {label}
        <span>
          <button type="button" onClick={() => onPick(localValue ?? '')} disabled={localValue === undefined}>
            {t('sync.local')}
          </button>
          <button type="button" onClick={() => onPick(remoteValue ?? '')} disabled={remoteValue === undefined}>
            {t('sync.remote')}
          </button>
        </span>
      </span>
      {children}
    </label>
  );
}

function getNoteSnapshot(item: SyncItem | undefined, side: 'local' | 'remote') {
  const snapshot = side === 'local' ? item?.conflict?.localSnapshot : item?.conflict?.remoteSnapshot;
  return snapshot && 'content' in snapshot ? (snapshot as Note) : null;
}

function getConflictTitle(item: SyncItem) {
  const localNote = getNoteSnapshot(item, 'local');
  const remoteNote = getNoteSnapshot(item, 'remote');
  return localNote?.title ?? remoteNote?.title ?? item.entityId;
}

function buildMergeDraft(note?: Note | null): MergeDraft {
  return {
    title: note?.title ?? '',
    intro: note?.content.intro ?? '',
    summaryMarkdown: blocksToMarkdown(note?.content.summary),
    explanationMarkdown: blocksToMarkdown(note?.content.explanation),
    tipTitle: note?.content.tip?.title ?? '',
    tipBody: note?.content.tip?.body ?? '',
    usageExamplesText: examplesToText(note?.content.usageExamples?.rows),
    additionalExamplesText: (note?.content.additionalExamples ?? []).join('\n'),
  };
}

function buildNoteFromDraft(base: Note, draft: MergeDraft): Note {
  return {
    ...base,
    title: draft.title.trim() || base.title,
    content: {
      ...base.content,
      intro: draft.intro.trim(),
      summary: markdownToBlocks(draft.summaryMarkdown, `${base.id}-summary`),
      explanation: markdownToBlocks(draft.explanationMarkdown, `${base.id}-explanation`),
      usageExamples: {
        rows: textToExamples(draft.usageExamplesText),
      },
      tip:
        draft.tipTitle.trim() || draft.tipBody.trim()
          ? {
              id: base.content.tip?.id ?? crypto.randomUUID(),
              title: draft.tipTitle.trim(),
              body: draft.tipBody.trim(),
            }
          : null,
      additionalExamples: draft.additionalExamplesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    },
  };
}

function blocksToMarkdown(blocks?: RichTextBlock[]) {
  return blocks?.map((block) => block.text).join('\n\n') ?? '';
}

function markdownToBlocks(markdown: string, prefix: string): RichTextBlock[] {
  const text = markdown.trimEnd();
  if (!text) {
    return [];
  }

  return [{ id: `${prefix}-${crypto.randomUUID()}`, text }];
}

function examplesToText(rows?: UsageExample[]) {
  return rows?.map((row) => [row.expression, row.meaning, row.example].join(' | ')).join('\n') ?? '';
}

function textToExamples(text: string): UsageExample[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [expression = '', meaning = '', example = ''] = line.split('|').map((part) => part.trim());
      return {
        id: crypto.randomUUID(),
        expression,
        meaning,
        example,
      };
    });
}

function tipToText(note?: Note | null) {
  if (!note?.content.tip) {
    return '';
  }

  return [note.content.tip.title, note.content.tip.body].filter(Boolean).join('\n');
}
