/**
 * Company: EonHive Inc.
 * Title: Workspace Build Contract
 * Purpose: Verify dependency barriers, bounded concurrency, and complete failure handling.
 * Author: Stan Nesi
 * Created: 2026-10-08
 * Updated: 2026-10-08
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBuildPlan, parseArguments, runBuilds } from './build.mjs';

function workspace(dependencies = {}, extra = {}) {
  return { scripts: { build: 'build' }, dependencies, ...extra };
}

function gate() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('plans requested dependencies once, including transitive packages without build scripts', () => {
  const workspaces = new Map([
    ['app', workspace({ bridge: '*', shared: '*' }, { devDependencies: { tools: '*' } })],
    ['bridge', { peerDependencies: { shared: '*' }, optionalDependencies: { optional: '*' } }],
    ['shared', workspace()], ['tools', workspace()], ['optional', workspace()], ['unrelated', workspace()],
  ]);
  const plan = createBuildPlan(workspaces, ['app', 'shared']);
  assert.deepEqual([...plan.keys()], ['shared', 'optional', 'bridge', 'tools', 'app']);
  assert.equal(plan.get('bridge').build, false);
  assert.deepEqual(plan.get('app').dependencies, ['bridge', 'shared', 'tools']);
  assert.throws(() => createBuildPlan(workspaces, ['missing']), /Unknown workspace/);
  workspaces.set('shared', workspace({ app: '*' }));
  assert.throws(() => createBuildPlan(workspaces, ['app']), /dependency cycle/);
});

test('runs independent builds together and releases each consumer as soon as its dependencies finish', async () => {
  const plan = createBuildPlan(new Map([
    ['app', workspace({ fast: '*' })], ['fast', workspace()], ['slow', workspace()],
    ['final', workspace({ app: '*', slow: '*' })],
  ]));
  const gates = new Map([...plan.keys()].map(name => [name, gate()]));
  const started = [];
  const result = runBuilds(plan, { jobs: 2, run(name) {
    started.push(name);
    return gates.get(name).promise;
  } });
  await nextTurn();
  assert.deepEqual(started, ['fast', 'slow']);
  gates.get('fast').resolve();
  await nextTurn();
  assert.deepEqual(started, ['fast', 'slow', 'app']);
  gates.get('app').resolve();
  await nextTurn();
  assert.equal(started.includes('final'), false);
  gates.get('slow').resolve();
  await nextTurn();
  assert.equal(started.at(-1), 'final');
  gates.get('final').resolve();
  await result;
});

test('bounds concurrency and supports sequential execution', async () => {
  const plan = createBuildPlan(new Map(['a', 'b', 'c', 'd'].map(name => [name, workspace()])));
  for (const jobs of [1, 2]) {
    let active = 0;
    let peak = 0;
    const started = [];
    await runBuilds(plan, { jobs, async run(name) {
      started.push(name);
      peak = Math.max(peak, ++active);
      await nextTurn();
      active--;
    } });
    assert.equal(peak, jobs);
    assert.deepEqual(started, ['a', 'b', 'c', 'd']);
  }
});

test('failure stops admission and waits for already-running siblings before rejecting', async () => {
  const plan = createBuildPlan(new Map([
    ['failed', workspace()], ['running', workspace()], ['queued', workspace({ failed: '*' })],
    ['independent', workspace()],
  ]));
  const failed = gate();
  const running = gate();
  const started = [];
  const failure = new Error('Compiler rejected the source');
  let finished = false;
  const result = runBuilds(plan, { jobs: 2, run(name) {
    started.push(name);
    return name === 'failed' ? failed.promise : running.promise;
  } });
  const checked = assert.rejects(result, error => error === failure).then(() => { finished = true; });
  await nextTurn();
  failed.reject(failure);
  await nextTurn();
  assert.equal(finished, false);
  assert.deepEqual(started, ['failed', 'running']);
  running.resolve();
  await checked;
  assert.deepEqual(started, ['failed', 'running']);
});

test('scriptless packages preserve dependency barriers and never start commands', async () => {
  const plan = createBuildPlan(new Map([
    ['app', workspace({ bridge: '*' })], ['bridge', { dependencies: { library: '*' } }],
    ['library', workspace()],
  ]));
  const events = [];
  await runBuilds(plan, { jobs: 2, async run(name) { events.push(name); } });
  assert.deepEqual(events, ['library', 'app']);
  await assert.rejects(runBuilds(plan, { jobs: 0, run() {} }), /positive integer/);
});

test('keeps target/plan arguments and validates explicit job limits before starting', () => {
  assert.deepEqual(parseArguments(['--plan', '@urk/www']), { jobs: 2, preview: true, targets: ['@urk/www'] });
  assert.equal(parseArguments(['--jobs', '1']).jobs, 1);
  assert.equal(parseArguments(['@urk/core', '--jobs=3']).jobs, 3);
  for (const args of [['--jobs'], ['--jobs=0'], ['--jobs=-1'], ['--jobs=1.5'], ['--jobs=Infinity'], ['--unknown']]) {
    assert.throws(() => parseArguments(args));
  }
});
