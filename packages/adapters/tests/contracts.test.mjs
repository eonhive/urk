/**
 * Company: EonHive Inc.
 * Title: Built-in Adapter Contract Tests
 * Purpose: Verify shared entrypoint identities, inert factories, typed lookup, and custom aliases.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { AdapterRegistry, createKernel, ManualFrameScheduler, token } from '@urk/core';
import * as root from '@urk/adapters';
import * as dom from '@urk/adapters/dom';

const adapters = [
  ['audio', 'Audio'], ['input', 'Input'], ['loading', 'Loading'], ['pointer', 'Pointer'],
  ['storage', 'Storage'], ['three', 'Three'], ['ui-widgets', 'UiWidgets'],
];

function storageBackend() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test('root, DOM, and independent imports share the same canonical contracts and factories', async () => {
  for (const [path, name] of adapters) {
    const leaf = await import(`@urk/adapters/${path}`);
    const capability = `${name}Capability`;
    const factory = `create${name}Adapter`;
    assert.equal(root[capability], leaf[capability]);
    assert.equal(root[factory], leaf[factory]);
    assert.equal(Object.isFrozen(leaf[capability]), true);
    assert.equal(leaf[capability].name, path);
    assert.equal(leaf[factory]().token, leaf[capability]);
    if (path !== 'three' && path !== 'audio') {
      assert.equal(dom[capability], leaf[capability]);
      assert.equal(dom[factory], leaf[factory]);
    }
  }
  assert.equal(dom.createAudioAdapter, undefined);
  assert.equal(dom.createThreeAdapter, undefined);
});

test('factories create registrations without reading browser resources or scheduling work', () => {
  const names = ['window', 'document', 'Audio', 'HTMLElement', 'requestAnimationFrame', 'setTimeout', 'setInterval'];
  const original = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  try {
    for (const name of names) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() { throw new Error(`Factory acquired ${name}`); },
      });
    }
    for (const [, name] of adapters) root[`create${name}Adapter`]();
  } finally {
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test('built-in tokens resolve real APIs, mixed dependencies, legacy aliases, and terminal removal', async () => {
  const local = storageBackend();
  const session = storageBackend();
  const calls = [];
  const kernel = createKernel({
    scheduler: new ManualFrameScheduler(),
    services: { 'storage:local': local, 'storage:session': session },
    adapters: [
      root.createLoadingAdapter(), root.createPointerAdapter(), root.createStorageAdapter({ namespace: 'proof' }),
      {
        id: 'consumer', capability: 'consumer', dependsOn: [root.LoadingCapability, 'storage'],
        setup(ctx) {
          const loading = ctx.adapters.require(root.LoadingCapability);
          const storage = ctx.adapters.require(root.StorageCapability);
          loading.begin([{ id: 'ready', label: 'Ready' }]);
          loading.setStage('ready', 1);
          storage.setItem('volume', 0.5);
          calls.push(loading.complete().complete);
          return {};
        },
      },
    ],
  });
  await kernel.boot();
  try {
    assert.deepEqual(calls, [true]);
    for (const name of ['Loading', 'Pointer', 'Storage']) {
      const capability = root[`${name}Capability`];
      assert.equal(kernel.getContext().adapters.require(capability), kernel.getContext().adapters.require(capability.name));
      assert.equal(kernel.getContext().adapters.require(capability), kernel.getContext().adapters.require(`${capability.name}-adapter`));
    }
    assert.equal(kernel.getContext().adapters.require(root.StorageCapability).getItem('volume'), 0.5);
    assert.equal(local.getItem('proof:volume'), '0.5');
  } finally {
    await kernel.shutdown();
  }
  for (const name of ['Loading', 'Pointer', 'Storage']) {
    assert.equal(kernel.getContext().adapters.get(root[`${name}Capability`]), undefined);
  }
  assert.equal(local.getItem('proof:volume'), '0.5');
});

test('remapped aliases still reject competing canonical providers without replacing the first API', async () => {
  const registry = new AdapterRegistry();
  const ctx = { id: 'duplicate', adapters: registry, signal: new AbortController().signal };
  const firstApi = {};
  await registry.register({ ...root.createLoadingAdapter('first'), setup: () => firstApi }, ctx);
  try {
    await assert.rejects(registry.register({
      ...root.createLoadingAdapter('second'), capability: 'other-loading',
      setup() { throw new Error('Duplicate setup must not run'); },
    }, ctx), /Adapter token already registered: loading/);
    assert.equal(registry.require(root.LoadingCapability), firstApi);
    assert.equal(registry.require('loading'), firstApi);
    assert.equal(registry.get('second'), undefined);
    assert.equal(registry.get('other-loading'), undefined);
  } finally {
    await registry.disposeAll(ctx);
  }
});

test('custom multiple-instance aliases can omit the canonical binding or supply a separate token', async () => {
  const CustomLoading = token('custom-loading');
  const kernel = createKernel({
    scheduler: new ManualFrameScheduler(),
    adapters: [
      root.createLoadingAdapter('primary'),
      { ...root.createLoadingAdapter('secondary'), capability: 'secondary-loading', token: undefined },
      { ...root.createLoadingAdapter('custom'), capability: 'custom-loading', token: CustomLoading },
    ],
  });
  await kernel.boot();
  try {
    const primary = kernel.getContext().adapters.require(root.LoadingCapability);
    const secondary = kernel.getContext().adapters.require('secondary-loading');
    const custom = kernel.getContext().adapters.require(CustomLoading);
    primary.begin([{ id: 'primary', label: 'Primary' }]);
    secondary.begin([{ id: 'secondary', label: 'Secondary' }]);
    assert.equal(primary.getSnapshot().stages[0].id, 'primary');
    assert.equal(secondary.getSnapshot().stages[0].id, 'secondary');
    assert.equal(custom.getSnapshot().active, false);
    assert.equal(kernel.getContext().adapters.require('custom-loading'), custom);
  } finally {
    await kernel.shutdown();
  }
});
