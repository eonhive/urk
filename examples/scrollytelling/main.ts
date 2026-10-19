/**
 * Company: EonHive Inc.
 * Title: URK Scrollytelling Proof
 * Purpose: Prove DOM-first scroll and section orchestration with existing URK adapters.
 * Author: Stan Nesi
 * Created: 2026-04-23
 * Updated: 2026-04-23
 * Notes: Vibe coded with Codex.
 */

import {
  createKernel,
  type ControllerRegistration,
  type Kernel,
  type RuntimeSnapshot,
} from '@urk/core';
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
} from '@urk/adapters/dom';
import {
  createMotionAdapter,
  createMotionController,
  MotionCapability,
  type MotionHandle,
  type TimelineEntry,
} from '@urk/adapters/motion';
import { createScrollMotion } from './scroll-motion.js';
import { createScrollTimeline } from './scroll-timeline.js';

const STORY_SECTION_IDS = ['intro', 'orchestration', 'runtime', 'proof'] as const;

type StorySectionId = (typeof STORY_SECTION_IDS)[number];
type NavigationSource = 'pointer' | 'keyboard' | 'top';
type MotionSource = 'scroll' | 'playback';

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
  storyProgress: number;
  lastAction: string;
  activeAnimationCount: number;
  motionProgress: number;
  motionStatus: string;
  navigationActive: boolean;
  motionSource: MotionSource;
  lifecycle: string;
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
  replay: () => void;
  cancel: () => void;
};

type StorySectionElements = Record<StorySectionId, HTMLElement>;
type StoryNavElements = Record<StorySectionId, HTMLButtonElement>;

type AppElements = {
  phaseValue: HTMLElement;
  reasonValue: HTMLElement;
  activeSectionValue: HTMLElement;
  frameValue: HTMLElement;
  motionValue: HTMLElement;
  motionProgressValue: HTMLElement;
  motionStatusValue: HTMLElement;
  lifecycleValue: HTMLElement;
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
  restartButton: HTMLButtonElement;
  replayButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  reducedInput: HTMLInputElement;
  motionSource: HTMLSelectElement;
  scrollTimeValue: HTMLOutputElement;
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
    body: 'This story begins with explicit runtime state, staged loading, and a single scroll surface that makes orchestration behavior easy to inspect.',
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
    body: 'Adapters provide tools. Controllers use them. The proof keeps scroll, pointer, input, and overlay behavior sharp without mixing product logic into the kernel.',
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
    body: 'The proof keeps phase, reason, section progress, frame tick, and latest action visible so state transitions never disappear behind framework component state.',
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
    body: 'The same public motion capability drives section scrolling and staggered entrances here and view transitions in Motion Lab. The application owns the story; the kernel coordinates its lifetime.',
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
    storyProgress: 0,
    lastAction: 'Booting scrollytelling proof',
    activeAnimationCount: 0,
    motionProgress: 0,
    motionStatus: 'idle',
    navigationActive: false,
    motionSource: 'scroll',
    lifecycle: 'created',
    hasReachedReady: false,
    isShutdown: false,
  };
}

function renderStoryNav(container: HTMLElement): void {
  container.innerHTML = STORY_SECTIONS.map((section) => {
    return `
      <button
        type="button"
        class="story-nav__button"
        data-role="nav-${section.id}"
        data-active="${section.id === 'intro' ? 'true' : 'false'}"
        aria-current="${section.id === 'intro' ? 'step' : 'false'}"
      >
        ${section.label}
      </button>
    `;
  }).join('');
}

