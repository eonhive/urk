/**
 * Company: EonHive Inc.
 * Title: Scene UI Bridge Mount
 * Purpose: Mount the public URK example that coordinates scene state with User Interface overlay state.
 * Author: Stan Nesi
 * Created: 2026-05-08
 * Updated: 2026-05-08
 * Notes: Vibe coded with Codex.
 */

import {
  createLoadingAdapter,
  createPointerAdapter,
  createUiWidgetsAdapter,
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

type SceneBridgeState = {
  selectedNodeId: string;
  selectedLabel: string;
  syncCount: number;
  pointerSource: 'scripted' | 'pointer';
  overlayMessage: string;
};

type SceneBridgeServices = {
  surface: HTMLElement;
  nodes: HTMLElement[];
  state: SceneBridgeState;
};

type SceneUiEventPayload = {
  message: string;
  selectedNodeId?: string;
  selectedLabel?: string;
  syncCount?: number;
  pointerSource?: SceneBridgeState['pointerSource'];
  observedType?: string;
  phase?: string;
  reason?: string;
};

type PointerTargetPayload = {
  targetId: string;
  meta?: Record<string, unknown>;
};

const STAGES = [
  { id: 'mount-scene', label: 'Mount Scene Surface' },
  { id: 'bind-pointer', label: 'Bind Pointer Targets' },
  { id: 'select-scene-node', label: 'Select Scene Node' },
  { id: 'sync-overlay', label: 'Sync UI Overlay' },
] as const;

const MAX_EVENTS = 28;

function emitSceneEvent(
  ctx: RuntimeContext,
  type: string,
  source: string,
  payload: SceneUiEventPayload,
): void {
  ctx.events.emit({
    type,
    source,
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

function getSceneBridge(ctx: RuntimeContext): SceneBridgeServices {
  return ctx.services.require<SceneBridgeServices>('scene:bridge');
}

function getNodeLabel(node: HTMLElement): string {
  return node.dataset.sceneLabel ?? node.dataset.sceneNode ?? 'Scene node';
}

function selectSceneNode(
  scene: SceneBridgeServices,
  nodeId: string,
  pointerSource: SceneBridgeState['pointerSource'],
): SceneBridgeState {
  const selectedNode = scene.nodes.find((node) => node.dataset.sceneNode === nodeId);

  if (!selectedNode) {
    return scene.state;
  }

  scene.state.selectedNodeId = nodeId;
  scene.state.selectedLabel = getNodeLabel(selectedNode);
  scene.state.pointerSource = pointerSource;
  scene.state.syncCount += 1;
  scene.state.overlayMessage =
    pointerSource === 'pointer'
      ? `Pointer selected ${scene.state.selectedLabel}.`
      : `Scene controller selected ${scene.state.selectedLabel}.`;

  for (const node of scene.nodes) {
    const selected = node === selectedNode;

    node.style.transform = selected ? 'translateY(-6px) scale(1.04)' : 'translateY(0) scale(1)';
    node.style.borderColor = selected ? 'rgba(250, 204, 21, 0.95)' : 'rgba(255, 255, 255, 0.34)';
    node.style.boxShadow = selected
      ? '0 18px 40px rgba(250, 204, 21, 0.22)'
      : '0 12px 26px rgba(15, 23, 42, 0.18)';
  }

  return scene.state;
}

function describeState(state: SceneBridgeState): SceneUiEventPayload {
  return {
    message: state.overlayMessage,
    selectedNodeId: state.selectedNodeId,
    selectedLabel: state.selectedLabel,
    syncCount: state.syncCount,
    pointerSource: state.pointerSource,
  };
}

function createSceneNode(id: string, label: string, left: string, top: string): HTMLElement {
  const node = document.createElement('button');

  node.type = 'button';
  node.dataset.sceneNode = id;
  node.dataset.sceneLabel = label;
  node.textContent = label;
  node.setAttribute('aria-label', `Select ${label}`);
  node.style.position = 'absolute';
  node.style.left = left;
  node.style.top = top;
  node.style.minWidth = '112px';
  node.style.padding = '10px 12px';
  node.style.border = '1px solid rgba(255, 255, 255, 0.34)';
  node.style.borderRadius = '999px';
  node.style.background = 'linear-gradient(135deg, rgba(14, 116, 144, 0.88), rgba(22, 101, 52, 0.86))';
  node.style.color = '#f8fafc';
  node.style.cursor = 'pointer';
  node.style.fontSize = '13px';
  node.style.fontWeight = '700';
  node.style.letterSpacing = '0.02em';
  node.style.transition = 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease';
  node.style.zIndex = '2';

  return node;
}

function prepareSceneBridge(elements: RuntimePanelElements): {
  bridge: SceneBridgeServices;
  restore: () => void;
} {
  const previousPosition = elements.previewSurface.style.position;
  const previousOverflow = elements.previewSurface.style.overflow;
  const previousIsolation = elements.previewSurface.style.isolation;
  const surface = document.createElement('div');
  const caption = document.createElement('div');
  const orbit = document.createElement('div');
  const nodes = [
    createSceneNode('scene-core', 'Scene core', '7%', '54%'),
    createSceneNode('ui-overlay', 'UI overlay', '40%', '18%'),
    createSceneNode('bridge-state', 'Bridge state', '66%', '58%'),
  ];
  const state: SceneBridgeState = {
    selectedNodeId: 'scene-core',
    selectedLabel: 'Scene core',
    syncCount: 0,
    pointerSource: 'scripted',
    overlayMessage: 'Scene surface mounted; waiting for bridge synchronization.',
  };

  if (!previousPosition) {
    elements.previewSurface.style.position = 'relative';
  }

  elements.previewSurface.style.overflow = 'hidden';
  elements.previewSurface.style.isolation = 'isolate';

  surface.dataset.sceneSurface = 'scene-ui-bridge';
  surface.setAttribute('aria-label', 'Scene and User Interface bridge surface');
  surface.style.position = 'relative';
  surface.style.height = '156px';
  surface.style.margin = '16px 0';
  surface.style.border = '1px solid rgba(148, 163, 184, 0.26)';
  surface.style.borderRadius = '22px';
  surface.style.background =
    'radial-gradient(circle at 24% 32%, rgba(34, 211, 238, 0.24), transparent 32%), radial-gradient(circle at 76% 70%, rgba(34, 197, 94, 0.22), transparent 30%), rgba(15, 23, 42, 0.58)';
  surface.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.08)';
  surface.style.overflow = 'hidden';
  surface.style.pointerEvents = 'auto';

  caption.textContent = 'Scene-like surface: click a node to sync the overlay';
  caption.style.position = 'absolute';
  caption.style.left = '16px';
  caption.style.top = '14px';
  caption.style.color = '#e2e8f0';
  caption.style.fontSize = '12px';
  caption.style.fontWeight = '700';
  caption.style.letterSpacing = '0.08em';
  caption.style.textTransform = 'uppercase';
  caption.style.zIndex = '1';

  orbit.style.position = 'absolute';
  orbit.style.left = '13%';
  orbit.style.right = '13%';
  orbit.style.top = '50%';
  orbit.style.height = '1px';
  orbit.style.background = 'linear-gradient(90deg, transparent, rgba(226, 232, 240, 0.42), transparent)';
  orbit.style.transform = 'translateY(-50%)';

  surface.append(caption, orbit, ...nodes);
  elements.previewSurface.insertBefore(surface, elements.previewMessage);
  selectSceneNode({ surface, nodes, state }, state.selectedNodeId, 'scripted');

  return {
    bridge: {
      surface,
      nodes,
      state,
    },
    restore() {
      surface.remove();
      elements.previewSurface.style.position = previousPosition;
      elements.previewSurface.style.overflow = previousOverflow;
      elements.previewSurface.style.isolation = previousIsolation;
    },
  };
}

function createSceneController(): ControllerRegistration {
  let elapsedMs = 0;
  let activeStageId: string | null = null;
  let completed = false;
  let cleanups: Array<() => void> = [];
  let unsubscribePointerSelect: (() => void) | null = null;

  return {
    id: 'scene-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const pointer = ctx.adapters.require<PointerAdapterApi>('pointer');
      const scene = getSceneBridge(ctx);

      loading.begin([...STAGES], 'Coordinating scene state with a User Interface overlay');

      cleanups = scene.nodes.map((node) => {
        return pointer.bindTarget({
          id: node.dataset.sceneNode ?? 'scene-node',
          element: node,
          meta: { label: getNodeLabel(node) },
        });
      });

      unsubscribePointerSelect = ctx.events.on('pointer:select', (event: KernelEvent) => {
        if (!isPointerTargetPayload(event.payload)) {
          return;
        }

        const nextState = selectSceneNode(scene, event.payload.targetId, 'pointer');

        emitSceneEvent(ctx, 'scene-ui:node-selected', 'scene-controller', {
          ...describeState(nextState),
          message: `Scene controller accepted pointer selection for ${nextState.selectedLabel}.`,
          observedType: event.type,
        });
      });

      emitSceneEvent(ctx, 'scene-ui:scene-mounted', 'scene-controller', {
        ...describeState(scene.state),
        message: 'Scene controller mounted the scene surface and bound pointer targets.',
      });
    },
    update(frame: FrameInfo, ctx) {
      if (completed) {
        return;
      }

      const deltaMs = frame.deltaMs === 0 ? 16 : frame.deltaMs;
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const scene = getSceneBridge(ctx);

      elapsedMs += deltaMs;

      if (elapsedMs < 650) {
        if (activeStageId !== 'mount-scene') {
          activeStageId = 'mount-scene';
          loading.setStage('mount-scene', 0.25, 'Scene-like browser surface is mounted');
        }

        return;
      }

      if (elapsedMs < 1250) {
        if (activeStageId !== 'bind-pointer') {
          activeStageId = 'bind-pointer';
          loading.setStage('bind-pointer', 0.5, 'Pointer targets are bound through the adapter');
        }

        return;
      }

      if (elapsedMs < 1850) {
        if (activeStageId !== 'select-scene-node') {
          activeStageId = 'select-scene-node';
          loading.setStage(
            'select-scene-node',
            0.74,
            'Scene controller updates example-local scene state',
          );
          const nextState = selectSceneNode(scene, 'ui-overlay', 'scripted');

          emitSceneEvent(ctx, 'scene-ui:scene-state-changed', 'scene-controller', {
            ...describeState(nextState),
            message: 'Scene state changed and should synchronize to the overlay.',
          });
        }

        return;
      }

      if (elapsedMs < 2350) {
        if (activeStageId !== 'sync-overlay') {
          activeStageId = 'sync-overlay';
          loading.setStage('sync-overlay', 0.92, 'UI bridge controller will sync the overlay');
          emitSceneEvent(ctx, 'scene-ui:overlay-sync-requested', 'scene-controller', {
            ...describeState(scene.state),
            message: 'Scene controller requested an overlay synchronization.',
          });
        }

        return;
      }

      loading.complete('Scene/UI bridge ready: scene state and UI overlay are synchronized');
      emitSceneEvent(ctx, 'scene-ui:ready', 'scene-controller', {
        ...describeState(scene.state),
        message: 'Scene and User Interface bridge reached ready.',
      });
      ctx.state.setPhase('ready', 'scene-ui-bridge:ready');
      completed = true;
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      if (next.phase === 'paused') {
        emitSceneEvent(ctx, 'scene-ui:scene-paused', 'scene-controller', {
          message: 'Scene controller observed the runtime pause.',
          phase: next.phase,
          reason: next.reason,
        });
      }

      if (previous.phase === 'paused' && next.phase !== 'paused') {
        emitSceneEvent(ctx, 'scene-ui:scene-resumed', 'scene-controller', {
          message: 'Scene controller observed the runtime resume.',
          phase: next.phase,
          reason: next.reason,
        });
      }
    },
    dispose(ctx) {
      for (const cleanup of cleanups) {
        cleanup();
      }

      cleanups = [];
      unsubscribePointerSelect?.();
      unsubscribePointerSelect = null;
      emitSceneEvent(ctx, 'scene-ui:scene-disposed', 'scene-controller', {
        message: 'Scene controller released pointer target bindings.',
        phase: ctx.state.getSnapshot().phase,
        reason: ctx.state.getSnapshot().reason,
      });
    },
  };
}

function syncOverlay(
  ctx: RuntimeContext,
  widgets: UiWidgetsAdapterApi,
  state: SceneBridgeState,
  observedType: string,
): void {
  widgets.setStatus(`Scene/UI synced: ${state.selectedLabel}`);
  widgets.showCallout({
    title: `Selected: ${state.selectedLabel}`,
    body: `${state.overlayMessage} Sync count: ${state.syncCount}.`,
    tone: state.pointerSource === 'pointer' ? 'selected' : 'active',
  });

  emitSceneEvent(ctx, 'scene-ui:overlay-synced', 'ui-bridge-controller', {
    ...describeState(state),
    message: 'UI bridge controller synchronized overlay state from scene state.',
    observedType,
  });
}

function createUiBridgeController(): ControllerRegistration {
  let unsubscribe: Array<() => void> = [];

  return {
    id: 'ui-bridge-controller',
    start(ctx) {
      const widgets = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');
      const scene = getSceneBridge(ctx);

      widgets.setStatus('Scene/UI bridge waiting');
      widgets.showCallout({
        title: 'Scene/UI bridge',
        body: 'Scene state will drive this User Interface overlay without moving renderer code into the kernel.',
        tone: 'active',
      });

      unsubscribe = [
        ctx.events.on('scene-ui:scene-mounted', (event) => {
          syncOverlay(ctx, widgets, scene.state, event.type);
        }),
        ctx.events.on('scene-ui:scene-state-changed', (event) => {
          syncOverlay(ctx, widgets, scene.state, event.type);
        }),
        ctx.events.on('scene-ui:node-selected', (event) => {
          syncOverlay(ctx, widgets, scene.state, event.type);
        }),
        ctx.events.on('scene-ui:overlay-sync-requested', (event) => {
          syncOverlay(ctx, widgets, scene.state, event.type);
        }),
        ctx.events.on('scene-ui:ready', (event) => {
          syncOverlay(ctx, widgets, scene.state, event.type);
        }),
      ];

      emitSceneEvent(ctx, 'scene-ui:bridge-listening', 'ui-bridge-controller', {
        message: 'UI bridge controller is listening for scene events.',
      });
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      const widgets = ctx.adapters.get<UiWidgetsAdapterApi>('ui-widgets');

      if (!widgets) {
        return;
      }

      if (next.phase === 'paused') {
        widgets.setStatus('Scene/UI bridge paused');
        emitSceneEvent(ctx, 'scene-ui:bridge-paused', 'ui-bridge-controller', {
          message: 'UI bridge controller observed runtime pause.',
          phase: next.phase,
          reason: next.reason,
        });
      }

      if (previous.phase === 'paused' && next.phase !== 'paused') {
        widgets.setStatus('Scene/UI bridge resumed');
        emitSceneEvent(ctx, 'scene-ui:bridge-resumed', 'ui-bridge-controller', {
          message: 'UI bridge controller observed runtime resume.',
          phase: next.phase,
          reason: next.reason,
        });
      }
    },
    dispose(ctx) {
      for (const cleanup of unsubscribe) {
        cleanup();
      }

      unsubscribe = [];
      ctx.adapters.get<UiWidgetsAdapterApi>('ui-widgets')?.hideCallout();
      emitSceneEvent(ctx, 'scene-ui:bridge-disposed', 'ui-bridge-controller', {
        message: 'UI bridge controller removed scene event subscriptions.',
      });
    },
  };
}

function createKernelInstance(uiHost: HTMLElement, sceneBridge: SceneBridgeServices) {
  return createKernel({
    id: 'urk-www-scene-ui-bridge',
    services: {
      'ui:host': uiHost,
      'scene:bridge': sceneBridge,
    },
    adapters: [createLoadingAdapter(), createUiWidgetsAdapter(), createPointerAdapter()],
    controllers: [createUiBridgeController(), createSceneController()],
  });
}

export async function mountSceneUiBridgeExample(
  host: HTMLElement,
  _options: ExampleMountOptions = {},
): Promise<ExampleMountResult> {
  const elements = readRuntimePanelElements(host, 'scene UI bridge');
  const { bridge, restore } = prepareSceneBridge(elements);
  const kernel = createKernelInstance(elements.previewSurface, bridge);

  return mountRuntimePanel({
    elements,
    kernel,
    exampleLabel: 'scene UI bridge',
    pauseReason: 'scene-ui-bridge:pause',
    resumeReason: 'scene-ui-bridge:resume',
    shutdownReason: 'scene-ui-bridge:shutdown',
    teardownReason: 'scene-ui-bridge:teardown',
    mountFailureMessage: 'The scene UI bridge example failed to mount.',
    previewFailureMessage:
      'The site stayed responsive, but the scene UI bridge example did not finish mounting.',
    recentEventLimit: MAX_EVENTS,
    onTeardown: restore,
  });
}
