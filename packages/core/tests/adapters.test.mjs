/**
 * Company: EonHive Inc.
 * Title: Adapter Lifecycle Tests
 * Purpose: Verify concurrent registration, cancellation, and adapter cleanup ownership.
 * Author: Stan Nesi
 * Created: 2026-10-03
 * Updated: 2026-10-03
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { AdapterRegistry, CleanupError } from '../dist/index.js';

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function context(registry, abort = new AbortController()) {
  return { id: 'adapter-test', adapters: registry, signal: abort.signal };
}

test('reserves adapter IDs and capabilities while setup is pending', async () => {
  for (const duplicate of [
    { id: 'original', capability: 'other-capability' },
    { id: 'other-id', capability: 'original-capability' },
  ]) {
    const registry = new AdapterRegistry();
    const ctx = context(registry);
    const gate = deferred();
    const first = registry.register({
      id: 'original', capability: 'original-capability', setup: () => gate.promise,
    }, ctx);
    let duplicateSetups = 0;
    const second = registry.register({
      ...duplicate,
      setup() { duplicateSetups += 1; return {}; },
    }, ctx);
    const secondResult = second.then(() => null, (error) => error);
    gate.resolve({});
    await first;
    const error = await secondResult;
    await registry.disposeAll(ctx);
    assert.ok(error instanceof Error, 'conflicting registration should reject');
    assert.equal(duplicateSetups, 0);
  }
});

test('shutdown waits for pending setup and prevents late capability publication', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const gate = deferred();
  const entered = deferred();
  let disposed = 0;
  const setup = registry.register({
    id: 'pending', capability: 'pending-api',
    setup() { entered.resolve(); return gate.promise; },
    dispose() { disposed += 1; },
  }, ctx);
  const setupResult = setup.then(() => null, (error) => error);
  await entered.promise;
  let shutdownComplete = false;
  const shutdown = registry.disposeAll(ctx).then(() => { shutdownComplete = true; });
  await Promise.resolve();
  await Promise.resolve();
  const finishedBeforeSetup = shutdownComplete;
  gate.resolve({});
  const error = await setupResult;
  await shutdown;
  assert.equal(finishedBeforeSetup, false);
  assert.ok(error instanceof Error);
  assert.equal(registry.get('pending-api'), undefined);
  assert.equal(disposed, 1);
});

test('concurrent shutdown callers share cleanup completion and do not repeat disposal', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const gate = deferred();
  let disposed = 0;
  await registry.register({
    id: 'one', capability: 'one', setup: () => ({}),
    async dispose() { disposed += 1; await gate.promise; },
  }, ctx);
  const first = registry.disposeAll(ctx);
  const second = registry.disposeAll(ctx);
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(disposed, 1);
  assert.equal(first, second);
});

test('ID and capability aliases cannot shadow another adapter', async () => {
  for (const duplicate of [
    { id: 'original-capability', capability: 'other-capability' },
    { id: 'other-id', capability: 'original' },
  ]) {
    const registry = new AdapterRegistry();
    const ctx = context(registry);
    await registry.register({ id: 'original', capability: 'original-capability', setup: () => ({}) }, ctx);
    const error = await registry.register({ ...duplicate, setup: () => ({}) }, ctx)
      .then(() => null, (failure) => failure);
    await registry.disposeAll(ctx);
    assert.ok(error instanceof Error);
  }
});

test('disposal prevents later registration', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  await registry.disposeAll(ctx);
  await assert.rejects(registry.register({ id: 'late', capability: 'late', setup: () => ({}) }, ctx));
});

test('failed setup cleans partial ownership without invoking the legacy disposer', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const failure = new Error('setup failed');
  const calls = [];
  const registration = {
    id: 'partial', capability: 'partial-api',
    setup(owned) {
      owned.scope.defer(() => { calls.push('first'); });
      owned.scope.defer(() => { calls.push('second'); });
      throw failure;
    },
    dispose() { calls.push('legacy'); },
  };
  await assert.rejects(registry.register(registration, ctx), (error) => error === failure);
  assert.deepEqual(calls, ['second', 'first']);
  assert.equal(registry.get('partial-api'), undefined);
  await registry.register({ id: 'partial', capability: 'partial-api', setup: () => ({}) }, ctx);
  await registry.disposeAll(ctx);
  assert.deepEqual(calls, ['second', 'first']);
});

test('setup and disposal share the owned context while borrowed resources survive', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const calls = [];
  const borrowed = { dispose() { calls.push('borrowed'); } };
  let setupContext;
  const api = await registry.register({
    id: 'owned', capability: 'owned-api',
    setup(owned) {
      setupContext = owned;
      owned.scope.defer(() => { calls.push('owned'); });
      return borrowed;
    },
    dispose(owned, value) {
      assert.equal(owned, setupContext);
      assert.equal(value, borrowed);
      calls.push('legacy');
    },
  }, ctx);
  assert.equal(api, borrowed);
  assert.notEqual(setupContext, ctx);
  assert.equal(setupContext.signal, ctx.signal);
  assert.equal('context' in registry.list()[0], false);
  await registry.disposeAll(context(registry));
  assert.deepEqual(calls, ['legacy', 'owned']);
});

test('setup failure is preserved and cleanup failures are reported by shutdown', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const failure = Object.freeze(new Error('setup failed'));
  const cleanupFailure = new Error('cleanup failed');
  await assert.rejects(registry.register({
    id: 'partial', capability: 'partial-api',
    setup(owned) {
      owned.scope.defer(() => { throw cleanupFailure; });
      throw failure;
    },
  }, ctx), (error) => error === failure);
  await assert.rejects(registry.disposeAll(ctx), (error) => {
    assert.ok(error instanceof CleanupError);
    assert.deepEqual(error.errors, [cleanupFailure]);
    return true;
  });
});

test('legacy and scoped cleanup failures do not skip other adapters', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const legacyFailure = new Error('legacy cleanup failed');
  const scopedFailure = new Error('scoped cleanup failed');
  const calls = [];
  await registry.register({
    id: 'first', capability: 'first', setup: () => ({}),
    dispose() { calls.push('first'); },
  }, ctx);
  await registry.register({
    id: 'second', capability: 'second',
    setup(owned) {
      owned.scope.defer(() => { calls.push('scope'); throw scopedFailure; });
      return {};
    },
    dispose() { calls.push('legacy'); throw legacyFailure; },
  }, ctx);
  const first = registry.disposeAll(ctx);
  const second = registry.disposeAll(ctx);
  await assert.rejects(first, (error) => {
    assert.deepEqual(error.errors, [legacyFailure, scopedFailure]);
    return true;
  });
  assert.equal(first, second);
  assert.deepEqual(calls, ['legacy', 'scope', 'first']);
  assert.deepEqual(registry.list(), []);
});

test('aborted setup cannot publish and disposes its completed API exactly once', async () => {
  const registry = new AdapterRegistry();
  const abort = new AbortController();
  const ctx = context(registry, abort);
  const entered = deferred();
  const gate = deferred();
  const calls = [];
  const setup = registry.register({
    id: 'aborted', capability: 'aborted-api',
    async setup(owned) {
      entered.resolve();
      await gate.promise;
      owned.scope.defer(() => { calls.push('late acquisition'); });
      return {};
    },
    dispose() { calls.push('legacy'); },
  }, ctx);
  const rejection = assert.rejects(setup, /shutdown/);
  await entered.promise;
  abort.abort();
  gate.resolve();
  await rejection;
  assert.equal(registry.get('aborted-api'), undefined);
  await registry.disposeAll(ctx);
  assert.deepEqual(calls, ['legacy', 'late acquisition']);
});

test('support hooks reserve aliases before reentrant registration', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  let nested;
  let nestedSetups = 0;
  await registry.register({
    id: 'outer', capability: 'outer-api',
    isSupported() {
      nested = registry.register({
        id: 'outer-api', capability: 'nested-api',
        setup() { nestedSetups += 1; return {}; },
      }, ctx).then(() => null, (error) => error);
      return true;
    },
    setup: () => ({}),
  }, ctx);
  assert.ok(await nested instanceof Error);
  assert.equal(nestedSetups, 0);
  await registry.disposeAll(ctx);
});

test('support hook shutdown is tracked and prevents setup from beginning', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  let shutdown;
  let setupCalls = 0;
  let cleanupCalls = 0;
  await assert.rejects(registry.register({
    id: 'reentrant', capability: 'reentrant-api',
    isSupported(owned) {
      owned.scope.defer(() => { cleanupCalls += 1; });
      shutdown = registry.disposeAll(ctx);
      return true;
    },
    setup() { setupCalls += 1; return {}; },
  }, ctx), /shutdown/);
  await shutdown;
  assert.equal(setupCalls, 0);
  assert.equal(cleanupCalls, 1);
});

test('setup can request shutdown without awaiting its own completion', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  let shutdown;
  let disposed = 0;
  await assert.rejects(registry.register({
    id: 'reentrant', capability: 'reentrant-api',
    setup() { shutdown = registry.disposeAll(ctx); return {}; },
    dispose() { disposed += 1; },
  }, ctx), /shutdown/);
  await shutdown;
  assert.equal(disposed, 1);
  assert.equal(registry.get('reentrant-api'), undefined);
});

test('rejected support and missing dependencies release registration names', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const registration = { id: 'retry', capability: 'retry-api', setup: () => ({}) };
  await assert.rejects(registry.register({ ...registration, dependsOn: ['missing'] }, ctx), /missing dependency/);
  await assert.rejects(registry.register({ ...registration, isSupported: () => false }, ctx), /not supported/);
  await registry.register(registration, ctx);
  assert.ok(registry.get('retry-api'));
  await registry.disposeAll(ctx);
});

test('shutdown waits for every pending adapter before disposing published dependencies', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const calls = [];
  const gate = deferred();
  const entered = deferred();
  const dependency = { available: true };
  await registry.register({
    id: 'dependency', capability: 'dependency-api', setup: () => dependency,
    dispose() { dependency.available = false; calls.push('dependency'); },
  }, ctx);
  const pending = registry.register({
    id: 'dependent', capability: 'dependent-api', dependsOn: ['dependency-api'],
    async setup(owned) {
      entered.resolve();
      await gate.promise;
      assert.equal(owned.adapters.require('dependency-api').available, true);
      return {};
    },
    dispose() { calls.push('dependent'); },
  }, ctx);
  const rejection = assert.rejects(pending, /shutdown/);
  await entered.promise;
  const shutdown = registry.disposeAll(ctx);
  await Promise.resolve();
  assert.equal(dependency.available, true);
  gate.resolve();
  await Promise.all([shutdown, rejection]);
  assert.deepEqual(calls, ['dependent', 'dependency']);
});

test('registration identity stays stable when setup mutates its registration object', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const existing = {};
  await registry.register({ id: 'existing', capability: 'existing-api', setup: () => existing }, ctx);
  let disposed = 0;
  const registration = {
    id: 'original', capability: 'original-api',
    setup() {
      assert.equal(this, registration);
      this.id = 'existing';
      this.capability = 'existing-api';
      return {};
    },
    dispose() { assert.equal(this, registration); disposed += 1; },
  };
  const api = await registry.register(registration, ctx);
  assert.equal(registry.get('original'), api);
  assert.equal(registry.get('original-api'), api);
  assert.equal(registry.get('existing'), existing);
  assert.deepEqual(registry.list().map(({ id, capability }) => ({ id, capability })), [
    { id: 'existing', capability: 'existing-api' },
    { id: 'original', capability: 'original-api' },
  ]);
  await registry.disposeAll(ctx);
  assert.equal(disposed, 1);
});

test('failed setup releases original aliases even when its registration object changes', async () => {
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const failure = new Error('mutated setup failed');
  await assert.rejects(registry.register({
    id: 'retry', capability: 'retry-api',
    setup() { this.id = 'changed'; this.capability = 'changed-api'; throw failure; },
  }, ctx), (error) => error === failure);
  await registry.register({ id: 'retry', capability: 'retry-api', setup: () => ({}) }, ctx);
  await registry.disposeAll(ctx);
});
