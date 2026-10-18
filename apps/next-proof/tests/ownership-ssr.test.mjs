/**
 * Company: EonHive Inc.
 * Title: Next Ownership Server Rendering Test
 * Purpose: Confirm server rendering constructs inert kernels without booting or acquiring browser resources.
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
import { UrkNextProvider, useRuntimePhase, useRuntimeInspectorSnapshot } from '@urk/next';

test('Next provider server renders with no startup, scheduling, or diagnostics subscriptions', async () => {
  const kernels = [];
  let acquisitions = 0;
  let subscriptions = 0;
  function createRuntime() {
    const kernel = createKernel({
      id: 'inert-server-runtime', scheduler: new ManualFrameScheduler(),
      adapters: [{ id: 'resource', capability: 'resource', setup() { acquisitions += 1; return {}; } }],
    });
    const inspector = kernel.getInspector();
    const subscribe = inspector.subscribe.bind(inspector);
    inspector.subscribe = (listener) => { subscriptions += 1; return subscribe(listener); };
    kernels.push(kernel);
    return kernel;
  }
  function RuntimeView() {
    const phase = useRuntimePhase();
    const snapshot = useRuntimeInspectorSnapshot();
    return createElement('span', null, `${phase}:${snapshot.booted}`);
  }
  for (let index = 0; index < 2; index += 1) {
    const html = renderToString(createElement(UrkNextProvider, { createKernel: createRuntime },
      createElement(RuntimeView),
    ));
    assert.equal(html, '<span>boot:false</span>');
  }
  assert.equal(kernels.length, 2);
  assert.equal(acquisitions, 0);
  assert.equal(subscriptions, 0);
  for (const kernel of kernels) {
    assert.equal(kernel.getContext().scheduler.isRunning(), false);
    assert.equal(kernel.getContext().signal.aborted, false);
    await kernel.shutdown();
  }
});
