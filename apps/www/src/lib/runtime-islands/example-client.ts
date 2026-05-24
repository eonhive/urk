/**
 * Company: EonHive Inc.
 * Title: Example Client Loader
 * Purpose: Mount and dispose real URK examples inside the public site without coupling docs rendering to runtime execution.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

import { loadExampleModule, type ExampleId, type ExampleMountResult } from '@urk/examples';

const mountedExamples = new Map<HTMLElement, ExampleMountResult>();
let observer: IntersectionObserver | null = null;
let cleanupRegistered = false;
let restartRegistered = false;

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Runtime example failed to mount.';
}

async function teardownAll(): Promise<void> {
  for (const [root, mounted] of mountedExamples.entries()) {
    await mounted.teardown();
    mountedExamples.delete(root);
  }
}

async function restartRoot(root: HTMLElement, trigger?: HTMLButtonElement): Promise<void> {
  if (root.dataset.mountState === 'mounting' || root.dataset.mountState === 'restarting') {
    return;
  }

  const mounted = mountedExamples.get(root);
  const previousLabel = trigger?.textContent;

  root.dataset.mountState = 'restarting';

  if (trigger) {
    trigger.disabled = true;
    trigger.textContent = 'Restarting';
  }

  try {
    if (mounted) {
      await mounted.teardown();
      mountedExamples.delete(root);
    }

    const errorTarget = root.querySelector<HTMLElement>('[data-role="example-error"]');

    if (errorTarget) {
      errorTarget.hidden = true;
      errorTarget.textContent = '';
    }

    root.dataset.mountState = 'idle';
    await mountRoot(root);
  } finally {
    if (trigger) {
      trigger.disabled = false;
      trigger.textContent = previousLabel ?? 'Reset / restart';
    }
  }
}

async function mountRoot(root: HTMLElement): Promise<void> {
  if (mountedExamples.has(root) || root.dataset.mountState === 'mounting') {
    return;
  }

  const exampleId = root.dataset.exampleId as ExampleId | undefined;

  if (!exampleId) {
    return;
  }

  root.dataset.mountState = 'mounting';

  try {
    const example = await loadExampleModule(exampleId);
    const mounted = await example.mount(root);
    mountedExamples.set(root, mounted);
    root.dataset.mountState = 'mounted';
  } catch (error) {
    root.dataset.mountState = 'error';
    const errorTarget = root.querySelector<HTMLElement>('[data-role="example-error"]');

    if (errorTarget) {
      errorTarget.hidden = false;
      errorTarget.textContent = readErrorMessage(error);
    }
  }
}

function registerRestartHandler(): void {
  if (restartRegistered) {
    return;
  }

  restartRegistered = true;
  document.addEventListener('click', (event) => {
    const trigger = (event.target as Element | null)?.closest<HTMLButtonElement>(
      '[data-role="restart-example"]',
    );

    if (!trigger) {
      return;
    }

    const root = trigger.closest<HTMLElement>('[data-urk-example-root]');

    if (!root) {
      return;
    }

    void restartRoot(root, trigger);
  });
}

function observeRoot(root: HTMLElement): void {
  if (!('IntersectionObserver' in window)) {
    void mountRoot(root);
    return;
  }

  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        observer?.unobserve(entry.target);
        void mountRoot(entry.target as HTMLElement);
      }
    }, { rootMargin: '160px 0px' });
  }

  observer.observe(root);
}

export function mountExampleIslands(): void {
  const roots = document.querySelectorAll<HTMLElement>('[data-urk-example-root]');

  registerRestartHandler();

  for (const root of roots) {
    observeRoot(root);
  }

  if (!cleanupRegistered) {
    cleanupRegistered = true;
    window.addEventListener('pagehide', () => {
      void teardownAll();
    });
  }
}
