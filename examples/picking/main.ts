/**
 * Company: EonHive Inc.
 * Title: URK DOM Proof Example
 * Purpose: Prove the v0 kernel contracts with a standalone browser demo.
 * Author: Stan Nesi
 * Created: 2026-04-12
 * Updated: 2026-04-22
 * Notes: Vibe coded with Codex.
 */

import { createKernel, type ControllerRegistration, type RuntimePhase } from '@urk/core';
import {
  createInputAdapter,
  createLoadingAdapter,
  createPointerAdapter,
  createStorageAdapter,
  createThreeAdapter,
  createUiWidgetsAdapter,
  type InputAdapterApi,
  type InputKeyEvent,
  type LoadingAdapterApi,
  type PointerAdapterApi,
  type PointerSurfaceEventPayload,
  type PointerTargetEventPayload,
  type StorageAdapterApi,
  type StorageArea,
  type ThreeAdapterApi,
  type UiWidgetsAdapterApi,
} from '@urk/adapters';
import * as THREE from 'three';

declare global {
  interface Window {
    __URK_DOM_PROOF__?: {
      kernel: ReturnType<typeof createKernel>;
      createInputAdapter: typeof createInputAdapter;
      createPointerAdapter: typeof createPointerAdapter;
      createStorageAdapter: typeof createStorageAdapter;
      createThreeAdapter: typeof createThreeAdapter;
    };
  }
}

const PROOF_TARGET_IDS = ['pulse-node-a', 'pulse-node-b'] as const;

type ProofTargetId = (typeof PROOF_TARGET_IDS)[number];

type ProofTargetState = {
  offsetX: number;
  offsetY: number;
};

type ProofTargetElements = Record<ProofTargetId, HTMLButtonElement>;

type AppElements = {
  phaseValue: HTMLElement;
  reasonValue: HTMLElement;
  frameValue: HTMLElement;
  progressValue: HTMLElement;
  progressFill: HTMLElement;
  messageValue: HTMLElement;
  eventValue: HTMLElement;
  positionValue: HTMLElement;
  inputValue: HTMLElement;
  storageValue: HTMLElement;
  pauseButton: HTMLButtonElement;
  resumeButton: HTMLButtonElement;
  shutdownButton: HTMLButtonElement;
  saveLocalButton: HTMLButtonElement;
  loadLocalButton: HTMLButtonElement;
  saveSessionButton: HTMLButtonElement;
  loadSessionButton: HTMLButtonElement;
  clearSavedButton: HTMLButtonElement;
  sceneTargets: ProofTargetElements;
  threeHost: HTMLElement;
  uiHost: HTMLElement;
};

// The proof keeps a small shared state model so controllers can coordinate
// DOM affordances, scene meshes, storage, and input without product-specific logic.
type ProofSceneState = {
  targets: Record<ProofTargetId, ProofTargetState>;
  selectedTargetId: ProofTargetId | null;
  hoveredTargetId: ProofTargetId | null;
  lastInputEvent: string;
};

type ProofSceneSnapshot = {
  targets: Record<ProofTargetId, ProofTargetState>;
  selectedTargetId: ProofTargetId | null;
};

type ProofTargetConfig = {
  label: string;
  shortLabel: string;
  baseColor: number;
  hoverColor: number;
  selectedColor: number;
  baseEmissive: number;
  selectedEmissive: number;
  rotationDirection: number;
};

const TARGET_CONFIG: Record<ProofTargetId, ProofTargetConfig> = {
  'pulse-node-a': {
    label: 'Pulse Node A',
    shortLabel: 'A',
    baseColor: 0x38bdf8,
    hoverColor: 0x7dd3fc,
    selectedColor: 0x22c55e,
    baseEmissive: 0x0f766e,
    selectedEmissive: 0x166534,
    rotationDirection: 1,
  },
  'pulse-node-b': {
    label: 'Pulse Node B',
    shortLabel: 'B',
    baseColor: 0xf97316,
    hoverColor: 0xfdba74,
    selectedColor: 0xfacc15,
    baseEmissive: 0x9a3412,
    selectedEmissive: 0xa16207,
    rotationDirection: -1,
  },
};

const INITIAL_TARGETS: Record<ProofTargetId, ProofTargetState> = {
  'pulse-node-a': { offsetX: -72, offsetY: 10 },
  'pulse-node-b': { offsetX: 72, offsetY: -10 },
};

const DEFAULT_ACTIVE_TARGET_ID: ProofTargetId = 'pulse-node-a';
const PROOF_STORAGE_KEY = 'scene-state';
const TARGET_MOVE_STEP = 24;
const TARGET_MOVE_LIMIT = 96;
const THREE_POSITION_SCALE = 48;
const DOM_TARGET_OFFSET_Y = -116;

function assertElement<T extends Element>(value: T | null, label: string): T {
  if (!value) {
    throw new Error(`Missing DOM element: ${label}`);
  }

  return value;
}

