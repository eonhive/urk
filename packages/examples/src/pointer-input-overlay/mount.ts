/**
 * Company: EonHive Inc.
 * Title: Pointer Input Overlay Mount
 * Purpose: Mount the public URK example that proves pointer and keyboard input overlay feedback.
 * Author: Stan Nesi
 * Created: 2026-05-09
 * Updated: 2026-05-09
 * Notes: Vibe coded with Codex.
 */

import {
  createInputAdapter,
  createLoadingAdapter,
  createPointerAdapter,
  createUiWidgetsAdapter,
  type InputAdapterApi,
  type InputKeyEvent,
  type LoadingAdapterApi,
  type PointerAdapterApi,
  type UiWidgetsAdapterApi,
} from '@urk/adapters/dom';
import {
  createKernel,
  type ControllerRegistration,
  type FrameInfo,
  type KernelEvent,
  type RuntimeContext,
  type RuntimeSnapshot,
} from '@urk/core';
import {
  mountRuntimePanel,
  readRuntimePanelElements,
  type RuntimePanelElements,
} from '../runtime-panel.js';
import type { ExampleMountOptions, ExampleMountResult } from '../types.js';

type PointerOverlayMode = 'idle' | 'hover' | 'surface' | 'target' | 'keyboard' | 'reset';

type PointerOverlayState = {
  mode: PointerOverlayMode;
  selectedTargetId: string;
  selectedLabel: string;
  pointerX: number;
  pointerY: number;
  keyCode: string;
  eventCount: number;
  message: string;
};

type PointerOverlayServices = {
  surface: HTMLElement;
  reticle: HTMLElement;
  status: HTMLElement;
  targets: HTMLElement[];
  state: PointerOverlayState;
};

type PointerTargetPayload = {
  targetId: string;
  meta?: Record<string, unknown>;
};

type PointerSurfacePayload = {
  surfaceId: string;
  localX: number;
  localY: number;
  nativeEvent: MouseEvent | PointerEvent;
};

type PointerInputEventPayload = {
  message: string;
  mode?: PointerOverlayMode;
  selectedTargetId?: string;
  selectedLabel?: string;
  pointerX?: number;
  pointerY?: number;
  keyCode?: string;
  eventCount?: number;
  observedType?: string;
  phase?: string;
  reason?: string;
};

const STAGES = [
  { id: 'mount-overlay', label: 'Mount Overlay Surface' },
  { id: 'bind-pointer', label: 'Bind Pointer Surface And Targets' },
  { id: 'bind-input', label: 'Bind Keyboard Input' },
  { id: 'sync-feedback', label: 'Sync Overlay Feedback' },
] as const;

const MAX_EVENTS = 32;

function emitPointerInputEvent(
  ctx: RuntimeContext,
  type: string,
  payload: PointerInputEventPayload,
): void {
  ctx.events.emit({
    type,
    source: 'pointer-overlay-controller',
    payload,
    timestamp: Date.now(),
  });
}

function isPointerTargetPayload(payload: unknown): payload is PointerTargetPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  return typeof (payload as PointerTargetPayload).targetId === 'string';
}

function isPointerSurfacePayload(payload: unknown): payload is PointerSurfacePayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as PointerSurfacePayload;

  return (
    typeof candidate.surfaceId === 'string' &&
    typeof candidate.localX === 'number' &&
    typeof candidate.localY === 'number'
  );
}

function getPointerOverlay(ctx: RuntimeContext): PointerOverlayServices {
  return ctx.services.require<PointerOverlayServices>('pointer-overlay:surface');
}

function getTargetLabel(target: HTMLElement): string {
  return target.dataset.pointerLabel ?? target.dataset.pointerTarget ?? 'Pointer target';
}

function describeState(state: PointerOverlayState): PointerInputEventPayload {
  return {
    message: state.message,
    mode: state.mode,
    selectedTargetId: state.selectedTargetId,
    selectedLabel: state.selectedLabel,
    pointerX: Math.round(state.pointerX),
    pointerY: Math.round(state.pointerY),
    keyCode: state.keyCode,
    eventCount: state.eventCount,
  };
}

