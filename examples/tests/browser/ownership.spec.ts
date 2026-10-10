/**
 * Company: EonHive Inc.
 * Title: Browser Ownership Integration Tests
 * Purpose: Verify cancellation, cleanup ownership, snapshot stability, and real Next navigation.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import { expect, test, type Page } from '@playwright/test';
import type { OwnershipTestApi } from '../fixtures/react-host';
import type { reports } from '../fixtures/runtime';

declare global {
  interface Window {
    urkOwnershipTest: OwnershipTestApi;
    urkNextOwnershipReports?: typeof reports;
  }
}

const reactUrl = 'http://127.0.0.1:5174/tests/fixtures/index.html';
const nextUrl = 'http://127.0.0.1:3102/ownership';
const unexpectedErrors = new WeakMap<Page, string[]>();

async function report(page: Page, index = 0) {
  return page.evaluate((position) => window.urkOwnershipTest.reports()[position], index);
}

async function expectDisposed(page: Page, index = 0) {
  await expect.poll(() => report(page, index)).toMatchObject({
    cancelled: true, disposals: 1, ownedListeners: 0,
    stateSubscriptions: 0, eventSubscriptions: 0,
    frames: 0, intervals: 0, schedulerRunning: false, adapters: 0, controllers: 0,
  });
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  unexpectedErrors.set(page, errors);
  page.on('pageerror', (error) => {
    const expectedGuard = error.message === 'This kernel already has a provider cleanup owner.' ||
      error.message === 'UrkProvider does not support changing ownership after mount.';
    if (!expectedGuard) {
      errors.push(error.message);
    }
  });
  await page.goto(reactUrl);
  await page.waitForFunction(() => Boolean(window.urkOwnershipTest));
});

test.afterEach(async ({ page }) => {
  expect(unexpectedErrors.get(page)).toEqual([]);
});

for (const ownership of ['legacy', 'provider'] as const) {
  test(`${ownership} ownership survives Strict Mode replay and cleans up once`, async ({ page }) => {
    await page.evaluate((mode) => {
      window.urkOwnershipTest.create({ id: 'runtime' });
      window.urkOwnershipTest.render([{ id: 'runtime', ownership: mode }], true);
    }, ownership);
    await expect.poll(() => report(page)).toMatchObject({
      startCompleted: 1, cancelled: false, schedulerRunning: true, frames: 1, intervals: 2,
    });
    expect((await report(page)).wrapperEvents).toEqual(['react-urk:boot-requested', 'react-urk:booted']);
    await page.evaluate(() => window.urkOwnershipTest.render([], true));
    await expectDisposed(page);
  });
}

for (const blocked of ['setup', 'start'] as const) {
  test(`unmount cancels deferred ${blocked} before settlement and prevents late activation`, async ({ page }) => {
    await page.evaluate((stage) => {
      window.urkOwnershipTest.create({ id: 'runtime', blocked: stage });
      window.urkOwnershipTest.render([{ id: 'runtime', ownership: 'provider' }]);
    }, blocked);
    await expect.poll(() => report(page)).toMatchObject(
      blocked === 'setup' ? { setupEntered: 1 } : { startEntered: 1 },
    );
    await page.evaluate(() => window.urkOwnershipTest.render([]));
    await expect.poll(() => report(page)).toMatchObject({ cancelled: true, disposals: 0, frames: 0 });
    await page.evaluate(() => window.urkOwnershipTest.release('runtime'));
    await expectDisposed(page);
    expect((await report(page)).wrapperEvents).not.toContain('react-urk:booted');
  });
}

test('external consumers never dispose their shared kernel', async ({ page }) => {
  await page.evaluate(() => {
    window.urkOwnershipTest.create({ id: 'runtime' });
    window.urkOwnershipTest.render([
      { id: 'runtime', key: 'first', ownership: 'external' },
      { id: 'runtime', key: 'second', ownership: 'external' },
    ]);
  });
  await expect.poll(() => report(page)).toMatchObject({ startCompleted: 1 });
  const subscriptions = (await report(page)).stateSubscriptions;
  await page.evaluate(() => window.urkOwnershipTest.render([
    { id: 'runtime', key: 'second', ownership: 'external' },
  ]));
  expect((await report(page)).stateSubscriptions).toBeLessThan(subscriptions);
  await page.evaluate(() => window.urkOwnershipTest.render([]));
  expect(await report(page)).toMatchObject({
    cancelled: false, disposals: 0, stateSubscriptions: 0, eventSubscriptions: 0,
    schedulerRunning: true, intervals: 1,
  });
  await page.evaluate(() => window.urkOwnershipTest.shutdown('runtime'));
  await expectDisposed(page);
});

test('a second explicit owner rejects while the first owner remains running', async ({ page }) => {
  await page.evaluate(() => {
    window.urkOwnershipTest.create({ id: 'runtime' });
    window.urkOwnershipTest.render([{ id: 'runtime', key: 'first', ownership: 'provider' }]);
  });
  await expect.poll(() => report(page)).toMatchObject({ startCompleted: 1 });
  await page.evaluate(() => window.urkOwnershipTest.render([
    { id: 'runtime', key: 'first', ownership: 'provider' },
    { id: 'runtime', key: 'second', ownership: 'provider' },
  ]));
  await expect(page.locator('[data-error]')).toHaveText('This kernel already has a provider cleanup owner.');
  expect(await report(page)).toMatchObject({ cancelled: false, disposals: 0, schedulerRunning: true });
  await page.evaluate(() => window.urkOwnershipTest.render([]));
  await expectDisposed(page);
});

test('ownership changes reject and release the original owner through normal unmount', async ({ page }) => {
  await page.evaluate(() => {
    window.urkOwnershipTest.create({ id: 'runtime' });
    window.urkOwnershipTest.render([{ id: 'runtime', ownership: 'provider' }]);
  });
  await expect.poll(() => report(page)).toMatchObject({ startCompleted: 1 });
  await page.evaluate(() => window.urkOwnershipTest.render([{ id: 'runtime', ownership: 'external' }]));
  await expect(page.locator('[data-error]')).toHaveText('UrkProvider does not support changing ownership after mount.');
  await expectDisposed(page);
});

for (const ownership of ['legacy', 'provider'] as const) {
  test(`${ownership} ownership survives reason and autoBoot changes`, async ({ page }) => {
    await page.evaluate((mode) => {
      window.urkOwnershipTest.create({ id: 'runtime' });
      window.urkOwnershipTest.render([{ id: 'runtime', ownership: mode }]);
    }, ownership);
    await expect.poll(() => report(page)).toMatchObject({ startCompleted: 1 });
    await page.evaluate((mode) => window.urkOwnershipTest.render([{
      id: 'runtime', ownership: mode, autoBoot: false, bootReason: 'changed', shutdownReason: 'changed',
    }]), ownership);
    expect(await report(page)).toMatchObject({ cancelled: false, disposals: 0, schedulerRunning: true });
    await page.evaluate(() => window.urkOwnershipTest.render([]));
    await expectDisposed(page);
  });
}

test('explicit ownership with autoBoot disabled still cleans an unbooted kernel', async ({ page }) => {
  await page.evaluate(() => {
    window.urkOwnershipTest.create({ id: 'runtime' });
    window.urkOwnershipTest.render([{ id: 'runtime', ownership: 'provider', autoBoot: false }]);
    window.urkOwnershipTest.render([]);
  });
  await expect.poll(() => report(page)).toMatchObject({
    cancelled: true, setupEntered: 0, startEntered: 0, disposals: 0,
    frames: 0, intervals: 0, stateSubscriptions: 0, eventSubscriptions: 0,
  });
});

for (const ownership of ['legacy', 'provider'] as const) {
  test(`${ownership} ownership boots once when autoBoot is enabled later`, async ({ page }) => {
    await page.evaluate((mode) => {
      window.urkOwnershipTest.create({ id: 'runtime' });
      window.urkOwnershipTest.render([{ id: 'runtime', ownership: mode, autoBoot: false }]);
    }, ownership);
    expect((await report(page)).setupEntered).toBe(0);
    await page.evaluate((mode) => window.urkOwnershipTest.render([
      { id: 'runtime', ownership: mode, autoBoot: true },
    ]), ownership);
    await expect.poll(() => report(page)).toMatchObject({ startCompleted: 1 });
    await page.evaluate((mode) => {
      window.urkOwnershipTest.render([{ id: 'runtime', ownership: mode, autoBoot: false }]);
      window.urkOwnershipTest.render([{ id: 'runtime', ownership: mode, autoBoot: true }]);
    }, ownership);
    expect((await report(page)).wrapperEvents).toEqual(['react-urk:boot-requested', 'react-urk:booted']);
    await page.evaluate(() => window.urkOwnershipTest.render([]));
    await expectDisposed(page);
  });
}

test('legacy ownership leaves an already booted kernel with its external host', async ({ page }) => {
  await page.evaluate(async () => {
    window.urkOwnershipTest.create({ id: 'runtime' });
    await window.urkOwnershipTest.boot('runtime');
    window.urkOwnershipTest.render([{ id: 'runtime' }]);
    window.urkOwnershipTest.render([]);
  });
  expect(await report(page)).toMatchObject({ cancelled: false, disposals: 0, schedulerRunning: true });
  await page.evaluate(() => window.urkOwnershipTest.shutdown('runtime'));
  await expectDisposed(page);
});

test('external unmount suppresses stale completion without cancelling host startup', async ({ page }) => {
  await page.evaluate(() => {
    window.urkOwnershipTest.create({ id: 'runtime', blocked: 'start' });
    window.urkOwnershipTest.render([{ id: 'runtime', ownership: 'external' }]);
  });
  await expect.poll(() => report(page)).toMatchObject({ startEntered: 1 });
  await page.evaluate(async () => {
    window.urkOwnershipTest.render([]);
    window.urkOwnershipTest.release('runtime');
    await window.urkOwnershipTest.boot('runtime');
  });
  expect((await report(page)).wrapperEvents).toEqual(['react-urk:boot-requested']);
  expect((await report(page)).cancelled).toBe(false);
  await page.evaluate(() => window.urkOwnershipTest.shutdown('runtime'));
  await expectDisposed(page);
});

test('snapshot identity follows revisions within one millisecond with stable subscriptions', async ({ page }) => {
  await page.evaluate(() => {
    window.urkOwnershipTest.create({ id: 'runtime' });
    window.urkOwnershipTest.render([{ id: 'runtime', ownership: 'provider' }]);
  });
  await expect.poll(() => report(page)).toMatchObject({ startCompleted: 1 });
  const before = await report(page);
  await page.evaluate(() => window.urkOwnershipTest.cycleSameTimestamp('runtime'));
  await expect.poll(async () => (await report(page)).snapshotVersion).toBeGreaterThan(before.snapshotVersion);
  const updated = await report(page);
  await page.evaluate(() => window.urkOwnershipTest.render([{
    id: 'runtime', ownership: 'provider', bootReason: 'changed',
  }]));
  expect(await report(page)).toMatchObject({
    snapshotVersion: updated.snapshotVersion, stateSubscriptionStarts: before.stateSubscriptionStarts,
  });
  await page.evaluate(() => window.urkOwnershipTest.render([]));
  await expectDisposed(page);
});

test('wrapper event observer exceptions cannot prevent boot or cancellation', async ({ page }) => {
  await page.evaluate(() => {
    window.urkOwnershipTest.create({ id: 'runtime' });
    window.urkOwnershipTest.throwObserver('runtime', 'react-urk:boot-requested');
    window.urkOwnershipTest.throwObserver('runtime', 'react-urk:shutdown-requested');
    window.urkOwnershipTest.render([{ id: 'runtime', ownership: 'provider' }]);
  });
  await expect.poll(() => report(page)).toMatchObject({ startCompleted: 1 });
  await page.evaluate(() => window.urkOwnershipTest.render([]));
  await expectDisposed(page);
});

test('Next navigation disposes the default owner and returning creates a fresh kernel', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => { errors.push(error.message); });
  await page.goto(nextUrl);
  await expect.poll(() => page.evaluate(() => window.urkNextOwnershipReports?.())).toEqual([
    expect.objectContaining({ startCompleted: 1, cancelled: false, frames: 1, intervals: 2 }),
  ]);
  await page.getByRole('link', { name: 'Leave runtime' }).click();
  await expect(page.getByRole('heading', { name: 'Runtime unmounted' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.urkNextOwnershipReports?.()[0])).toMatchObject({
    cancelled: true, disposals: 1, frames: 0, intervals: 0,
    ownedListeners: 0, stateSubscriptions: 0, eventSubscriptions: 0,
  });
  await page.getByRole('link', { name: 'Return to runtime' }).click();
  await expect.poll(() => page.evaluate(() => window.urkNextOwnershipReports?.())).toEqual([
    expect.objectContaining({ cancelled: true, disposals: 1 }),
    expect.objectContaining({ startCompleted: 1, cancelled: false, disposals: 0, frames: 1 }),
  ]);
  await page.getByRole('link', { name: 'Leave runtime' }).click();
  await expect.poll(() => page.evaluate(() => window.urkNextOwnershipReports?.()[1])).toMatchObject({
    cancelled: true, disposals: 1, frames: 0, intervals: 0,
    ownedListeners: 0, stateSubscriptions: 0, eventSubscriptions: 0,
  });
  expect(errors).toEqual([]);
});