function createLayout(): AppElements {
  const app = assertElement(document.querySelector<HTMLDivElement>('#app'), '#app');

  return {
    phaseValue: assertElement(app.querySelector('[data-role="phase-value"]'), 'phase value'),
    reasonValue: assertElement(app.querySelector('[data-role="reason-value"]'), 'reason value'),
    frameValue: assertElement(app.querySelector('[data-role="frame-value"]'), 'frame value'),
    progressValue: assertElement(app.querySelector('[data-role="progress-value"]'), 'progress value'),
    progressFill: assertElement(app.querySelector('[data-role="progress-fill"]'), 'progress fill'),
    messageValue: assertElement(app.querySelector('[data-role="message-value"]'), 'message value'),
    eventValue: assertElement(app.querySelector('[data-role="event-value"]'), 'event value'),
    positionValue: assertElement(app.querySelector('[data-role="position-value"]'), 'position value'),
    inputValue: assertElement(app.querySelector('[data-role="input-value"]'), 'input value'),
    storageValue: assertElement(app.querySelector('[data-role="storage-value"]'), 'storage value'),
    pauseButton: assertElement(app.querySelector('[data-role="pause-button"]'), 'pause button'),
    resumeButton: assertElement(app.querySelector('[data-role="resume-button"]'), 'resume button'),
    shutdownButton: assertElement(app.querySelector('[data-role="shutdown-button"]'), 'shutdown button'),
    saveLocalButton: assertElement(app.querySelector('[data-role="save-local-button"]'), 'save local button'),
    loadLocalButton: assertElement(app.querySelector('[data-role="load-local-button"]'), 'load local button'),
    saveSessionButton: assertElement(
      app.querySelector('[data-role="save-session-button"]'),
      'save session button',
    ),
    loadSessionButton: assertElement(
      app.querySelector('[data-role="load-session-button"]'),
      'load session button',
    ),
    clearSavedButton: assertElement(
      app.querySelector('[data-role="clear-saved-button"]'),
      'clear saved button',
    ),
    sceneTargets: {
      'pulse-node-a': assertElement(
        app.querySelector('[data-role="scene-target-a"]'),
        'scene target A',
      ),
      'pulse-node-b': assertElement(
        app.querySelector('[data-role="scene-target-b"]'),
        'scene target B',
      ),
    },
    threeHost: assertElement(app.querySelector('[data-role="three-host"]'), 'three host'),
    uiHost: assertElement(app.querySelector('[data-role="ui-host"]'), 'ui host'),
  };
}

function phaseStatus(phase: RuntimePhase): string {
  switch (phase) {
    case 'boot':
      return 'Booting kernel';
    case 'loading':
      return 'Loading staged capabilities';
    case 'transition':
      return 'Handing off to interactive mode';
    case 'ready':
      return 'Ready for interaction';
    case 'paused':
      return 'Paused';
    case 'error':
      return 'Runtime error';
    default:
      return phase;
  }
}

function isProofTargetId(value: unknown): value is ProofTargetId {
  return typeof value === 'string' && PROOF_TARGET_IDS.includes(value as ProofTargetId);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function cloneTargets(
  targets: Record<ProofTargetId, ProofTargetState>,
): Record<ProofTargetId, ProofTargetState> {
  return {
    'pulse-node-a': { ...targets['pulse-node-a'] },
    'pulse-node-b': { ...targets['pulse-node-b'] },
  };
}

function createInitialSceneState(): ProofSceneState {
  return {
    targets: cloneTargets(INITIAL_TARGETS),
    selectedTargetId: null,
    hoveredTargetId: null,
    lastInputEvent: 'waiting',
  };
}

function getActiveTargetId(sceneState: ProofSceneState): ProofTargetId {
  return sceneState.selectedTargetId ?? DEFAULT_ACTIVE_TARGET_ID;
}

function getTargetLabel(targetId: ProofTargetId): string {
  return TARGET_CONFIG[targetId].label;
}

function getTargetShortLabel(targetId: ProofTargetId): string {
  return TARGET_CONFIG[targetId].shortLabel;
}

function formatPosition(sceneState: ProofSceneState): string {
  return PROOF_TARGET_IDS.map((targetId) => {
    const position = sceneState.targets[targetId];
    return `${getTargetShortLabel(targetId)} x ${position.offsetX}px, y ${position.offsetY}px`;
  }).join(' | ');
}

function formatInputEvent(event: InputKeyEvent, isInteractive: boolean): string {
  const parts = [`${event.phase}:${event.code}`];

  if (event.repeat) {
    parts.push('repeat');
  }

  if (!isInteractive) {
    parts.push('ignored');
  }

  return parts.join(' ');
}

function formatStorageSummary(localSaved: boolean, sessionSaved: boolean): string {
  return `local ${localSaved ? 'saved' : 'empty'} | session ${sessionSaved ? 'saved' : 'empty'}`;
}

function createSceneSnapshot(sceneState: ProofSceneState): ProofSceneSnapshot {
  return {
    targets: cloneTargets(sceneState.targets),
    selectedTargetId: sceneState.selectedTargetId,
  };
}

function parseSceneSnapshot(value: unknown): ProofSceneSnapshot {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Stored scene state is invalid.');
  }

  const snapshot = value as Record<string, unknown>;
  const rawTargets = snapshot.targets;

  if (typeof rawTargets !== 'object' || rawTargets === null) {
    throw new Error('Stored scene state must include target positions.');
  }

  const nextTargets = {} as Record<ProofTargetId, ProofTargetState>;

  for (const targetId of PROOF_TARGET_IDS) {
    const rawTarget = (rawTargets as Record<string, unknown>)[targetId];

    if (typeof rawTarget !== 'object' || rawTarget === null) {
      throw new Error(`Stored scene state is missing ${targetId}.`);
    }

    const parsedTarget = rawTarget as Record<string, unknown>;

    if (
      typeof parsedTarget.offsetX !== 'number'
      || typeof parsedTarget.offsetY !== 'number'
    ) {
      throw new Error(`Stored scene state contains invalid coordinates for ${targetId}.`);
    }

    nextTargets[targetId] = {
      offsetX: parsedTarget.offsetX,
      offsetY: parsedTarget.offsetY,
    };
  }

  if (snapshot.selectedTargetId !== null && !isProofTargetId(snapshot.selectedTargetId)) {
    throw new Error('Stored scene state contains an unsupported selection.');
  }

  return {
    targets: nextTargets,
    selectedTargetId: snapshot.selectedTargetId as ProofTargetId | null,
  };
}

