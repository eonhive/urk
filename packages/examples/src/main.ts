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

function installStyles(): void {
  const style = document.createElement('style');

  style.textContent = `
    :root {
      color-scheme: light;
      font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 36%),
        radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.14), transparent 34%),
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

    .proof-shell {
      width: min(1120px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 20px;
      grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
    }

    .proof-panel,
    .proof-stage {
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 28px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
      backdrop-filter: blur(16px);
    }

    .proof-panel {
      padding: 22px;
      display: grid;
      gap: 18px;
      align-content: start;
    }

    .proof-stage {
      position: relative;
      min-height: 560px;
      overflow: hidden;
      background:
        radial-gradient(circle at top, rgba(56, 189, 248, 0.16), transparent 42%),
        linear-gradient(180deg, rgba(15, 23, 42, 0.04), rgba(15, 23, 42, 0.1)),
        #f8fafc;
    }

    .proof-heading h1 {
      margin: 0;
      font-size: clamp(1.8rem, 3vw, 2.4rem);
      line-height: 1.05;
      letter-spacing: -0.04em;
    }

    .proof-heading p {
      margin: 10px 0 0;
      color: #475569;
      line-height: 1.6;
    }

    .metric-grid {
      display: grid;
      gap: 12px;
    }

    .metric-card {
      padding: 14px 16px;
      border-radius: 18px;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.18);
    }

    .metric-card span {
      display: block;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      margin-bottom: 6px;
    }

    .metric-card strong {
      display: block;
      font-size: 1rem;
      line-height: 1.4;
    }

    .proof-help {
      padding: 16px;
      border-radius: 18px;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.18);
    }

    .proof-help h2 {
      margin: 0 0 12px;
      font-size: 0.95rem;
      letter-spacing: -0.02em;
    }

    .proof-help ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
      color: #334155;
      line-height: 1.5;
    }

    .proof-help code {
      font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      font-size: 0.88em;
      color: #0f172a;
      background: rgba(148, 163, 184, 0.12);
      padding: 2px 6px;
      border-radius: 999px;
    }

    .progress-shell {
      display: grid;
      gap: 10px;
    }

    .progress-track {
      overflow: hidden;
      height: 14px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.2);
    }

    .progress-fill {
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #0ea5e9, #22c55e);
      transition: width 140ms linear;
    }

    .control-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .control-row button {
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      background: #0f172a;
      color: #f8fafc;
      transition: transform 120ms ease, opacity 120ms ease;
    }

    .control-row button:hover:not(:disabled) {
      transform: translateY(-1px);
    }

    .control-row button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .storage-actions button {
      background: #164e63;
    }

    .three-host {
      position: absolute;
      inset: 0;
    }

    .three-host canvas {
      width: 100%;
      height: 100%;
      display: block;
      pointer-events: none;
    }

    .scene-content {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
      background:
        radial-gradient(circle at center, rgba(14, 165, 233, 0.18), transparent 32%),
        radial-gradient(circle at bottom, rgba(34, 197, 94, 0.14), transparent 34%);
    }

    .scene-caption {
      position: absolute;
      left: 24px;
      bottom: 24px;
      margin: 0;
      max-width: 380px;
      color: #334155;
      line-height: 1.55;
      font-size: 0.95rem;
    }

    .scene-target {
      --scene-target-x: 0px;
      --scene-target-y: 0px;
      --scene-target-scale: 1;
      position: absolute;
      left: 50%;
      top: 50%;
      min-width: 132px;
      height: 44px;
      padding: 0 16px;
      border: 0;
      border-radius: 999px;
      color: #f8fafc;
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      pointer-events: auto;
      transform:
        translate(
          calc(-50% + var(--scene-target-x)),
          calc(-50% + var(--scene-target-y))
        )
        scale(var(--scene-target-scale));
      box-shadow:
        0 18px 28px rgba(15, 23, 42, 0.18),
        inset 0 -10px 16px rgba(15, 23, 42, 0.16);
      transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
    }

    .scene-target[data-target-id="pulse-node-a"] {
      background: linear-gradient(180deg, #38bdf8, #0f766e);
    }

    .scene-target[data-target-id="pulse-node-b"] {
      background: linear-gradient(180deg, #fb923c, #9a3412);
    }

    .scene-target:hover:not(:disabled),
    .scene-target[data-hovered="true"] {
      box-shadow:
        0 22px 34px rgba(15, 23, 42, 0.24),
        0 0 0 6px rgba(255, 255, 255, 0.42),
        inset 0 -10px 16px rgba(15, 23, 42, 0.16);
    }

    .scene-target[data-selected="true"] {
      box-shadow:
        0 24px 36px rgba(15, 23, 42, 0.28),
        0 0 0 7px rgba(34, 197, 94, 0.24),
        inset 0 -10px 16px rgba(15, 23, 42, 0.18);
    }

    .scene-target:disabled {
      filter: saturate(0.55);
      cursor: not-allowed;
    }

    .ui-host {
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
    }

    @media (max-width: 920px) {
      #app {
        padding: 20px;
      }

      .proof-shell {
        grid-template-columns: 1fr;
      }

      .proof-stage {
        min-height: 460px;
      }
    }
  `;

  document.head.append(style);
}

