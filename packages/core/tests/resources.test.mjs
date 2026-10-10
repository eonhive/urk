/**
 * Company: EonHive Inc.
 * Title: Resource Scope Tests
 * Purpose: Verify cleanup ordering, shared completion, and complete failure reporting.
 * Author: Stan Nesi
 * Created: 2026-10-03
 * Updated: 2026-10-03
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { CleanupError, ResourceScope } from '../dist/index.js';

test('scope cleans owned acquisitions in reverse order and awaits asynchronous cleanup', async () => {
  const scope = new ResourceScope();
  const calls = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  scope.defer(() => { calls.push('first'); });
  scope.defer(async () => { calls.push('second:start'); await gate; calls.push('second:end'); });
  const first = scope.dispose();
  const second = scope.dispose();
  await Promise.resolve();
  assert.equal(first, second);
  assert.deepEqual(calls, ['second:start']);
  release();
  await first;
  await scope.dispose();
  assert.deepEqual(calls, ['second:start', 'second:end', 'first']);
});

test('scope preserves every failure and continues remaining cleanup', async () => {
  const scope = new ResourceScope();
  const firstFailure = new Error('first cleanup failed');
  const lastFailure = 'last cleanup failed';
  const calls = [];
  scope.defer(() => { calls.push('first'); throw firstFailure; });
  scope.defer(() => { calls.push('middle'); });
  scope.defer(async () => { calls.push('last'); throw lastFailure; });
  const disposal = scope.dispose();
  await assert.rejects(disposal, (error) => {
    assert.ok(error instanceof CleanupError);
    assert.deepEqual(error.errors, [lastFailure, firstFailure]);
    assert.equal(Object.isFrozen(error.errors), true);
    return true;
  });
  assert.equal(scope.dispose(), disposal);
  assert.deepEqual(calls, ['last', 'middle', 'first']);
});

test('scope rejects new cleanup immediately after disposal begins', async () => {
  const scope = new ResourceScope();
  const disposal = scope.dispose();
  assert.throws(() => scope.defer(() => {}), /disposal begins/);
  await disposal;
  assert.throws(() => scope.defer(() => {}), /disposal begins/);
});

test('reentrant disposal observes the original completion promise', async () => {
  const scope = new ResourceScope();
  let reentrant;
  scope.defer(() => { reentrant = scope.dispose(); });
  const disposal = scope.dispose();
  await disposal;
  assert.equal(reentrant, disposal);
});

test('empty scopes have shared successful completion', async () => {
  const scope = new ResourceScope();
  const disposal = scope.dispose();
  await disposal;
  assert.equal(scope.dispose(), disposal);
});