function applySnapshotToSceneState(
  sceneState: ProofSceneState,
  snapshot: ProofSceneSnapshot,
): void {
  for (const targetId of PROOF_TARGET_IDS) {
    sceneState.targets[targetId] = {
      offsetX: clamp(snapshot.targets[targetId].offsetX, -TARGET_MOVE_LIMIT, TARGET_MOVE_LIMIT),
      offsetY: clamp(snapshot.targets[targetId].offsetY, -TARGET_MOVE_LIMIT, TARGET_MOVE_LIMIT),
    };
  }

  sceneState.selectedTargetId = snapshot.selectedTargetId;
  sceneState.hoveredTargetId = null;
}

function syncPosition(elements: AppElements, sceneState: ProofSceneState): void {
  elements.positionValue.textContent = formatPosition(sceneState);
}

function syncLastInput(elements: AppElements, sceneState: ProofSceneState): void {
  elements.inputValue.textContent = sceneState.lastInputEvent;
}

function syncSceneTargetState(
  targetId: ProofTargetId,
  target: HTMLButtonElement,
  sceneState: ProofSceneState,
): void {
  target.dataset.selected = sceneState.selectedTargetId === targetId ? 'true' : 'false';
  target.dataset.hovered = sceneState.hoveredTargetId === targetId ? 'true' : 'false';
}

function applySceneTargetVisual(
  targetId: ProofTargetId,
  target: HTMLButtonElement,
  sceneState: ProofSceneState,
  phase: RuntimePhase,
  timeMs = 0,
): void {
  const targetState = sceneState.targets[targetId];
  const isSelected = sceneState.selectedTargetId === targetId;
  const isHovered = sceneState.hoveredTargetId === targetId;
  const pulseSeed = targetId === 'pulse-node-a' ? 0 : Math.PI / 2;
  const phaseScale = phase === 'ready' ? 1 + Math.sin(timeMs / 220 + pulseSeed) * 0.03 : 1;
  const interactionScale = isSelected ? 1.12 : isHovered ? 1.05 : 1;

  target.style.setProperty('--scene-target-x', `${targetState.offsetX}px`);
  target.style.setProperty('--scene-target-y', `${targetState.offsetY + DOM_TARGET_OFFSET_Y}px`);
  target.style.setProperty('--scene-target-scale', (phaseScale * interactionScale).toFixed(3));
  syncSceneTargetState(targetId, target, sceneState);
}

function applySceneTargetsVisual(
  targets: ProofTargetElements,
  sceneState: ProofSceneState,
  phase: RuntimePhase,
  timeMs = 0,
): void {
  for (const targetId of PROOF_TARGET_IDS) {
    applySceneTargetVisual(targetId, targets[targetId], sceneState, phase, timeMs);
  }
}

function mapSceneOffsetToThreePosition(target: ProofTargetState): {
  x: number;
  y: number;
} {
  return {
    x: target.offsetX / THREE_POSITION_SCALE,
    y: -target.offsetY / THREE_POSITION_SCALE,
  };
}

function getRaycastTargetId(
  intersections: THREE.Intersection<THREE.Object3D>[],
): ProofTargetId | null {
  for (const intersection of intersections) {
    let object: THREE.Object3D | null = intersection.object;

    while (object) {
      if (isProofTargetId(object.userData.targetId)) {
        return object.userData.targetId as ProofTargetId;
      }

      object = object.parent;
    }
  }

  return null;
}

