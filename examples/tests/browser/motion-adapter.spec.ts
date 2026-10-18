/**
 * Company: EonHive Inc. | Title: Public Motion Browser Contract
 * Purpose: Verify real native playback controls, stable styling, and scoped cleanup.
 * Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-14
 * Notes: Vibe coded with Codex.
 */
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

test('public motion preserves UI styling, individual pause, and terminal cleanup in a browser', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}/`);
  const result = await page.evaluate(async urls => {
    const { createKernel, ResourceScope, ManualFrameScheduler } = await import(urls.core);
    const { createMotionAdapter, MotionCapability } = await import(urls.motion);
    const scheduler = new ManualFrameScheduler();
    const kernel = createKernel({ frameMode: 'auto', scheduler, adapters: [createMotionAdapter()] });
    await kernel.boot();
    const scope = new ResourceScope();
    const motion = kernel.getContext().require(MotionCapability).scoped(scope);
    const element = document.createElement('div');
    element.style.opacity = '0.65';
    element.style.transform = 'translateX(5px)';
    element.textContent = 'Motion probe';
    document.body.append(element);
    const frames = [{ opacity: 0.1, transform: 'translateX(20px)' }, { opacity: 1, transform: 'none' }];
    const playback = motion.animate(element, frames, { durationMs: 1000 });
    const native = element.getAnimations()[0];
    playback.pause();
    await native.ready;
    const time = native.currentTime;
    motion.pause();
    motion.resume();
    await new Promise(resolve => setTimeout(resolve, 80));
    const stayedPaused = native.playState === 'paused' && time === native.currentTime;
    playback.resume();
    await native.ready;
    const resumed = native.playState === 'running';
    playback.finish();
    const completed = await playback.finished;
    playback.resume();
    const released = element.getAnimations().length === 0;
    const stableOpacity = getComputedStyle(element).opacity;
    const stableTransform = element.style.transform;

    const natural = motion.animate(element, frames, { durationMs: 20 });
    const naturalResult = await natural.finished;
    const previous = motion.animate(element, frames, { durationMs: 1000 });
    const next = motion.animate(element, frames, { durationMs: 1000 });
    const replacement = await previous.finished;
    next.cancel('navigation');
    const cancelled = await next.finished;
    const pending = motion.animate(element, frames, { durationMs: 1000 });
    await scope.dispose();
    const disposed = await pending.finished;
    const activeCount = motion.activeCount;
    const idle = !scheduler.isRunning();
    const effects = element.getAnimations().length;
    await kernel.shutdown();
    element.remove();
    return { stayedPaused, resumed, completed, released, stableOpacity, stableTransform,
      naturalResult, replacement, cancelled, disposed, activeCount, idle, effects };
  }, {
    core: `/@fs${fileURLToPath(new URL('../../../packages/core/dist/index.js', import.meta.url))}`,
    motion: `/@fs${fileURLToPath(new URL('../../../packages/adapters/dist/motion/index.js', import.meta.url))}`,
  });
  expect(result).toEqual({
    stayedPaused: true,
    resumed: true,
    completed: { status: 'completed' },
    released: true,
    stableOpacity: '0.65',
    stableTransform: 'translateX(5px)',
    naturalResult: { status: 'completed' },
    replacement: { status: 'cancelled', reason: 'replaced' },
    cancelled: { status: 'cancelled', reason: 'navigation' },
    disposed: { status: 'cancelled', reason: 'owner-disposed' },
    activeCount: 0,
    idle: true,
    effects: 0,
  });
  expect(errors).toEqual([]);
});
