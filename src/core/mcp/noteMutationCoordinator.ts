type NoteMutationEntry = {
  localDraftSources: Set<string>;
  localSaveCounts: Map<string, number>;
  mcpMutationActive: boolean;
};

export type McpMutationLease =
  | { acquired: true; release: () => void }
  | { acquired: false; blockedBy: 'local' | 'mcp' };

const entries = new Map<string, NoteMutationEntry>();

export function setLocalDraftPending(noteId: string, sourceId: string, pending: boolean) {
  const entry = getOrCreateEntry(noteId);
  if (pending) {
    entry.localDraftSources.add(sourceId);
  } else {
    entry.localDraftSources.delete(sourceId);
  }
  pruneEntry(noteId, entry);
}

export function beginLocalSave(noteId: string, sourceId: string) {
  const entry = getOrCreateEntry(noteId);
  entry.localSaveCounts.set(sourceId, (entry.localSaveCounts.get(sourceId) ?? 0) + 1);

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const current = entries.get(noteId);
    if (!current) {
      return;
    }
    const count = current.localSaveCounts.get(sourceId) ?? 0;
    if (count <= 1) {
      current.localSaveCounts.delete(sourceId);
    } else {
      current.localSaveCounts.set(sourceId, count - 1);
    }
    pruneEntry(noteId, current);
  };
}

export function tryBeginMcpMutation(noteId: string): McpMutationLease {
  const entry = getOrCreateEntry(noteId);
  if (entry.localDraftSources.size || entry.localSaveCounts.size) {
    return { acquired: false, blockedBy: 'local' };
  }
  if (entry.mcpMutationActive) {
    return { acquired: false, blockedBy: 'mcp' };
  }

  entry.mcpMutationActive = true;
  let released = false;
  return {
    acquired: true,
    release: () => {
      if (released) {
        return;
      }
      released = true;
      const current = entries.get(noteId);
      if (!current) {
        return;
      }
      current.mcpMutationActive = false;
      pruneEntry(noteId, current);
    },
  };
}

function getOrCreateEntry(noteId: string) {
  const existing = entries.get(noteId);
  if (existing) {
    return existing;
  }

  const entry: NoteMutationEntry = {
    localDraftSources: new Set(),
    localSaveCounts: new Map(),
    mcpMutationActive: false,
  };
  entries.set(noteId, entry);
  return entry;
}

function pruneEntry(noteId: string, entry: NoteMutationEntry) {
  if (!entry.localDraftSources.size && !entry.localSaveCounts.size && !entry.mcpMutationActive) {
    entries.delete(noteId);
  }
}