function showHoverCallout(
  ui: UiWidgetsAdapterApi,
  targetId: ProofTargetId,
  source: 'dom' | 'scene',
): void {
  ui.showCallout({
    title: `${source === 'dom' ? 'DOM' : 'Scene'} hover captured`,
    body: `InteractionController hovered ${getTargetLabel(targetId)} through the ${source === 'dom' ? 'DOM target' : 'scene raycast'} path.`,
    tone: 'active',
  });
}

function showSelectionCallout(
  ui: UiWidgetsAdapterApi,
  targetId: ProofTargetId,
  source: 'dom' | 'scene' | 'input' | 'storage' | 'selected',
  storageArea?: StorageArea,
): void {
  if (source === 'storage') {
    ui.showCallout({
      title: `${storageArea === 'session' ? 'Session' : 'Local'} state loaded`,
      body: `StorageController restored ${getTargetLabel(targetId)} from ${storageArea} storage.`,
      tone: 'selected',
    });
    return;
  }

  if (source === 'selected') {
    ui.showCallout({
      title: 'Selection remains active',
      body: `${getTargetLabel(targetId)} is still selected after hover cleared.`,
      tone: 'selected',
    });
    return;
  }

  if (source === 'input') {
    ui.showCallout({
      title: 'Keyboard selection',
      body: `InputController selected ${getTargetLabel(targetId)} through the input adapter.`,
      tone: 'selected',
    });
    return;
  }

  ui.showCallout({
    title: `${source === 'dom' ? 'DOM' : 'Scene'} selection captured`,
    body: `InteractionController selected ${getTargetLabel(targetId)} through the ${source === 'dom' ? 'DOM target' : 'scene raycast'} path.`,
    tone: 'selected',
  });
}

function clearHoverState(
  sceneState: ProofSceneState,
  ui: UiWidgetsAdapterApi,
): void {
  sceneState.hoveredTargetId = null;

  if (sceneState.selectedTargetId) {
    showSelectionCallout(ui, sceneState.selectedTargetId, 'selected');
    return;
  }

  ui.hideCallout();
}

function setSelectedTarget(
  sceneState: ProofSceneState,
  targetId: ProofTargetId | null,
): void {
  sceneState.selectedTargetId = targetId;
  sceneState.hoveredTargetId = targetId;
}

function createThreeSceneController(sceneState: ProofSceneState): ControllerRegistration {
  let three: ThreeAdapterApi | null = null;
  let ambientLight: THREE.AmbientLight | null = null;
  let directionalLight: THREE.DirectionalLight | null = null;
  const pulseMeshes = new Map<
    ProofTargetId,
    THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  >();
  let rotationY = 0;
  let pulseMs = 0;

  const syncScene = (phase: RuntimePhase): void => {
    if (!directionalLight) {
      return;
    }

    for (const targetId of PROOF_TARGET_IDS) {
      const pulseMesh = pulseMeshes.get(targetId);

      if (!pulseMesh) {
        continue;
      }

      const config = TARGET_CONFIG[targetId];
      const position = mapSceneOffsetToThreePosition(sceneState.targets[targetId]);
      const isSelected = sceneState.selectedTargetId === targetId;
      const isHovered = sceneState.hoveredTargetId === targetId;
      const pulseScale = phase === 'ready' ? 1 + Math.sin(pulseMs / 220 + (targetId === 'pulse-node-a' ? 0 : Math.PI / 2)) * 0.06 : 1;
      const interactionScale = isSelected ? 1.18 : isHovered ? 1.08 : 1;

      pulseMesh.position.set(position.x, position.y, 0);
      pulseMesh.scale.setScalar(interactionScale * pulseScale);
      pulseMesh.rotation.y = rotationY * config.rotationDirection;
      pulseMesh.rotation.x = 0.18 + Math.sin((pulseMs / 760) + (config.rotationDirection > 0 ? 0 : Math.PI / 3)) * 0.1;
      pulseMesh.rotation.z = isSelected ? Math.sin(pulseMs / 520) * 0.08 : 0;
      pulseMesh.material.color.set(
        isSelected
          ? config.selectedColor
          : isHovered
            ? config.hoverColor
            : config.baseColor,
      );
      pulseMesh.material.emissive.set(
        isSelected ? config.selectedEmissive : config.baseEmissive,
      );
      pulseMesh.material.emissiveIntensity = isSelected ? 0.82 : isHovered ? 0.62 : 0.46;
    }

    directionalLight.intensity = phase === 'ready' ? 1.25 : 1;
  };

  return {
    id: 'three-scene-controller',
    init(ctx) {
      three = ctx.adapters.require<ThreeAdapterApi>('three');

      const scene = three.getScene();
      ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
      directionalLight = new THREE.DirectionalLight(0xffffff, 1.25);
      directionalLight.position.set(4, 5, 6);
      scene.add(ambientLight, directionalLight);

      for (const targetId of PROOF_TARGET_IDS) {
        const config = TARGET_CONFIG[targetId];
        const geometry =
          targetId === 'pulse-node-a'
            ? new THREE.IcosahedronGeometry(0.92, 4)
            : new THREE.DodecahedronGeometry(0.98, 0);
        const material = new THREE.MeshStandardMaterial({
          color: config.baseColor,
          emissive: config.baseEmissive,
          emissiveIntensity: 0.46,
          roughness: 0.24,
          metalness: 0.08,
        });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.userData.targetId = targetId;
        pulseMeshes.set(targetId, mesh);
        scene.add(mesh);
      }

      syncScene('boot');
      three.resize();
      three.render();
    },
    update(frame, ctx) {
      if (!three) {
        return;
      }

      const phase = ctx.state.getSnapshot().phase;

      if (phase === 'ready') {
        rotationY += frame.deltaSeconds * 0.9;
        pulseMs += frame.deltaMs;
      }

      syncScene(phase);
      three.render();
    },
    onStateChange(next) {
      if (!three) {
        return;
      }

      if (next.phase !== 'ready' && next.phase !== 'paused') {
        rotationY = 0;
        pulseMs = 0;
      }

      syncScene(next.phase);
      three.resize();
      three.render();
    },
    dispose() {
      if (!three) {
        return;
      }

      const scene = three.getScene();

      if (ambientLight) {
        scene.remove(ambientLight);
        ambientLight = null;
      }

      if (directionalLight) {
        scene.remove(directionalLight);
        directionalLight = null;
      }

      for (const pulseMesh of pulseMeshes.values()) {
        scene.remove(pulseMesh);
        pulseMesh.geometry.dispose();
        pulseMesh.material.dispose();
      }

      pulseMeshes.clear();
    },
  };
}

