/**
 * Company: EonHive Inc.
 * Title: Embedded Docs Demo Mount
 * Purpose: Mount the public URK example that proves documentation-embedded runtime islands.
 * Author: Stan Nesi
 * Created: 2026-05-09
 * Updated: 2026-05-09
 * Notes: Vibe coded with Codex.
 */

import { createLoadingAdapter, type LoadingAdapterApi } from '@urk/adapters/dom';
import {
  createKernel,
  type ControllerRegistration,
  type FrameInfo,
  type RuntimeContext,
  type RuntimeSnapshot,
} from '@urk/core';
import {
  mountRuntimePanel,
  readRuntimePanelElements,
  type RuntimePanelElements,
} from '../runtime-panel.js';
import type { ExampleMountOptions, ExampleMountResult } from '../types.js';

type DocsEmbedStep =
  | 'static-content'
  | 'island-loading'
  | 'runtime-mounted'
  | 'fallback-boundary'
  | 'disposed';

type DocsEmbedState = {
  step: DocsEmbedStep;
  message: string;
  contentRendered: boolean;
  islandLoaded: boolean;
  fallbackArmed: boolean;
};

type DocsEmbedSurface = {
  article: HTMLElement;
  island: HTMLElement;
  status: HTMLElement;
  fallback: HTMLElement;
  stagePills: HTMLElement[];
  state: DocsEmbedState;
};

type DocsEmbedEventPayload = {
  message: string;
  step?: DocsEmbedStep;
  phase?: string;
  reason?: string;
  hostTagName?: string;
};

const STAGES = [
  { id: 'resolve-docs-host', label: 'Resolve Docs Host' },
  { id: 'lazy-load-island', label: 'Lazy Load Runtime Island' },
  { id: 'mount-runtime', label: 'Mount Runtime' },
  { id: 'confirm-fallback', label: 'Confirm Local Fallback' },
] as const;

const STEP_ORDER: DocsEmbedStep[] = [
  'static-content',
  'island-loading',
  'runtime-mounted',
  'fallback-boundary',
];

const MAX_EVENTS = 20;

function emitDocsEvent(
  ctx: RuntimeContext,
  type: string,
  payload: DocsEmbedEventPayload,
): void {
  ctx.events.emit({
    type,
    source: 'docs-embed-controller',
    payload,
    timestamp: Date.now(),
  });
}

function createElement(tagName: string, className: string, textContent?: string): HTMLElement {
  const element = document.createElement(tagName);

  element.className = className;

  if (textContent) {
    element.textContent = textContent;
  }

  return element;
}

function styleStagePill(pill: HTMLElement, active: boolean, complete: boolean): void {
  pill.style.borderColor = active
    ? 'rgba(125, 211, 252, 0.9)'
    : complete
      ? 'rgba(34, 197, 94, 0.72)'
      : 'rgba(148, 163, 184, 0.24)';
  pill.style.background = active
    ? 'rgba(14, 116, 144, 0.68)'
    : complete
      ? 'rgba(22, 101, 52, 0.52)'
      : 'rgba(15, 23, 42, 0.52)';
}

function syncDocsSurface(surface: DocsEmbedSurface): void {
  const currentIndex = STEP_ORDER.indexOf(surface.state.step);

  surface.status.textContent = surface.state.message;
  surface.island.dataset.docsEmbedStep = surface.state.step;
  surface.fallback.textContent = surface.state.fallbackArmed
    ? 'Local fallback boundary armed. Static docs content stays readable if this island fails.'
    : 'Fallback remains local to this island.';

  surface.stagePills.forEach((pill, index) => {
    styleStagePill(pill, index === currentIndex, index < currentIndex);
  });
}

function setDocsStep(
  surface: DocsEmbedSurface,
  step: DocsEmbedStep,
  message: string,
): DocsEmbedState {
  surface.state.step = step;
  surface.state.message = message;
  surface.state.contentRendered = true;
  surface.state.islandLoaded = step !== 'static-content';
  surface.state.fallbackArmed = step === 'fallback-boundary';
  syncDocsSurface(surface);

  return surface.state;
}

function createStaticDocsBlock(): HTMLElement {
  const block = createElement('section', 'embedded-docs-demo__static');
  const eyebrow = createElement('div', 'embedded-docs-demo__eyebrow', 'Static MDX content');
  const heading = createElement('h3', 'embedded-docs-demo__heading', 'URK runtime island');
  const copy = createElement(
    'p',
    'embedded-docs-demo__copy',
    'This documentation copy renders first. URK boots only inside the client island below.',
  );

  block.append(eyebrow, heading, copy);
  return block;
}

