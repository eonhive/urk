/**
 * Company: EonHive Inc.
 * Title: Lifecycle Compatibility Tests
 * Purpose: Preserve registration identity and promise rejection contracts around user callbacks.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler } from '../dist/index.js';

test('adapter registration events use the reserved identity after setup mutates its object', async () => {
  const kernel = createKernel({ scheduler: new ManualFrameScheduler() });
  let event;
  kernel.getEventBus().on('adapter:registered', (next) => { event = next; });
  const registration = {
    id: 'original', capability: 'original-capability',
    setup() {
      assert.equal(this, registration);
      this.id = 'changed';
      this.capability = 'changed-capability';
      return {};
    },
  };
  await kernel.registerAdapter(registration);
  assert.equal(event.source, 'original');
  assert.deepEqual(event.payload, { id: 'original', capability: 'original-capability' });
  assert.ok(kernel.getContext().adapters.get('original-capability'));
  await kernel.shutdown();
});

test('controller registration observers cannot change the ID used for startup', async () => {
  const frames = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler: frames });
  await kernel.boot();
  const actions = [];
  const controller = {
    id: 'original',
    start() { assert.equal(this, controller); actions.push('start'); },
    update() { assert.equal(this, controller); actions.push('update'); },
  };
  kernel.getEventBus().on('controller:registered', (event) => {
    assert.deepEqual(event.payload, { id: 'original' });
    controller.id = 'changed';
  });
  await kernel.registerController(controller);
  frames.step(100);
  assert.deepEqual(actions, ['start', 'update']);
  assert.equal(kernel.getContext().signal.aborted, false);
  assert.equal(kernel.getContext().controllers.require('original'), controller);
  await kernel.shutdown();
});

for (const method of ['initializeOne', 'startOne']) {
  test(`${method} returns rejected promises for missing IDs and disposal guards`, async () => {
    const kernel = createKernel({ scheduler: new ManualFrameScheduler() });
    const ctx = kernel.getContext();
    let operation;
    assert.doesNotThrow(() => { operation = ctx.controllers[method]('missing', ctx); });
    await assert.rejects(operation, /Missing required controller/);
    await kernel.shutdown();
    assert.doesNotThrow(() => { operation = ctx.controllers[method]('missing', ctx); });
    await assert.rejects(operation, /disposal/);
  });
}