function createLoadingController(): ControllerRegistration {
  const stages = [
    { id: 'bootstrap', label: 'Bootstrap', weight: 1 },
    { id: 'adapters', label: 'Adapters', weight: 1.2 },
    { id: 'handoff', label: 'Interactive handoff', weight: 0.8 },
  ];

  let elapsedMs = 0;
  let completed = false;
  let movedToTransition = false;

  return {
    id: 'loading-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      loading.begin(stages, 'Booting the runtime kernel');
    },
    update(frame, ctx) {
      if (completed) {
        return;
      }

      elapsedMs += frame.deltaMs;
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      if (elapsedMs < 900) {
        loading.setStage(
          'bootstrap',
          elapsedMs / 900,
          'Creating runtime context and services',
        );
        return;
      }

      if (elapsedMs < 2100) {
        loading.setStage(
          'adapters',
          (elapsedMs - 900) / 1200,
          'Registering adapters and controller surfaces',
        );
        return;
      }

      if (!movedToTransition) {
        movedToTransition = true;
        ctx.state.setPhase('transition', 'loading:handoff');
      }

      if (elapsedMs < 2900) {
        loading.setStage(
          'handoff',
          (elapsedMs - 2100) / 800,
          'Switching into interactive mode',
        );
        return;
      }

      loading.complete('Runtime ready');
      ctx.state.setPhase('ready', 'loading:complete');
      completed = true;
    },
  };
}