function createLayout(): AppElements {
  const app = assertElement(document.querySelector<HTMLDivElement>('#app'), '#app');

  app.innerHTML = `
    <main class="proof-shell">
      <section class="proof-panel">
        <header class="proof-heading">
          <h1>URK Picking Proof</h1>
          <p>Standalone kernel, explicit runtime phases, real registries, and six small adapters proving loading, pointer, raycast picking, input, storage, scene sync, and overlay coordination.</p>
        </header>

        <div class="metric-grid">
          <article class="metric-card">
            <span>Runtime Phase</span>
            <strong data-role="phase-value">boot</strong>
          </article>
          <article class="metric-card">
            <span>Phase Reason</span>
            <strong data-role="reason-value">kernel:init</strong>
          </article>
          <article class="metric-card">
            <span>Latest Event</span>
            <strong data-role="event-value">waiting</strong>
          </article>
          <article class="metric-card">
            <span>Frame Tick</span>
            <strong data-role="frame-value">0</strong>
          </article>
          <article class="metric-card">
            <span>Target Positions</span>
            <strong data-role="position-value">A x -72px, y 10px | B x 72px, y -10px</strong>
          </article>
          <article class="metric-card">
            <span>Last Input</span>
            <strong data-role="input-value">waiting</strong>
          </article>
          <article class="metric-card">
            <span>Storage Status</span>
            <strong data-role="storage-value">local empty | session empty</strong>
          </article>
        </div>

        <section class="progress-shell">
          <div class="metric-card">
            <span>Loading Progress</span>
            <strong data-role="progress-value">0%</strong>
          </div>
          <div class="progress-track">
            <div class="progress-fill" data-role="progress-fill"></div>
          </div>
          <div class="metric-card">
            <span>Loading Message</span>
            <strong data-role="message-value">Waiting to start</strong>
          </div>
        </section>

        <div class="control-row">
          <button type="button" data-role="pause-button">Pause</button>
          <button type="button" data-role="resume-button">Resume</button>
          <button type="button" data-role="shutdown-button">Shutdown</button>
        </div>

        <div class="control-row storage-actions">
          <button type="button" data-role="save-local-button">Save Local</button>
          <button type="button" data-role="load-local-button">Load Local</button>
          <button type="button" data-role="save-session-button">Save Session</button>
          <button type="button" data-role="load-session-button">Load Session</button>
          <button type="button" data-role="clear-saved-button">Clear Saved</button>
        </div>

        <section class="proof-help">
          <h2>Scene Picking Proof</h2>
          <ul>
            <li><code>Hover</code> or <code>Click</code> the DOM pills to compare direct target interaction against the scene path.</li>
            <li><code>Hover</code> or <code>Click</code> the Three meshes to prove raycast-driven picking through the shared interaction controller.</li>
            <li><code>Arrow Keys</code> move the selected target, or <code>Pulse Node A</code> when nothing is selected.</li>
            <li><code>Enter</code>, <code>Space</code>, and <code>Escape</code> control selection through the input adapter.</li>
            <li><code>Save</code> and <code>Load</code> prove local/session persistence for both targets.</li>
          </ul>
        </section>
      </section>

      <section class="proof-stage">
        <div class="three-host" data-role="three-host"></div>
        <div class="scene-content">
          <button
            class="scene-target"
            type="button"
            data-role="scene-target-a"
            data-target-id="pulse-node-a"
          >
            Pulse Node A
          </button>
          <button
            class="scene-target"
            type="button"
            data-role="scene-target-b"
            data-target-id="pulse-node-b"
          >
            Pulse Node B
          </button>
          <p class="scene-caption">When the runtime reaches ready, compare direct DOM picking against Three surface raycasts, move the selected target with the keyboard, and watch both the DOM pills and scene meshes stay synchronized.</p>
        </div>
        <div class="ui-host" data-role="ui-host"></div>
      </section>
    </main>
  `;

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
  installStyles();
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