function createOverlayTarget(id: string, label: string, left: string, top: string): HTMLElement {
  const target = document.createElement('button');

  target.type = 'button';
  target.dataset.pointerOverlayTarget = id;
  target.dataset.pointerTarget = id;
  target.dataset.pointerLabel = label;
  target.textContent = label;
  target.setAttribute('aria-label', `Select ${label}`);
  target.style.position = 'absolute';
  target.style.left = left;
  target.style.top = top;
  target.style.padding = '10px 12px';
  target.style.minWidth = '104px';
  target.style.border = '1px solid rgba(255, 255, 255, 0.32)';
  target.style.borderRadius = '16px';
  target.style.background = 'rgba(15, 23, 42, 0.74)';
  target.style.color = '#f8fafc';
  target.style.cursor = 'pointer';
  target.style.fontSize = '13px';
  target.style.fontWeight = '700';
  target.style.backdropFilter = 'blur(10px)';
  target.style.transition = 'transform 160ms ease, border-color 160ms ease, background 160ms ease';
  target.style.zIndex = '3';

  return target;
}

function styleTarget(target: HTMLElement, selected: boolean): void {
  target.style.transform = selected ? 'translateY(-5px) scale(1.04)' : 'translateY(0) scale(1)';
  target.style.borderColor = selected ? 'rgba(125, 211, 252, 0.95)' : 'rgba(255, 255, 255, 0.32)';
  target.style.background = selected ? 'rgba(14, 116, 144, 0.9)' : 'rgba(15, 23, 42, 0.74)';
}

function syncOverlaySurface(overlay: PointerOverlayServices): void {
  const state = overlay.state;

  overlay.status.textContent = `${state.message} Events: ${state.eventCount}. Key: ${state.keyCode}.`;
  overlay.reticle.style.left = `${state.pointerX}px`;
  overlay.reticle.style.top = `${state.pointerY}px`;
  overlay.reticle.style.background =
    state.mode === 'keyboard'
      ? 'rgba(250, 204, 21, 0.9)'
      : state.mode === 'target'
        ? 'rgba(34, 197, 94, 0.86)'
        : 'rgba(125, 211, 252, 0.86)';

  for (const target of overlay.targets) {
    styleTarget(target, target.dataset.pointerTarget === state.selectedTargetId);
  }
}

function updateWidgetOverlay(
  widgets: UiWidgetsAdapterApi,
  state: PointerOverlayState,
  title = 'Pointer/input overlay',
): void {
  widgets.setStatus(`Overlay ${state.mode}: ${state.selectedLabel}`);
  widgets.showCallout({
    title,
    body: `${state.message} Use pointer targets, click the surface, or press Space / R while focused.`,
    tone: state.mode === 'reset' ? 'neutral' : state.mode === 'keyboard' ? 'selected' : 'active',
  });
}

function setSelectedTarget(
  overlay: PointerOverlayServices,
  targetId: string,
  mode: PointerOverlayMode,
  message: string,
): PointerOverlayState {
  const target = overlay.targets.find((candidate) => candidate.dataset.pointerTarget === targetId);

  overlay.state.mode = mode;
  overlay.state.selectedTargetId = targetId;
  overlay.state.selectedLabel = target ? getTargetLabel(target) : targetId;
  overlay.state.eventCount += 1;
  overlay.state.message = message;

  if (target) {
    const targetBounds = target.getBoundingClientRect();
    const surfaceBounds = overlay.surface.getBoundingClientRect();

    overlay.state.pointerX = targetBounds.left - surfaceBounds.left + targetBounds.width / 2;
    overlay.state.pointerY = targetBounds.top - surfaceBounds.top + targetBounds.height / 2;
  }

  syncOverlaySurface(overlay);
  return overlay.state;
}

function setSurfacePoint(
  overlay: PointerOverlayServices,
  x: number,
  y: number,
  message: string,
): PointerOverlayState {
  overlay.state.mode = 'surface';
  overlay.state.selectedTargetId = 'surface';
  overlay.state.selectedLabel = 'Overlay surface';
  overlay.state.pointerX = Math.max(0, x);
  overlay.state.pointerY = Math.max(0, y);
  overlay.state.eventCount += 1;
  overlay.state.message = message;
  syncOverlaySurface(overlay);

  return overlay.state;
}

function activateKeyboardOverlay(
  ctx: RuntimeContext,
  overlay: PointerOverlayServices,
  widgets: UiWidgetsAdapterApi,
  code: string,
): void {
  overlay.state.mode = 'keyboard';
  overlay.state.selectedTargetId = 'keyboard';
  overlay.state.selectedLabel = 'Keyboard input';
  overlay.state.keyCode = code;
  overlay.state.eventCount += 1;
  overlay.state.message = `${code} activated the focused overlay surface.`;
  syncOverlaySurface(overlay);
  updateWidgetOverlay(widgets, overlay.state, 'Keyboard input');
  emitPointerInputEvent(ctx, 'pointer-input:key-activated', describeState(overlay.state));
}

