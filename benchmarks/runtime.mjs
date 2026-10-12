/**
 * Company: EonHive Inc.
 * Title: URK Runtime Measurement
 * Purpose: Compare continuous and automatic frame dispatch on repeatable local workloads.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-11
 * Notes: Vibe coded with Codex.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { cpus, platform, release } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createKernel, ManualFrameScheduler } from '../packages/core/dist/index.js';

const steps = 5000;
const runs = 7;
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const workingChanges = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
const coreDirectory = fileURLToPath(new URL('../packages/core/dist/', import.meta.url));
const digest = createHash('sha256');
for (const file of readdirSync(coreDirectory, { recursive: true }).filter(file => file.endsWith('.js')).sort()) {
  digest.update(file).update(readFileSync(`${coreDirectory}${file}`));
}
const coreBuildSha256 = digest.digest('hex');
const cases = [];
for (const count of [0, 10, 100, 1000]) {
  for (const frameMode of ['continuous', 'auto']) {
    const samples = [];
    const bootSamples = [];
    let dispatchedFrames = 0;
    for (let run = -2; run < runs; run++) {
      const scheduler = new ManualFrameScheduler();
      const kernel = createKernel({ scheduler, frameMode,
        controllers: Array.from({ length: count }, (_, index) => ({ id: String(index), update() {} })),
      });
      const bootStart = performance.now();
      await kernel.boot();
      const bootMs = performance.now() - bootStart;
      const start = performance.now();
      for (let step = 0; step < steps; step++) scheduler.step(step * 16);
      const elapsed = performance.now() - start;
      dispatchedFrames = kernel.getInspector().getSnapshot().frameCount;
      await kernel.shutdown();
      if (run >= 0) { samples.push(elapsed); bootSamples.push(bootMs); }
    }
    samples.sort((a, b) => a - b);
    bootSamples.sort((a, b) => a - b);
    cases.push({ controllers: count, frameMode, dispatchedFrames,
      medianMs: Number(samples[3].toFixed(3)), maxMs: Number(samples[6].toFixed(3)),
      bootMedianMs: Number(bootSamples[3].toFixed(3)), bootSamplesMs: bootSamples, dispatchSamplesMs: samples });
  }
}
process.stdout.write(`${JSON.stringify({
  measuredAt: new Date().toISOString(),
  node: process.version,
  os: `${platform()} ${release()}`,
  cpu: cpus()[0]?.model,
  head,
  workingChanges,
  coreBuildSha256,
  protocol: { steps, measuredRuns: runs, warmupRuns: 2, diagnostics: 'off', scheduler: 'manual', startup: 'complete boot; construction and cleanup excluded' },
  comparison: 'frame modes within the v0.2 working tree; no historical v0.1 baseline or GPU/rendering measurement',
  cases,
}, null, 2)}\n`);