function createRuntimeIsland(): {
  island: HTMLElement;
  status: HTMLElement;
  fallback: HTMLElement;
  stagePills: HTMLElement[];
} {
  const island = createElement('section', 'embedded-docs-demo__island');
  const eyebrow = createElement('div', 'embedded-docs-demo__eyebrow', 'Client island');
  const status = createElement(
    'strong',
    'embedded-docs-demo__status',
    'Waiting for the docs host to resolve.',
  );
  const fallback = createElement(
    'p',
    'embedded-docs-demo__fallback',
    'Fallback remains local to this island.',
  );
  const stageList = createElement('div', 'embedded-docs-demo__stages');
  const stagePills = STEP_ORDER.map((step) => {
    const pill = createElement('span', 'embedded-docs-demo__stage', step.replace(/-/g, ' '));

    pill.style.border = '1px solid rgba(148, 163, 184, 0.24)';
    pill.style.borderRadius = '999px';
    pill.style.padding = '5px 8px';
    pill.style.fontSize = '11px';
    pill.style.fontWeight = '700';
    pill.style.textTransform = 'uppercase';
    pill.style.letterSpacing = '0.06em';

    return pill;
  });

  stageList.append(...stagePills);
  island.append(eyebrow, status, fallback, stageList);

  return { island, status, fallback, stagePills };
}

function prepareDocsEmbedSurface(elements: RuntimePanelElements): {
  docsSurface: DocsEmbedSurface;
  restore: () => void;
} {
  const previousPosition = elements.previewSurface.style.position;
  const previousOverflow = elements.previewSurface.style.overflow;
  const previousIsolation = elements.previewSurface.style.isolation;
  const article = createElement('article', 'embedded-docs-demo');
  const staticBlock = createStaticDocsBlock();
  const { island, status, fallback, stagePills } = createRuntimeIsland();
  const docsSurface: DocsEmbedSurface = {
    article,
    island,
    status,
    fallback,
    stagePills,
    state: {
      step: 'static-content',
      message: 'Static docs content is already rendered.',
      contentRendered: true,
      islandLoaded: false,
      fallbackArmed: false,
    },
  };

  if (!previousPosition) {
    elements.previewSurface.style.position = 'relative';
  }

  elements.previewSurface.style.overflow = 'hidden';
  elements.previewSurface.style.isolation = 'isolate';

  article.dataset.docsEmbedSurface = 'embedded-docs-demo';
  article.setAttribute('aria-label', 'Documentation page with embedded URK runtime island');
  article.style.display = 'grid';
  article.style.gap = '12px';
  article.style.margin = '16px 0';
  article.style.padding = '16px';
  article.style.border = '1px solid rgba(148, 163, 184, 0.28)';
  article.style.borderRadius = '22px';
  article.style.background =
    'linear-gradient(135deg, rgba(15, 23, 42, 0.78), rgba(8, 47, 73, 0.62))';
  article.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.08)';
  article.append(staticBlock, island);

  for (const panel of [staticBlock, island]) {
    panel.style.border = '1px solid rgba(226, 232, 240, 0.14)';
    panel.style.borderRadius = '18px';
    panel.style.background = 'rgba(15, 23, 42, 0.5)';
    panel.style.padding = '14px';
  }

  for (const element of article.querySelectorAll<HTMLElement>(
    '.embedded-docs-demo__eyebrow',
  )) {
    element.style.color = '#a5f3fc';
    element.style.fontSize = '11px';
    element.style.fontWeight = '800';
    element.style.letterSpacing = '0.1em';
    element.style.textTransform = 'uppercase';
  }

  for (const element of article.querySelectorAll<HTMLElement>(
    '.embedded-docs-demo__heading, .embedded-docs-demo__status',
  )) {
    element.style.display = 'block';
    element.style.margin = '6px 0';
    element.style.color = '#f8fafc';
    element.style.fontSize = '16px';
    element.style.fontWeight = '800';
  }

  for (const element of article.querySelectorAll<HTMLElement>(
    '.embedded-docs-demo__copy, .embedded-docs-demo__fallback',
  )) {
    element.style.margin = '0';
    element.style.color = '#cbd5e1';
    element.style.fontSize = '13px';
    element.style.lineHeight = '1.65';
  }

  const stageList = island.querySelector<HTMLElement>('.embedded-docs-demo__stages');

  if (stageList) {
    stageList.style.display = 'flex';
    stageList.style.flexWrap = 'wrap';
    stageList.style.gap = '6px';
    stageList.style.marginTop = '10px';
  }

  elements.previewSurface.insertBefore(article, elements.previewMessage);
  syncDocsSurface(docsSurface);

  return {
    docsSurface,
    restore() {
      article.remove();
      elements.previewSurface.style.position = previousPosition;
      elements.previewSurface.style.overflow = previousOverflow;
      elements.previewSurface.style.isolation = previousIsolation;
    },
  };
}