function createInteractionController(
  elements: AppElements,
  sceneState: ProofSceneState,
): ControllerRegistration {
  const cleanups: Array<() => void> = [];
  let tickCount = 0;

  return {
    id: 'interaction-controller',
    init(ctx) {
      const pointer = ctx.adapters.require<PointerAdapterApi>('pointer');
      const three = ctx.adapters.require<ThreeAdapterApi>('three');
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      const applyVisuals = (): void => {
        applySceneTargetsVisual(
          elements.sceneTargets,
          sceneState,
          ctx.state.getSnapshot().phase,
          performance.now(),
        );
      };

      const selectTarget = (
        targetId: ProofTargetId,
        source: 'dom' | 'scene',
      ): void => {
        setSelectedTarget(sceneState, targetId);
        applyVisuals();
        showSelectionCallout(ui, targetId, source);
      };

      const hoverTarget = (
        targetId: ProofTargetId,
        source: 'dom' | 'scene',
      ): void => {
        sceneState.hoveredTargetId = targetId;
        applyVisuals();
        showHoverCallout(ui, targetId, source);
      };

      for (const targetId of PROOF_TARGET_IDS) {
        cleanups.push(
          pointer.bindTarget({
            id: targetId,
            element: elements.sceneTargets[targetId],
            meta: { label: getTargetLabel(targetId) },
          }),
        );
      }

      cleanups.push(
        pointer.bindSurface({
          id: 'three-surface',
          element: elements.threeHost,
          meta: { label: 'Three Scene Surface' },
        }),
      );

      cleanups.push(
        ctx.events.on('pointer:hover', (event) => {
          if (ctx.state.getSnapshot().phase !== 'ready') {
            return;
          }

          const payload = event.payload as PointerTargetEventPayload;

          if (!isProofTargetId(payload.targetId)) {
            return;
          }

          hoverTarget(payload.targetId, 'dom');
        }),
      );

      cleanups.push(
        ctx.events.on('pointer:leave', (event) => {
          const payload = event.payload as PointerTargetEventPayload;

          if (!isProofTargetId(payload.targetId) || sceneState.hoveredTargetId !== payload.targetId) {
            return;
          }

          clearHoverState(sceneState, ui);
          applyVisuals();
        }),
      );

      cleanups.push(
        ctx.events.on('pointer:select', (event) => {
          if (ctx.state.getSnapshot().phase !== 'ready') {
            return;
          }

          const payload = event.payload as PointerTargetEventPayload;

          if (!isProofTargetId(payload.targetId)) {
            return;
          }

          selectTarget(payload.targetId, 'dom');
        }),
      );

      cleanups.push(
        ctx.events.on('pointer:surface-move', (event) => {
          if (ctx.state.getSnapshot().phase !== 'ready') {
            return;
          }

          const payload = event.payload as PointerSurfaceEventPayload;
          const hitTargetId = getRaycastTargetId(
            three.raycast(payload.clientX, payload.clientY, three.getScene().children),
          );

          if (!hitTargetId) {
            clearHoverState(sceneState, ui);
            applyVisuals();
            return;
          }

          hoverTarget(hitTargetId, 'scene');
        }),
      );

      cleanups.push(
        ctx.events.on('pointer:surface-leave', () => {
          clearHoverState(sceneState, ui);
          applyVisuals();
        }),
      );

      cleanups.push(
        ctx.events.on('pointer:surface-select', (event) => {
          if (ctx.state.getSnapshot().phase !== 'ready') {
            return;
          }

          const payload = event.payload as PointerSurfaceEventPayload;
          const hitTargetId = getRaycastTargetId(
            three.raycast(payload.clientX, payload.clientY, three.getScene().children),
          );

          if (!hitTargetId) {
            return;
          }

          selectTarget(hitTargetId, 'scene');
        }),
      );

      ui.setStatus('Booting kernel');
    },
    update(frame, ctx) {
      tickCount += 1;
      elements.frameValue.textContent = String(tickCount);
      applySceneTargetsVisual(
        elements.sceneTargets,
        sceneState,
        ctx.state.getSnapshot().phase,
        frame.timeMs,
      );
    },
    onStateChange(next, _previous, ctx) {
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      ui.setStatus(phaseStatus(next.phase));

      if (next.phase !== 'ready' && next.phase !== 'paused') {
        sceneState.selectedTargetId = null;
        sceneState.hoveredTargetId = null;
        ui.hideCallout();
      }

      applySceneTargetsVisual(elements.sceneTargets, sceneState, next.phase);
    },
    dispose(ctx) {
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }

      sceneState.selectedTargetId = null;
      sceneState.hoveredTargetId = null;
      applySceneTargetsVisual(elements.sceneTargets, sceneState, 'boot');
      ui.hideCallout();
      ui.setStatus('Kernel shut down');
    },
  };
}

