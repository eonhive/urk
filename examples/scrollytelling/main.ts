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
  storyProgress: number;
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
    storyProgress: 0,
    lastAction: 'Booting scrollytelling proof',
    motionTick: 0,
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
      >
        ${section.label}
      </button>
    `;
  }).join('');
}

function renderStorySections(container: HTMLElement): void {
  container.innerHTML = STORY_SECTIONS.map((section, index) => {
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
  elements.loadingStageValue.textContent = showLoading
    ? loadingSnapshot.stageLabel ?? 'Waiting'
    : 'Story progress';
  elements.loadingProgressValue.textContent = `${Math.round(
    (showLoading ? loadingSnapshot.progress : state.storyProgress) * 100,
  )}%`;
  elements.loadingProgressFill.setAttribute(
    'style',
    `width: ${(showLoading ? loadingSnapshot.progress : state.storyProgress) * 100}%`,
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

function createStoryScrollController(
  state: StoryState,
  elements: AppElements,
  storyActions: StoryActions,
): ControllerRegistration {
  const cleanups: Array<() => void> = [];
  let lockedScrollTop = 0;

  const syncFromScroll = (recordAction: boolean): void => {
    const { sectionId, progress, storyProgress } = getActiveScrollState(elements);
    const action =
      recordAction && state.activeSectionId !== sectionId
        ? `Scrolled into ${sectionLabel(sectionId)} section`
        : undefined;

    setActiveSection(state, sectionId, progress, storyProgress, action);
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
        const targetScrollTop = Math.max(
          target.offsetTop - elements.scrollContainer.offsetTop,
          0,
        );

        setActiveSection(
          state,
          sectionId,
          0,
          getStoryProgress(elements, targetScrollTop),
          source === 'top'
            ? 'Returned to intro section'
            : `${source === 'pointer' ? 'Clicked' : 'Keyed'} ${sectionLabel(sectionId)} section`,
        );
        elements.scrollContainer.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
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

      setActiveSection(state, 'intro', 0, 0);
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
