/**
 * Company: EonHive Inc.
 * Title: URK Architecture Comparison
 * Purpose: Compare saved core builds on identical startup, dispatch, and lookup workloads.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { resolve, join, relative } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  throw new Error('Usage: node benchmarks/architecture.mjs <before-dist> <after-dist>');
}

const warmups = 3;
const runs = 11;
const builds = [];
for (const [label, path] of [['before', beforePath], ['after', afterPath]]) {
  const directory = resolve(path);
  builds.push({ label, core: await import(pathToFileURL(join(directory, 'index.js')).href),
    sha256: await hashBuild(directory) });
}

const workloads = [
  ...[1000, 5000].map(count => ({ name: `boot-${count}-updaters`, create(core) {
    const kernel = core.createKernel({ scheduler: new core.ManualFrameScheduler(),
      controllers: Array.from({ length: count }, (_, index) => ({ id: String(index), update() {} })),
    });
    return { run: () => kernel.boot(), verify() {
      assert.equal(kernel.getContext().controllers.getActiveUpdateCount(), count);
    }, close: () => kernel.shutdown() };
  } })),
  ...[1, 100].map(every => ({ name: `dispatch-1000-controllers-every-${every}`, async create(core) {
    const scheduler = new core.ManualFrameScheduler();
    let updates = 0;
    const kernel = core.createKernel({ scheduler, frameMode: 'auto',
      controllers: Array.from({ length: 1000 }, (_, index) => ({ id: String(index),
        update: index % every === 0 ? () => { updates++; } : undefined,
      })),
    });
    await kernel.boot();
    return { run() {
      for (let frame = 0; frame < 10000; frame++) scheduler.step(frame * 16);
    }, verify() { assert.equal(updates, 10000 * (1000 / every)); }, close: () => kernel.shutdown() };
  } })),
  ...['token', 'alias'].map(kind => ({ name: `lookup-${kind}-100-providers`, async create(core) {
    const tokens = Array.from({ length: 100 }, (_, index) => core.token(`api-${index}`));
    const kernel = core.createKernel({ frameMode: 'auto', adapters: tokens.map((token, index) => ({
      id: `adapter-${index}`, capability: `api-${index}`, token, setup: () => index,
    })) });
    await kernel.boot();
    const ctx = kernel.getContext();
    const keys = kind === 'token' ? tokens : tokens.map(token => token.name);
    let sum = 0;
    return { run() {
      for (let index = 0; index < 1000000; index++) sum += ctx.require(keys[index % keys.length]);
    }, verify() { assert.equal(sum, 49500000); }, close: () => kernel.shutdown() };
  } })),
];

const cases = [];
for (const workload of workloads) {
  const samples = { before: [], after: [] };
  for (let run = -warmups; run < runs; run++) {
    // Alternate which build runs first to reduce systematic warmup/order bias.
    for (const build of run % 2 === 0 ? builds : [...builds].reverse()) {
      const fixture = await workload.create(build.core);
      try {
        const start = performance.now();
        await fixture.run();
        const elapsed = performance.now() - start;
        fixture.verify();
        if (run >= 0) samples[build.label].push(elapsed);
      } finally {
        await fixture.close();
      }
    }
  }
  cases.push({ workload: workload.name, before: summarize(samples.before), after: summarize(samples.after) });
}

process.stdout.write(`${JSON.stringify({
  measuredAt: new Date().toISOString(), node: process.version,
  os: `${platform()} ${release()}`, cpu: cpus()[0]?.model,
  builds: builds.map(({ label, sha256 }) => ({ label, sha256 })),
  protocol: { warmups, runs, order: 'alternating', diagnostics: 'off', scheduler: 'manual',
    timing: 'fixture construction and cleanup excluded; all boot hooks included for startup cases' },
  cases,
}, null, 2)}\n`);

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { medianMs: sorted[Math.floor(sorted.length / 2)], maxMs: sorted.at(-1), samplesMs: values };
}

async function hashBuild(directory) {
  const hash = createHash('sha256');
  async function visit(path) {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.name.endsWith('.js')) {
        hash.update(relative(directory, file));
        hash.update(await readFile(file));
      }
    }
  }
  await visit(directory);
  return hash.digest('hex');
}