function resetOverlay(
  ctx: RuntimeContext,
  overlay: PointerOverlayServices,
  widgets: UiWidgetsAdapterApi,
): void {
  overlay.state.mode = 'reset';
  overlay.state.selectedTargetId = 'focus-node';
  overlay.state.selectedLabel = 'Focus node';
  overlay.state.pointerX = 96;
  overlay.state.pointerY = 82;
  overlay.state.keyCode = 'KeyR';
  overlay.state.eventCount += 1;
  overlay.state.message = 'Keyboard reset returned overlay focus to the first target.';
  syncOverlaySurface(overlay);
  updateWidgetOverlay(widgets, overlay.state, 'Overlay reset');
  emitPointerInputEvent(ctx, 'pointer-input:reset', describeState(overlay.state));
}

function preparePointerOverlay(elements: RuntimePanelElements): {
  overlay: PointerOverlayServices;
  restore: () => void;
} {
  const previousPosition = elements.previewSurface.style.position;
  const previousOverflow = elements.previewSurface.style.overflow;
  const previousIsolation = elements.previewSurface.style.isolation;
  const surface = document.createElement('div');
  const status = document.createElement('div');
  const reticle = document.createElement('div');
  const guide = document.createElement('div');
  const targets = [
    createOverlayTarget('focus-node', 'Focus node', '7%', '22%'),
    createOverlayTarget('route-node', 'Route node', '42%', '55%'),
    createOverlayTarget('overlay-node', 'Overlay node', '66%', '24%'),
  ];
  const state: PointerOverlayState = {
    mode: 'idle',
    selectedTargetId: 'focus-node',
    selectedLabel: 'Focus node',
    pointerX: 96,
    pointerY: 82,
    keyCode: 'none',
    eventCount: 0,
    message: 'Overlay mounted. Click a target or press Space while focused.',
  };
  const overlay: PointerOverlayServices = {
    surface,
    reticle,
    status,
    targets,
    state,
  };

  if (!previousPosition) {
    elements.previewSurface.style.position = 'relative';
  }

  elements.previewSurface.style.overflow = 'hidden';
  elements.previewSurface.style.isolation = 'isolate';

  surface.dataset.pointerOverlaySurface = 'pointer-input-overlay';
  surface.setAttribute('aria-label', 'Pointer and keyboard input overlay surface');
  surface.tabIndex = 0;
  surface.style.position = 'relative';
  surface.style.height = '168px';
  surface.style.margin = '16px 0';
  surface.style.border = '1px solid rgba(148, 163, 184, 0.28)';
  surface.style.borderRadius = '22px';
  surface.style.background =
    'radial-gradient(circle at 18% 26%, rgba(125, 211, 252, 0.22), transparent 30%), radial-gradient(circle at 78% 64%, rgba(250, 204, 21, 0.2), transparent 28%), rgba(15, 23, 42, 0.62)';
  surface.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.08)';
  surface.style.overflow = 'hidden';
  surface.style.pointerEvents = 'auto';
  surface.style.outline = 'none';

  guide.textContent = 'Click targets, click empty space, press Space, or press R';
  guide.style.position = 'absolute';
  guide.style.left = '16px';
  guide.style.top = '14px';
  guide.style.color = '#e2e8f0';
  guide.style.fontSize = '12px';
  guide.style.fontWeight = '800';
  guide.style.letterSpacing = '0.08em';
  guide.style.textTransform = 'uppercase';

  status.dataset.pointerOverlayStatus = 'true';
  status.style.position = 'absolute';
  status.style.left = '16px';
  status.style.right = '16px';
  status.style.bottom = '14px';
  status.style.padding = '8px 10px';
  status.style.borderRadius = '14px';
  status.style.background = 'rgba(15, 23, 42, 0.72)';
  status.style.color = '#f8fafc';
  status.style.fontSize = '12px';
  status.style.fontWeight = '650';
  status.style.backdropFilter = 'blur(10px)';
  status.style.zIndex = '4';

  reticle.dataset.pointerOverlayReticle = 'true';
  reticle.style.position = 'absolute';
  reticle.style.width = '18px';
  reticle.style.height = '18px';
  reticle.style.border = '2px solid rgba(15, 23, 42, 0.86)';
  reticle.style.borderRadius = '999px';
  reticle.style.boxShadow = '0 0 0 7px rgba(125, 211, 252, 0.18)';
  reticle.style.transform = 'translate(-50%, -50%)';
  reticle.style.transition = 'left 120ms ease, top 120ms ease, background 120ms ease';
  reticle.style.zIndex = '2';

  surface.append(guide, reticle, ...targets, status);
  elements.previewSurface.insertBefore(surface, elements.previewMessage);
  syncOverlaySurface(overlay);

  return {
    overlay,
    restore() {
      surface.remove();
      elements.previewSurface.style.position = previousPosition;
      elements.previewSurface.style.overflow = previousOverflow;
      elements.previewSurface.style.isolation = previousIsolation;
    },
  };
}

