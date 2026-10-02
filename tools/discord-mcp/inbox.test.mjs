import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInbox } from './inbox.mjs';

test('inbox retains order, waits for events, times out and unblocks on shutdown', async () => {
  const inbox = createInbox();
  inbox.push({ id: '1' });
  inbox.push({ id: '2' });
  assert.deepEqual(await inbox.next(0), { id: '1' });
  assert.deepEqual(await inbox.next(0), { id: '2' });
  const pending = inbox.next(1000);
  assert.throws(() => inbox.next(0), /대기 중/);
  inbox.push({ id: '3' });
  assert.deepEqual(await pending, { id: '3' });
  assert.equal(await inbox.next(0), null);
  const closing = inbox.next(1000);
  inbox.close();
  assert.equal(await closing, null);
});
