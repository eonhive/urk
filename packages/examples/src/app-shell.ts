/**
 * Company: EonHive Inc.
 * Title: URK App-Shell Proof
 * Purpose: Prove DOM-first app-shell orchestration with existing URK adapters.
 * Author: Stan Nesi
 * Created: 2026-04-23
 * Updated: 2026-04-23
 * Notes: Vibe coded with Codex.
 */

import { createKernel, type ControllerRegistration, type RuntimeSnapshot } from '@urk/core';
import {
  createInputAdapter,
  createLoadingAdapter,
  createPointerAdapter,
  createStorageAdapter,
  createUiWidgetsAdapter,
  type InputAdapterApi,
  type InputKeyEvent,
  type LoadingAdapterApi,
  type LoadingSnapshot,
  type PointerAdapterApi,
  type PointerTargetEventPayload,
  type StorageAdapterApi,
  type UiWidgetsAdapterApi,
} from '@urk/adapters';

const SHELL_VIEWS = ['overview', 'runtime', 'activity'] as const;
const STORAGE_KEY = 'shell-layout';
const STORAGE_NAMESPACE = 'urk-app-shell-proof';

type ShellView = (typeof SHELL_VIEWS)[number];

type PersistedShellLayout = {
  activeView: ShellView;
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
};

type ShellState = PersistedShellLayout & {
  lastAction: string;
  activityTick: number;
  hasReachedReady: boolean;
  isShutdown: boolean;
  resetRequested: boolean;
  lastPersistedSignature: string;
};

type PointerActionMeta =
  | { scope: 'app-shell'; action: 'view'; view: ShellView }
  | { scope: 'app-shell'; action: 'toggle-sidebar' }
  | { scope: 'app-shell'; action: 'toggle-inspector' }
  | { scope: 'app-shell'; action: 'pause' }
  | { scope: 'app-shell'; action: 'resume' }
  | { scope: 'app-shell'; action: 'reset-layout' }
  | { scope: 'app-shell'; action: 'shutdown' };

type ShellControlActions = {
  pause(): void;
  resume(): void;
  shutdown(): void;
};

type AppElements = {
  phaseValue: HTMLElement;
  reasonValue: HTMLElement;
  frameValue: HTMLElement;
  stageValue: HTMLElement;
  progressValue: HTMLElement;
  progressFill: HTMLElement;
  actionValue: HTMLElement;
  eventValue: HTMLElement;
  overviewLayoutValue: HTMLElement;
  overviewFocusValue: HTMLElement;
  runtimePhaseValue: HTMLElement;
  runtimeReasonValue: HTMLElement;
  runtimeStageValue: HTMLElement;
  activityTickValue: HTMLElement;
  activityEventValue: HTMLElement;
  activityActionValue: HTMLElement;
  inspectorViewValue: HTMLElement;
  inspectorLayoutValue: HTMLElement;
  inspectorStorageValue: HTMLElement;
  loadingVeil: HTMLElement;
  loadingTitle: HTMLElement;
  loadingBody: HTMLElement;
  shellStage: HTMLElement;
  sidebar: HTMLElement;
  inspectorPanel: HTMLElement;
  toggleSidebarButton: HTMLButtonElement;
  toggleInspectorButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  resumeButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  shutdownButton: HTMLButtonElement;
  navButtons: Record<ShellView, HTMLButtonElement>;
  viewPanels: Record<ShellView, HTMLElement>;
  uiHost: HTMLElement;
};

const DEFAULT_LAYOUT: PersistedShellLayout = {
  activeView: 'overview',
  sidebarCollapsed: false,
  inspectorOpen: true,
};

function assertElement<T extends Element>(value: T | null, label: string): T {
  if (!value) {
    throw new Error(`Missing DOM element: ${label}`);
  }

  return value;
}

function cloneDefaultLayout(): PersistedShellLayout {
  return {
    activeView: DEFAULT_LAYOUT.activeView,
    sidebarCollapsed: DEFAULT_LAYOUT.sidebarCollapsed,
    inspectorOpen: DEFAULT_LAYOUT.inspectorOpen,
  };
}

function createInitialState(): ShellState {
  const layout = cloneDefaultLayout();

  return {
    ...layout,
    lastAction: 'Booting generic shell proof',
    activityTick: 0,
    hasReachedReady: false,
    isShutdown: false,
    resetRequested: false,
    lastPersistedSignature: JSON.stringify(layout),
  };
}

function isShellView(value: unknown): value is ShellView {
  return typeof value === 'string' && (SHELL_VIEWS as readonly string[]).includes(value);
}

function parsePersistedLayout(value: unknown): PersistedShellLayout | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Partial<PersistedShellLayout>;

  if (!isShellView(candidate.activeView)) {
    return null;
  }

  if (typeof candidate.sidebarCollapsed !== 'boolean') {
    return null;
  }

  if (typeof candidate.inspectorOpen !== 'boolean') {
    return null;
  }

  return {
    activeView: candidate.activeView,
    sidebarCollapsed: candidate.sidebarCollapsed,
    inspectorOpen: candidate.inspectorOpen,
  };
}

function createEmptyLoadingSnapshot(): LoadingSnapshot {
  return {
    active: false,
    complete: false,
    progress: 0,
    message: 'Waiting to start',
    stageId: null,
    stageLabel: null,
    stages: [],
    updatedAt: Date.now(),
  };
}

function viewLabel(view: ShellView): string {
  switch (view) {
    case 'overview':
      return 'Overview';
    case 'runtime':
      return 'Runtime';
    case 'activity':
      return 'Activity';
  }
}