function createDocsEmbedController(docsSurface: DocsEmbedSurface): ControllerRegistration {
  let elapsedMs = 0;
  let activeStageId: string | null = null;
  let completed = false;

  return {
    id: 'docs-embed-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const docsHost = ctx.services.require<HTMLElement>('docs:host');

      loading.begin([...STAGES], 'Resolving the static docs host before runtime island boot');
      setDocsStep(docsSurface, 'static-content', 'Static docs content rendered before URK boot.');
      emitDocsEvent(ctx, 'docs-embed:host-resolved', {
        message: 'The docs host exists before the runtime island starts.',
        step: 'static-content',
        hostTagName: docsHost.tagName.toLowerCase(),
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
        if (activeStageId !== 'resolve-docs-host') {
          activeStageId = 'resolve-docs-host';
          loading.setStage(
            'resolve-docs-host',
            0.28,
            'Static documentation host is resolved before runtime work starts',
          );
        }

        return;
      }

      if (elapsedMs < 1300) {
        if (activeStageId !== 'lazy-load-island') {
          activeStageId = 'lazy-load-island';
          loading.setStage(
            'lazy-load-island',
            0.58,
            'Client runtime island is lazy-loaded inside the docs shell',
          );
          setDocsStep(docsSurface, 'island-loading', 'Runtime island module loaded locally.');
          emitDocsEvent(ctx, 'docs-embed:island-loading', {
            message: 'The runtime island loads after the static docs shell.',
            step: 'island-loading',
          });
        }

        return;
      }

      if (elapsedMs < 1950) {
        if (activeStageId !== 'mount-runtime') {
          activeStageId = 'mount-runtime';
          loading.setStage(
            'mount-runtime',
            0.82,
            'URK owns the live runtime surface inside the documentation page',
          );
          setDocsStep(docsSurface, 'runtime-mounted', 'URK runtime mounted inside the island.');
          emitDocsEvent(ctx, 'docs-embed:runtime-mounted', {
            message: 'URK owns the live island, not the surrounding documentation shell.',
            step: 'runtime-mounted',
          });
        }

        return;
      }

      if (elapsedMs < 2450) {
        if (activeStageId !== 'confirm-fallback') {
          activeStageId = 'confirm-fallback';
          loading.setStage(
            'confirm-fallback',
            0.92,
            'Docs content remains available while the runtime island owns its local fallback',
          );
          setDocsStep(
            docsSurface,
            'fallback-boundary',
            'Local fallback boundary armed; docs content remains readable.',
          );
          emitDocsEvent(ctx, 'docs-embed:fallback-confirmed', {
            message: 'Runtime failure would stay local to the embedded island.',
            step: 'fallback-boundary',
          });
        }

        return;
      }

      loading.complete('Embedded docs demo ready: docs shell and runtime island stay separate');
      emitDocsEvent(ctx, 'docs-embed:ready', {
        message: 'Embedded docs runtime island reached ready.',
        step: docsSurface.state.step,
      });
      ctx.state.setPhase('ready', 'embedded-docs-demo:ready');
      completed = true;
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      if (next.phase === 'paused') {
        docsSurface.status.textContent = 'Runtime island paused; static docs content remains visible.';
        emitDocsEvent(ctx, 'docs-embed:paused', {
          message: 'Runtime island paused without affecting the docs shell.',
          phase: next.phase,
          reason: next.reason,
        });
      }

      if (previous.phase === 'paused' && next.phase !== 'paused') {
        docsSurface.status.textContent = docsSurface.state.message;
        emitDocsEvent(ctx, 'docs-embed:resumed', {
          message: 'Runtime island resumed inside the same docs host.',
          phase: next.phase,
          reason: next.reason,
        });
      }

      if (next.phase === 'error') {
        docsSurface.fallback.textContent = next.reason ?? 'Runtime island failed locally.';
        emitDocsEvent(ctx, 'docs-embed:error', {
          message: next.reason ?? 'Runtime island failed locally.',
          phase: next.phase,
          reason: next.reason,
        });
      }
    },
    dispose(ctx) {
      setDocsStep(docsSurface, 'disposed', 'Runtime island disposed; docs shell teardown restored.');
      emitDocsEvent(ctx, 'docs-embed:disposed', {
        message: 'Embedded docs runtime island disposed cleanly.',
        step: 'disposed',
      });
    },
  };
}

function createKernelInstance(docsSurface: DocsEmbedSurface) {
  return createKernel({
    id: 'urk-www-embedded-docs-demo',
    services: {
      'docs:host': docsSurface.article,
    },
    adapters: [createLoadingAdapter()],
    controllers: [createDocsEmbedController(docsSurface)],
  });
}

export async function mountEmbeddedDocsDemoExample(
  host: HTMLElement,
  _options: ExampleMountOptions = {},
): Promise<ExampleMountResult> {
  const elements = readRuntimePanelElements(host, 'embedded docs demo');
  const { docsSurface, restore } = prepareDocsEmbedSurface(elements);
  const kernel = createKernelInstance(docsSurface);

  return mountRuntimePanel({
    elements,
    kernel,
    exampleLabel: 'embedded docs demo',
    pauseReason: 'embedded-docs-demo:pause',
    resumeReason: 'embedded-docs-demo:resume',
    shutdownReason: 'embedded-docs-demo:shutdown',
    teardownReason: 'embedded-docs-demo:teardown',
    mountFailureMessage: 'The embedded docs demo failed to mount.',
    previewFailureMessage:
      'The docs page stayed readable, but the embedded runtime island did not finish mounting.',
    recentEventLimit: MAX_EVENTS,
    onTeardown: restore,
  });
}