function createPointerOverlayController(): ControllerRegistration {
  let elapsedMs = 0;
  let activeStageId: string | null = null;
  let completed = false;
  let cleanups: Array<() => void> = [];
  let unsubscribeEvents: Array<() => void> = [];

  return {
    id: 'pointer-overlay-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const pointer = ctx.adapters.require<PointerAdapterApi>('pointer');
      const input = ctx.adapters.require<InputAdapterApi>('input');
      const widgets = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');
      const overlay = getPointerOverlay(ctx);

      loading.begin([...STAGES], 'Binding pointer and keyboard input to the overlay surface');
      overlay.surface.focus();

      cleanups = [
        pointer.bindSurface({
          id: 'pointer-overlay-surface',
          element: overlay.surface,
          meta: { example: 'pointer-input-overlay' },
        }),
        input.bindKey({
          code: 'Space',
          phase: 'down',
          handler(event: InputKeyEvent) {
            event.nativeEvent.preventDefault();
            activateKeyboardOverlay(ctx, overlay, widgets, event.code);
          },
        }),
        input.bindKey({
          code: 'KeyR',
          phase: 'down',
          handler(event: InputKeyEvent) {
            event.nativeEvent.preventDefault();
            resetOverlay(ctx, overlay, widgets);
          },
        }),
      ];

      for (const target of overlay.targets) {
        cleanups.push(
          pointer.bindTarget({
            id: target.dataset.pointerTarget ?? 'pointer-target',
            element: target,
            meta: { label: getTargetLabel(target) },
          }),
        );
      }

      unsubscribeEvents = [
        ctx.events.on('pointer:hover', (event: KernelEvent) => {
          if (!isPointerTargetPayload(event.payload)) {
            return;
          }

          const nextState = setSelectedTarget(
            overlay,
            event.payload.targetId,
            'hover',
            `Hovering ${event.payload.meta?.label ?? event.payload.targetId}.`,
          );

          updateWidgetOverlay(widgets, nextState, 'Pointer hover');
          emitPointerInputEvent(ctx, 'pointer-input:target-hovered', {
            ...describeState(nextState),
            observedType: event.type,
          });
        }),
        ctx.events.on('pointer:select', (event: KernelEvent) => {
          if (!isPointerTargetPayload(event.payload)) {
            return;
          }

          const nextState = setSelectedTarget(
            overlay,
            event.payload.targetId,
            'target',
            `Selected ${event.payload.meta?.label ?? event.payload.targetId} through pointer target binding.`,
          );

          updateWidgetOverlay(widgets, nextState, 'Pointer target selected');
          emitPointerInputEvent(ctx, 'pointer-input:target-selected', {
            ...describeState(nextState),
            observedType: event.type,
          });
        }),
        ctx.events.on('pointer:surface-select', (event: KernelEvent) => {
          if (!isPointerSurfacePayload(event.payload)) {
            return;
          }

          if (
            event.payload.nativeEvent.target instanceof HTMLElement &&
            event.payload.nativeEvent.target.closest('[data-pointer-overlay-target]')
          ) {
            return;
          }

          const nextState = setSurfacePoint(
            overlay,
            event.payload.localX,
            event.payload.localY,
            'Selected empty overlay space through pointer surface binding.',
          );

          updateWidgetOverlay(widgets, nextState, 'Pointer surface selected');
          emitPointerInputEvent(ctx, 'pointer-input:surface-selected', {
            ...describeState(nextState),
            observedType: event.type,
          });
        }),
      ];

      updateWidgetOverlay(widgets, overlay.state);
      emitPointerInputEvent(ctx, 'pointer-input:bindings-ready', {
        ...describeState(overlay.state),
        message: 'Pointer surface, pointer targets, and keyboard bindings are registered.',
      });
    },
    update(frame: FrameInfo, ctx) {
      if (completed) {
        return;
      }

      const deltaMs = frame.deltaMs === 0 ? 16 : frame.deltaMs;
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      elapsedMs += deltaMs;

      if (elapsedMs < 650) {
        if (activeStageId !== 'mount-overlay') {
          activeStageId = 'mount-overlay';
          loading.setStage('mount-overlay', 0.24, 'Focusable overlay surface is mounted');
        }

        return;
      }

      if (elapsedMs < 1250) {
        if (activeStageId !== 'bind-pointer') {
          activeStageId = 'bind-pointer';
          loading.setStage(
            'bind-pointer',
            0.52,
            'Pointer adapter owns surface and target event bindings',
          );
        }

        return;
      }

      if (elapsedMs < 1850) {
        if (activeStageId !== 'bind-input') {
          activeStageId = 'bind-input';
          loading.setStage(
            'bind-input',
            0.76,
            'Input adapter owns Space and R keyboard bindings',
          );
          emitPointerInputEvent(ctx, 'pointer-input:keyboard-ready', {
            message: 'Keyboard bindings are ready on the focused overlay surface.',
            keyCode: 'Space/KeyR',
          });
        }

        return;
      }

      if (elapsedMs < 2350) {
        if (activeStageId !== 'sync-feedback') {
          activeStageId = 'sync-feedback';
          loading.setStage('sync-feedback', 0.92, 'Overlay feedback is synchronized');
        }

        return;
      }

      loading.complete('Pointer/input overlay ready: pointer and keyboard feedback are visible');
      emitPointerInputEvent(ctx, 'pointer-input:ready', {
        ...describeState(getPointerOverlay(ctx).state),
        message: 'Pointer/input overlay reached ready.',
      });
      ctx.state.setPhase('ready', 'pointer-input-overlay:ready');
      completed = true;
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      const widgets = ctx.adapters.get<UiWidgetsAdapterApi>('ui-widgets');

      if (next.phase === 'paused') {
        widgets?.setStatus('Pointer/input overlay paused');
        emitPointerInputEvent(ctx, 'pointer-input:paused', {
          message: 'Pointer/input overlay observed runtime pause.',
          phase: next.phase,
          reason: next.reason,
        });
      }

      if (previous.phase === 'paused' && next.phase !== 'paused') {
        widgets?.setStatus('Pointer/input overlay resumed');
        emitPointerInputEvent(ctx, 'pointer-input:resumed', {
          message: 'Pointer/input overlay observed runtime resume.',
          phase: next.phase,
          reason: next.reason,
        });
      }
    },
    dispose(ctx) {
      for (const unsubscribe of unsubscribeEvents) {
        unsubscribe();
      }

      for (const cleanup of cleanups) {
        cleanup();
      }

      unsubscribeEvents = [];
      cleanups = [];
      ctx.adapters.get<UiWidgetsAdapterApi>('ui-widgets')?.hideCallout();
      emitPointerInputEvent(ctx, 'pointer-input:disposed', {
        message: 'Pointer/input overlay released pointer and keyboard bindings.',
        phase: ctx.state.getSnapshot().phase,
        reason: ctx.state.getSnapshot().reason,
      });
    },
  };
}

