/**
 * Company: EonHive Inc. | Title: Motion Widget Host
 * Purpose: Demonstrate two independent widget lifetimes on one existing runtime clock.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import { createKernel, type Kernel, type RuntimeContext } from '@urk/core';
import {
  createMotionAdapter,
  MotionCapability,
  type MotionAdapterApi,
} from '@urk/adapters/motion';
import { mountMotionWidget, mountWidgetPreferences, type MotionWidget } from './widget.js';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const button = (id: string) => get<HTMLButtonElement>(id);
const reduced = get<HTMLInputElement>('reduced');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const slots = [get('widget-a'), get('widget-b')];
const slotBusy = [false, false];
let widgets: (MotionWidget | undefined)[] = [];
let preferences: ReturnType<typeof mountWidgetPreferences>[] = [];
let kernel: Kernel;
let ctx: RuntimeContext;
let api: MotionAdapterApi | undefined;
let busy = false;
let instance = 0;
let reducedOverride: boolean | undefined;

function report(error: unknown): void {
  get('host-message').textContent = String(error);
}
function sync(): void {
  if (!kernel) return;
  const state = kernel.getLifecycleSnapshot().state;
  const available = state === 'running' || state === 'paused';
  get('runtime-state').textContent = state;
  get('active-count').textContent = String(api?.activeCount ?? 0);
  get('instance').textContent = String(instance).padStart(2, '0');
  button('pause-runtime').disabled = busy || state !== 'running';
  button('resume-runtime').disabled = busy || state !== 'paused';
  button('dispose-runtime').disabled = busy || !available;
  button('restart-runtime').disabled = busy || available;
  button('replay-widgets').disabled =
    busy || state !== 'running' || slotBusy.some(Boolean) || !widgets.some(Boolean);
  slots.forEach((host, index) => {
    const toggle = button(`toggle-${index}`);
    toggle.disabled =
      busy || slotBusy[index]! || !available || (!widgets[index] && state !== 'running');
    toggle.textContent = widgets[index] ? 'Unmount widget' : 'Mount fresh widget';
    host.querySelector<HTMLElement>('.empty-slot')!.hidden = Boolean(widgets[index]);
  });
}

async function mount(index: number): Promise<void> {
  const settings = preferences[index]!;
  widgets[index] = await mountMotionWidget(slots[index]!, ctx, {
    ...settings.restore(),
    title: index === 0 ? 'Signal' : 'Studio',
    tone: index === 0 ? 'cyan' : 'violet',
    onSettingsChange: settings.changed,
    onChange: sync,
  });
  settings.changed(widgets[index]!.getSnapshot());
  void widgets[index]!.replay().catch(report);
}

async function startFresh(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    if (kernel) {
      sync();
      await kernel.shutdown('widget:restart');
    }
    widgets = [];
    api = undefined;
    instance++;
    kernel = createKernel({
      frameMode: 'auto',
      adapters: [createMotionAdapter()],
      controllers: [
        {
          id: 'widget-host',
          async start(context) {
            ctx = context;
            api = ctx.require(MotionCapability);
            api.setReducedMotion(reducedOverride);
            ctx.scope.defer(ctx.subscribeLifecycle(sync));
            preferences = slots.map((host, index) =>
              mountWidgetPreferences(
                host,
                ctx.scope,
                `urk:motion-widget:standalone:${index === 0 ? 'signal' : 'studio'}`,
              ),
            );
            for (let index = 0; index < slots.length; index++) await mount(index);
          },
        },
      ],
    });
    await kernel.boot();
    await ctx.state.transition('ready', 'widget:ready');
    for (const widget of widgets) void widget?.replay().catch(report);
    get('host-message').textContent = 'Two widgets, one runtime. Try pausing just one.';
  } finally {
    busy = false;
    sync();
  }
}

const listeners = new AbortController();
const on = (id: string, action: () => void | Promise<void>) =>
  button(id).addEventListener(
    'click',
    () => {
      void Promise.resolve().then(action).catch(report);
    },
    { signal: listeners.signal },
  );
on('pause-runtime', () => {
  kernel.pause('widget:pause');
  sync();
});
on('resume-runtime', () => {
  kernel.resume('widget:resume');
  sync();
});
on('dispose-runtime', async () => {
  busy = true;
  sync();
  try {
    await kernel.shutdown('widget:dispose');
    widgets = [];
  } finally {
    busy = false;
    sync();
  }
  get('host-message').textContent = 'Runtime disposed. Both widget scopes have been released.';
});
on('restart-runtime', startFresh);
on('replay-widgets', () => {
  for (const widget of widgets) void widget?.replay().catch(report);
  get('host-message').textContent =
    'Sequences replayed. Offscreen widgets wait until you scroll back.';
});
slots.forEach((_host, index) =>
  on(`toggle-${index}`, async () => {
    if (busy || slotBusy[index]) return;
    slotBusy[index] = true;
    sync();
    try {
      if (widgets[index]) {
        await widgets[index]!.teardown();
        widgets[index] = undefined;
      } else await mount(index);
    } finally {
      slotBusy[index] = false;
      sync();
    }
  }),
);
function syncPreference(): void {
  reduced.checked = reducedOverride ?? preference.matches;
  get('motion-preference').textContent =
    reducedOverride === undefined ? 'Following your system preference' : 'Your override is active';
}
reduced.addEventListener(
  'change',
  () => {
    reducedOverride = reduced.checked;
    api?.setReducedMotion(reducedOverride);
    syncPreference();
  },
  { signal: listeners.signal },
);
preference.addEventListener('change', syncPreference);
syncPreference();
const stop = () => {
  void kernel?.shutdown('widget:unload').catch(report);
};
const restore = (event: PageTransitionEvent) => {
  if (event.persisted) void startFresh().catch(report);
};
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', restore);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    listeners.abort();
    preference.removeEventListener('change', syncPreference);
    window.removeEventListener('pagehide', stop);
    window.removeEventListener('pageshow', restore);
    stop();
  });
void startFresh().catch(report);
