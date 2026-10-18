/**
 * Company: EonHive Inc.
 * Title: URK v0.2 Framework Host
 * Purpose: Mount the shared experience through thin React and Next providers.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Kernel } from '@urk/core';
import { UrkProvider } from '@urk/react';
import { attachV02Controls, createV02Experience, type DemoPreferences } from '@urk/examples/v02';

export function V02Host({ renderProvider }: {
  renderProvider?: (kernel: Kernel, children: ReactNode) => ReactNode;
}) {
  const controls = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const preferences = useRef<DemoPreferences>({ selected: null });
  const makeKernel = (failSetup = false) => createV02Experience(() => surface.current, {
    failSetup, preferences: preferences.current,
  });
  const [kernel, setKernel] = useState(() => makeKernel());
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    if (!controls.current) return;
    const detach = attachV02Controls(controls.current, kernel, {
      restart(failSetup) { setKernel(makeKernel(failSetup)); setMounted(true); },
      unmount() { setMounted(false); },
    });
    return () => { void detach(); };
  }, [kernel]);
  const content = <div ref={surface} />;
  return <main className="urk-v02">
    <div ref={controls} />
    {mounted && (renderProvider
      ? renderProvider(kernel, content)
      : <UrkProvider key={kernel.getContext().id} kernel={kernel} ownership="provider">{content}</UrkProvider>)}
  </main>;
}
