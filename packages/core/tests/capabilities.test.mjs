/**
 * Company: EonHive Inc.
 * Title: Typed Capability Runtime Tests
 * Purpose: Verify token identity, reservation, dependencies, rollback, and terminal cleanup.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { AdapterRegistry, CleanupError, createKernel, ManualFrameScheduler, token } from '../dist/index.js';

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

function context(registry, abort = new AbortController()) {
  return { id: 'capability-test', adapters: registry, signal: abort.signal };
}

test('tokens are frozen identities and their names do not create string aliases', async () => {
  const original = token('display-name');
  const other = token('display-name');
  assert.equal(Object.isFrozen(original), true);
  assert.equal(original.name, 'display-name');
  assert.equal(typeof original.key, 'symbol');
  assert.notEqual(original.key, other.key);
  assert.throws(() => { original.key = other.key; }, TypeError);
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const api = {};
  await registry.register({ id: 'adapter', capability: 'legacy-api', token: original, setup: () => api }, ctx);
  assert.equal(registry.require(original), api);
  assert.equal(registry.require('adapter'), api);
  assert.equal(registry.require('legacy-api'), api);
  assert.equal(registry.get(other), undefined);
  assert.equal(registry.get('display-name'), undefined);
  assert.throws(() => registry.require(other), /Missing required adapter: display-name/);
  assert.deepEqual(Object.keys(registry.list()[0]), ['id', 'capability', 'api', 'registration']);
  await registry.disposeAll(ctx);
});

test('independently named tokens can publish different APIs with the same display name', async () => {
  const first = token('same-name');
  const second = token('same-name');
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  await registry.register({ id: 'first', capability: 'first-api', token: first, setup: () => 1 }, ctx);
  await registry.register({ id: 'second', capability: 'second-api', token: second, setup: () => 2 }, ctx);
  assert.equal(registry.require(first), 1);
  assert.equal(registry.require(second), 2);
  await registry.disposeAll(ctx);
});

test('token providers reserve identity before deferred setup and reject a duplicate without running hooks', async () => {
  const capability = token('reserved');
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const entered = deferred();
  const release = deferred();
  const first = registry.register({ id: 'first', capability: 'first-api', token: capability,
    setup() { entered.resolve(); return release.promise; },
  }, ctx);
  await entered.promise;
  assert.equal(registry.get(capability), undefined);
  let duplicateHooks = 0;
  const duplicate = registry.register({ id: 'second', capability: 'second-api', token: capability,
    isSupported() { duplicateHooks += 1; return true; },
    setup() { duplicateHooks += 1; return {}; },
  }, ctx);
  await assert.rejects(duplicate, /Adapter token already registered: reserved/);
  assert.equal(duplicateHooks, 0);
  const api = {};
  release.resolve(api);
  await first;
  assert.equal(registry.require(capability), api);
  await registry.disposeAll(ctx);
});

test('token conflict rejection does not reserve the rejected provider legacy aliases', async () => {
  const first = token('first');
  const second = token('second');
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  await registry.register({ id: 'first', capability: 'first-api', token: first, setup: () => 1 }, ctx);
  await assert.rejects(registry.register({
    id: 'retry', capability: 'retry-api', token: first, setup: () => 2,
  }, ctx), /token already registered/);
  await registry.register({ id: 'retry', capability: 'retry-api', token: second, setup: () => 3 }, ctx);
  assert.equal(registry.require(first), 1);
  assert.equal(registry.require(second), 3);
  await registry.disposeAll(ctx);
});

test('legacy alias conflict rejection does not reserve the rejected provider token', async () => {
  const capability = token('retry');
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  await registry.register({ id: 'existing', capability: 'existing-api', setup: () => 1 }, ctx);
  await assert.rejects(registry.register({
    id: 'existing-api', capability: 'new-api', token: capability, setup: () => 2,
  }, ctx), /ID or capability already registered/);
  await registry.register({ id: 'retry', capability: 'new-api', token: capability, setup: () => 3 }, ctx);
  assert.equal(registry.require(capability), 3);
  await registry.disposeAll(ctx);
});

test('failed setup releases token and string reservations after partial cleanup', async () => {
  const capability = token('retry');
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const failure = new Error('setup failed');
  const calls = [];
  await assert.rejects(registry.register({
    id: 'retry', capability: 'retry-api', token: capability,
    setup(owned) { owned.scope.defer(() => { calls.push('partial cleanup'); }); throw failure; },
  }, ctx), (error) => error === failure);
  assert.deepEqual(calls, ['partial cleanup']);
  assert.equal(registry.get(capability), undefined);
  await registry.register({ id: 'retry', capability: 'retry-api', token: capability, setup: () => 1 }, ctx);
  assert.equal(registry.require(capability), 1);
  await registry.disposeAll(ctx);
});

test('unsupported providers release tokens without publishing or running setup', async () => {
  const capability = token('supported-later');
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  let setups = 0;
  await assert.rejects(registry.register({
    id: 'unsupported', capability: 'unsupported-api', token: capability,
    isSupported: () => false, setup() { setups += 1; return {}; },
  }, ctx), /not supported/);
  assert.equal(setups, 0);
  await registry.register({ id: 'supported', capability: 'supported-api', token: capability, setup: () => 1 }, ctx);
  assert.equal(registry.require(capability), 1);
  await registry.disposeAll(ctx);
});

test('shutdown during setup prevents late token publication and cleans the completed API once', async () => {
  const capability = token('cancelled');
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const entered = deferred();
  const release = deferred();
  const calls = [];
  const registration = registry.register({
    id: 'cancelled', capability: 'cancelled-api', token: capability,
    async setup(owned) {
      entered.resolve();
      await release.promise;
      owned.scope.defer(() => { calls.push('scope'); });
      return {};
    },
    dispose() { calls.push('api'); },
  }, ctx).catch((error) => error);
  await entered.promise;
  let completed = false;
  const shutdown = registry.disposeAll(ctx).then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  release.resolve();
  assert.ok(await registration instanceof Error);
  await shutdown;
  assert.equal(registry.get(capability), undefined);
  assert.equal(registry.get('cancelled-api'), undefined);
  assert.deepEqual(calls, ['api', 'scope']);
  await assert.rejects(registry.register({
    id: 'late', capability: 'late-api', token: capability, setup: () => ({}),
  }, ctx), /shutdown begins/);
});

test('token identity is captured before support/setup hooks mutate registration metadata', async () => {
  const original = token('original');
  const supported = token('support-replacement');
  const setup = token('setup-replacement');
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const registration = {
    id: 'stable', capability: 'stable-api', token: original,
    isSupported() { assert.equal(this, registration); this.token = supported; return true; },
    setup() { assert.equal(this, registration); this.token = setup; return 1; },
    dispose(_ctx, api) { assert.equal(this, registration); assert.equal(api, 1); },
  };
  await registry.register(registration, ctx);
  assert.equal(registry.require(original), 1);
  assert.equal(registry.get(supported), undefined);
  assert.equal(registry.get(setup), undefined);
  await registry.disposeAll(ctx);
});

test('token dependencies share configured sequential startup with legacy dependency aliases', async () => {
  const capability = token('dependency');
  const calls = [];
  const kernel = createKernel({ scheduler: new ManualFrameScheduler(), adapters: [
    { id: 'dependency', capability: 'dependency-api', token: capability,
      setup() { calls.push('dependency'); return { value: 1 }; } },
    { id: 'consumer', capability: 'consumer-api', dependsOn: [capability, 'dependency-api'],
      setup(ctx) { calls.push('consumer'); assert.equal(ctx.adapters.require(capability).value, 1); return {}; } },
  ], controllers: [{
    id: 'controller', start(ctx) { calls.push('controller'); assert.equal(ctx.adapters.require(capability).value, 1); },
  }] });
  await kernel.boot();
  assert.deepEqual(calls, ['dependency', 'consumer', 'controller']);
  await kernel.shutdown();
});

test('same-name tokens cannot satisfy dependencies and rejection leaves aliases available for retry', async () => {
  const existing = token('dependency');
  const missing = token('dependency');
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  await registry.register({ id: 'dependency', capability: 'dependency-api', token: existing, setup: () => 1 }, ctx);
  let setups = 0;
  await assert.rejects(registry.register({
    id: 'consumer', capability: 'consumer-api', dependsOn: [missing],
    setup() { setups += 1; return {}; },
  }, ctx), /Adapter consumer is missing dependency: dependency/);
  assert.equal(setups, 0);
  await registry.register({ id: 'consumer', capability: 'consumer-api', dependsOn: [existing], setup: () => 2 }, ctx);
  assert.equal(registry.require('consumer-api'), 2);
  await registry.disposeAll(ctx);
});

test('a reserved token is not a satisfied dependency until setup publishes', async () => {
  const capability = token('pending-dependency');
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  const release = deferred();
  const dependency = registry.register({
    id: 'dependency', capability: 'dependency-api', token: capability, setup: () => release.promise,
  }, ctx);
  const consumer = { id: 'consumer', capability: 'consumer-api', dependsOn: [capability], setup: () => 2 };
  await assert.rejects(registry.register(consumer, ctx), /missing dependency/);
  release.resolve(1);
  await dependency;
  await registry.register(consumer, ctx);
  assert.equal(registry.require(capability), 1);
  await registry.disposeAll(ctx);
});

test('pending controller hooks retain token access until they settle before dependency cleanup', async () => {
  const capability = token('dependency');
  const entered = deferred();
  const release = deferred();
  const calls = [];
  const kernel = createKernel({ scheduler: new ManualFrameScheduler(), adapters: [{
    id: 'dependency', capability: 'dependency-api', token: capability, setup: () => ({ value: 1 }),
    dispose() { calls.push('adapter'); },
  }], controllers: [{
    id: 'consumer', async start(ctx) {
      entered.resolve();
      await release.promise;
      assert.equal(ctx.adapters.require(capability).value, 1);
      calls.push('hook');
    },
    dispose() { calls.push('controller'); },
  }] });
  const boot = kernel.boot().catch((error) => error);
  await entered.promise;
  const shutdown = kernel.shutdown();
  assert.equal(kernel.getContext().signal.aborted, true);
  assert.equal(kernel.getContext().adapters.require(capability).value, 1);
  release.resolve();
  assert.ok(await boot instanceof Error);
  await shutdown;
  assert.deepEqual(calls, ['hook', 'controller', 'adapter']);
  assert.equal(kernel.getContext().adapters.get(capability), undefined);
});

test('cleanup failures still release token lookup and report their original causes', async () => {
  const capability = token('failing-cleanup');
  const failure = new Error('cleanup failure');
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  await registry.register({ id: 'failed', capability: 'failed-api', token: capability, setup: () => 1,
    dispose() { throw failure; },
  }, ctx);
  await assert.rejects(registry.disposeAll(ctx), (error) => {
    assert.ok(error instanceof CleanupError);
    assert.deepEqual(error.errors, [failure]);
    return true;
  });
  assert.equal(registry.get(capability), undefined);
  assert.equal(registry.get('failed-api'), undefined);
  assert.deepEqual(registry.list(), []);
});

test('tokens from an independent module instance work without constructor checks or global name interning', async () => {
  const independent = await import('../dist/capabilities/token.js?independent-instance');
  const canonical = independent.token('foreign-contract');
  const local = token('foreign-contract');
  const registry = new AdapterRegistry();
  const ctx = context(registry);
  await registry.register({ id: 'foreign', capability: 'foreign-api', token: canonical, setup: () => 1 }, ctx);
  assert.equal(registry.require(canonical), 1);
  assert.equal(registry.get(local), undefined);
  await registry.disposeAll(ctx);
});
