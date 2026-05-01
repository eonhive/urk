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

function createLayout(): AppElements {
  const app = assertElement(document.querySelector<HTMLDivElement>('#app'), '#app');

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
