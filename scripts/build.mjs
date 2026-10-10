/**
 * Company: EonHive Inc.
 * Title: URK Workspace Build
 * Purpose: Build local dependencies once and run independent workspaces concurrently.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-08
 * Notes: Vibe coded with Codex.
 */

import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

export function parseArguments(args) {
  const options = { jobs: 2, preview: false, targets: [] };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--plan') {
      options.preview = true;
    } else if (argument === '--jobs' || argument.startsWith('--jobs=')) {
      const value = argument === '--jobs' ? args[++index] : argument.slice('--jobs='.length);
      if (!/^[1-9]\d*$/.test(value ?? '') || !Number.isSafeInteger(Number(value))) {
        throw new Error('--jobs requires a positive integer. Use --jobs 1 for sequential builds.');
      }
      options.jobs = Number(value);
    } else if (argument.startsWith('-')) {
      throw new Error(`Unknown build option: ${argument}`);
    } else {
      options.targets.push(argument);
    }
  }
  return options;
}

export function createBuildPlan(workspaces, targets = []) {
  const plan = new Map();
  const visiting = new Set();
  function visit(name) {
    if (plan.has(name)) return;
    const workspace = workspaces.get(name);
    if (!workspace) throw new Error(`Unknown workspace: ${name}`);
    if (visiting.has(name)) throw new Error(`Workspace dependency cycle: ${name}`);
    visiting.add(name);
    const declared = { ...workspace.dependencies, ...workspace.devDependencies, ...workspace.peerDependencies, ...workspace.optionalDependencies };
    const dependencies = Object.keys(declared).filter(dependency => workspaces.has(dependency));
    for (const dependency of dependencies) visit(dependency);
    visiting.delete(name);
    // Retain packages without build scripts so their transitive dependencies still gate consumers.
    plan.set(name, { dependencies, build: Boolean(workspace.scripts?.build) });
  }
  for (const name of targets.length ? targets : workspaces.keys()) visit(name);
  return plan;
}

export async function runBuilds(plan, { jobs, run }) {
  if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error('Build concurrency must be a positive integer.');
  const waiting = new Map(plan);
  const active = new Map();
  const completed = new Set();
  let failure;

  while (waiting.size || active.size) {
    if (!failure) {
      for (const [name, workspace] of waiting) {
        if (active.size >= jobs) break;
        if (!workspace.dependencies.every(dependency => completed.has(dependency))) continue;
        waiting.delete(name);
        if (!workspace.build) {
          completed.add(name);
          continue;
        }
        const task = Promise.resolve().then(() => run(name)).then(
          () => { completed.add(name); return name; },
          error => { failure ??= { error }; return name; },
        );
        active.set(name, task);
      }
    }
    if (!active.size) {
      if (failure) break;
      if (waiting.size) throw new Error('Build plan has unresolved dependencies.');
      break;
    }
    active.delete(await Promise.race(active.values()));
  }
  // Already-running builds finish before failure is reported; no child is abandoned writing output.
  if (failure) throw failure.error;
}

function buildWorkspace(name) {
  process.stdout.write(`Building ${name}\n`);
  return new Promise((resolveBuild, reject) => {
    const child = spawn('corepack', ['yarn', 'workspace', name, 'build'], { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolveBuild();
      } else {
        const reason = signal ? `signal ${signal}` : `exit code ${code}`;
        reject(Object.assign(new Error(`Build failed for ${name}: ${reason}`), { exitCode: code ?? 1 }));
      }
    });
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const workspaces = new Map(manifest.workspaces.map(path => {
    const data = JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8'));
    return [data.name, data];
  }));
  const plan = createBuildPlan(workspaces, options.targets);
  if (options.preview) {
    const order = [...plan].filter(([, workspace]) => workspace.build).map(([name]) => name);
    process.stdout.write(`${order.join('\n')}\n`);
    return;
  }
  await runBuilds(plan, { jobs: options.jobs, run: buildWorkspace });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = error?.exitCode || 1;
  });
}