function renderStorySections(container: HTMLElement): void {
  container.innerHTML = STORY_SECTIONS.map((section, index) => {
    return `
      <section id="story-${section.id}"
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
  }).join('');
}

function createLayout(): AppElements {
  const app = assertElement(document.querySelector<HTMLDivElement>('#app'), '#app');

  const storyNav = assertElement(
    app.querySelector<HTMLElement>('[data-role="story-nav"]'),
    'story nav',
  );
  const scrollContainer = assertElement(
    app.querySelector<HTMLElement>('[data-role="scroll-container"]'),
    'scroll container',
  );
  renderStoryNav(storyNav);
  renderStorySections(scrollContainer);

  return {
    phaseValue: assertElement(app.querySelector('[data-role="phase-value"]'), 'phase value'),
    reasonValue: assertElement(app.querySelector('[data-role="reason-value"]'), 'reason value'),
    activeSectionValue: assertElement(
      app.querySelector('[data-role="section-value"]'),
      'active section value',
    ),
    frameValue: assertElement(app.querySelector('[data-role="frame-value"]'), 'frame value'),
    motionValue: assertElement(app.querySelector('[data-role="motion-value"]'), 'motion value'),
    motionProgressValue: assertElement(
      app.querySelector('[data-role="motion-progress-value"]'),
      'motion progress',
    ),
    motionStatusValue: assertElement(
      app.querySelector('[data-role="motion-status-value"]'),
      'motion status',
    ),
    lifecycleValue: assertElement(app.querySelector('[data-role="lifecycle-value"]'), 'lifecycle'),
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
    loadingTitle: assertElement(app.querySelector('[data-role="loading-title"]'), 'loading title'),
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
    restartButton: assertElement(
      app.querySelector('[data-role="restart-button"]'),
      'restart button',
    ),
    replayButton: assertElement(app.querySelector('[data-role="replay-button"]'), 'replay button'),
    cancelButton: assertElement(app.querySelector('[data-role="cancel-button"]'), 'cancel button'),
    reducedInput: assertElement(app.querySelector('[data-role="reduced-input"]'), 'reduced motion'),
    motionSource: assertElement(app.querySelector('[data-role="motion-source"]'), 'motion source'),
    scrollTimeValue: assertElement(
      app.querySelector('[data-role="scroll-time-value"]'),
      'scroll time',
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
      runtime: assertElement(app.querySelector('[data-role="section-runtime"]'), 'runtime section'),
      proof: assertElement(app.querySelector('[data-role="section-proof"]'), 'proof section'),
    },
    uiHost: assertElement(app.querySelector('[data-role="ui-host"]'), 'ui host'),
  };
}

function setButtonDisabled(button: HTMLButtonElement, disabled: boolean): void {
  button.disabled = disabled;
}

function syncControls(elements: AppElements, snapshot: RuntimeSnapshot, state: StoryState): void {
  const readyInteractive =
    (snapshot.phase === 'ready' || snapshot.phase === 'transition') && !state.isShutdown;

  for (const sectionId of STORY_SECTION_IDS) {
    setButtonDisabled(elements.navButtons[sectionId], !readyInteractive);
  }

  setButtonDisabled(elements.pauseButton, state.isShutdown || state.lifecycle !== 'running');
  setButtonDisabled(elements.resumeButton, state.isShutdown || snapshot.phase !== 'paused');
  setButtonDisabled(elements.backToTopButton, state.isShutdown || snapshot.phase !== 'ready');
  setButtonDisabled(elements.shutdownButton, state.isShutdown);
  setButtonDisabled(elements.restartButton, state.lifecycle !== 'disposed');
  setButtonDisabled(elements.replayButton, !readyInteractive || state.motionSource !== 'playback');
  setButtonDisabled(elements.cancelButton, state.isShutdown || !state.navigationActive);
  elements.reducedInput.disabled = state.isShutdown;
  elements.motionSource.disabled = !readyInteractive;
}

function syncStoryView(
  elements: AppElements,
  state: StoryState,
  snapshot: RuntimeSnapshot,
  loadingSnapshot: LoadingSnapshot,
  latestEvent: string,
  frameTick: number,
): void {
  const showLoading =
    snapshot.phase === 'loading' || (snapshot.phase === 'paused' && !state.hasReachedReady);
  const readyInteractive =
    (snapshot.phase === 'ready' || snapshot.phase === 'transition') && !state.isShutdown;

  elements.phaseValue.textContent = snapshot.phase;
  elements.reasonValue.textContent = snapshot.reason ?? 'n/a';
  elements.activeSectionValue.textContent = sectionLabel(state.activeSectionId);
  elements.frameValue.textContent = String(frameTick);
  elements.motionValue.textContent = String(state.activeAnimationCount);
  elements.motionProgressValue.textContent = `${Math.round(state.motionProgress * 100)}%`;
  elements.motionStatusValue.textContent =
    state.lifecycle === 'paused' ? 'paused' : state.motionStatus;
  elements.lifecycleValue.textContent = state.lifecycle;
  elements.actionValue.textContent = state.lastAction;
  elements.eventValue.textContent = latestEvent;
  elements.loadingStageValue.textContent = showLoading
    ? (loadingSnapshot.stageLabel ?? 'Waiting')
    : 'Story progress';
  elements.loadingProgressValue.textContent = `${Math.round(
    (showLoading ? loadingSnapshot.progress : state.storyProgress) * 100,
  )}%`;
  elements.loadingProgressFill.setAttribute(
    'style',
    `width: ${(showLoading ? loadingSnapshot.progress : state.storyProgress) * 100}%`,
  );
  elements.sectionProgressValue.textContent = `${Math.round(state.sectionProgress * 100)}%`;
  elements.sectionProgressFill.setAttribute('style', `width: ${state.sectionProgress * 100}%`);

  for (const sectionId of STORY_SECTION_IDS) {
    const active = state.activeSectionId === sectionId;
    elements.navButtons[sectionId].dataset.active = active ? 'true' : 'false';
    elements.navButtons[sectionId].setAttribute('aria-current', active ? 'step' : 'false');
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
  sectionProgress: number,
  storyProgress: number,
  action?: string,
): void {
  const nextSectionProgress = clamp(sectionProgress);
  const nextStoryProgress = clamp(storyProgress);

  if (
    state.activeSectionId === sectionId &&
    Math.abs(state.sectionProgress - nextSectionProgress) < 0.0001 &&
    Math.abs(state.storyProgress - nextStoryProgress) < 0.0001 &&
    !action
  ) {
    return;
  }

  state.activeSectionId = sectionId;
  state.sectionProgress = nextSectionProgress;
  state.storyProgress = nextStoryProgress;

  if (action) {
    state.lastAction = action;
  }
}

function getStoryProgress(
  elements: AppElements,
  scrollTop = elements.scrollContainer.scrollTop,
): number {
  const maxScrollTop = Math.max(
    elements.scrollContainer.scrollHeight - elements.scrollContainer.clientHeight,
    0,
  );

  if (maxScrollTop === 0) {
    return 0;
  }

  return clamp(scrollTop / maxScrollTop);
}

function getActiveScrollState(elements: AppElements): {
  sectionId: StorySectionId;
  progress: number;
  storyProgress: number;
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

  const maxScrollTop =
    elements.scrollContainer.scrollHeight - elements.scrollContainer.clientHeight;
  if (maxScrollTop > 0 && scrollTop >= maxScrollTop - 1) sectionId = 'proof';

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
    storyProgress: getStoryProgress(elements, scrollTop),
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

function sectionEntrance(elements: AppElements, sectionId: StorySectionId): TimelineEntry[] {
  const section = elements.sections[sectionId];
  const targets = [
    section.querySelector<HTMLElement>('.story-section__content')!,
    section.querySelector<HTMLElement>('.story-section__visual-card')!,
    ...section.querySelectorAll<HTMLElement>('li'),
  ];
  return targets.map((target, index) => {
    target.style.opacity = '0';
    return {
      atMs: index * 85,
      from: 0,
      to: 1,
      durationMs: 480,
      easing: 'ease-out',
      onUpdate(value) {
        target.style.opacity = String(value);
        target.style.transform = `translateY(${(1 - value) * (index === 1 ? 32 : 14)}px) scale(${0.97 + 0.03 * value})`;
      },
    };
  });
}

function scrollChoreography(elements: AppElements): TimelineEntry[] {
  const container = elements.scrollContainer;
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
  const timeAt = (position: number) => (maxScroll > 0 ? clamp(position / maxScroll) * 1000 : 0);
  const tweens: TimelineEntry[] = [
    {
      from: 0,
      to: 1000,
      durationMs: 1000,
      onUpdate(value) {
        elements.scrollTimeValue.textContent = `${Math.round(value)} / 1,000 ms`;
      },
    },
  ];
  for (const [index, sectionId] of STORY_SECTION_IDS.entries()) {
    const section = elements.sections[sectionId];
    const card = section.querySelector<HTMLElement>('.story-section__visual-card')!;
    const top = section.offsetTop - container.offsetTop;
    const start = timeAt(top - container.clientHeight * 0.7);
    const end = timeAt(top + section.offsetHeight * 0.45);
    tweens.push({
      atMs: start,
      from: 0,
      to: 1,
      durationMs: Math.max(0, end - start),
      easing: 'ease-in-out',
      onUpdate(value) {
        const tilt = (value - 0.5) * (index % 2 === 0 ? 8 : -8);
        card.style.transform = `translateY(${(0.5 - value) * 64}px) rotate(${tilt}deg) scale(${0.94 + value * 0.06})`;
      },
    });
  }
  return tweens;
}

function createStoryScrollController(
  state: StoryState,
  elements: AppElements,
  storyActions: StoryActions,
): ControllerRegistration {
  let lockedScrollTop = 0;
  let entrance: MotionHandle | undefined;
  let scroll: ReturnType<typeof createScrollMotion>;
  let scrub: ReturnType<typeof createScrollTimeline>;
  let layoutDirty = false;
  let lastLayout = '';
  let replay = () => {};
  let sampleScroll = () => {};

  const syncFromScroll = (recordAction: boolean): void => {
    const { sectionId, progress, storyProgress } = getActiveScrollState(elements);
    const changed = state.activeSectionId !== sectionId;
    const action =
      recordAction && changed ? `Scrolled into ${sectionLabel(sectionId)} section` : undefined;
    setActiveSection(state, sectionId, progress, storyProgress, action);
    if (changed && !scroll.navigating && state.motionSource === 'playback') replay();
    sampleScroll();
  };

  const resetVisuals = (): void => {
    entrance?.cancel('section-changed');
    entrance = undefined;
    scrub?.reset();
    for (const target of elements.scrollContainer.querySelectorAll<HTMLElement>(
      '.story-section__content,.story-section__visual-card,li',
    )) {
      target.style.opacity = '1';
      target.style.transform = 'none';
    }
  };

  return {
    id: 'story-scroll-controller',
    init(ctx) {
      const api = ctx.require(MotionCapability);
      const motion = api.scoped(ctx.scope);
      const preference = matchMedia('(prefers-reduced-motion: reduce)');
      let preferenceOverridden = false;
      elements.reducedInput.checked = preference.matches;
      elements.motionSource.value = state.motionSource;
      scrub = createScrollTimeline(ctx, motion, () => ({ tweens: scrollChoreography(elements) }));
      sampleScroll = () => {
        if (state.motionSource !== 'scroll' || !state.hasReachedReady) return;
        if (elements.reducedInput.checked) {
          elements.scrollTimeValue.textContent = 'Static · reduced motion';
          return;
        }
        const container = elements.scrollContainer;
        const layout = `${container.clientWidth}:${container.clientHeight}:${container.scrollHeight}`;
        // A scroll event can arrive before the browser publishes resize. Measure
        // before sampling so the new position never uses the old track ranges.
        if (layoutDirty || layout !== lastLayout) {
          scrub.reset();
          layoutDirty = false;
          lastLayout = layout;
        }
        scrub.sample(getStoryProgress(elements));
      };
      const refreshMotion = (playEntrance = false) => {
        resetVisuals();
        if (state.motionSource === 'scroll') sampleScroll();
        else {
          elements.scrollTimeValue.textContent = 'Timed entrance';
          if (playEntrance && state.hasReachedReady && !scroll.navigating) replay();
        }
        storyActions.render();
      };
      const syncPreference = () => {
        if (preferenceOverridden) return;
        elements.reducedInput.checked = preference.matches;
        refreshMotion();
      };
      preference.addEventListener('change', syncPreference);
      ctx.scope.defer(() => preference.removeEventListener('change', syncPreference));
      elements.reducedInput.addEventListener(
        'change',
        () => {
          preferenceOverridden = true;
          // Release the preview before reduction finishes active playback. Stable
          // styles stay application-owned; re-enabling samples the current scroll.
          resetVisuals();
          api.setReducedMotion(elements.reducedInput.checked);
          refreshMotion();
        },
        { signal: ctx.signal },
      );

      scroll = createScrollMotion(ctx, motion, {
        read: () => elements.scrollContainer.scrollTop,
        write(position) {
          elements.scrollContainer.scrollTop = position;
          lockedScrollTop = elements.scrollContainer.scrollTop;
          syncFromScroll(false);
        },
      });
      replay = () => {
        if (ctx.signal.aborted) return;
        resetVisuals();
        if (state.motionSource === 'scroll') sampleScroll();
        else {
          elements.scrollTimeValue.textContent = 'Timed entrance';
          entrance = motion.timeline({ tweens: sectionEntrance(elements, state.activeSectionId) });
        }
      };
      storyActions.replay = () => {
        if (state.motionSource !== 'playback') return;
        void scroll.cancel('replay').then(() => {
          if (!ctx.signal.aborted && !scroll.navigating) replay();
        });
      };
      storyActions.cancel = () => {
        void scroll.cancel().then(() => {
          if (ctx.signal.aborted || scroll.navigating) return;
          syncFromScroll(false);
          replay();
          state.lastAction = 'Navigation cancelled at the current scroll position';
          storyActions.render();
        });
      };
      storyActions.navigateTo = (sectionId, source) => {
        if (!['ready', 'transition'].includes(ctx.state.getSnapshot().phase) || state.isShutdown)
          return;
        if (state.motionSource === 'playback') resetVisuals();
        const max = Math.max(
          0,
          elements.scrollContainer.scrollHeight - elements.scrollContainer.clientHeight,
        );
        const target = Math.min(
          max,
          Math.max(0, elements.sections[sectionId].offsetTop - elements.scrollContainer.offsetTop),
        );
        state.lastAction =
          source === 'top'
            ? 'Returning to intro section'
            : `${source === 'pointer' ? 'Clicked' : 'Keyed'} ${sectionLabel(sectionId)} section`;
        void scroll
          .navigate(target)
          .then((result) => {
            if (ctx.signal.aborted || result.status !== 'completed') return;
            syncFromScroll(false);
            replay();
            state.lastAction = `Arrived at ${sectionLabel(sectionId)} section`;
            storyActions.render();
          })
          .catch((error) => {
            state.lastAction = String(error);
            storyActions.render();
          });
      };

      const interrupt = () => {
        if (ctx.getLifecycleSnapshot().state !== 'running' || !scroll.navigating) return;
        void scroll.cancel('manual-scroll').then(() => {
          if (ctx.signal.aborted || scroll.navigating) return;
          syncFromScroll(true);
          replay();
          state.lastAction = 'Manual scrolling took over';
          storyActions.render();
        });
      };
      for (const type of ['wheel', 'touchstart', 'pointerdown']) {
        elements.scrollContainer.addEventListener(type, interrupt, {
          passive: true,
          signal: ctx.signal,
        });
      }
      elements.scrollContainer.addEventListener(
        'scroll',
        () => {
          if (ctx.getLifecycleSnapshot().state !== 'running' || !state.hasReachedReady) {
            elements.scrollContainer.scrollTop = lockedScrollTop;
            return;
          }
          lockedScrollTop = elements.scrollContainer.scrollTop;
          syncFromScroll(true);
          storyActions.render();
        },
        { passive: true, signal: ctx.signal },
      );
      // Browser scrolling keys take over; section shortcuts are handled by Input.
      elements.scrollContainer.addEventListener(
        'keydown',
        (event) => {
          if (['PageDown', 'PageUp', 'Home', 'End', 'Space'].includes(event.code)) interrupt();
        },
        { signal: ctx.signal },
      );
      window.addEventListener(
        'resize',
        () => {
          layoutDirty = true;
          if (ctx.getLifecycleSnapshot().state !== 'running') return;
          void scroll.cancel('layout-changed').then(() => {
            if (ctx.signal.aborted) return;
            syncFromScroll(false);
            storyActions.render();
          });
        },
        { signal: ctx.signal },
      );
      elements.replayButton.addEventListener('click', () => storyActions.replay(), {
        signal: ctx.signal,
      });
      elements.cancelButton.addEventListener('click', () => storyActions.cancel(), {
        signal: ctx.signal,
      });
      elements.motionSource.addEventListener(
        'change',
        () => {
          state.motionSource = elements.motionSource.value === 'playback' ? 'playback' : 'scroll';
          refreshMotion(true);
          state.lastAction =
            state.motionSource === 'scroll'
              ? 'Scroll position drives the timeline; scroll back to reverse its pose'
              : 'Timed entrances enabled; use Replay entrance to play again';
          storyActions.render();
        },
        { signal: ctx.signal },
      );
      ctx.scope.defer(resetVisuals);
      setActiveSection(state, 'intro', 0, 0);
    },
    update(_frame, ctx) {
      sampleScroll();
      state.navigationActive = scroll.navigating;
      state.activeAnimationCount = ctx.require(MotionCapability).activeCount;
      const handle =
        scroll.activeHandle ?? (state.motionSource === 'scroll' ? scrub.handle : entrance);
      state.motionProgress = handle?.progress ?? 0;
      state.motionStatus = scroll.navigating
        ? (handle?.status ?? 'pending')
        : state.motionSource === 'scroll'
          ? elements.reducedInput.checked
            ? 'static'
            : 'scroll-linked'
          : (handle?.status ?? 'idle');
    },
    onStateChange(next, previous, ctx) {
      if (next.phase === 'ready') {
        lockedScrollTop = elements.scrollContainer.scrollTop;
        syncFromScroll(false);
        if (previous.phase === 'loading') {
          replay();
          elements.scrollContainer.focus({ preventScroll: true });
        }
      } else if (ctx.getLifecycleSnapshot().state !== 'running') {
        lockedScrollTop = elements.scrollContainer.scrollTop;
      }
      storyActions.render();
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
  ): Omit<StoryActions, 'replay' | 'cancel'> => {
    return {
      navigateTo:
        ctx.services.require<(sectionId: StorySectionId, source: NavigationSource) => void>(
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
        if (['ready', 'transition'].includes(snapshot.phase) && !state.isShutdown) {
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
        if (['ready', 'transition'].includes(snapshot.phase) && !state.isShutdown) {
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
          handler: (event) => {
            if (!elements.storyStage.contains(document.activeElement)) return;
            event.nativeEvent.preventDefault();
            if (
              !['ready', 'transition'].includes(ctx.state.getSnapshot().phase) ||
              state.isShutdown
            ) {
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
          handler: (event) => {
            if (!elements.storyStage.contains(document.activeElement)) return;
            event.nativeEvent.preventDefault();
            if (
              !['ready', 'transition'].includes(ctx.state.getSnapshot().phase) ||
              state.isShutdown
            ) {
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
      const motion = ctx.require(MotionCapability);

      latestLoadingSnapshot = loading.getSnapshot();

      render = (): void => {
        state.lifecycle = ctx.getLifecycleSnapshot().state;
        state.activeAnimationCount = motion.activeCount;
        const snapshot = ctx.state.getSnapshot();
        syncControls(elements, snapshot, state);
        syncStoryView(elements, state, snapshot, latestLoadingSnapshot, latestEvent, frameTick);
      };

      setForceRender(render);
      render();
      cleanups.push(ctx.subscribeLifecycle(() => render?.()));

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

      if (snapshot.phase === 'transition') {
        ui.showCallout({
          title: 'Moving through the story',
          body: 'Choose another section, or scroll to take over. Pause preserves the current position.',
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
  const elements = createLayout();
  const hostListeners = new AbortController();
  let kernel: Kernel | undefined;
  let starting = false;

  async function startFresh(): Promise<void> {
    if (starting) return;
    starting = true;
    elements.restartButton.disabled = true;
    try {
      await kernel?.shutdown('story:restart');
      const state = createInitialState();
      let forceRender: (() => void) | null = null;
      elements.scrollContainer.scrollTop = 0;
      const storyActions: StoryActions = {
        navigateTo() {},
        pause() {},
        resume() {},
        shutdown() {},
        replay() {},
        cancel() {},
        render() {
          forceRender?.();
        },
      };
      const current = createKernel({
        id: 'urk-scrollytelling-proof',
        frameMode: 'auto',
        services: {
          'ui:host': elements.uiHost,
          'story:navigateTo': (sectionId: StorySectionId, source: NavigationSource) =>
            storyActions.navigateTo(sectionId, source),
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
          createMotionAdapter(),
        ],
        controllers: [
          createMotionController(),
          createStoryLoadingController(state),
          createStoryScrollController(state, elements, storyActions),
          createStoryNavigationController(state, elements),
          createStoryChromeController(state, elements, (render) => {
            forceRender = render;
          }),
        ],
      });
      kernel = current;
      storyActions.pause = () => {
        if (state.isShutdown || current.getLifecycleSnapshot().state !== 'running') return;
        state.lastAction = 'Paused story runtime';
        current.pause('story:pause');
        storyActions.render();
      };
      storyActions.resume = () => {
        if (state.isShutdown || current.getLifecycleSnapshot().state !== 'paused') return;
        state.lastAction = 'Resumed story runtime';
        current.resume('story:resume');
        storyActions.render();
      };
      storyActions.shutdown = () => {
        if (state.isShutdown) return;
        state.isShutdown = true;
        state.lastAction = 'Kernel shut down';
        storyActions.render();
        void current
          .shutdown('story:shutdown')
          .then(() => storyActions.render())
          .catch((error) => {
            state.lastAction = String(error);
            storyActions.render();
          });
      };
      await current.boot();
    } finally {
      starting = false;
    }
  }

  const report = (error: unknown) => {
    elements.actionValue.textContent = String(error);
  };
  elements.restartButton.addEventListener(
    'click',
    () => {
      void startFresh().catch(report);
    },
    { signal: hostListeners.signal },
  );
  const stop = () => {
    void kernel?.shutdown('story:unload').catch(report);
  };
  window.addEventListener('pagehide', stop, { signal: hostListeners.signal });
  window.addEventListener(
    'pageshow',
    (event) => {
      if (event.persisted) void startFresh().catch(report);
    },
    { signal: hostListeners.signal },
  );
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      hostListeners.abort();
      stop();
    });
  await startFresh();
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
