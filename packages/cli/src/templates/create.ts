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
- one controller that moves the runtime from \`loading\` to \`ready\`
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
- \`src/controllers/app.controller.ts\` - one controller with the full lifecycle hooks
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
 * Created: 2026-05-03
 * Updated: 2026-05-03
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
  Created: 2026-05-03
  Updated: 2026-05-03
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
          one controller, named services, and visible runtime phases.
        </p>

        <dl class="status-grid">
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
            The app controller will begin staged loading, warm the DOM adapters, and move the
            runtime into the ready phase.
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
 * Purpose: Boot the standalone URK kernel into a small browser shell.
 * Author: Stan Nesi
 * Created: 2026-05-03
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

import './styles.css';
import { CANONICAL_RUNTIME_PHASES, createAppKernel, type AppKernelElements } from './kernel';

function assertElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(\`Missing required DOM element: \${selector}\`);
  }

  return element;
}

const elements: AppKernelElements = {
  phaseValue: assertElement<HTMLElement>('[data-role="phase-value"]'),
  reasonValue: assertElement<HTMLElement>('[data-role="reason-value"]'),
  stageValue: assertElement<HTMLElement>('[data-role="stage-value"]'),
  progressValue: assertElement<HTMLElement>('[data-role="progress-value"]'),
  messageValue: assertElement<HTMLElement>('[data-role="message-value"]'),
  detailValue: assertElement<HTMLElement>('[data-role="detail-value"]'),
  uiHost: assertElement<HTMLElement>('[data-role="ui-host"]'),
};

assertElement<HTMLElement>('[data-role="phase-list"]').textContent =
  CANONICAL_RUNTIME_PHASES.join(', ');

const kernel = createAppKernel(elements);

window.addEventListener(
  'beforeunload',
  () => {
    void kernel.shutdown('window:unload');
  },
  { once: true },
);

async function bootRuntime(): Promise<void> {
  try {
    await kernel.boot();
  } catch (runtimeError) {
    elements.messageValue.textContent = 'Kernel boot failed';
    elements.detailValue.textContent =
      runtimeError instanceof Error ? runtimeError.message : 'Unexpected runtime failure';
    throw runtimeError;
  }
}

void bootRuntime();
`,
    'src/kernel.ts': `/**
 * Company: EonHive Inc.
 * Title: App Kernel
 * Purpose: Create the standalone URK kernel and register named services for the browser shell.
 * Author: Stan Nesi
 * Created: 2026-05-03
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

import { createKernel, type Kernel, type RuntimePhase } from '@urk/core';
import { adapters } from './adapters';
import { appController } from './controllers/app.controller';

export type AppShellService = {
  phaseValue: HTMLElement;
  reasonValue: HTMLElement;
  stageValue: HTMLElement;
  progressValue: HTMLElement;
  messageValue: HTMLElement;
  detailValue: HTMLElement;
};

export type AppKernelElements = AppShellService & {
  uiHost: HTMLElement;
};

export const CANONICAL_RUNTIME_PHASES: RuntimePhase[] = [
  'boot',
  'loading',
  'ready',
  'transition',
  'paused',
  'error',
];

/**
 * A kernel is the root URK runtime object. It owns lifecycle, runtime phases, adapters,
 * controllers, shared services, and the update loop for a browser experience.
 */
export function createAppKernel(elements: AppKernelElements): Kernel {
  /**
   * A service is any named shared value the runtime can look up later. This starter shares
   * one shell object for controller-driven DOM updates plus the special ui:host element.
   */
  const shellService: AppShellService = {
    phaseValue: elements.phaseValue,
    reasonValue: elements.reasonValue,
    stageValue: elements.stageValue,
    progressValue: elements.progressValue,
    messageValue: elements.messageValue,
    detailValue: elements.detailValue,
  };

  return createKernel({
    services: {
      'app:shell': shellService,
      /**
       * ui:host is the HTMLElement the ui-widgets adapter mounts into. It gives overlay
       * widgets one explicit browser host instead of letting adapters attach anywhere.
       */
      'ui:host': elements.uiHost,
    },
    adapters,
    controllers: [appController],
  });
}
`,
    'src/adapters.ts': `/**
 * Company: EonHive Inc.
 * Title: App Adapters
 * Purpose: Keep the standalone URK adapter stack explicit and dependency-light.
 * Author: Stan Nesi
 * Created: 2026-05-03
 * Updated: 2026-05-03
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
 * Purpose: Orchestrate the first standalone URK loading flow and browser shell updates.
 * Author: Stan Nesi
 * Created: 2026-05-03
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

import type {
  InputAdapterApi,
  LoadingAdapterApi,
  LoadingSnapshot,
  UiWidgetsAdapterApi,
} from '@urk/adapters/dom';
import type {
  ControllerRegistration,
  FrameInfo,
  RuntimeContext,
  RuntimeSnapshot,
} from '@urk/core';
import type { AppShellService } from '../kernel';

const STAGES = [
  { id: 'connect-shell', label: 'Connect Browser Shell' },
  { id: 'sync-capabilities', label: 'Sync DOM Capabilities' },
  { id: 'activate-ready', label: 'Activate Ready Runtime' },
] as const;

const CONNECT_SHELL_DURATION_MS = 700;
const SYNC_CAPABILITIES_DURATION_MS = 900;
const ACTIVATE_READY_DURATION_MS = 800;

function getShell(ctx: RuntimeContext): AppShellService {
  return ctx.services.require<AppShellService>('app:shell');
}

function renderPhase(snapshot: RuntimeSnapshot, ctx: RuntimeContext): void {
  const shell = getShell(ctx);

  /**
   * A runtime phase is the explicit state the kernel is in right now. URK keeps phases named
   * and visible so shells and tools can explain what the runtime is doing at any moment.
   */
  shell.phaseValue.textContent = snapshot.phase;
  shell.reasonValue.textContent = snapshot.reason ?? 'No reason provided';
}

function renderLoading(snapshot: LoadingSnapshot, ctx: RuntimeContext): void {
  const shell = getShell(ctx);

  shell.stageValue.textContent = snapshot.stageLabel ?? 'Waiting to start';
  shell.progressValue.textContent = \`\${Math.round(snapshot.progress * 100)}%\`;
}

function renderMessage(message: string, detail: string, ctx: RuntimeContext): void {
  const shell = getShell(ctx);

  shell.messageValue.textContent = message;
  shell.detailValue.textContent = detail;
}

export const appController: ControllerRegistration = (() => {
  /**
   * A controller is the runtime orchestration unit in URK. It reads adapters, reacts to
   * state changes, and decides what the standalone experience should do over time.
   */
  let elapsedMs = 0;
  let completed = false;
  let unbindHelpKey: (() => void) | null = null;

  return {
    id: 'app-controller',
    init(ctx) {
      renderPhase(ctx.state.getSnapshot(), ctx);
      renderMessage(
        'Booting the kernel',
        'The kernel is creating runtime context, services, and the first controller lifecycle pass.',
        ctx,
      );
    },
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const input = ctx.adapters.require<InputAdapterApi>('input');
      const widgets = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      loading.begin([...STAGES], 'Booting the standalone URK runtime');
      renderLoading(loading.getSnapshot(), ctx);
      renderMessage(
        'Starting staged loading',
        'The controller is warming the browser shell and the DOM adapter stack.',
        ctx,
      );

      widgets.setStatus('Phase: loading');
      widgets.showCallout({
        title: 'Keyboard help',
        body: 'Press H at any time to reopen this help overlay.',
        tone: 'active',
      });

      unbindHelpKey = input.bindKey({
        code: 'KeyH',
        handler() {
          widgets.showCallout({
            title: 'URK Starter',
            body: 'This starter is driven by one kernel, three DOM adapters, one controller, and explicit runtime phases.',
            tone: 'active',
          });
        },
      });
    },
    update(frame: FrameInfo, ctx) {
      if (completed) {
        return;
      }

      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const widgets = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');
      const deltaMs = frame.deltaMs === 0 ? 16 : frame.deltaMs;

      elapsedMs += deltaMs;

      if (elapsedMs < CONNECT_SHELL_DURATION_MS) {
        loading.setStage(
          'connect-shell',
          elapsedMs / CONNECT_SHELL_DURATION_MS,
          'Connecting shell services and the dedicated overlay host',
        );
        renderLoading(loading.getSnapshot(), ctx);
        renderMessage(
          'Connecting browser services',
          'Named services make the DOM shell explicit instead of hidden inside a framework wrapper.',
          ctx,
        );
        return;
      }

      if (elapsedMs < CONNECT_SHELL_DURATION_MS + SYNC_CAPABILITIES_DURATION_MS) {
        loading.setStage(
          'sync-capabilities',
          (elapsedMs - CONNECT_SHELL_DURATION_MS) / SYNC_CAPABILITIES_DURATION_MS,
          'Warming the loading, input, and ui-widgets browser capabilities',
        );
        renderLoading(loading.getSnapshot(), ctx);
        renderMessage(
          'Syncing DOM capabilities',
          'Adapters are the bridge from raw browser APIs into small reusable runtime capabilities.',
          ctx,
        );
        return;
      }

      if (
        elapsedMs <
        CONNECT_SHELL_DURATION_MS + SYNC_CAPABILITIES_DURATION_MS + ACTIVATE_READY_DURATION_MS
      ) {
        loading.setStage(
          'activate-ready',
          (elapsedMs - CONNECT_SHELL_DURATION_MS - SYNC_CAPABILITIES_DURATION_MS) /
            ACTIVATE_READY_DURATION_MS,
          'Moving the runtime from loading into ready',
        );
        renderLoading(loading.getSnapshot(), ctx);
        renderMessage(
          'Activating ready runtime',
          'The controller is about to complete loading and set the runtime phase to ready.',
          ctx,
        );
        return;
      }

      loading.complete('Standalone runtime ready');
      renderLoading(loading.getSnapshot(), ctx);
      renderMessage(
        'Runtime ready',
        'The kernel is now in the ready phase and the overlay host is available for runtime UI.',
        ctx,
      );
      widgets.setStatus('Phase: ready');
      ctx.state.setPhase('ready', 'app:ready');
      completed = true;
    },
    onStateChange(next: RuntimeSnapshot, _previous: RuntimeSnapshot, ctx) {
      const widgets = ctx.adapters.get<UiWidgetsAdapterApi>('ui-widgets');

      renderPhase(next, ctx);

      if (!widgets) {
        return;
      }

      widgets.setStatus(\`Phase: \${next.phase}\`);

      if (next.phase === 'error') {
        widgets.showCallout({
          title: 'Runtime error',
          body: next.reason ?? 'An unknown runtime error occurred.',
          tone: 'selected',
        });
      }
    },
    dispose(ctx) {
      const widgets = ctx.adapters.get<UiWidgetsAdapterApi>('ui-widgets');

      unbindHelpKey?.();
      unbindHelpKey = null;
      widgets?.hideCallout();
      renderMessage(
        'Runtime disposed',
        'The controller released its bindings and the kernel shut down cleanly.',
        ctx,
      );
    },
  };
})();
`,
    'src/styles.css': `/**
 * Company: EonHive Inc.
 * Title: App Styles
 * Purpose: Style the standalone URK browser scaffold without introducing framework dependencies.
 * Author: Stan Nesi
 * Created: 2026-05-03
 * Updated: 2026-05-03
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
