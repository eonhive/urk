/**
 * Company: EonHive Inc. | Title: Widget Timing Contracts
 * Purpose: Check independent timing configuration, invalid patches, and finite bounds.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(
  new URL('../../packages/examples/src/motion-widget/timing.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
}).outputText;
const { defaultWidgetTiming, resolveWidgetTiming, widgetDurationMs } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('partial timing patches are independent of other instances and caller mutations', () => {
  const first = resolveWidgetTiming();
  const second = resolveWidgetTiming();
  const patch = { entranceMs: 1200 };
  const next = resolveWidgetTiming(patch, first);
  patch.entranceMs = 9000;
  assert.deepEqual(next, { entranceMs: 1200, staggerMs: 140, revealMs: 320 });
  assert.deepEqual(first, { entranceMs: 700, staggerMs: 140, revealMs: 320 });
  assert.deepEqual(second, first);
  next.staggerMs = 500;
  assert.equal(second.staggerMs, 140);
  assert.equal(defaultWidgetTiming.staggerMs, 140);
  assert.equal(Object.isFrozen(defaultWidgetTiming), true);
});

test('invalid patches reject atomically, including non-finite values and unknown fields', () => {
  const previous = resolveWidgetTiming();
  for (const key of ['entranceMs', 'staggerMs', 'revealMs']) {
    for (const value of [-1, NaN, Infinity, -Infinity, 10001, 0.5, undefined, '100']) {
      assert.throws(() => resolveWidgetTiming({ [key]: value }, previous), RangeError);
    }
  }
  assert.throws(
    () => resolveWidgetTiming({ entranceMs: 100, staggerMs: NaN }, previous),
    RangeError,
  );
  assert.throws(() => resolveWidgetTiming({ durationMs: 100 }, previous), TypeError);
  assert.deepEqual(previous, { entranceMs: 700, staggerMs: 140, revealMs: 320 });
});

test('zero timing and the maximum configuration have finite total duration', () => {
  assert.equal(widgetDurationMs(resolveWidgetTiming()), 1300);
  assert.equal(
    widgetDurationMs(resolveWidgetTiming({ entranceMs: 0, staggerMs: 0, revealMs: 0 })),
    0,
  );
  assert.equal(
    widgetDurationMs(resolveWidgetTiming({ entranceMs: 10000, staggerMs: 10000, revealMs: 10000 })),
    40000,
  );
});