function phaseStatus(snapshot: RuntimeSnapshot): string {
  switch (snapshot.phase) {
    case 'loading':
      return 'Loading shell';
    case 'ready':
      return 'Shell ready';
    case 'paused':
      return 'Shell paused';
    case 'transition':
      return 'Shell transition';
    case 'error':
      return 'Shell error';
    default:
      return 'Booting shell';
  }
}

function getPersistedLayout(state: ShellState): PersistedShellLayout {
  return {
    activeView: state.activeView,
    sidebarCollapsed: state.sidebarCollapsed,
    inspectorOpen: state.inspectorOpen,
  };
}

function getLayoutSignature(layout: PersistedShellLayout): string {
  return JSON.stringify(layout);
}

function getLayoutSummary(state: PersistedShellLayout): string {
  const sidebarLabel = state.sidebarCollapsed ? 'sidebar collapsed' : 'sidebar expanded';
  const inspectorLabel = state.inspectorOpen ? 'inspector open' : 'inspector closed';

  return `${sidebarLabel}, ${inspectorLabel}`;
}

function applyLayout(state: ShellState, layout: PersistedShellLayout): void {
  state.activeView = layout.activeView;
  state.sidebarCollapsed = layout.sidebarCollapsed;
  state.inspectorOpen = layout.inspectorOpen;
}

function setActiveView(state: ShellState, view: ShellView, source: 'pointer' | 'keyboard'): void {
  if (state.activeView === view) {
    return;
  }

  state.activeView = view;
  state.lastAction = `${source === 'pointer' ? 'Clicked' : 'Keyed'} ${viewLabel(view)} view`;
}

function toggleSidebar(state: ShellState, source: 'pointer' | 'keyboard'): void {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  state.lastAction = `${source === 'pointer' ? 'Toggled' : 'Keyed'} sidebar ${
    state.sidebarCollapsed ? 'closed' : 'open'
  }`;
}

function toggleInspector(state: ShellState, source: 'pointer' | 'keyboard'): void {
  state.inspectorOpen = !state.inspectorOpen;
  state.lastAction = `${source === 'pointer' ? 'Toggled' : 'Keyed'} inspector ${
    state.inspectorOpen ? 'open' : 'closed'
  }`;
}

function closeInspector(state: ShellState): void {
  if (!state.inspectorOpen) {
    return;
  }

  state.inspectorOpen = false;
  state.lastAction = 'Closed inspector with Escape';
}

function requestResetLayout(state: ShellState): void {
  state.resetRequested = true;
  state.lastAction = 'Requested layout reset';
}

