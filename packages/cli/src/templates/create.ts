/**
 * Company: EonHive Inc.
 * Title: Create Project Template
 * Purpose: Generate the standalone-first project files for `urk create <name>`.
 * Author: Stan Nesi
 * Created: 2026-05-03
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

import { toPascalCase } from '../utils/names.js';

export type CreateProjectTemplateOptions = {
  name: string;
  packageManager?: string;
  dependencyVersions: {
    core: string;
    adapters: string;
    typescript: string;
    vite: string;
  };
};

export type CreateProjectTemplateResult = {
  packageJson: Record<string, unknown>;
  files: Record<string, string>;
};

function createTitleFromName(name: string): string {
  return toPascalCase(name).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/**
 * Build the file map for the first standalone URK browser runtime scaffold.
 * The generated app stays explicit about kernel, adapters, controllers, phases, and services.
 */
export function createProjectTemplate(
  options: CreateProjectTemplateOptions,
): CreateProjectTemplateResult {
  const title = createTitleFromName(options.name);
  const createdAt = new Date().toISOString().slice(0, 10);
  const packageJson: Record<string, unknown> = {
    name: options.name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc --noEmit && vite build',
      preview: 'vite preview',
    },
    dependencies: {
      '@urk/core': options.dependencyVersions.core,
      '@urk/adapters': options.dependencyVersions.adapters,
    },
    devDependencies: {
      typescript: options.dependencyVersions.typescript,
      vite: options.dependencyVersions.vite,
    },
  };

  if (options.packageManager) {
    packageJson.packageManager = options.packageManager;
  }

  const files: Record<string, string> = {
    'README.md': `# ${title}

This project was created by \`urk create\`.

It demonstrates a standalone-first URK browser runtime with:

- one kernel created from \`@urk/core\`
- one small DOM adapter stack from \`@urk/adapters/dom\`
- real cancellable content loading, scoped subscriptions, and ordered phase commands
- an idle frame loop plus pause, resume, stop, and fresh-kernel controls
- one overlay host mounted through the \`ui:host\` service

## Run

\`\`\`bash
corepack enable
yarn install
yarn dev
\`\`\`

## Files

- \`index.html\` - static browser shell
- \`src/main.ts\` - DOM bootstrap and \`await kernel.boot()\`
- \`src/kernel.ts\` - kernel factory and service registration
- \`src/adapters.ts\` - dependency-light DOM adapter stack
- \`src/contracts.ts\` - the typed shell capability
- \`src/controllers/app.controller.ts\` - event-driven loading and interaction
- \`public/content.json\` - editable starter content
- \`src/styles.css\` - standalone browser styling
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "types": ["vite/client"],
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src", "vite.config.ts"]
}
`,
    'vite.config.ts': `/**
 * Company: EonHive Inc.
 * Title: Vite Config
 * Purpose: Keep the standalone URK starter on a minimal Vite browser build.
 * Author: Stan Nesi
 * Created: ${createdAt}
 * Updated: ${createdAt}
 * Notes: Vibe coded with Codex.
 */

import { defineConfig } from 'vite';

export default defineConfig({});
`,
    'index.html': `<!--
  Company: EonHive Inc.
  Title: ${title}
  Purpose: Mount the first standalone URK browser runtime scaffold.
  Author: Stan Nesi
  Created: ${createdAt}
  Updated: ${createdAt}
  Notes: Vibe coded with Codex.
-->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <main class="app-shell">
      <section class="app-panel">
        <span class="eyebrow">Standalone URK Runtime</span>
        <h1>${title}</h1>
        <p class="intro">
          This starter keeps the runtime explicit: one kernel, a small DOM adapter stack,
          one controller, typed services, and visible lifecycle and experience state.
        </p>

        <nav class="runtime-controls" aria-label="Runtime controls">
          <button type="button" data-action="pause" disabled>Pause</button>
          <button type="button" data-action="resume" disabled>Resume</button>
          <button type="button" data-action="stop">Stop</button>
          <button type="button" data-action="restart" disabled>Start fresh</button>
        </nav>
        <dl class="status-grid">
          <div class="status-card"><dt>Lifecycle</dt><dd data-role="lifecycle-value">created</dd></div>
          <div class="status-card"><dt>Frame loop</dt><dd data-role="loop-value">Idle</dd></div>
          <div class="status-card">
            <dt>Runtime phase</dt>
            <dd data-role="phase-value">boot</dd>
          </div>
          <div class="status-card">
            <dt>Phase reason</dt>
            <dd data-role="reason-value">kernel:init</dd>
          </div>
          <div class="status-card">
            <dt>Loading stage</dt>
            <dd data-role="stage-value">Waiting to start</dd>
          </div>
          <div class="status-card">
            <dt>Loading progress</dt>
            <dd data-role="progress-value">0%</dd>
          </div>
        </dl>

        <article class="phase-note">
          <h2>Canonical runtime phases</h2>
          <p data-role="phase-list">
            boot, loading, ready, transition, paused, error
          </p>
        </article>
      </section>

      <section class="app-stage">
        <article class="stage-card">
          <span class="stage-meta">Controller-managed shell</span>
          <h2 data-role="message-value">Waiting to boot</h2>
          <p data-role="detail-value">
            The controller will load content and connect input. The kernel rests when no frame work is needed.
          </p>
        </article>

        <div class="ui-host" data-role="ui-host"></div>
      </section>
    </main>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
    'src/main.ts': `/**
 * Company: EonHive Inc.
 * Title: App Entry
 * Purpose: Own the browser host and expose the URK lifecycle controls.
 * Author: Stan Nesi
 * Created: ${createdAt}
 * Updated: ${createdAt}
 * Notes: Vibe coded with Codex.
 */

import './styles.css';
import { ResourceScope, type Kernel } from '@urk/core';
import { createAppKernel } from './kernel';
import type { AppShell } from './contracts';

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(\`Missing element: \${selector}\`);
  return found;
}

const shell: AppShell = {
  phaseValue: element('[data-role="phase-value"]'),
  reasonValue: element('[data-role="reason-value"]'),
  stageValue: element('[data-role="stage-value"]'),
  progressValue: element('[data-role="progress-value"]'),
  messageValue: element('[data-role="message-value"]'),
  detailValue: element('[data-role="detail-value"]'),
};
const lifecycleValue = element<HTMLElement>('[data-role="lifecycle-value"]');
const loopValue = element<HTMLElement>('[data-role="loop-value"]');
const controls = element<HTMLElement>('.runtime-controls');
const uiHost = element<HTMLElement>('[data-role="ui-host"]');
const hostScope = new ResourceScope();
let kernel: Kernel;
let unsubscribeLifecycle = (): void => {};
let closed = false;

function renderLifecycle(): void {
  const state = kernel.getLifecycleSnapshot().state;
  lifecycleValue.textContent = state;
  loopValue.textContent = kernel.getContext().scheduler.isRunning() ? 'Running' : 'Idle';
  element<HTMLButtonElement>('[data-action="pause"]').disabled = state !== 'running';
  element<HTMLButtonElement>('[data-action="resume"]').disabled = state !== 'paused';
  element<HTMLButtonElement>('[data-action="stop"]').disabled = state === 'disposing' || state === 'disposed';
  element<HTMLButtonElement>('[data-action="restart"]').disabled = state !== 'disposed' && state !== 'failed';
}

function showError(error: unknown): void {
  shell.messageValue.textContent = 'Runtime error';
  shell.detailValue.textContent = error instanceof Error ? error.message : String(error);
}

async function start(): Promise<void> {
  if (closed) return;
  unsubscribeLifecycle();
  kernel = createAppKernel(shell, uiHost);
  const current = kernel;
  unsubscribeLifecycle = current.subscribeLifecycle(renderLifecycle);
  renderLifecycle();
  try {
    await kernel.boot();
  } catch (error) {
    if (closed || kernel !== current) return;
    // An explicit Stop is cancellation; a failed setup has already rendered its error phase.
    if (!current.getContext().signal.aborted || current.getState().phase === 'error') showError(error);
  }
}

const onAction = (event: Event): void => {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
  const action = target?.dataset.action;
  if (!action) return;
  const perform = async (): Promise<void> => {
    if (action === 'pause') kernel.pause();
    if (action === 'resume') kernel.resume();
    if (action === 'stop') await kernel.shutdown('host:stop');
    if (action === 'restart') {
      const previous = kernel;
      await previous.shutdown('host:restart');
      if (kernel === previous) await start();
    }
  };
  void perform().catch(showError);
};
controls.addEventListener('click', onAction);
hostScope.defer(() => controls.removeEventListener('click', onAction));
hostScope.defer(() => unsubscribeLifecycle());

function disposeHost(): void {
  if (closed) return;
  closed = true;
  void kernel.shutdown('host:dispose').catch(showError);
  void hostScope.dispose().catch(showError);
}
window.addEventListener('beforeunload', disposeHost, { once: true });
hostScope.defer(() => window.removeEventListener('beforeunload', disposeHost));
if (import.meta.hot) import.meta.hot.dispose(disposeHost);
void start();
`,
    'src/kernel.ts': `/**
 * Company: EonHive Inc.
 * Title: App Kernel
 * Purpose: Compose an inert v2 kernel with typed borrowed services.
 * Author: Stan Nesi
 * Created: ${createdAt}
 * Updated: ${createdAt}
 * Notes: Vibe coded with Codex.
 */

import { createKernel, type Kernel } from '@urk/core';
import { adapters } from './adapters';
import { AppShellCapability, type AppShell } from './contracts';
import { createAppController } from './controllers/app.controller';

export function createAppKernel(shell: AppShell, uiHost: HTMLElement): Kernel {
  return createKernel({
    frameMode: 'auto',
    adapterStartup: 'parallel',
    serviceBindings: [{ token: AppShellCapability, value: shell }],
    services: { 'ui:host': uiHost },
    adapters,
    controllers: [createAppController()],
  });
}
`,
    'src/contracts.ts': `/**
 * Company: EonHive Inc.
 * Title: Application Contracts
 * Purpose: Define the typed browser shell shared with the runtime.
 * Author: Stan Nesi
 * Created: ${createdAt}
 * Updated: ${createdAt}
 * Notes: Vibe coded with Codex.
 */

import { token } from '@urk/core';

export interface AppShell {
  phaseValue: HTMLElement;
  reasonValue: HTMLElement;
  stageValue: HTMLElement;
  progressValue: HTMLElement;
  messageValue: HTMLElement;
  detailValue: HTMLElement;
}

export const AppShellCapability = token<AppShell>('app:shell');
`,
    'public/content.json': `{
  "message": "Your URK v2 runtime is ready",
  "detail": "Press H for help. Pause, stop, and create a fresh kernel using the controls. Edit public/content.json to change this content."
}
`,
    'src/adapters.ts': `/**
 * Company: EonHive Inc.
 * Title: App Adapters
 * Purpose: Keep the standalone URK adapter stack explicit and dependency-light.
 * Author: Stan Nesi
 * Created: ${createdAt}
 * Updated: ${createdAt}
 * Notes: Vibe coded with Codex.
 */

import type { AdapterRegistration } from '@urk/core';
import {
  createInputAdapter,
  createLoadingAdapter,
  createUiWidgetsAdapter,
} from '@urk/adapters/dom';

/**
 * An adapter exposes one browser capability to the kernel behind a small API. This starter
 * stays standalone-first by importing only the DOM adapter entrypoint instead of any wrapper.
 */
export const adapters: Array<AdapterRegistration<unknown>> = [
  // Tracks staged progress so the controller can move the runtime from loading to ready.
  createLoadingAdapter(),
  // Normalizes browser keyboard input into one capability the controller can bind to.
  createInputAdapter(),
  // Mounts a tiny overlay status and callout UI into the shared ui:host service.
  createUiWidgetsAdapter(),
];
`,
    'src/controllers/app.controller.ts': `/**
 * Company: EonHive Inc.
 * Title: App Controller
 * Purpose: Load real content and own event-driven interaction without an idle frame loop.
 * Author: Stan Nesi
 * Created: ${createdAt}
 * Updated: ${createdAt}
 * Notes: Vibe coded with Codex.
 */

import { LoadingCapability, InputCapability, UiWidgetsCapability } from '@urk/adapters/dom';
import type { ControllerRegistration } from '@urk/core';
import { AppShellCapability } from '../contracts';

export function createAppController(): ControllerRegistration {
  return {
    id: 'app-controller',
    async start(ctx) {
      const shell = ctx.require(AppShellCapability);
      const loading = ctx.require(LoadingCapability);
      const input = ctx.require(InputCapability);
      const widgets = ctx.require(UiWidgetsCapability);
      ctx.scope.defer(loading.subscribe(snapshot => {
        shell.stageValue.textContent = snapshot.stageLabel ?? 'Ready';
        shell.progressValue.textContent = \`\${Math.round(snapshot.progress * 100)}%\`;
      }));
      loading.begin([
        { id: 'content', label: 'Load content' },
        { id: 'interaction', label: 'Connect input' },
      ]);
      shell.messageValue.textContent = 'Loading your content';
      shell.detailValue.textContent = 'The request is cancelled if this runtime stops.';

      const response = await fetch(new URL('content.json', document.baseURI), { signal: ctx.signal });
      if (!response.ok) throw new Error(\`Content request failed: \${response.status}\`);
      const content: unknown = await response.json();
      ctx.signal.throwIfAborted();
      if (!content || typeof content !== 'object' ||
          !('message' in content) || typeof content.message !== 'string' ||
          !('detail' in content) || typeof content.detail !== 'string') {
        throw new Error('Content must contain message and detail strings.');
      }
      loading.setStage('content', 1);
      shell.messageValue.textContent = content.message;
      shell.detailValue.textContent = content.detail;
      ctx.scope.defer(input.bindKey({
        code: 'KeyH',
        handler(event) {
          if (event.ctrlKey || event.metaKey || event.altKey || ctx.state.getSnapshot().phase === 'paused') return;
          widgets.showCallout({ title: 'URK v2', body: 'Typed capabilities, scoped cleanup, and an idle frame loop.', tone: 'active' });
        },
      }));
      loading.setStage('interaction', 1);
      loading.complete('Ready');
      await ctx.state.transition('ready', 'app:loaded');
    },
    onStateChange(next, _previous, ctx) {
      const shell = ctx.require(AppShellCapability);
      shell.phaseValue.textContent = next.phase;
      shell.reasonValue.textContent = next.reason ?? 'No reason provided';
      ctx.get(UiWidgetsCapability)?.setStatus(\`Experience: \${next.phase}\`);
    },
    dispose(ctx) {
      const shell = ctx.require(AppShellCapability);
      shell.messageValue.textContent = 'Runtime stopped';
      shell.detailValue.textContent = 'Owned subscriptions have been released. Start fresh to create another kernel.';
    },
  };
}
`,
    'src/styles.css': `/**
 * Company: EonHive Inc.
 * Title: App Styles
 * Purpose: Style the standalone URK browser scaffold without introducing framework dependencies.
 * Author: Stan Nesi
 * Created: ${createdAt}
 * Updated: ${createdAt}
 * Notes: Vibe coded with Codex.
 */

:root {
  color-scheme: light;
  font-family: "Avenir Next", "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.14), transparent 36%),
    radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.1), transparent 28%),
    #f3f6fb;
  color: #102033;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: inherit;
}

.app-shell {
  min-height: 100vh;
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: 24px;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 360px) minmax(0, 1fr);
}

.app-panel,
.app-stage {
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(14px);
}

.app-panel {
  padding: 24px;
  display: grid;
  gap: 18px;
  align-content: start;
}

.app-stage {
  position: relative;
  min-height: 520px;
  overflow: hidden;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.12), transparent 38%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.03), rgba(15, 23, 42, 0.07)),
    #f8fafc;
}

.eyebrow,
.stage-meta {
  display: inline-flex;
  width: max-content;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.8);
  color: #102033;
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.app-panel h1,
.stage-card h2,
.phase-note h2 {
  margin: 0;
  font-family: "Trebuchet MS", "Avenir Next", sans-serif;
  letter-spacing: -0.04em;
  color: #0f172a;
}

.app-panel h1 {
  font-size: clamp(2rem, 5vw, 3.5rem);
  line-height: 0.96;
}

.intro,
.stage-card p,
.phase-note p {
  margin: 0;
  color: #475569;
  line-height: 1.65;
}

.runtime-controls { display: flex; flex-wrap: wrap; gap: 8px; }
.runtime-controls button { padding: 9px 13px; border: 1px solid #cbd5e1; border-radius: 10px; background: white; color: #102033; font: inherit; cursor: pointer; }
.runtime-controls button:disabled { opacity: 0.45; cursor: default; }
.runtime-controls button:focus-visible { outline: 2px solid #0284c7; outline-offset: 2px; }

.status-grid {
  margin: 0;
  display: grid;
  gap: 12px;
}

.status-card,
.stage-card,
.phase-note {
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: #f8fafc;
}

.status-card {
  padding: 14px 16px;
}

.status-card dt {
  margin-bottom: 6px;
  font-size: 0.78rem;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #64748b;
}

.status-card dd {
  margin: 0;
  font-size: 1rem;
  line-height: 1.4;
  color: #0f172a;
}

.phase-note {
  padding: 16px;
  display: grid;
  gap: 10px;
}

.phase-note h2 {
  font-size: 1rem;
}

.stage-card {
  width: min(560px, 100%);
  padding: 22px;
  display: grid;
  gap: 14px;
}

.stage-card h2 {
  font-size: clamp(1.6rem, 4vw, 2.6rem);
}

.ui-host {
  position: absolute;
  inset: 0;
}

@media (max-width: 860px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .app-stage {
    min-height: 420px;
  }
}
`,
  };

  if (options.packageManager?.startsWith('yarn@')) {
    files['yarn.lock'] = '';
  }

  return {
    packageJson,
    files,
  };
}