function createKernelInstance(uiHost: HTMLElement, overlay: PointerOverlayServices) {
  return createKernel({
    id: 'urk-www-pointer-input-overlay',
    services: {
      'ui:host': uiHost,
      'input:target': overlay.surface,
      'pointer-overlay:surface': overlay,
    },
    adapters: [
      createLoadingAdapter(),
      createPointerAdapter(),
      createInputAdapter(),
      createUiWidgetsAdapter(),
    ],
    controllers: [createPointerOverlayController()],
  });
}

export async function mountPointerInputOverlayExample(
  host: HTMLElement,
  _options: ExampleMountOptions = {},
): Promise<ExampleMountResult> {
  const elements = readRuntimePanelElements(host, 'pointer input overlay');
  const { overlay, restore } = preparePointerOverlay(elements);
  const kernel = createKernelInstance(elements.previewSurface, overlay);

  return mountRuntimePanel({
    elements,
    kernel,
    exampleLabel: 'pointer input overlay',
    pauseReason: 'pointer-input-overlay:pause',
    resumeReason: 'pointer-input-overlay:resume',
    shutdownReason: 'pointer-input-overlay:shutdown',
    teardownReason: 'pointer-input-overlay:teardown',
    mountFailureMessage: 'The pointer/input overlay example failed to mount.',
    previewFailureMessage:
      'The site stayed responsive, but the pointer/input overlay example did not finish mounting.',
    recentEventLimit: MAX_EVENTS,
    onTeardown: restore,
  });
}