function installStyles(): void {
  const style = document.createElement('style');

  style.textContent = `
    :root {
      color-scheme: light;
      font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(16, 185, 129, 0.12), transparent 34%),
        radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.14), transparent 38%),
        #f4f7fb;
      color: #0f172a;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
    }

    button,
    input,
    textarea,
    select {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    #app {
      min-height: 100vh;
      padding: 32px;
    }

    .shell-proof {
      width: min(1280px, 100%);
      margin: 0 auto;
    }

    .shell-frame {
      min-height: 760px;
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 32px;
      overflow: hidden;
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
      backdrop-filter: blur(18px);
    }

    .shell-sidebar {
      display: grid;
      align-content: start;
      gap: 18px;
      padding: 24px 18px;
      background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.9)),
        #0f172a;
      color: #e2e8f0;
      transition: width 160ms ease, padding 160ms ease;
    }

    .shell-sidebar[data-collapsed="true"] {
      width: 96px;
      padding-inline: 12px;
    }

    .shell-sidebar__heading h1 {
      margin: 0;
      font-size: 1.35rem;
      line-height: 1.1;
      letter-spacing: -0.04em;
    }

    .shell-sidebar__heading p {
      margin: 10px 0 0;
      color: rgba(226, 232, 240, 0.78);
      line-height: 1.55;
      font-size: 0.95rem;
    }

    .shell-sidebar[data-collapsed="true"] .shell-sidebar__heading p,
    .shell-sidebar[data-collapsed="true"] .shell-sidebar__note {
      display: none;
    }

    .shell-nav {
      display: grid;
      gap: 10px;
    }

    .shell-nav__button,
    .shell-toolbar__button,
    .shell-control__button {
      border: 0;
      border-radius: 18px;
      padding: 12px 14px;
      text-align: left;
      transition: transform 120ms ease, background 120ms ease, opacity 120ms ease;
    }

    .shell-nav__button {
      background: rgba(51, 65, 85, 0.55);
      color: #e2e8f0;
    }

    .shell-nav__button[data-active="true"] {
      background: rgba(16, 185, 129, 0.22);
      color: #f8fafc;
      box-shadow: inset 0 0 0 1px rgba(110, 231, 183, 0.24);
    }

    .shell-sidebar[data-collapsed="true"] .shell-nav__button {
      text-align: center;
      padding-inline: 8px;
      font-size: 0.88rem;
    }

    .shell-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .shell-toolbar__button {
      background: rgba(248, 250, 252, 0.12);
      color: #f8fafc;
    }

    .shell-sidebar__note {
      margin: 0;
      padding: 14px;
      border-radius: 18px;
      background: rgba(30, 41, 59, 0.55);
      color: rgba(226, 232, 240, 0.9);
      line-height: 1.55;
      font-size: 0.92rem;
    }

    .shell-stage {
      position: relative;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      background:
        radial-gradient(circle at top, rgba(16, 185, 129, 0.12), transparent 42%),
        linear-gradient(180deg, rgba(15, 23, 42, 0.02), rgba(15, 23, 42, 0.06)),
        #f8fafc;
      isolation: isolate;
    }

    .shell-header {
      padding: 22px 24px 18px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      display: grid;
      gap: 16px;
    }

    .shell-header__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .shell-header__title h2 {
      margin: 0;
      font-size: clamp(1.6rem, 2.6vw, 2rem);
      letter-spacing: -0.04em;
      line-height: 1.05;
    }

    .shell-header__title p {
      margin: 8px 0 0;
      color: #475569;
      line-height: 1.55;
    }

    .shell-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .shell-metric {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.16);
      min-height: 92px;
    }

    .shell-metric span {
      display: block;
      margin-bottom: 6px;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }

    .shell-metric strong {
      display: block;
      line-height: 1.45;
      font-size: 1rem;
      word-break: break-word;
    }

    .shell-progress {
      display: grid;
      gap: 8px;
      padding: 12px 14px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .shell-progress__copy {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      color: #475569;
      font-size: 0.95rem;
    }

    .shell-progress__track {
      height: 12px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(148, 163, 184, 0.2);
    }

    .shell-progress__fill {
      height: 100%;
      width: 0%;
      border-radius: inherit;
      background: linear-gradient(90deg, #0ea5e9, #10b981);
      transition: width 140ms linear;
    }

    .shell-main {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 20px;
      padding: 22px 24px 24px;
      align-items: start;
    }

    .shell-content {
      display: grid;
      gap: 18px;
    }

    .shell-panel {
      display: none;
      gap: 16px;
    }

    .shell-panel[data-active="true"] {
      display: grid;
    }

    .shell-card {
      padding: 18px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.16);
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.04);
    }

    .shell-card h3 {
      margin: 0 0 12px;
      font-size: 1.05rem;
      letter-spacing: -0.02em;
    }

    .shell-card p,
    .shell-card li {
      color: #334155;
      line-height: 1.6;
    }

    .shell-card ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
    }

    .shell-grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .shell-kv {
      padding: 14px;
      border-radius: 18px;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .shell-kv span {
      display: block;
      margin-bottom: 6px;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }

    .shell-kv strong {
      display: block;
      line-height: 1.5;
      font-size: 0.98rem;
      word-break: break-word;
    }

    .shell-inspector {
      display: grid;
      gap: 14px;
      padding: 18px;
      border-radius: 24px;
      background: rgba(15, 23, 42, 0.96);
      color: #e2e8f0;
      border: 1px solid rgba(51, 65, 85, 0.28);
      min-height: 100%;
    }

    .shell-inspector[hidden] {
      display: none;
    }

    .shell-inspector h3 {
      margin: 0;
      font-size: 1.1rem;
      letter-spacing: -0.03em;
    }

    .shell-inspector p {
      margin: 0;
      color: rgba(226, 232, 240, 0.78);
      line-height: 1.55;
    }

    .shell-inspector .shell-kv {
      background: rgba(30, 41, 59, 0.82);
      border-color: rgba(71, 85, 105, 0.34);
    }

    .shell-inspector .shell-kv span {
      color: rgba(148, 163, 184, 0.82);
    }

    .shell-inspector .shell-kv strong {
      color: #f8fafc;
    }

    .shell-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .shell-control__button {
      background: #0f172a;
      color: #f8fafc;
    }

    .shell-control__button[data-role="reset-button"] {
      background: #0f766e;
    }

    .shell-control__button[data-role="resume-button"] {
      background: #2563eb;
    }

    .shell-nav__button:hover:not(:disabled),
    .shell-toolbar__button:hover:not(:disabled),
    .shell-control__button:hover:not(:disabled) {
      transform: translateY(-1px);
    }

    .shell-nav__button:disabled,
    .shell-toolbar__button:disabled,
    .shell-control__button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .shell-loading-veil {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(248, 250, 252, 0.76);
      backdrop-filter: blur(10px);
      z-index: 2;
    }

    .shell-loading-veil[hidden] {
      display: none;
    }

    .shell-loading-card {
      width: min(420px, 100%);
      padding: 24px;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(148, 163, 184, 0.18);
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
    }

    .shell-loading-card h3 {
      margin: 0;
      font-size: 1.3rem;
      letter-spacing: -0.03em;
    }

    .shell-loading-card p {
      margin: 12px 0 0;
      color: #475569;
      line-height: 1.6;
    }

    .shell-ui-host {
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
    }

    @media (max-width: 1080px) {
      .shell-frame {
        grid-template-columns: 1fr;
      }

      .shell-sidebar {
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      }

      .shell-main {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      #app {
        padding: 18px;
      }

      .shell-header__top {
        flex-direction: column;
        align-items: flex-start;
      }

      .shell-metrics {
        grid-template-columns: 1fr;
      }

      .shell-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.append(style);
}

function createLayout(): AppElements {
  const app = assertElement(document.querySelector<HTMLDivElement>('#app'), '#app');

  app.innerHTML = `
    <div class="shell-proof">
      <section class="shell-frame">
        <aside class="shell-sidebar" data-role="sidebar" data-collapsed="false">
          <div class="shell-sidebar__heading">
            <h1>URK App Shell</h1>
            <p>
              Generic runtime shell proof for controller orchestration, input/pointer flow,
              persistence, and lifecycle behavior.
            </p>
          </div>

          <div class="shell-toolbar">
            <button
              type="button"
              class="shell-toolbar__button"
              data-role="toggle-sidebar-button"
            >
              Toggle Sidebar
            </button>
          </div>

          <nav class="shell-nav" aria-label="Shell views">
            <button type="button" class="shell-nav__button" data-role="nav-overview">
              Overview
            </button>
            <button type="button" class="shell-nav__button" data-role="nav-runtime">
              Runtime
            </button>
            <button type="button" class="shell-nav__button" data-role="nav-activity">
              Activity
            </button>
          </nav>

          <p class="shell-sidebar__note">
            Pointer switches views and triggers shell actions. Keyboard proves the same shell
            state can be orchestrated through a second capability path.
          </p>
        </aside>

        <section class="shell-stage" data-role="shell-stage" tabindex="-1">
          <header class="shell-header">
            <div class="shell-header__top">
              <div class="shell-header__title">
                <h2>Standalone shell proof</h2>
                <p>
                  DOM-only runtime shell with persisted layout, explicit lifecycle, and adapter-
                  driven interaction.
                </p>
              </div>

              <div class="shell-toolbar">
                <button
                  type="button"
                  class="shell-toolbar__button"
                  data-role="toggle-inspector-button"
                >
                  Toggle Inspector
                </button>
              </div>
            </div>

            <div class="shell-metrics">
              <div class="shell-metric">
                <span>Phase</span>
                <strong data-role="phase-value">boot</strong>
              </div>
              <div class="shell-metric">
                <span>Reason</span>
                <strong data-role="reason-value">kernel:init</strong>
              </div>
              <div class="shell-metric">
                <span>Frame Tick</span>
                <strong data-role="frame-value">0</strong>
              </div>
              <div class="shell-metric">
                <span>Loading Stage</span>
                <strong data-role="stage-value">Waiting</strong>
              </div>
              <div class="shell-metric">
                <span>Latest Action</span>
                <strong data-role="action-value">Booting generic shell proof</strong>
              </div>
              <div class="shell-metric">
                <span>Latest Event</span>
                <strong data-role="event-value">kernel:init</strong>
              </div>
            </div>

            <div class="shell-progress">
              <div class="shell-progress__copy">
                <strong>Loading progress</strong>
                <span data-role="progress-value">0%</span>
              </div>
              <div class="shell-progress__track">
                <div class="shell-progress__fill" data-role="progress-fill"></div>
              </div>
            </div>
          </header>

          <div class="shell-main">
            <div class="shell-content">
              <div class="shell-controls">
                <button
                  type="button"
                  class="shell-control__button"
                  data-role="pause-button"
                >
                  Pause
                </button>
                <button
                  type="button"
                  class="shell-control__button"
                  data-role="resume-button"
                >
                  Resume
                </button>
                <button
                  type="button"
                  class="shell-control__button"
                  data-role="reset-button"
                >
                  Reset Layout
                </button>
                <button
                  type="button"
                  class="shell-control__button"
                  data-role="shutdown-button"
                >
                  Shutdown
                </button>
              </div>

              <section class="shell-panel" data-role="panel-overview" data-active="true">
                <article class="shell-card">
                  <h3>Shell overview</h3>
                  <p>
                    This proof keeps the shell generic: one view state, one persisted layout
                    shape, and one explicit runtime lifecycle.
                  </p>
                </article>
                <div class="shell-grid">
                  <div class="shell-kv">
                    <span>Layout Summary</span>
                    <strong data-role="overview-layout-value">sidebar expanded, inspector open</strong>
                  </div>
                  <div class="shell-kv">
                    <span>Current Focus</span>
                    <strong data-role="overview-focus-value">Overview view active</strong>
                  </div>
                </div>
              </section>

              <section class="shell-panel" data-role="panel-runtime" data-active="false">
                <article class="shell-card">
                  <h3>Runtime state</h3>
                  <p>
                    The shell view stays generic while making kernel state explicit enough to debug
                    loading, ready, pause, and shutdown behavior.
                  </p>
                </article>
                <div class="shell-grid">
                  <div class="shell-kv">
                    <span>Phase</span>
                    <strong data-role="runtime-phase-value">boot</strong>
                  </div>
                  <div class="shell-kv">
                    <span>Reason</span>
                    <strong data-role="runtime-reason-value">kernel:init</strong>
                  </div>
                  <div class="shell-kv">
                    <span>Stage</span>
                    <strong data-role="runtime-stage-value">Waiting</strong>
                  </div>
                </div>
              </section>

              <section class="shell-panel" data-role="panel-activity" data-active="false">
                <article class="shell-card">
                  <h3>Activity loop</h3>
                  <p>
                    The shell uses one scheduler-driven activity tick so pause and resume are
                    visually obvious without adding scene or audio complexity.
                  </p>
                </article>
                <div class="shell-grid">
                  <div class="shell-kv">
                    <span>Activity Tick</span>
                    <strong data-role="activity-tick-value">0</strong>
                  </div>
                  <div class="shell-kv">
                    <span>Last Event</span>
                    <strong data-role="activity-event-value">kernel:init</strong>
                  </div>
                  <div class="shell-kv">
                    <span>Last Action</span>
                    <strong data-role="activity-action-value">Booting generic shell proof</strong>
                  </div>
                </div>
              </section>
            </div>

            <aside class="shell-inspector" data-role="inspector-panel">
              <h3>Inspector</h3>
              <p>
                Generic shell inspector for current layout, persistence status, and recent shell
                intent.
              </p>

              <div class="shell-kv">
                <span>Active View</span>
                <strong data-role="inspector-view-value">Overview</strong>
              </div>

              <div class="shell-kv">
                <span>Layout State</span>
                <strong data-role="inspector-layout-value">sidebar expanded, inspector open</strong>
              </div>

              <div class="shell-kv">
                <span>Persistence</span>
                <strong data-role="inspector-storage-value">Default layout active</strong>
              </div>
            </aside>
          </div>

          <div class="shell-loading-veil" data-role="loading-veil" hidden>
            <div class="shell-loading-card">
              <h3 data-role="loading-title">Preparing shell</h3>
              <p data-role="loading-body">
                The shell is staging adapters, restoring layout, and activating ready-mode
                interaction.
              </p>
            </div>
          </div>

          <div class="shell-ui-host" data-role="ui-host"></div>
        </section>
      </section>
    </div>
  `;

  return {
    phaseValue: assertElement(app.querySelector('[data-role="phase-value"]'), 'phase value'),
    reasonValue: assertElement(app.querySelector('[data-role="reason-value"]'), 'reason value'),
    frameValue: assertElement(app.querySelector('[data-role="frame-value"]'), 'frame value'),
    stageValue: assertElement(app.querySelector('[data-role="stage-value"]'), 'stage value'),
    progressValue: assertElement(app.querySelector('[data-role="progress-value"]'), 'progress value'),
    progressFill: assertElement(app.querySelector('[data-role="progress-fill"]'), 'progress fill'),
    actionValue: assertElement(app.querySelector('[data-role="action-value"]'), 'action value'),
    eventValue: assertElement(app.querySelector('[data-role="event-value"]'), 'event value'),
    overviewLayoutValue: assertElement(
      app.querySelector('[data-role="overview-layout-value"]'),
      'overview layout value',
    ),
    overviewFocusValue: assertElement(
      app.querySelector('[data-role="overview-focus-value"]'),
      'overview focus value',
    ),
    runtimePhaseValue: assertElement(
      app.querySelector('[data-role="runtime-phase-value"]'),
      'runtime phase value',
    ),
    runtimeReasonValue: assertElement(
      app.querySelector('[data-role="runtime-reason-value"]'),
      'runtime reason value',
    ),
    runtimeStageValue: assertElement(
      app.querySelector('[data-role="runtime-stage-value"]'),
      'runtime stage value',
    ),
    activityTickValue: assertElement(
      app.querySelector('[data-role="activity-tick-value"]'),
      'activity tick value',
    ),
    activityEventValue: assertElement(
      app.querySelector('[data-role="activity-event-value"]'),
      'activity event value',
    ),
    activityActionValue: assertElement(
      app.querySelector('[data-role="activity-action-value"]'),
      'activity action value',
    ),
    inspectorViewValue: assertElement(
      app.querySelector('[data-role="inspector-view-value"]'),
      'inspector view value',
    ),
    inspectorLayoutValue: assertElement(
      app.querySelector('[data-role="inspector-layout-value"]'),
      'inspector layout value',
    ),
    inspectorStorageValue: assertElement(
      app.querySelector('[data-role="inspector-storage-value"]'),
      'inspector storage value',
    ),
    loadingVeil: assertElement(app.querySelector('[data-role="loading-veil"]'), 'loading veil'),
    loadingTitle: assertElement(app.querySelector('[data-role="loading-title"]'), 'loading title'),
    loadingBody: assertElement(app.querySelector('[data-role="loading-body"]'), 'loading body'),
    shellStage: assertElement(app.querySelector('[data-role="shell-stage"]'), 'shell stage'),
    sidebar: assertElement(app.querySelector('[data-role="sidebar"]'), 'sidebar'),
    inspectorPanel: assertElement(
      app.querySelector('[data-role="inspector-panel"]'),
      'inspector panel',
    ),
    toggleSidebarButton: assertElement(
      app.querySelector('[data-role="toggle-sidebar-button"]'),
      'toggle sidebar button',
    ),
    toggleInspectorButton: assertElement(
      app.querySelector('[data-role="toggle-inspector-button"]'),
      'toggle inspector button',
    ),
    pauseButton: assertElement(app.querySelector('[data-role="pause-button"]'), 'pause button'),
    resumeButton: assertElement(app.querySelector('[data-role="resume-button"]'), 'resume button'),
    resetButton: assertElement(app.querySelector('[data-role="reset-button"]'), 'reset button'),
    shutdownButton: assertElement(
      app.querySelector('[data-role="shutdown-button"]'),
      'shutdown button',
    ),
    navButtons: {
      overview: assertElement(
        app.querySelector('[data-role="nav-overview"]'),
        'overview nav button',
      ),
      runtime: assertElement(
        app.querySelector('[data-role="nav-runtime"]'),
        'runtime nav button',
      ),
      activity: assertElement(
        app.querySelector('[data-role="nav-activity"]'),
        'activity nav button',
      ),
    },
    viewPanels: {
      overview: assertElement(
        app.querySelector('[data-role="panel-overview"]'),
        'overview panel',
      ),
      runtime: assertElement(app.querySelector('[data-role="panel-runtime"]'), 'runtime panel'),
      activity: assertElement(
        app.querySelector('[data-role="panel-activity"]'),
        'activity panel',
      ),
    },
    uiHost: assertElement(app.querySelector('[data-role="ui-host"]'), 'ui host'),
  };
}

function setButtonDisabled(button: HTMLButtonElement, disabled: boolean): void {
  button.disabled = disabled;
}

function syncControls(
  elements: AppElements,
  snapshot: RuntimeSnapshot,
  state: ShellState,
): void {
  const readyInteractive = snapshot.phase === 'ready' && !state.isShutdown;

  for (const view of SHELL_VIEWS) {
    setButtonDisabled(elements.navButtons[view], !readyInteractive);
  }

  setButtonDisabled(elements.toggleSidebarButton, !readyInteractive);
  setButtonDisabled(elements.toggleInspectorButton, !readyInteractive);
  setButtonDisabled(elements.pauseButton, state.isShutdown || snapshot.phase !== 'ready');
  setButtonDisabled(elements.resumeButton, state.isShutdown || snapshot.phase !== 'paused');
  setButtonDisabled(elements.resetButton, state.isShutdown || snapshot.phase !== 'ready');
  setButtonDisabled(elements.shutdownButton, state.isShutdown);
}

function syncPanels(elements: AppElements, state: ShellState): void {
  for (const view of SHELL_VIEWS) {
    const isActive = state.activeView === view;
    elements.navButtons[view].dataset.active = isActive ? 'true' : 'false';
    elements.viewPanels[view].dataset.active = isActive ? 'true' : 'false';
  }
}

function syncShellView(
  elements: AppElements,
  state: ShellState,
  snapshot: RuntimeSnapshot,
  loadingSnapshot: LoadingSnapshot,
  latestEvent: string,
  frameTick: number,
): void {
  const layout = getPersistedLayout(state);
  const loadingVisible = snapshot.phase === 'loading' || (snapshot.phase === 'paused' && !state.hasReachedReady);
  const persistedSignature = getLayoutSignature(layout);

  elements.phaseValue.textContent = snapshot.phase;
  elements.reasonValue.textContent = snapshot.reason ?? 'n/a';
  elements.frameValue.textContent = String(frameTick);
  elements.stageValue.textContent = loadingSnapshot.stageLabel ?? 'Waiting';
  elements.progressValue.textContent = `${Math.round(loadingSnapshot.progress * 100)}%`;
  elements.progressFill.setAttribute('style', `width: ${loadingSnapshot.progress * 100}%`);
  elements.actionValue.textContent = state.lastAction;
  elements.eventValue.textContent = latestEvent;
  elements.activityTickValue.textContent = String(state.activityTick);
  elements.activityEventValue.textContent = latestEvent;
  elements.activityActionValue.textContent = state.lastAction;
  elements.runtimePhaseValue.textContent = snapshot.phase;
  elements.runtimeReasonValue.textContent = snapshot.reason ?? 'n/a';
  elements.runtimeStageValue.textContent = loadingSnapshot.stageLabel ?? 'Waiting';
  elements.overviewLayoutValue.textContent = getLayoutSummary(layout);
  elements.overviewFocusValue.textContent = `${viewLabel(state.activeView)} view active`;
  elements.inspectorViewValue.textContent = viewLabel(state.activeView);
  elements.inspectorLayoutValue.textContent = getLayoutSummary(layout);
  elements.inspectorStorageValue.textContent =
    persistedSignature === getLayoutSignature(DEFAULT_LAYOUT)
      ? 'Default layout active'
      : 'Custom layout persisted';

  elements.sidebar.dataset.collapsed = state.sidebarCollapsed ? 'true' : 'false';
  elements.inspectorPanel.hidden = !state.inspectorOpen;

  syncPanels(elements, state);

  if (loadingVisible) {
    elements.loadingVeil.hidden = false;
    elements.loadingTitle.textContent =
      snapshot.phase === 'paused' ? 'Loading paused' : 'Preparing shell';
    elements.loadingBody.textContent = loadingSnapshot.stageLabel
      ? `${loadingSnapshot.stageLabel}: ${loadingSnapshot.message}`
      : loadingSnapshot.message;
  } else {
    elements.loadingVeil.hidden = true;
    elements.loadingTitle.textContent = 'Preparing shell';
    elements.loadingBody.textContent =
      'The shell is staging adapters, restoring layout, and activating ready-mode interaction.';
  }
}

function createShellLoadingController(state: ShellState): ControllerRegistration {
  const stages = [
    { id: 'bootstrap-shell', label: 'Bootstrap shell', weight: 1 },
    { id: 'restore-layout', label: 'Restore layout', weight: 1 },
    { id: 'activate-shell', label: 'Activate shell', weight: 1 },
  ];

  let elapsedMs = 0;
  let loadingActive = false;

  return {
    id: 'shell-loading-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      loading.begin(stages, 'Creating shell frame and runtime services');
      elapsedMs = 0;
      loadingActive = true;
      state.lastAction = 'Started staged shell loading';

      if (ctx.state.getSnapshot().phase !== 'loading') {
        ctx.state.setPhase('loading', 'shell:boot');
      }
    },
    update(frame, ctx) {
      if (!loadingActive || ctx.state.getSnapshot().phase !== 'loading') {
        return;
      }

      elapsedMs += frame.deltaMs;
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      if (elapsedMs < 900) {
        loading.setStage(
          'bootstrap-shell',
          elapsedMs / 900,
          'Creating shell frame and runtime services',
        );
        return;
      }

      if (elapsedMs < 1700) {
        loading.setStage(
          'restore-layout',
          (elapsedMs - 900) / 800,
          'Restoring saved shell layout and persisted chrome state',
        );
        return;
      }

      if (elapsedMs < 2600) {
        loading.setStage(
          'activate-shell',
          (elapsedMs - 1700) / 900,
          'Enabling navigation, inspector, and runtime shell controls',
        );
        return;
      }

      loading.complete('Shell ready');
      loadingActive = false;
      state.lastAction = 'Shell reached ready state';
      ctx.state.setPhase('ready', 'shell:ready');
    },
    onStateChange(next) {
      if (next.phase === 'ready') {
        state.hasReachedReady = true;
      }
    },
  };
}

function createShellNavigationController(
  state: ShellState,
  elements: AppElements,
): ControllerRegistration {
  const cleanups: Array<() => void> = [];

  const handleAction = (
    meta: PointerActionMeta,
    ctx: Parameters<NonNullable<ControllerRegistration['init']>>[0],
    source: 'pointer' | 'keyboard',
  ): void => {
    const snapshot = ctx.state.getSnapshot();
    const pauseShell = ctx.services.require<() => void>('shell:pause');
    const resumeShell = ctx.services.require<() => void>('shell:resume');
    const shutdownShell = ctx.services.require<() => void>('shell:shutdown');
    const renderShell = ctx.services.require<() => void>('shell:render');

    if (meta.action === 'shutdown') {
      if (!state.isShutdown) {
        state.lastAction = 'Requested shell shutdown';
        shutdownShell();
      }
      return;
    }

    if (meta.action === 'resume') {
      if (snapshot.phase === 'paused' && !state.isShutdown) {
        state.lastAction = 'Resumed shell runtime';
        resumeShell();
      }
      return;
    }

    if (meta.action === 'pause') {
      if (snapshot.phase === 'ready' && !state.isShutdown) {
        state.lastAction = 'Paused shell runtime';
        pauseShell();
      }
      return;
    }

    if (snapshot.phase !== 'ready' || state.isShutdown) {
      return;
    }

    switch (meta.action) {
      case 'view':
        setActiveView(state, meta.view, source);
        renderShell();
        break;
      case 'toggle-sidebar':
        toggleSidebar(state, source);
        renderShell();
        break;
      case 'toggle-inspector':
        toggleInspector(state, source);
        renderShell();
        break;
      case 'reset-layout':
        requestResetLayout(state);
        renderShell();
        break;
      default:
        break;
    }
  };

  return {
    id: 'shell-navigation-controller',
    init(ctx) {
      const pointer = ctx.adapters.require<PointerAdapterApi>('pointer');
      const input = ctx.adapters.require<InputAdapterApi>('input');

      const pointerTargets: Array<{
        id: string;
        element: HTMLButtonElement;
        meta: PointerActionMeta;
      }> = [
        {
          id: 'nav-overview',
          element: elements.navButtons.overview,
          meta: { scope: 'app-shell', action: 'view', view: 'overview' },
        },
        {
          id: 'nav-runtime',
          element: elements.navButtons.runtime,
          meta: { scope: 'app-shell', action: 'view', view: 'runtime' },
        },
        {
          id: 'nav-activity',
          element: elements.navButtons.activity,
          meta: { scope: 'app-shell', action: 'view', view: 'activity' },
        },
        {
          id: 'toggle-sidebar',
          element: elements.toggleSidebarButton,
          meta: { scope: 'app-shell', action: 'toggle-sidebar' },
        },
        {
          id: 'toggle-inspector',
          element: elements.toggleInspectorButton,
          meta: { scope: 'app-shell', action: 'toggle-inspector' },
        },
        {
          id: 'pause-shell',
          element: elements.pauseButton,
          meta: { scope: 'app-shell', action: 'pause' },
        },
        {
          id: 'resume-shell',
          element: elements.resumeButton,
          meta: { scope: 'app-shell', action: 'resume' },
        },
        {
          id: 'reset-layout',
          element: elements.resetButton,
          meta: { scope: 'app-shell', action: 'reset-layout' },
        },
        {
          id: 'shutdown-shell',
          element: elements.shutdownButton,
          meta: { scope: 'app-shell', action: 'shutdown' },
        },
      ];

      for (const target of pointerTargets) {
        cleanups.push(
          pointer.bindTarget({
            id: target.id,
            element: target.element,
            meta: target.meta,
          }),
        );
      }

      cleanups.push(
        ctx.events.on('pointer:select', (event) => {
          const payload = event.payload as PointerTargetEventPayload | undefined;
          const meta = payload?.meta as PointerActionMeta | undefined;

          if (!payload || !meta || meta.scope !== 'app-shell') {
            return;
          }

          handleAction(meta, ctx, 'pointer');
        }),
      );

      cleanups.push(
        input.bindKey({
          code: 'Digit1',
          handler: () => {
            handleAction({ scope: 'app-shell', action: 'view', view: 'overview' }, ctx, 'keyboard');
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'Digit2',
          handler: () => {
            handleAction({ scope: 'app-shell', action: 'view', view: 'runtime' }, ctx, 'keyboard');
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'Digit3',
          handler: () => {
            handleAction({ scope: 'app-shell', action: 'view', view: 'activity' }, ctx, 'keyboard');
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'KeyB',
          handler: () => {
            handleAction({ scope: 'app-shell', action: 'toggle-sidebar' }, ctx, 'keyboard');
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'KeyI',
          handler: () => {
            handleAction({ scope: 'app-shell', action: 'toggle-inspector' }, ctx, 'keyboard');
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'Escape',
          handler: (_event: InputKeyEvent) => {
            if (ctx.state.getSnapshot().phase !== 'ready' || state.isShutdown) {
              return;
            }

            closeInspector(state);
          },
        }),
      );
    },
    dispose() {
      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }
    },
  };
}

function createShellPersistenceController(state: ShellState): ControllerRegistration {
  return {
    id: 'shell-persistence-controller',
    init(ctx) {
      const storage = ctx.adapters.require<StorageAdapterApi>('storage');
      const defaultLayout = cloneDefaultLayout();

      try {
        const saved = storage.getItem<unknown>(STORAGE_KEY);
        const parsed = parsePersistedLayout(saved);

        if (parsed) {
          applyLayout(state, parsed);
          state.lastPersistedSignature = getLayoutSignature(parsed);
          state.lastAction = 'Restored saved shell layout';
          return;
        }
      } catch {
        storage.removeItem(STORAGE_KEY);
        state.lastAction = 'Discarded invalid saved shell layout';
      }

      applyLayout(state, defaultLayout);
      state.lastPersistedSignature = getLayoutSignature(defaultLayout);
      state.lastAction = 'Using default shell layout';
    },
    update(_frame, ctx) {
      if (state.isShutdown) {
        return;
      }

      const storage = ctx.adapters.require<StorageAdapterApi>('storage');
      const renderShell = ctx.services.require<() => void>('shell:render');

      if (state.resetRequested) {
        const defaults = cloneDefaultLayout();

        storage.removeItem(STORAGE_KEY);
        applyLayout(state, defaults);
        state.resetRequested = false;
        state.lastPersistedSignature = getLayoutSignature(defaults);
        state.lastAction = 'Reset layout to defaults';
        renderShell();
        return;
      }

      if (ctx.state.getSnapshot().phase !== 'ready') {
        return;
      }

      const nextSignature = getLayoutSignature(getPersistedLayout(state));

      if (nextSignature === state.lastPersistedSignature) {
        return;
      }

      storage.setItem(STORAGE_KEY, getPersistedLayout(state));
      state.lastPersistedSignature = nextSignature;
    },
  };
}

function createShellChromeController(
  state: ShellState,
  elements: AppElements,
  setForceRender: (render: (() => void) | null) => void,
): ControllerRegistration {
  const cleanups: Array<() => void> = [];
  let frameTick = 0;
  let latestEvent = 'kernel:init';
  let latestLoadingSnapshot = createEmptyLoadingSnapshot();
  let render: (() => void) | null = null;

  return {
    id: 'shell-chrome-controller',
    init(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      latestLoadingSnapshot = loading.getSnapshot();

      render = (): void => {
        const snapshot = ctx.state.getSnapshot();
        syncControls(elements, snapshot, state);
        syncShellView(elements, state, snapshot, latestLoadingSnapshot, latestEvent, frameTick);
      };

      setForceRender(render);
      render();

      cleanups.push(
        loading.subscribe((snapshot) => {
          latestLoadingSnapshot = snapshot;
          latestEvent = 'loading:changed';
          render?.();
        }),
      );

      for (const eventType of [
        'runtime:phase-changed',
        'runtime:paused',
        'runtime:resumed',
        'runtime:error',
        'pointer:select',
        'input:key-down',
      ]) {
        cleanups.push(
          ctx.events.on(eventType, (event) => {
            latestEvent = event.type;
            render?.();
          }),
        );
      }

      ui.setStatus('Booting shell');
    },
    update(_frame, ctx) {
      if (state.isShutdown) {
        return;
      }

      const snapshot = ctx.state.getSnapshot();
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      frameTick += 1;

      if (snapshot.phase === 'ready') {
        state.activityTick += 1;
        state.hasReachedReady = true;
      }

      syncControls(elements, snapshot, state);
      syncShellView(elements, state, snapshot, latestLoadingSnapshot, latestEvent, frameTick);

      ui.setStatus(phaseStatus(snapshot));

      if (snapshot.phase === 'loading') {
        ui.showCallout({
          title: 'Shell loading',
          body: latestLoadingSnapshot.stageLabel
            ? `${latestLoadingSnapshot.stageLabel}: ${latestLoadingSnapshot.message}`
            : latestLoadingSnapshot.message,
          tone: 'active',
        });
        return;
      }

      if (snapshot.phase === 'paused') {
        ui.showCallout({
          title: 'Shell paused',
          body: `Resume to continue ${viewLabel(state.activeView)} with ${getLayoutSummary(state)}.`,
          tone: 'neutral',
        });
        return;
      }

      if (snapshot.phase === 'ready') {
        ui.showCallout({
          title: `${viewLabel(state.activeView)} view`,
          body: `${getLayoutSummary(state)}. Latest action: ${state.lastAction}.`,
          tone: 'selected',
        });
        return;
      }

      if (snapshot.phase === 'error') {
        ui.showCallout({
          title: 'Shell error',
          body: snapshot.reason ?? 'Unknown shell runtime error.',
          tone: 'neutral',
        });
        return;
      }

      ui.hideCallout();
    },
    onStateChange(next) {
      if (next.phase === 'ready') {
        state.hasReachedReady = true;
        elements.shellStage.focus();
      }

      render?.();
    },
    dispose(ctx) {
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }

      ui.hideCallout();
      ui.setStatus('Shell stopped');
    },
  };
}

async function main(): Promise<void> {
  installStyles();
  const elements = createLayout();
  const state = createInitialState();
  let forceRender: (() => void) | null = null;

  const shellActions: ShellControlActions = {
    pause() {},
    resume() {},
    shutdown() {},
  };

  const kernel = createKernel({
    id: 'urk-app-shell-proof',
    services: {
      'ui:host': elements.uiHost,
      'shell:pause': () => shellActions.pause(),
      'shell:resume': () => shellActions.resume(),
      'shell:shutdown': () => shellActions.shutdown(),
      'shell:render': () => forceRender?.(),
    },
    adapters: [
      createLoadingAdapter(),
      createUiWidgetsAdapter(),
      createInputAdapter(),
      createPointerAdapter(),
      createStorageAdapter({ namespace: STORAGE_NAMESPACE }),
    ],
    controllers: [
      createShellLoadingController(state),
      createShellNavigationController(state, elements),
      createShellPersistenceController(state),
      createShellChromeController(state, elements, (render) => {
        forceRender = render;
      }),
    ],
  });

  shellActions.pause = () => {
    if (state.isShutdown || kernel.getState().phase !== 'ready') {
      return;
    }

    state.lastAction = 'Paused shell runtime';
    kernel.pause('app-shell:pause');
  };

  shellActions.resume = () => {
    if (state.isShutdown || kernel.getState().phase !== 'paused') {
      return;
    }

    state.lastAction = 'Resumed shell runtime';
    kernel.resume('app-shell:resume');
  };

  shellActions.shutdown = () => {
    if (state.isShutdown) {
      return;
    }

    state.isShutdown = true;
    state.lastAction = 'Kernel shut down';
    forceRender?.();

    void kernel.shutdown('app-shell:shutdown').catch((error) => {
      state.lastAction = error instanceof Error ? error.message : 'Shutdown failed';
      forceRender?.();
    });
  };

  await kernel.boot();

  window.addEventListener(
    'beforeunload',
    () => {
      state.isShutdown = true;
      void kernel.shutdown('app-shell:unload');
    },
    { once: true },
  );
}

void main().catch((error) => {
  const app = document.querySelector<HTMLDivElement>('#app');

  if (app) {
    app.innerHTML = `
      <main style="padding: 32px; font-family: IBM Plex Sans, sans-serif;">
        <h1 style="margin: 0 0 12px;">URK app-shell proof failed</h1>
        <p style="margin: 0; line-height: 1.6; color: #475569;">
          ${error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </main>
    `;
  }

  throw error;
});
