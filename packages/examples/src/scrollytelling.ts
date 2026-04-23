/**
 * Company: EonHive Inc.
 * Title: URK Scrollytelling Proof
 * Purpose: Prove DOM-first scroll and section orchestration with existing URK adapters.
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
  createUiWidgetsAdapter,
  type InputAdapterApi,
  type LoadingAdapterApi,
  type LoadingSnapshot,
  type PointerAdapterApi,
  type PointerTargetEventPayload,
  type UiWidgetsAdapterApi,
} from '@urk/adapters';

const STORY_SECTION_IDS = ['intro', 'orchestration', 'runtime', 'proof'] as const;

type StorySectionId = (typeof STORY_SECTION_IDS)[number];
type NavigationSource = 'pointer' | 'keyboard' | 'top';

type StorySectionConfig = {
  id: StorySectionId;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  highlights: [string, string, string];
};

type StoryState = {
  activeSectionId: StorySectionId;
  sectionProgress: number;
  lastAction: string;
  motionTick: number;
  hasReachedReady: boolean;
  isShutdown: boolean;
};

type PointerActionMeta =
  | { scope: 'story'; action: 'section'; sectionId: StorySectionId }
  | { scope: 'story'; action: 'pause' }
  | { scope: 'story'; action: 'resume' }
  | { scope: 'story'; action: 'back-to-top' }
  | { scope: 'story'; action: 'shutdown' };

type StoryActions = {
  navigateTo: (sectionId: StorySectionId, source: NavigationSource) => void;
  pause: () => void;
  resume: () => void;
  shutdown: () => void;
  render: () => void;
};

type StorySectionElements = Record<StorySectionId, HTMLElement>;
type StoryNavElements = Record<StorySectionId, HTMLButtonElement>;

type AppElements = {
  phaseValue: HTMLElement;
  reasonValue: HTMLElement;
  activeSectionValue: HTMLElement;
  frameValue: HTMLElement;
  motionValue: HTMLElement;
  actionValue: HTMLElement;
  eventValue: HTMLElement;
  loadingStageValue: HTMLElement;
  loadingProgressValue: HTMLElement;
  loadingProgressFill: HTMLElement;
  sectionProgressValue: HTMLElement;
  sectionProgressFill: HTMLElement;
  scrollContainer: HTMLElement;
  storyStage: HTMLElement;
  loadingVeil: HTMLElement;
  loadingTitle: HTMLElement;
  loadingBody: HTMLElement;
  pauseButton: HTMLButtonElement;
  resumeButton: HTMLButtonElement;
  backToTopButton: HTMLButtonElement;
  shutdownButton: HTMLButtonElement;
  navButtons: StoryNavElements;
  sections: StorySectionElements;
  uiHost: HTMLElement;
};

const STORY_SECTIONS: StorySectionConfig[] = [
  {
    id: 'intro',
    label: 'Intro',
    eyebrow: 'Web-first runtime',
    title: 'URK starts as a visible runtime, not a hidden helper.',
    body:
      'This story begins with explicit runtime state, staged loading, and a single scroll surface that makes orchestration behavior easy to inspect.',
    highlights: [
      'Standalone browser proof',
      'Explicit lifecycle visibility',
      'No framework wrapper required',
    ],
  },
  {
    id: 'orchestration',
    label: 'Orchestration',
    eyebrow: 'Controllers use capabilities',
    title: 'Controllers coordinate motion, navigation, and UI without owning capability internals.',
    body:
      'Adapters provide tools. Controllers use them. The proof keeps scroll, pointer, input, and overlay behavior sharp without mixing product logic into the kernel.',
    highlights: [
      'Pointer-driven section jumps',
      'Keyboard-driven navigation',
      'One shared runtime-facing story state',
    ],
  },
  {
    id: 'runtime',
    label: 'Runtime',
    eyebrow: 'State stays explicit',
    title: 'Phases, section progress, and motion remain inspectable while the story runs.',
    body:
      'The proof keeps phase, reason, section progress, frame tick, and latest action visible so state transitions never disappear behind framework component state.',
    highlights: [
      'Loading to ready handoff',
      'Pause freezes mutation cleanly',
      'Resume continues from the paused point',
    ],
  },
  {
    id: 'proof',
    label: 'Proof',
    eyebrow: 'Examples validate the boundary',
    title: 'URK proves itself through focused examples, not only through abstractions.',
    body:
      'This scrollytelling route closes the remaining Phase 3 proof gap with a DOM-first landing-page style orchestration path and no product-shell drift.',
    highlights: [
      'Section + motion orchestration',
      'Overlay and lifecycle feedback',
      'Kernel-facing, product-agnostic structure',
    ],
  },
];

function assertElement<T extends Element>(value: T | null, label: string): T {
  if (!value) {
    throw new Error(`Missing DOM element: ${label}`);
  }

  return value;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(value, max));
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

function sectionLabel(sectionId: StorySectionId): string {
  return STORY_SECTIONS.find((section) => section.id === sectionId)?.label ?? 'Unknown';
}

function phaseStatus(snapshot: RuntimeSnapshot): string {
  switch (snapshot.phase) {
    case 'loading':
      return 'Loading story';
    case 'ready':
      return 'Story ready';
    case 'paused':
      return 'Story paused';
    case 'transition':
      return 'Story transition';
    case 'error':
      return 'Story error';
    default:
      return 'Booting story';
  }
}

function createInitialState(): StoryState {
  return {
    activeSectionId: 'intro',
    sectionProgress: 0,
    lastAction: 'Booting scrollytelling proof',
    motionTick: 0,
    hasReachedReady: false,
    isShutdown: false,
  };
}

function installStyles(): void {
  const style = document.createElement('style');

  style.textContent = `
    :root {
      color-scheme: light;
      font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(16, 185, 129, 0.12), transparent 34%),
        radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.14), transparent 36%),
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
      padding: 28px;
    }

    .story-proof {
      width: min(1320px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 20px;
      grid-template-columns: 300px minmax(0, 1fr);
      align-items: start;
    }

    .story-panel,
    .story-stage {
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 30px;
      box-shadow: 0 18px 46px rgba(15, 23, 42, 0.08);
      backdrop-filter: blur(18px);
    }

    .story-panel {
      padding: 22px;
      display: grid;
      gap: 18px;
      position: sticky;
      top: 28px;
    }

    .story-panel h1 {
      margin: 0;
      font-size: clamp(1.9rem, 2.4vw, 2.3rem);
      line-height: 1.02;
      letter-spacing: -0.05em;
    }

    .story-panel p {
      margin: 10px 0 0;
      color: #475569;
      line-height: 1.6;
    }

    .story-nav {
      display: grid;
      gap: 10px;
    }

    .story-nav__button,
    .story-controls__button {
      border: 0;
      border-radius: 18px;
      padding: 12px 14px;
      text-align: left;
      transition: transform 120ms ease, opacity 120ms ease, background 120ms ease;
    }

    .story-nav__button {
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.16);
      color: #0f172a;
    }

    .story-nav__button[data-active="true"] {
      background: rgba(14, 165, 233, 0.12);
      border-color: rgba(14, 165, 233, 0.28);
      color: #0c4a6e;
    }

    .story-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .story-controls__button {
      background: #0f172a;
      color: #f8fafc;
    }

    .story-controls__button[data-role="resume-button"] {
      background: #2563eb;
    }

    .story-controls__button[data-role="top-button"] {
      background: #0f766e;
    }

    .story-nav__button:hover:not(:disabled),
    .story-controls__button:hover:not(:disabled) {
      transform: translateY(-1px);
    }

    .story-nav__button:disabled,
    .story-controls__button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .story-help {
      padding: 16px;
      border-radius: 20px;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.16);
    }

    .story-help h2 {
      margin: 0 0 12px;
      font-size: 1rem;
      letter-spacing: -0.02em;
    }

    .story-help ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
      color: #334155;
      line-height: 1.55;
    }

    .story-help code {
      font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      font-size: 0.88em;
      color: #0f172a;
      background: rgba(148, 163, 184, 0.12);
      padding: 2px 6px;
      border-radius: 999px;
    }

    .story-stage {
      position: relative;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      height: calc(100vh - 56px);
      min-height: 760px;
      overflow: hidden;
      background:
        radial-gradient(circle at top, rgba(14, 165, 233, 0.12), transparent 42%),
        linear-gradient(180deg, rgba(15, 23, 42, 0.02), rgba(15, 23, 42, 0.08)),
        #f8fafc;
      --motion-wave: 0px;
      isolation: isolate;
    }

    .story-stage:focus {
      outline: 2px solid rgba(37, 99, 235, 0.28);
      outline-offset: -2px;
    }

    .story-header {
      position: sticky;
      top: 0;
      z-index: 2;
      padding: 22px 24px 18px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      background: rgba(248, 250, 252, 0.82);
      backdrop-filter: blur(14px);
      display: grid;
      gap: 16px;
    }

    .story-header__title h2 {
      margin: 0;
      font-size: clamp(1.6rem, 2.6vw, 2rem);
      letter-spacing: -0.04em;
      line-height: 1.04;
    }

    .story-header__title p {
      margin: 8px 0 0;
      color: #475569;
      line-height: 1.6;
    }

    .story-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .story-metric {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.16);
      min-height: 92px;
    }

    .story-metric span {
      display: block;
      margin-bottom: 6px;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }

    .story-metric strong {
      display: block;
      line-height: 1.45;
      font-size: 1rem;
      word-break: break-word;
    }

    .story-progress-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .story-progress-card {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.16);
      display: grid;
      gap: 10px;
    }

    .story-progress-card__copy {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #475569;
      font-size: 0.95rem;
    }

    .story-progress-card__track {
      height: 12px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(148, 163, 184, 0.2);
    }

    .story-progress-card__fill {
      height: 100%;
      width: 0%;
      border-radius: inherit;
      transition: width 140ms linear;
    }

    .story-progress-card__fill[data-role="loading-progress-fill"] {
      background: linear-gradient(90deg, #0ea5e9, #10b981);
    }

    .story-progress-card__fill[data-role="section-progress-fill"] {
      background: linear-gradient(90deg, #38bdf8, #2563eb);
    }

    .story-scroll {
      min-height: 0;
      height: 100%;
      overflow-y: auto;
      scroll-snap-type: y mandatory;
      scroll-behavior: smooth;
      padding: 0 24px 24px;
    }

    .story-scroll[data-locked="true"] {
      overflow-y: hidden;
    }

    .story-section {
      min-height: 620px;
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
      gap: 24px;
      align-items: center;
      padding: 34px 0;
      scroll-snap-align: start;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      --section-progress: 0;
    }

    .story-section:last-child {
      border-bottom: 0;
    }

    .story-section__content {
      padding: 28px;
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.16);
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
      transform:
        translateY(calc(var(--motion-wave) * 0.12))
        scale(calc(1 + var(--section-progress) * 0.015));
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    }

    .story-section[data-active="true"] .story-section__content {
      border-color: rgba(14, 165, 233, 0.28);
      box-shadow: 0 18px 42px rgba(14, 165, 233, 0.08);
    }

    .story-section__eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.08);
      color: #0f172a;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .story-section__content h3 {
      margin: 16px 0 14px;
      font-size: clamp(1.9rem, 3vw, 2.5rem);
      letter-spacing: -0.05em;
      line-height: 1.02;
    }

    .story-section__content p {
      margin: 0;
      color: #334155;
      line-height: 1.7;
      font-size: 1rem;
    }

    .story-section__content ul {
      margin: 18px 0 0;
      padding-left: 18px;
      display: grid;
      gap: 10px;
      color: #334155;
      line-height: 1.6;
    }

    .story-section__visual {
      min-height: 360px;
      display: grid;
      place-items: center;
      padding: 28px;
    }

    .story-section__visual-card {
      width: min(100%, 340px);
      min-height: 280px;
      display: grid;
      align-content: space-between;
      padding: 22px;
      border-radius: 28px;
      color: #f8fafc;
      box-shadow: 0 22px 46px rgba(15, 23, 42, 0.12);
      transform:
        translateY(calc(var(--motion-wave) * -0.16))
        rotate(calc((var(--section-progress) - 0.5) * 3deg));
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .story-section[data-active="true"] .story-section__visual-card {
      box-shadow: 0 28px 54px rgba(15, 23, 42, 0.18);
    }

    .story-section__visual-chip {
      justify-self: start;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(248, 250, 252, 0.14);
      font-size: 0.82rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .story-section__visual-metric span {
      display: block;
      margin-bottom: 6px;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(248, 250, 252, 0.76);
    }

    .story-section__visual-metric strong {
      display: block;
      font-size: 1.5rem;
      letter-spacing: -0.04em;
      line-height: 1.1;
    }

    .story-section--intro .story-section__visual-card {
      background: linear-gradient(160deg, #0f766e, #0f172a);
    }

    .story-section--orchestration .story-section__visual-card {
      background: linear-gradient(160deg, #0f172a, #1d4ed8);
    }

    .story-section--runtime .story-section__visual-card {
      background: linear-gradient(160deg, #1e3a8a, #0ea5e9);
    }

    .story-section--proof .story-section__visual-card {
      background: linear-gradient(160deg, #0f766e, #2563eb);
    }

    .story-loading-veil {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(248, 250, 252, 0.74);
      backdrop-filter: blur(12px);
      z-index: 3;
    }

    .story-loading-veil[hidden] {
      display: none;
    }

    .story-loading-card {
      width: min(420px, 100%);
      padding: 24px;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(148, 163, 184, 0.16);
      box-shadow: 0 20px 44px rgba(15, 23, 42, 0.08);
    }

    .story-loading-card h3 {
      margin: 0;
      font-size: 1.3rem;
      letter-spacing: -0.03em;
    }

    .story-loading-card p {
      margin: 12px 0 0;
      color: #475569;
      line-height: 1.6;
    }

    .story-ui-host {
      position: absolute;
      inset: 0;
      z-index: 4;
      pointer-events: none;
    }

    @media (max-width: 1080px) {
      .story-proof {
        grid-template-columns: 1fr;
      }

      .story-panel {
        position: static;
      }

      .story-section {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      #app {
        padding: 16px;
      }

      .story-metrics,
      .story-progress-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.append(style);
}

function createLayout(): AppElements {
  const app = assertElement(document.querySelector<HTMLDivElement>('#app'), '#app');

  app.innerHTML = `
    <div class="story-proof">
      <aside class="story-panel">
        <div>
          <h1>URK Story Flow</h1>
          <p>
            DOM-first scrollytelling proof for section orchestration, explicit runtime state,
            pointer/input navigation, and pause-safe motion control.
          </p>
        </div>

        <nav class="story-nav" aria-label="Story sections">
          ${STORY_SECTIONS.map((section) => {
            return `
              <button
                type="button"
                class="story-nav__button"
                data-role="nav-${section.id}"
                data-active="${section.id === 'intro' ? 'true' : 'false'}"
              >
                ${section.label}
              </button>
            `;
          }).join('')}
        </nav>

        <div class="story-controls">
          <button type="button" class="story-controls__button" data-role="pause-button">
            Pause
          </button>
          <button type="button" class="story-controls__button" data-role="resume-button">
            Resume
          </button>
          <button type="button" class="story-controls__button" data-role="top-button">
            Back To Top
          </button>
          <button type="button" class="story-controls__button" data-role="shutdown-button">
            Shutdown
          </button>
        </div>

        <section class="story-help">
          <h2>Keyboard</h2>
          <ul>
            <li><code>1</code> to <code>4</code> jump to sections directly.</li>
            <li><code>ArrowDown</code> and <code>ArrowUp</code> move section-to-section.</li>
            <li><code>Pause</code> freezes motion and scroll mutation until <code>Resume</code>.</li>
          </ul>
        </section>
      </aside>

      <section class="story-stage" data-role="story-stage" tabindex="-1">
        <header class="story-header">
          <div class="story-header__title">
            <h2>Scrollytelling orchestration proof</h2>
            <p>
              One internal scroll surface, one explicit story state, and one overlay bridge that
              stays kernel-facing instead of drifting into product-shell behavior.
            </p>
          </div>

          <div class="story-metrics">
            <div class="story-metric">
              <span>Phase</span>
              <strong data-role="phase-value">boot</strong>
            </div>
            <div class="story-metric">
              <span>Reason</span>
              <strong data-role="reason-value">kernel:init</strong>
            </div>
            <div class="story-metric">
              <span>Active Section</span>
              <strong data-role="section-value">Intro</strong>
            </div>
            <div class="story-metric">
              <span>Frame Tick</span>
              <strong data-role="frame-value">0</strong>
            </div>
            <div class="story-metric">
              <span>Motion Tick</span>
              <strong data-role="motion-value">0</strong>
            </div>
            <div class="story-metric">
              <span>Latest Action</span>
              <strong data-role="action-value">Booting scrollytelling proof</strong>
            </div>
            <div class="story-metric">
              <span>Latest Event</span>
              <strong data-role="event-value">kernel:init</strong>
            </div>
          </div>

          <div class="story-progress-grid">
            <div class="story-progress-card">
              <div class="story-progress-card__copy">
                <strong data-role="loading-stage-value">Waiting</strong>
                <span data-role="loading-progress-value">0%</span>
              </div>
              <div class="story-progress-card__track">
                <div
                  class="story-progress-card__fill"
                  data-role="loading-progress-fill"
                ></div>
              </div>
            </div>

            <div class="story-progress-card">
              <div class="story-progress-card__copy">
                <strong>Section progress</strong>
                <span data-role="section-progress-value">0%</span>
              </div>
              <div class="story-progress-card__track">
                <div
                  class="story-progress-card__fill"
                  data-role="section-progress-fill"
                ></div>
              </div>
            </div>
          </div>
        </header>

        <div class="story-scroll" data-role="scroll-container" data-locked="true">
          ${STORY_SECTIONS.map((section, index) => {
            return `
              <section
                class="story-section story-section--${section.id}"
                data-role="section-${section.id}"
                data-active="${section.id === 'intro' ? 'true' : 'false'}"
              >
                <div class="story-section__content">
                  <span class="story-section__eyebrow">0${index + 1} · ${section.eyebrow}</span>
                  <h3>${section.title}</h3>
                  <p>${section.body}</p>
                  <ul>
                    <li>${section.highlights[0]}</li>
                    <li>${section.highlights[1]}</li>
                    <li>${section.highlights[2]}</li>
                  </ul>
                </div>

                <div class="story-section__visual">
                  <article class="story-section__visual-card">
                    <span class="story-section__visual-chip">${section.label}</span>
                    <div class="story-section__visual-metric">
                      <span>Runtime lens</span>
                      <strong>${section.eyebrow}</strong>
                    </div>
                  </article>
                </div>
              </section>
            `;
          }).join('')}
        </div>

        <div class="story-loading-veil" data-role="loading-veil">
          <div class="story-loading-card">
            <h3 data-role="loading-title">Preparing story</h3>
            <p data-role="loading-body">
              The proof is staging the runtime shell, binding the scroll surface, and activating
              section navigation.
            </p>
          </div>
        </div>

        <div class="story-ui-host" data-role="ui-host"></div>
      </section>
    </div>
  `;

  return {
    phaseValue: assertElement(app.querySelector('[data-role="phase-value"]'), 'phase value'),
    reasonValue: assertElement(app.querySelector('[data-role="reason-value"]'), 'reason value'),
    activeSectionValue: assertElement(
      app.querySelector('[data-role="section-value"]'),
      'active section value',
    ),
    frameValue: assertElement(app.querySelector('[data-role="frame-value"]'), 'frame value'),
    motionValue: assertElement(app.querySelector('[data-role="motion-value"]'), 'motion value'),
    actionValue: assertElement(app.querySelector('[data-role="action-value"]'), 'action value'),
    eventValue: assertElement(app.querySelector('[data-role="event-value"]'), 'event value'),
    loadingStageValue: assertElement(
      app.querySelector('[data-role="loading-stage-value"]'),
      'loading stage value',
    ),
    loadingProgressValue: assertElement(
      app.querySelector('[data-role="loading-progress-value"]'),
      'loading progress value',
    ),
    loadingProgressFill: assertElement(
      app.querySelector('[data-role="loading-progress-fill"]'),
      'loading progress fill',
    ),
    sectionProgressValue: assertElement(
      app.querySelector('[data-role="section-progress-value"]'),
      'section progress value',
    ),
    sectionProgressFill: assertElement(
      app.querySelector('[data-role="section-progress-fill"]'),
      'section progress fill',
    ),
    scrollContainer: assertElement(
      app.querySelector('[data-role="scroll-container"]'),
      'scroll container',
    ),
    storyStage: assertElement(app.querySelector('[data-role="story-stage"]'), 'story stage'),
    loadingVeil: assertElement(app.querySelector('[data-role="loading-veil"]'), 'loading veil'),
    loadingTitle: assertElement(
      app.querySelector('[data-role="loading-title"]'),
      'loading title',
    ),
    loadingBody: assertElement(app.querySelector('[data-role="loading-body"]'), 'loading body'),
    pauseButton: assertElement(app.querySelector('[data-role="pause-button"]'), 'pause button'),
    resumeButton: assertElement(app.querySelector('[data-role="resume-button"]'), 'resume button'),
    backToTopButton: assertElement(
      app.querySelector('[data-role="top-button"]'),
      'back to top button',
    ),
    shutdownButton: assertElement(
      app.querySelector('[data-role="shutdown-button"]'),
      'shutdown button',
    ),
    navButtons: {
      intro: assertElement(app.querySelector('[data-role="nav-intro"]'), 'intro nav button'),
      orchestration: assertElement(
        app.querySelector('[data-role="nav-orchestration"]'),
        'orchestration nav button',
      ),
      runtime: assertElement(app.querySelector('[data-role="nav-runtime"]'), 'runtime nav button'),
      proof: assertElement(app.querySelector('[data-role="nav-proof"]'), 'proof nav button'),
    },
    sections: {
      intro: assertElement(app.querySelector('[data-role="section-intro"]'), 'intro section'),
      orchestration: assertElement(
        app.querySelector('[data-role="section-orchestration"]'),
        'orchestration section',
      ),
      runtime: assertElement(
        app.querySelector('[data-role="section-runtime"]'),
        'runtime section',
      ),
      proof: assertElement(app.querySelector('[data-role="section-proof"]'), 'proof section'),
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
  state: StoryState,
): void {
  const readyInteractive = snapshot.phase === 'ready' && !state.isShutdown;

  for (const sectionId of STORY_SECTION_IDS) {
    setButtonDisabled(elements.navButtons[sectionId], !readyInteractive);
  }

  setButtonDisabled(elements.pauseButton, state.isShutdown || snapshot.phase !== 'ready');
  setButtonDisabled(elements.resumeButton, state.isShutdown || snapshot.phase !== 'paused');
  setButtonDisabled(elements.backToTopButton, state.isShutdown || snapshot.phase !== 'ready');
  setButtonDisabled(elements.shutdownButton, state.isShutdown);
}

function syncStoryView(
  elements: AppElements,
  state: StoryState,
  snapshot: RuntimeSnapshot,
  loadingSnapshot: LoadingSnapshot,
  latestEvent: string,
  frameTick: number,
): void {
  const showLoading = snapshot.phase === 'loading' || (snapshot.phase === 'paused' && !state.hasReachedReady);
  const readyInteractive = snapshot.phase === 'ready' && !state.isShutdown;
  const motionWave = Math.sin(state.motionTick / 18) * 14;

  elements.phaseValue.textContent = snapshot.phase;
  elements.reasonValue.textContent = snapshot.reason ?? 'n/a';
  elements.activeSectionValue.textContent = sectionLabel(state.activeSectionId);
  elements.frameValue.textContent = String(frameTick);
  elements.motionValue.textContent = String(state.motionTick);
  elements.actionValue.textContent = state.lastAction;
  elements.eventValue.textContent = latestEvent;
  elements.loadingStageValue.textContent = loadingSnapshot.stageLabel ?? 'Waiting';
  elements.loadingProgressValue.textContent = `${Math.round(loadingSnapshot.progress * 100)}%`;
  elements.loadingProgressFill.setAttribute(
    'style',
    `width: ${loadingSnapshot.progress * 100}%`,
  );
  elements.sectionProgressValue.textContent = `${Math.round(state.sectionProgress * 100)}%`;
  elements.sectionProgressFill.setAttribute(
    'style',
    `width: ${state.sectionProgress * 100}%`,
  );
  elements.storyStage.style.setProperty('--motion-wave', `${motionWave.toFixed(2)}px`);

  for (const sectionId of STORY_SECTION_IDS) {
    const active = state.activeSectionId === sectionId;
    elements.navButtons[sectionId].dataset.active = active ? 'true' : 'false';
    elements.sections[sectionId].dataset.active = active ? 'true' : 'false';
    elements.sections[sectionId].style.setProperty(
      '--section-progress',
      active ? state.sectionProgress.toFixed(4) : '0',
    );
  }

  elements.scrollContainer.dataset.locked = readyInteractive ? 'false' : 'true';

  if (showLoading) {
    elements.loadingVeil.hidden = false;
    elements.loadingTitle.textContent =
      snapshot.phase === 'paused' ? 'Loading paused' : 'Preparing story';
    elements.loadingBody.textContent = loadingSnapshot.stageLabel
      ? `${loadingSnapshot.stageLabel}: ${loadingSnapshot.message}`
      : loadingSnapshot.message;
  } else {
    elements.loadingVeil.hidden = true;
    elements.loadingTitle.textContent = 'Preparing story';
    elements.loadingBody.textContent =
      'The proof is staging the runtime shell, binding the scroll surface, and activating section navigation.';
  }
}

function setActiveSection(
  state: StoryState,
  sectionId: StorySectionId,
  progress: number,
  action?: string,
): void {
  const nextProgress = clamp(progress);

  if (
    state.activeSectionId === sectionId &&
    Math.abs(state.sectionProgress - nextProgress) < 0.0001 &&
    !action
  ) {
    return;
  }

  state.activeSectionId = sectionId;
  state.sectionProgress = nextProgress;

  if (action) {
    state.lastAction = action;
  }
}

function getActiveScrollState(elements: AppElements): {
  sectionId: StorySectionId;
  progress: number;
} {
  const scrollTop = elements.scrollContainer.scrollTop;
  const contentOffsetTop = elements.scrollContainer.offsetTop;
  let sectionId: StorySectionId = STORY_SECTION_IDS[0];

  for (const currentId of STORY_SECTION_IDS) {
    const sectionTop = elements.sections[currentId].offsetTop - contentOffsetTop;

    if (sectionTop <= scrollTop + 1) {
      sectionId = currentId;
    } else {
      break;
    }
  }

  const currentIndex = STORY_SECTION_IDS.indexOf(sectionId);
  const currentStart = elements.sections[sectionId].offsetTop - contentOffsetTop;
  const nextId = STORY_SECTION_IDS[currentIndex + 1];
  const nextStart = nextId
    ? elements.sections[nextId].offsetTop - contentOffsetTop
    : Math.max(
        currentStart + 1,
        elements.scrollContainer.scrollHeight - elements.scrollContainer.clientHeight,
      );
  const distance = Math.max(nextStart - currentStart, 1);
  const progress = clamp((scrollTop - currentStart) / distance);

  return {
    sectionId,
    progress,
  };
}

function createStoryLoadingController(state: StoryState): ControllerRegistration {
  const stages = [
    { id: 'bootstrap-story', label: 'Bootstrap story', weight: 1 },
    { id: 'bind-scroll', label: 'Bind scroll surface', weight: 1 },
    { id: 'activate-story', label: 'Activate story flow', weight: 1 },
  ];

  let elapsedMs = 0;
  let loadingActive = false;

  return {
    id: 'story-loading-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      elapsedMs = 0;
      loadingActive = true;
      state.lastAction = 'Started staged story loading';
      loading.begin(stages, 'Creating story chrome and runtime shell');

      if (ctx.state.getSnapshot().phase !== 'loading') {
        ctx.state.setPhase('loading', 'story:boot');
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
          'bootstrap-story',
          elapsedMs / 900,
          'Creating story shell and progress instrumentation',
        );
        return;
      }

      if (elapsedMs < 1800) {
        loading.setStage(
          'bind-scroll',
          (elapsedMs - 900) / 900,
          'Binding the internal scroll surface and section observers',
        );
        return;
      }

      if (elapsedMs < 2700) {
        loading.setStage(
          'activate-story',
          (elapsedMs - 1800) / 900,
          'Enabling pointer, keyboard, and overlay navigation',
        );
        return;
      }

      loading.complete('Story ready');
      loadingActive = false;
      state.lastAction = 'Story reached ready state';
      ctx.state.setPhase('ready', 'story:ready');
    },
    onStateChange(next) {
      if (next.phase === 'ready') {
        state.hasReachedReady = true;
      }
    },
  };
}

function createStoryScrollController(
  state: StoryState,
  elements: AppElements,
  storyActions: StoryActions,
): ControllerRegistration {
  const cleanups: Array<() => void> = [];
  let lockedScrollTop = 0;

  const syncFromScroll = (recordAction: boolean): void => {
    const { sectionId, progress } = getActiveScrollState(elements);
    const action =
      recordAction && state.activeSectionId !== sectionId
        ? `Scrolled into ${sectionLabel(sectionId)} section`
        : undefined;

    setActiveSection(state, sectionId, progress, action);
  };

  const lockScroll = (): void => {
    lockedScrollTop = elements.scrollContainer.scrollTop;
    elements.scrollContainer.scrollTop = lockedScrollTop;
  };

  return {
    id: 'story-scroll-controller',
    init(ctx) {
      storyActions.navigateTo = (sectionId, source) => {
        if (ctx.state.getSnapshot().phase !== 'ready' || state.isShutdown) {
          return;
        }

        const target = elements.sections[sectionId];

        setActiveSection(
          state,
          sectionId,
          state.sectionProgress,
          source === 'top'
            ? 'Returned to intro section'
            : `${source === 'pointer' ? 'Clicked' : 'Keyed'} ${sectionLabel(sectionId)} section`,
        );
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest',
        });
        storyActions.render();
      };

      const onScroll = (): void => {
        if (ctx.state.getSnapshot().phase !== 'ready' || state.isShutdown) {
          if (Math.abs(elements.scrollContainer.scrollTop - lockedScrollTop) > 1) {
            elements.scrollContainer.scrollTop = lockedScrollTop;
          }
          return;
        }

        lockedScrollTop = elements.scrollContainer.scrollTop;
        syncFromScroll(true);
        storyActions.render();
      };

      elements.scrollContainer.addEventListener('scroll', onScroll, { passive: true });
      cleanups.push(() => {
        elements.scrollContainer.removeEventListener('scroll', onScroll);
      });

      setActiveSection(state, 'intro', 0);
    },
    onStateChange(next) {
      if (next.phase === 'ready') {
        lockedScrollTop = elements.scrollContainer.scrollTop;
        syncFromScroll(false);
        elements.storyStage.focus();
        storyActions.render();
        return;
      }

      lockScroll();
      storyActions.render();
    },
    dispose() {
      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }
    },
  };
}

function createStoryNavigationController(
  state: StoryState,
  elements: AppElements,
): ControllerRegistration {
  const cleanups: Array<() => void> = [];

  const withActions = (
    ctx: Parameters<NonNullable<ControllerRegistration['init']>>[0],
  ): StoryActions => {
    return {
      navigateTo: ctx.services.require<(sectionId: StorySectionId, source: NavigationSource) => void>(
        'story:navigateTo',
      ),
      pause: ctx.services.require<() => void>('story:pause'),
      resume: ctx.services.require<() => void>('story:resume'),
      shutdown: ctx.services.require<() => void>('story:shutdown'),
      render: ctx.services.require<() => void>('story:render'),
    };
  };

  const handlePointerAction = (
    meta: PointerActionMeta,
    ctx: Parameters<NonNullable<ControllerRegistration['init']>>[0],
    source: 'pointer' | 'keyboard',
  ): void => {
    const snapshot = ctx.state.getSnapshot();
    const actions = withActions(ctx);

    switch (meta.action) {
      case 'section':
        if (snapshot.phase === 'ready' && !state.isShutdown) {
          actions.navigateTo(meta.sectionId, source);
        }
        return;
      case 'pause':
        actions.pause();
        return;
      case 'resume':
        actions.resume();
        return;
      case 'back-to-top':
        if (snapshot.phase === 'ready' && !state.isShutdown) {
          actions.navigateTo('intro', 'top');
        }
        return;
      case 'shutdown':
        actions.shutdown();
        return;
    }
  };

  return {
    id: 'story-navigation-controller',
    init(ctx) {
      const pointer = ctx.adapters.require<PointerAdapterApi>('pointer');
      const input = ctx.adapters.require<InputAdapterApi>('input');

      const pointerTargets: Array<{
        id: string;
        element: HTMLButtonElement;
        meta: PointerActionMeta;
      }> = [
        {
          id: 'nav-intro',
          element: elements.navButtons.intro,
          meta: { scope: 'story', action: 'section', sectionId: 'intro' },
        },
        {
          id: 'nav-orchestration',
          element: elements.navButtons.orchestration,
          meta: { scope: 'story', action: 'section', sectionId: 'orchestration' },
        },
        {
          id: 'nav-runtime',
          element: elements.navButtons.runtime,
          meta: { scope: 'story', action: 'section', sectionId: 'runtime' },
        },
        {
          id: 'nav-proof',
          element: elements.navButtons.proof,
          meta: { scope: 'story', action: 'section', sectionId: 'proof' },
        },
        {
          id: 'pause-story',
          element: elements.pauseButton,
          meta: { scope: 'story', action: 'pause' },
        },
        {
          id: 'resume-story',
          element: elements.resumeButton,
          meta: { scope: 'story', action: 'resume' },
        },
        {
          id: 'top-story',
          element: elements.backToTopButton,
          meta: { scope: 'story', action: 'back-to-top' },
        },
        {
          id: 'shutdown-story',
          element: elements.shutdownButton,
          meta: { scope: 'story', action: 'shutdown' },
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

          if (!payload || !meta || meta.scope !== 'story') {
            return;
          }

          handlePointerAction(meta, ctx, 'pointer');
        }),
      );

      cleanups.push(
        input.bindKey({
          code: 'Digit1',
          handler: () => {
            handlePointerAction(
              { scope: 'story', action: 'section', sectionId: 'intro' },
              ctx,
              'keyboard',
            );
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'Digit2',
          handler: () => {
            handlePointerAction(
              { scope: 'story', action: 'section', sectionId: 'orchestration' },
              ctx,
              'keyboard',
            );
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'Digit3',
          handler: () => {
            handlePointerAction(
              { scope: 'story', action: 'section', sectionId: 'runtime' },
              ctx,
              'keyboard',
            );
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'Digit4',
          handler: () => {
            handlePointerAction(
              { scope: 'story', action: 'section', sectionId: 'proof' },
              ctx,
              'keyboard',
            );
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'ArrowDown',
          handler: () => {
            if (ctx.state.getSnapshot().phase !== 'ready' || state.isShutdown) {
              return;
            }

            const currentIndex = STORY_SECTION_IDS.indexOf(state.activeSectionId);
            const nextId =
              STORY_SECTION_IDS[Math.min(currentIndex + 1, STORY_SECTION_IDS.length - 1)];

            if (nextId !== state.activeSectionId) {
              withActions(ctx).navigateTo(nextId, 'keyboard');
            }
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'ArrowUp',
          handler: () => {
            if (ctx.state.getSnapshot().phase !== 'ready' || state.isShutdown) {
              return;
            }

            const currentIndex = STORY_SECTION_IDS.indexOf(state.activeSectionId);
            const nextId = STORY_SECTION_IDS[Math.max(currentIndex - 1, 0)];

            if (nextId !== state.activeSectionId) {
              withActions(ctx).navigateTo(nextId, 'keyboard');
            }
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

function createStoryChromeController(
  state: StoryState,
  elements: AppElements,
  setForceRender: (render: (() => void) | null) => void,
): ControllerRegistration {
  const cleanups: Array<() => void> = [];
  let frameTick = 0;
  let latestEvent = 'kernel:init';
  let latestLoadingSnapshot = createEmptyLoadingSnapshot();
  let render: (() => void) | null = null;

  return {
    id: 'story-chrome-controller',
    init(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      latestLoadingSnapshot = loading.getSnapshot();

      render = (): void => {
        const snapshot = ctx.state.getSnapshot();
        syncControls(elements, snapshot, state);
        syncStoryView(elements, state, snapshot, latestLoadingSnapshot, latestEvent, frameTick);
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

      ui.setStatus('Booting story');
    },
    update(_frame, ctx) {
      if (state.isShutdown) {
        return;
      }

      const snapshot = ctx.state.getSnapshot();
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      frameTick += 1;

      if (snapshot.phase === 'ready') {
        state.motionTick += 1;
        state.hasReachedReady = true;
      }

      syncControls(elements, snapshot, state);
      syncStoryView(elements, state, snapshot, latestLoadingSnapshot, latestEvent, frameTick);

      ui.setStatus(phaseStatus(snapshot));

      if (snapshot.phase === 'loading') {
        ui.showCallout({
          title: 'Story loading',
          body: latestLoadingSnapshot.stageLabel
            ? `${latestLoadingSnapshot.stageLabel}: ${latestLoadingSnapshot.message}`
            : latestLoadingSnapshot.message,
          tone: 'active',
        });
        return;
      }

      if (snapshot.phase === 'paused') {
        ui.showCallout({
          title: 'Story paused',
          body: `Resume to continue ${sectionLabel(state.activeSectionId)} at ${Math.round(
            state.sectionProgress * 100,
          )}% progress.`,
          tone: 'neutral',
        });
        return;
      }

      if (snapshot.phase === 'ready') {
        ui.showCallout({
          title: `${sectionLabel(state.activeSectionId)} section`,
          body: `${Math.round(
            state.sectionProgress * 100,
          )}% through the current section. Scroll, use nav buttons, or jump by keyboard.`,
          tone: 'selected',
        });
        return;
      }

      if (snapshot.phase === 'error') {
        ui.showCallout({
          title: 'Story error',
          body: snapshot.reason ?? 'Unknown story runtime error.',
          tone: 'neutral',
        });
        return;
      }

      ui.hideCallout();
    },
    onStateChange(next) {
      if (next.phase === 'ready') {
        state.hasReachedReady = true;
        elements.storyStage.focus();
      }

      render?.();
    },
    dispose(ctx) {
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }

      ui.hideCallout();
      ui.setStatus('Story stopped');
    },
  };
}

async function main(): Promise<void> {
  installStyles();
  const elements = createLayout();
  const state = createInitialState();
  let forceRender: (() => void) | null = null;

  const storyActions: StoryActions = {
    navigateTo() {},
    pause() {},
    resume() {},
    shutdown() {},
    render() {
      forceRender?.();
    },
  };

  const kernel = createKernel({
    id: 'urk-scrollytelling-proof',
    services: {
      'ui:host': elements.uiHost,
      'story:navigateTo': (sectionId: StorySectionId, source: NavigationSource) => {
        storyActions.navigateTo(sectionId, source);
      },
      'story:pause': () => storyActions.pause(),
      'story:resume': () => storyActions.resume(),
      'story:shutdown': () => storyActions.shutdown(),
      'story:render': () => storyActions.render(),
    },
    adapters: [
      createLoadingAdapter(),
      createUiWidgetsAdapter(),
      createPointerAdapter(),
      createInputAdapter(),
    ],
    controllers: [
      createStoryLoadingController(state),
      createStoryScrollController(state, elements, storyActions),
      createStoryNavigationController(state, elements),
      createStoryChromeController(state, elements, (render) => {
        forceRender = render;
      }),
    ],
  });

  storyActions.pause = () => {
    if (state.isShutdown || kernel.getState().phase !== 'ready') {
      return;
    }

    state.lastAction = 'Paused story runtime';
    kernel.pause('story:pause');
    storyActions.render();
  };

  storyActions.resume = () => {
    if (state.isShutdown || kernel.getState().phase !== 'paused') {
      return;
    }

    state.lastAction = 'Resumed story runtime';
    kernel.resume('story:resume');
    storyActions.render();
  };

  storyActions.shutdown = () => {
    if (state.isShutdown) {
      return;
    }

    state.isShutdown = true;
    state.lastAction = 'Kernel shut down';
    storyActions.render();

    void kernel.shutdown('story:shutdown').catch((error) => {
      state.lastAction = error instanceof Error ? error.message : 'Shutdown failed';
      storyActions.render();
    });
  };

  await kernel.boot();

  window.addEventListener(
    'beforeunload',
    () => {
      state.isShutdown = true;
      void kernel.shutdown('story:unload');
    },
    { once: true },
  );
}

void main().catch((error) => {
  const app = document.querySelector<HTMLDivElement>('#app');

  if (app) {
    app.innerHTML = `
      <main style="padding: 32px; font-family: IBM Plex Sans, sans-serif;">
        <h1 style="margin: 0 0 12px;">URK scrollytelling proof failed</h1>
        <p style="margin: 0; line-height: 1.6; color: #475569;">
          ${error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </main>
    `;
  }

  throw error;
});
