import { expect, it } from 'vitest';
import { beginLocalSave, setLocalDraftPending, tryBeginMcpMutation } from './noteMutationCoordinator';

it('blocks remote edits until every local draft and save finishes', () => {
  const id = 'draft-test';
  setLocalDraftPending(id, 'header', true);
  const finish = beginLocalSave(id, 'block');
  expect(tryBeginMcpMutation(id)).toEqual({ acquired: false, blockedBy: 'local' });
  setLocalDraftPending(id, 'header', false);
  expect(tryBeginMcpMutation(id)).toEqual({ acquired: false, blockedBy: 'local' });
  finish();
  finish();
  const lease = tryBeginMcpMutation(id);
  expect(lease.acquired).toBe(true);
  if (lease.acquired) lease.release();
});

it('rejects a concurrent MCP edit and releases the note after completion', () => {
  const lease = tryBeginMcpMutation('parallel-test');
  expect(tryBeginMcpMutation('parallel-test')).toEqual({ acquired: false, blockedBy: 'mcp' });
  if (lease.acquired) lease.release();
  const next = tryBeginMcpMutation('parallel-test');
  expect(next.acquired).toBe(true);
  if (next.acquired) next.release();
});
