/**
 * Company: EonHive Inc.
 * Title: React Inspector Server Rendering Tests
 * Purpose: Verify inspector hook snapshots during server rendering without a browser runtime.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createKernel, ManualFrameScheduler } from '@urk/core';
import { UrkProvider, useRuntimeInspector, useRuntimeInspectorSnapshot } from '@urk/react';

function renderInspector(kernel, snapshots) {
  function Inspector() {
    const inspector = useRuntimeInspector();
    const snapshot = useRuntimeInspectorSnapshot();
    assert.equal(inspector, kernel.getInspector());
    snapshots.push(snapshot);
    return createElement('span', { 'data-runtime': snapshot.runtimeId }, snapshot.runtime.phase);
  }

  return renderToString(createElement(UrkProvider, { kernel },
    createElement(Inspector),
    createElement(Inspector),
  ));
}

test('server inspector consumers share a stable snapshot without subscribing or booting', async () => {
  const frames = new ManualFrameScheduler();
  let starts = 0;
  const kernel = createKernel({
    id: 'ssr-inspector',
    scheduler: frames,
    controllers: [{ id: 'probe', start() { starts += 1; } }],
  });
  const inspector = kernel.getInspector();
  const originalSubscribe = inspector.subscribe;
  let subscriptions = 0;
  inspector.subscribe = function (listener) {
    subscriptions += 1;
    return originalSubscribe.call(this, listener);
  };

  const snapshots = [];
  const html = renderInspector(kernel, snapshots);
  assert.equal(html, '<span data-runtime="ssr-inspector">boot</span><span data-runtime="ssr-inspector">boot</span>');
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0], snapshots[1]);
  assert.equal(snapshots[0], inspector.getSnapshot());
  assert.equal(Object.isFrozen(snapshots[0]), true);
  assert.equal(Object.isFrozen(snapshots[0].runtime), true);
  assert.equal(starts, 0);
  assert.equal(subscriptions, 0);
  assert.equal(frames.isRunning(), false);
  await kernel.shutdown();
});

test('server renders expose new inspector revisions within the same millisecond', async (t) => {
  t.mock.method(Date, 'now', () => 1000);
  const kernel = createKernel({ id: 'ssr-revisions', scheduler: new ManualFrameScheduler() });
  const before = [];
  renderInspector(kernel, before);

  kernel.getContext().services.register('probe', {});
  const after = [];
  renderInspector(kernel, after);

  assert.equal(before[0].updatedAt, after[0].updatedAt);
  assert.notEqual(before[0], after[0]);
  assert.ok(after[0].revision > before[0].revision);
  assert.equal(after[0].services.length, before[0].services.length + 1);
  assert.equal(after[0].totalEvents, 0);
  assert.equal(after[0], after[1]);
  await kernel.shutdown();
});

test('inspector hooks reject server rendering outside the kernel provider', () => {
  function Inspector() {
    useRuntimeInspectorSnapshot();
    return null;
  }

  assert.throws(() => renderToString(createElement(Inspector)), /inside an UrkProvider/);
});
