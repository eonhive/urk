/**
 * Company: EonHive Inc. | Title: Motion and Transition Ownership
 * Purpose: Verify finite animation replacement, reduced motion, reentrancy, and cooperative transition cleanup.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createTransitions } from '../../packages/examples/dist/media/index.js';

test('new transitions cancel previous actions and disposal waits for cooperative completion', async () => {
  const owner = new AbortController();
  const flow = createTransitions(owner.signal);
  let release, oldSignal;
  const committed = [];
  const old = assert.rejects(
    flow.run(async (signal) => {
      oldSignal = signal;
      await new Promise((resolve) => {
        release = resolve;
      });
      if (!signal.aborted) committed.push('old');
    }),
    { name: 'AbortError' },
  );
  await flow.run(() => {
    committed.push('new');
  });
  assert.equal(oldSignal.aborted, true);
  let disposed = false;
  const done = flow.dispose().then(() => {
    disposed = true;
  });
  await Promise.resolve();
  assert.equal(disposed, false);
  release();
  await old;
  await done;
  assert.deepEqual(committed, ['new']);
  await assert.rejects(
    flow.run(() => {}),
    { name: 'AbortError' },
  );
});

test('reentrant replacement cannot run a stale action; failures do not block later transitions', async () => {
  const owner = new AbortController();
  const flow = createTransitions(owner.signal);
  let release, reentrant;
  const actions = [];
  const first = assert.rejects(
    flow.run(
      (signal) =>
        new Promise((resolve) => {
          release = resolve;
          signal.addEventListener('abort', () => {
            reentrant = flow.run(() => {
              actions.push('latest');
            });
          });
        }),
    ),
    { name: 'AbortError' },
  );
  await assert.rejects(
    flow.run(() => {
      actions.push('stale');
    }),
    { name: 'AbortError' },
  );
  await reentrant;
  release();
  await first;
  assert.deepEqual(actions, ['latest']);
  await assert.rejects(
    flow.run(() => {
      throw new Error('failed');
    }),
    /failed/,
  );
  await flow.run(() => {
    actions.push('recovered');
  });
  owner.abort();
  await flow.dispose();
  assert.deepEqual(actions, ['latest', 'recovered']);
});
