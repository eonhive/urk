/**
 * Company: EonHive Inc. | Title: Video Visibility Policies
 * Purpose: Observe optional loading and pause conditions without polling or automatic resume.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */

import type { VideoVisibilityOptions } from './types.js';

export function observeVideoVisibility(
  element: HTMLVideoElement,
  { target = element, pauseWhenHidden, pauseWhenOffscreen, loadWhenVisible }: VideoVisibilityOptions,
  changed: (blocked: boolean, visible: boolean) => void,
) {
  const document = element.ownerDocument;
  const Observer = document.defaultView?.IntersectionObserver;
  let intersecting: boolean | undefined;
  let observer: IntersectionObserver | undefined;
  let disposed = false;
  const blocked = () => Boolean(
    (pauseWhenHidden && document.hidden) || (pauseWhenOffscreen && intersecting === false),
  );
  const refresh = () => {
    if (disposed) return;
    // Without IntersectionObserver, loading falls back to document visibility.
    changed(blocked(), !document.hidden && (intersecting ?? !observer));
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    document.removeEventListener('visibilitychange', refresh);
  };
  try {
    if (Observer && (pauseWhenOffscreen || loadWhenVisible)) {
      observer = new Observer((entries) => {
        if (disposed) return;
        let entry: IntersectionObserverEntry | undefined;
        for (const candidate of entries) if (candidate.target === target) entry = candidate;
        if (!entry) return;
        intersecting = entry.isIntersecting && entry.intersectionRatio > 0;
        refresh();
      });
      observer.observe(target);
    }
    if (pauseWhenHidden || loadWhenVisible) document.addEventListener('visibilitychange', refresh);
  } catch (error) {
    dispose();
    throw error;
  }
  return { blocked, refresh, dispose };
}