function createInputController(
  elements: AppElements,
  sceneState: ProofSceneState,
): ControllerRegistration {
  const cleanups: Array<() => void> = [];

  const moveTarget = (targetId: ProofTargetId, deltaX: number, deltaY: number): void => {
    const target = sceneState.targets[targetId];

    target.offsetX = clamp(
      target.offsetX + deltaX,
      -TARGET_MOVE_LIMIT,
      TARGET_MOVE_LIMIT,
    );
    target.offsetY = clamp(
      target.offsetY + deltaY,
      -TARGET_MOVE_LIMIT,
      TARGET_MOVE_LIMIT,
    );
    syncPosition(elements, sceneState);
  };

  return {
    id: 'input-controller',
    init(ctx) {
      const input = ctx.adapters.require<InputAdapterApi>('input');
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      cleanups.push(
        input.subscribe((event) => {
          const isInteractive = ctx.state.getSnapshot().phase === 'ready';
          sceneState.lastInputEvent = formatInputEvent(event, isInteractive);
          syncLastInput(elements, sceneState);
        }),
      );

      const bindMovement = (code: string, deltaX: number, deltaY: number): void => {
        cleanups.push(
          input.bindKey({
            code,
            handler: () => {
              if (ctx.state.getSnapshot().phase !== 'ready') {
                return;
              }

              moveTarget(getActiveTargetId(sceneState), deltaX, deltaY);
              applySceneTargetsVisual(
                elements.sceneTargets,
                sceneState,
                'ready',
                performance.now(),
              );
            },
          }),
        );
      };

      bindMovement('ArrowUp', 0, -TARGET_MOVE_STEP);
      bindMovement('ArrowDown', 0, TARGET_MOVE_STEP);
      bindMovement('ArrowLeft', -TARGET_MOVE_STEP, 0);
      bindMovement('ArrowRight', TARGET_MOVE_STEP, 0);

      const toggleSelection = (): void => {
        if (ctx.state.getSnapshot().phase !== 'ready') {
          return;
        }

        const activeTargetId = getActiveTargetId(sceneState);

        if (sceneState.selectedTargetId === activeTargetId) {
          sceneState.selectedTargetId = null;
          sceneState.hoveredTargetId = null;
          applySceneTargetsVisual(
            elements.sceneTargets,
            sceneState,
            'ready',
            performance.now(),
          );
          ui.hideCallout();
          return;
        }

        setSelectedTarget(sceneState, activeTargetId);
        applySceneTargetsVisual(
          elements.sceneTargets,
          sceneState,
          'ready',
          performance.now(),
        );
        showSelectionCallout(ui, activeTargetId, 'input');
      };

      cleanups.push(
        input.bindKey({
          code: 'Enter',
          handler: toggleSelection,
        }),
      );

      cleanups.push(
        input.bindKey({
          code: 'Space',
          handler: toggleSelection,
        }),
      );

      cleanups.push(
        input.bindKey({
          code: 'Escape',
          handler: () => {
            if (ctx.state.getSnapshot().phase !== 'ready') {
              return;
            }

            sceneState.selectedTargetId = null;
            sceneState.hoveredTargetId = null;
            applySceneTargetsVisual(
              elements.sceneTargets,
              sceneState,
              'ready',
              performance.now(),
            );
            ui.hideCallout();
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

function createStorageController(
  elements: AppElements,
  sceneState: ProofSceneState,
): ControllerRegistration {
  const cleanups: Array<() => void> = [];

  const bindButton = (
    button: HTMLButtonElement,
    handler: () => void,
  ): void => {
    button.addEventListener('click', handler);
    cleanups.push(() => {
      button.removeEventListener('click', handler);
    });
  };

  return {
    id: 'storage-controller',
    init(ctx) {
      const storage = ctx.adapters.require<StorageAdapterApi>('storage');
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      const updateStorageStatus = (message?: string): void => {
        const localSaved = storage.listKeys('local').includes(PROOF_STORAGE_KEY);
        const sessionSaved = storage.listKeys('session').includes(PROOF_STORAGE_KEY);
        const summary = formatStorageSummary(localSaved, sessionSaved);

        elements.storageValue.textContent = message ? `${message} | ${summary}` : summary;
      };

      const applyStoredSceneState = (
        snapshot: ProofSceneSnapshot,
        area: StorageArea,
      ): void => {
        applySnapshotToSceneState(sceneState, snapshot);
        syncPosition(elements, sceneState);
        applySceneTargetsVisual(
          elements.sceneTargets,
          sceneState,
          'ready',
          performance.now(),
        );

        if (sceneState.selectedTargetId) {
          showSelectionCallout(ui, sceneState.selectedTargetId, 'storage', area);
          return;
        }

        ui.hideCallout();
      };

      const runStorageAction = (action: () => void): void => {
        try {
          action();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Storage action failed.';

          elements.storageValue.textContent = message;
        }
      };

      const saveSceneState = (area: StorageArea): void => {
        if (ctx.state.getSnapshot().phase !== 'ready') {
          return;
        }

        storage.setItem(PROOF_STORAGE_KEY, createSceneSnapshot(sceneState), area);
        updateStorageStatus(`Saved ${area} scene state`);
      };

      const loadSceneState = (area: StorageArea): void => {
        if (ctx.state.getSnapshot().phase !== 'ready') {
          return;
        }

        const value = storage.getItem(PROOF_STORAGE_KEY, area);

        if (value === null) {
          updateStorageStatus(`No ${area} scene state`);
          return;
        }

        applyStoredSceneState(parseSceneSnapshot(value), area);
        updateStorageStatus(`Loaded ${area} scene state`);
      };

      bindButton(elements.saveLocalButton, () => {
        runStorageAction(() => {
          saveSceneState('local');
        });
      });

      bindButton(elements.loadLocalButton, () => {
        runStorageAction(() => {
          loadSceneState('local');
        });
      });

      bindButton(elements.saveSessionButton, () => {
        runStorageAction(() => {
          saveSceneState('session');
        });
      });

      bindButton(elements.loadSessionButton, () => {
        runStorageAction(() => {
          loadSceneState('session');
        });
      });

      bindButton(elements.clearSavedButton, () => {
        runStorageAction(() => {
          if (ctx.state.getSnapshot().phase !== 'ready') {
            return;
          }

          storage.removeItem(PROOF_STORAGE_KEY, 'local');
          storage.removeItem(PROOF_STORAGE_KEY, 'session');
          updateStorageStatus('Cleared saved scene state');
        });
      });

      updateStorageStatus();
    },
    onStateChange(next, _previous, ctx) {
      if (next.phase !== 'ready') {
        return;
      }

      const storage = ctx.adapters.require<StorageAdapterApi>('storage');
      const localSaved = storage.listKeys('local').includes(PROOF_STORAGE_KEY);
      const sessionSaved = storage.listKeys('session').includes(PROOF_STORAGE_KEY);

      elements.storageValue.textContent = formatStorageSummary(localSaved, sessionSaved);
    },
    dispose() {
      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }
    },
  };
}

function syncControls(elements: AppElements, phase: RuntimePhase, isShutdown: boolean): void {
  const isInteractive = !isShutdown && phase === 'ready';

  elements.pauseButton.disabled = isShutdown || phase === 'paused' || phase === 'error';
  elements.resumeButton.disabled = isShutdown || phase !== 'paused';
  elements.shutdownButton.disabled = isShutdown;
  elements.saveLocalButton.disabled = !isInteractive;
  elements.loadLocalButton.disabled = !isInteractive;
  elements.saveSessionButton.disabled = !isInteractive;
  elements.loadSessionButton.disabled = !isInteractive;
  elements.clearSavedButton.disabled = !isInteractive;

  for (const targetId of PROOF_TARGET_IDS) {
    elements.sceneTargets[targetId].disabled = !isInteractive;
  }
}

async function main(): Promise<void> {
  const elements = createLayout();
  const sceneState = createInitialSceneState();
  let isShutdown = false;

  syncPosition(elements, sceneState);
  syncLastInput(elements, sceneState);
  applySceneTargetsVisual(elements.sceneTargets, sceneState, 'boot');
  syncControls(elements, 'boot', isShutdown);

  const kernel = createKernel({
    id: 'urk-dom-proof',
    services: {
      'three:host': elements.threeHost,
      'ui:host': elements.uiHost,
    },
    adapters: [
      createPointerAdapter(),
      createInputAdapter(),
      createStorageAdapter({ namespace: 'urk-dom-proof' }),
      createLoadingAdapter(),
      createThreeAdapter(),
      createUiWidgetsAdapter(),
    ],
    controllers: [
      createLoadingController(),
      createThreeSceneController(sceneState),
      createInteractionController(elements, sceneState),
      createInputController(elements, sceneState),
      createStorageController(elements, sceneState),
    ],
  });

  // Expose a tiny dev hook so the browser acceptance flow can verify duplicate guards.
  window.__URK_DOM_PROOF__ = {
    kernel,
    createInputAdapter,
    createPointerAdapter,
    createStorageAdapter,
    createThreeAdapter,
  };

  const detachState = kernel.getContext().state.subscribe((next) => {
    elements.phaseValue.textContent = next.phase;
    elements.reasonValue.textContent = next.reason ?? 'n/a';
    syncControls(elements, next.phase, isShutdown);
  });

  const detachPhaseEvents = kernel
    .getEventBus()
    .on('runtime:phase-changed', (event) => {
      elements.eventValue.textContent = event.type;
    });

  const detachPointerHover = kernel.getEventBus().on('pointer:hover', (event) => {
    elements.eventValue.textContent = event.type;
  });

  const detachPointerSelect = kernel.getEventBus().on('pointer:select', (event) => {
    elements.eventValue.textContent = event.type;
  });

  const detachSurfaceMove = kernel.getEventBus().on('pointer:surface-move', (event) => {
    elements.eventValue.textContent = event.type;
  });

  const detachSurfaceSelect = kernel.getEventBus().on('pointer:surface-select', (event) => {
    elements.eventValue.textContent = event.type;
  });

  const detachInputDown = kernel.getEventBus().on('input:key-down', (event) => {
    elements.eventValue.textContent = event.type;
  });

  const detachInputUp = kernel.getEventBus().on('input:key-up', (event) => {
    elements.eventValue.textContent = event.type;
  });

  elements.pauseButton.addEventListener('click', () => {
    kernel.pause('demo:pause');
  });

  elements.resumeButton.addEventListener('click', () => {
    kernel.resume('demo:resume');
  });

  elements.shutdownButton.addEventListener('click', () => {
    if (isShutdown) {
      return;
    }

    isShutdown = true;
    void kernel.shutdown('demo:shutdown').catch((error) => {
      elements.messageValue.textContent = error instanceof Error ? error.message : 'Shutdown failed';
    });

    syncControls(elements, kernel.getState().phase, isShutdown);
  });

  await kernel.boot();

  const loading = kernel.getContext().adapters.require<LoadingAdapterApi>('loading');

  const detachLoading = loading.subscribe((snapshot) => {
    elements.progressValue.textContent = `${Math.round(snapshot.progress * 100)}%`;
    elements.progressFill.setAttribute('style', `width: ${snapshot.progress * 100}%`);
    elements.messageValue.textContent = snapshot.message;
  });

  const initialSnapshot = loading.getSnapshot();
  elements.progressValue.textContent = `${Math.round(initialSnapshot.progress * 100)}%`;
  elements.progressFill.setAttribute('style', `width: ${initialSnapshot.progress * 100}%`);
  elements.messageValue.textContent = initialSnapshot.message;
  syncControls(elements, kernel.getState().phase, isShutdown);

  window.addEventListener(
    'beforeunload',
    () => {
      window.__URK_DOM_PROOF__ = undefined;
      detachLoading();
      detachInputUp();
      detachInputDown();
      detachSurfaceSelect();
      detachSurfaceMove();
      detachPointerSelect();
      detachPointerHover();
      detachPhaseEvents();
      detachState();
      void kernel.shutdown('demo:unload');
    },
    { once: true },
  );
}

void main().catch((error) => {
  const app = document.querySelector<HTMLDivElement>('#app');

  if (app) {
    app.innerHTML = `<pre>${error instanceof Error ? error.message : 'Failed to start example.'}</pre>`;
  }

  throw error;
});
