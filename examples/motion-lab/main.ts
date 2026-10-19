/**
 * Company: EonHive Inc. | Title: URK Motion Lab Controller
 * Purpose: Bind three DOM experiences to runtime-driven tweens and owned timelines.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import { createKernel, type Kernel, type RuntimeContext } from '@urk/core';
import {
  createMotionAdapter,
  createDomMotionBinding,
  fade,
  slide,
  scale,
  stagger,
  MotionCapability,
  type MotionAdapterApi,
  type ValueTweenHandle,
  type ScopedMotion,
  type TimelineEntry,
  type TimelineHandle,
  type DomMotionBinding,
  type MotionPlayback,
} from '@urk/adapters/motion';
import { createViewNavigation } from './navigation.js';

const views = ['explore', 'create', 'connect'] as const;
type View = (typeof views)[number];
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const button = (id: string) => get<HTMLButtonElement>(id);
const panels = views.map((view) => get(view));
const veil = get('veil');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const reducedInput = get<HTMLInputElement>('reduced');
const presetDefaults = { distancePx: 38, durationMs: 860, staggerMs: 160 };
const presetControls = [
  { key: 'distancePx', input: get<HTMLInputElement>('preset-distance'), unit: 'px' },
  { key: 'durationMs', input: get<HTMLInputElement>('preset-duration'), unit: 'ms' },
  { key: 'staggerMs', input: get<HTMLInputElement>('preset-stagger'), unit: 'ms' },
] as const;
let presetSettings = { ...presetDefaults };
let reducedOverride: boolean | undefined;
let kernel: Kernel;
let api: MotionAdapterApi | undefined;
let navigation: ReturnType<typeof createViewNavigation<View>> | undefined;
let content: TimelineHandle | undefined;
let instance = 0;
let busy = false;
let replay = () => {};
let scrub = (_progress: number) => {};
let navigate = (_view: View) => {};
let pulseNode = (_node: HTMLElement) => {};
let highlight = (_card: HTMLElement, _value: number) => {};
let composition = 0;
let motionGroup: ScopedMotion | undefined;
let contentPassMs = 0;
let contentYoyo = false;
let actionStatus = 'idle';
let runAction = async () => {};
let cancelAction = () => {};

function message(text: string): void {
  get('message').textContent = text;
}
function report(error: unknown): void {
  message(`Motion Lab: ${String(error)}`);
}
function preferenceLabel(): void {
  reducedInput.checked = reducedOverride ?? preference.matches;
  get('preference-label').textContent =
    reducedOverride === undefined
      ? `System preference: ${preference.matches ? 'reduced' : 'full'} motion`
      : 'Your override is active';
}

function updatePresetDraft(): void {
  for (const { input, unit } of presetControls) {
    get(`${input.id}-value`).textContent = `${input.value} ${unit}`;
  }
  const duration = presetControls[1].input.valueAsNumber;
  const gap = presetControls[2].input.valueAsNumber;
  get('preset-preview').textContent = `${(duration + gap * 2).toLocaleString('en-US')} ms / pass`;
}

function applyPresetSettings(reset = false): void {
  if (get<HTMLFieldSetElement>('preset-settings').disabled) return;
  const next = { ...presetDefaults };
  for (const { key, input } of presetControls) {
    if (reset) input.value = String(presetDefaults[key]);
    if (!input.reportValidity() || !Number.isFinite(input.valueAsNumber)) return;
    next[key] = input.valueAsNumber;
  }
  presetSettings = next;
  updatePresetDraft();
  replay();
  message(
    reset
      ? 'Default Explore presets restored and replayed.'
      : 'Explore presets applied. The sequence uses your new settings.',
  );
}

function sync(): void {
  if (!kernel) return;
  const state = kernel.getLifecycleSnapshot().state;
  const available = state === 'running' || state === 'paused';
  get<HTMLSelectElement>('speed').disabled = busy || !available;
  get<HTMLSelectElement>('repeat').disabled =
    busy || state !== 'running' || Boolean(navigation?.transitioning) || reducedInput.checked;
  const exploring = navigation?.currentView === 'explore';
  get<HTMLFieldSetElement>('preset-settings').disabled =
    busy || state !== 'running' || Boolean(navigation?.transitioning) || !exploring;
  get('preset-hint').textContent = !exploring
    ? 'Return to Explore to adjust its entrance. Create and Connect keep their own choreography.'
    : 'Draft changes apply with Apply & replay. Resume the runtime to edit; reduced motion skips movement.';
  const timeline = navigation?.activeTimeline ?? content;
  const progress = timeline?.progress ?? 0;
  get('lifecycle').textContent = state;
  get('phase').textContent = kernel.getState().phase;
  get('current-view').textContent = navigation?.currentView ?? 'explore';
  get('active-count').textContent = String(api?.activeCount ?? 0);
  get('playback').textContent =
    state === 'paused' ? 'paused' : (timeline?.status ?? (available ? 'idle' : 'stopped'));
  get('instance').textContent = String(instance).padStart(2, '0');
  get('progress-label').textContent = `${Math.round(progress * 100)}%`;
  get<HTMLProgressElement>('progress').value = progress;
  let passProgress = progress;
  if (!navigation?.activeTimeline && content && contentPassMs > 0) {
    const pass = Math.min(
      Math.ceil(content.durationMs / contentPassMs) - 1,
      Math.floor(content.currentTimeMs / contentPassMs),
    );
    passProgress = (content.currentTimeMs - pass * contentPassMs) / contentPassMs;
    if (contentYoyo && pass % 2 === 1) passProgress = 1 - passProgress;
  }
  get('playhead').style.left = `calc(60px + (100% - 60px) * ${passProgress})`;
  const scrubber = get<HTMLInputElement>('scrubber');
  const canScrub = !busy && available && !navigation?.transitioning && !reducedInput.checked;
  scrubber.disabled = !canScrub;
  scrubber.value = String(Math.round((content?.progress ?? 0) * 1000));
  const time = Math.round(content?.currentTimeMs ?? 0);
  const duration = Math.round(content?.durationMs ?? 0);
  scrubber.setAttribute('aria-valuetext', `${time} of ${duration} milliseconds`);
  get('scrub-time').textContent =
    `${time.toLocaleString('en-US')} / ${duration.toLocaleString('en-US')} ms`;
  button('timeline-toggle').disabled =
    !canScrub ||
    state !== 'running' ||
    !content ||
    ['completed', 'cancelled', 'failed'].includes(content.status);
  button('timeline-toggle').textContent =
    content?.status === 'paused' ? '▷ Resume sequence' : 'Ⅱ Pause sequence';
  button('pause').disabled = busy || state !== 'running';
  button('resume').disabled = busy || state !== 'paused';
  button('dispose').disabled = busy || !available;
  button('restart').disabled = busy || available;
  button('cancel').disabled = busy || !available || kernel.getState().phase !== 'transition';
  button('run-action').disabled = busy || state !== 'running';
  button('cancel-action').disabled = busy || !available || actionStatus !== 'running';
  get('action-status').textContent = actionStatus;
  for (const id of ['previous', 'next', 'replay', 'compose', 'send-signal'])
    button(id).disabled = busy || !available;
  for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    tab.disabled = busy || !available;
    tab.setAttribute('aria-pressed', String(tab.dataset.view === navigation?.requestedView));
  }
  for (const target of document.querySelectorAll<HTMLButtonElement>('.sample-card,.node'))
    target.disabled = busy || !available;
}

function show(view: View): void {
  // Move focus out of a view before making it inert; navigation controls stay usable.
  if (panels.some((panel) => panel.id !== view && panel.contains(document.activeElement))) {
    document.querySelector<HTMLButtonElement>(`[data-view="${view}"]`)?.focus();
  }
  for (const panel of panels) {
    panel.hidden = panel.id !== view;
    panel.inert = panel.id !== view;
    panel.style.opacity = '1';
    panel.style.transform = 'none';
  }
  veil.style.opacity = '0';
  veil.style.transform = 'translateX(-100%)';
  get('view-number').textContent = `${String(views.indexOf(view) + 1).padStart(2, '0')} — 03`;
}

function tweenEntry(
  atMs: number,
  durationMs: number,
  onUpdate: (value: number) => void,
): TimelineEntry {
  return { atMs, durationMs, from: 0, to: 1, easing: 'ease-out', onUpdate };
}

function contentEntries(
  view: View,
  bindingFor: (element: HTMLElement) => DomMotionBinding,
): TimelineEntry[] {
  if (view === 'explore') {
    get('timeline-caption').textContent = 'Stagger → overlap → settle';
    const { distancePx, durationMs, staggerMs } = presetSettings;
    const items = [...document.querySelectorAll<HTMLElement>('.explore-item')];
    const bindings = items.map(bindingFor);
    for (const [index, item] of items.entries()) {
      bindings[index]!.set({
        opacity: 0,
        x: 0,
        y: distancePx,
        scale: 1,
        rotate: distancePx === 0 ? 0 : (index - 1) * 9,
      });
      item.inert = true;
    }
    const fades = stagger(
      items.map((item, index) =>
        fade({
          durationMs,
          onUpdate(value) {
            item.inert = value === 0;
            bindings[index]!.set({ opacity: value });
          },
        }),
      ),
      staggerMs,
    );
    const slides = stagger(
      bindings.map((binding, index) =>
        slide({
          from: distancePx,
          durationMs,
          onUpdate(value) {
            // Zero distance is a fade-only entrance with no rotation to normalize.
            const remaining = distancePx === 0 ? 0 : value / distancePx;
            binding.set({ y: value, rotate: remaining * (index - 1) * 9 });
          },
        }),
      ),
      staggerMs,
    );
    return [...fades, ...slides];
  }
  if (view === 'create') {
    get('timeline-caption').textContent = 'Assemble → rotate → resolve';
    const positions =
      composition % 2 === 0
        ? [
            [-95, -35],
            [26, -68],
            [52, 49],
            [-65, 88],
          ]
        : [
            [-85, 30],
            [35, 20],
            [0, -83],
            [92, -48],
          ];
    const entries = [...document.querySelectorAll<HTMLElement>('.shape')].map((shape, index) => {
      const binding = bindingFor(shape);
      binding.set({ opacity: 0, x: 0, y: 0, scale: 0.4, rotate: 0 });
      const [x, y] = positions[index]!;
      return tweenEntry(index * 130, 740, (value) => {
        binding.set({
          opacity: value,
          x: x! * value,
          y: y! * value,
          scale: 0.4 + 0.6 * value,
          rotate: value * (index === 2 ? 135 : -12),
        });
      });
    });
    const ring = document.querySelector<HTMLElement>('.composition-ring')!;
    const ringBinding = bindingFor(ring);
    ringBinding.set({ opacity: 0, x: 0, y: 0, rotate: -25, scale: 0.8 });
    entries.push(
      tweenEntry(1130, 350, (value) => {
        ringBinding.set({ opacity: value, rotate: -25 + value * 40, scale: 0.8 + 0.2 * value });
      }),
    );
    return entries;
  }
  get('timeline-caption').textContent = 'Nodes → shared signal → connection';
  const entries = stagger(
    [...document.querySelectorAll<HTMLElement>('.node')].map((node) => {
      node.style.opacity = '0';
      node.inert = true;
      return scale({
        from: 0.5,
        durationMs: 500,
        onUpdate(value) {
          node.inert = value === 0.5;
          node.style.opacity = String((value - 0.5) * 2);
          node.style.transform = `scale(${value})`;
        },
      });
    }),
    110,
  );
  for (const [index, path] of [
    ...document.querySelectorAll<SVGPathElement>('.network path'),
  ].entries()) {
    const length = path.getTotalLength();
    path.style.strokeDasharray = String(length);
    path.style.strokeDashoffset = String(length);
    entries.push(
      tweenEntry(250 + index * 140, 720, (value) => {
        path.style.strokeDashoffset = String(length * (1 - value));
      }),
    );
  }
  return entries;
}

function displayTracks(view: View, entries: TimelineEntry[]): number {
  const names =
    view === 'explore'
      ? ['Signal', 'Form', 'Field']
      : view === 'create'
        ? ['Shape A', 'Shape B', 'Resolve']
        : ['Input', 'Kernel', 'Signal'];
  const selected =
    view === 'explore'
      ? entries.slice(0, 3)
      : [entries[0]!, entries[1]!, entries[entries.length - 1]!];
  const duration = Math.max(...entries.map((entry) => (entry.atMs ?? 0) + entry.durationMs));
  selected.forEach((entry, index) => {
    get(`track-label-${index}`).textContent = names[index]!;
    get(`track-${index}`).style.left = `${((entry.atMs ?? 0) / duration) * 100}%`;
    get(`track-${index}`).style.width = `${(entry.durationMs / duration) * 100}%`;
  });
  get('timeline-duration').textContent = `${duration.toLocaleString('en-US')} ms / pass`;
  return duration;
}

function configure(ctx: RuntimeContext): void {
  api = ctx.require(MotionCapability);
  api.setReducedMotion(reducedOverride);
  const motion: ScopedMotion = api.scoped(ctx.scope);
  motionGroup = motion;
  motion.setPlaybackRate(Number(get<HTMLSelectElement>('speed').value));
  const bindings = new Map<HTMLElement, DomMotionBinding>();
  ctx.scope.defer(() => bindings.clear());
  const bindingFor = (element: HTMLElement): DomMotionBinding => {
    let binding = bindings.get(element);
    if (!binding) {
      binding = createDomMotionBinding(element, ctx.scope);
      bindings.set(element, binding);
    }
    return binding;
  };
  const orb = bindingFor(get('action-orb'));
  const actionProgress = get<HTMLProgressElement>('action-progress');
  let actionAbort: AbortController | undefined;
  let actionGeneration = 0;
  actionStatus = 'idle';
  actionProgress.value = 0;
  cancelAction = () => {
    actionGeneration++;
    const active = actionAbort;
    actionAbort = undefined;
    if (!active) return;
    active.abort();
    actionStatus = 'cancelled';
    sync();
  };
  ctx.signal.addEventListener('abort', cancelAction, { once: true });
  const cancelOwnedAction = cancelAction;
  ctx.scope.defer(() => {
    ctx.signal.removeEventListener('abort', cancelOwnedAction);
    cancelOwnedAction();
  });
  runAction = async () => {
    if (ctx.signal.aborted) return;
    cancelOwnedAction();
    const ticket = ++actionGeneration;
    const abort = new AbortController();
    actionAbort = abort;
    const signal = abort.signal;
    const handles: MotionPlayback[] = [];
    try {
      actionStatus = 'running';
      orb.set({ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 });
      actionProgress.value = 0;
      handles.push(
        motion.tween({
          from: 0,
          to: Math.max(0, get('action-stage').clientWidth - 40),
          durationMs: 1000,
          easing: 'ease-in-out',
          signal,
          onUpdate: orb.property('x'),
        }),
      );
      handles.push(
        motion.timeline({
          signal,
          tweens: [
            scale({ from: 1, to: 1.5, durationMs: 400, onUpdate: orb.property('scale') }),
            scale({
              atMs: 400,
              from: 1.5,
              to: 1,
              durationMs: 600,
              onUpdate: orb.property('scale'),
            }),
          ],
        }),
      );
      handles.push(
        motion.tween({
          from: 0,
          to: 1,
          durationMs: 1000,
          signal,
          onUpdate(value) {
            actionProgress.value = value;
            sync();
          },
        }),
      );
      sync();
      const results = await Promise.all(handles.map((handle) => handle.finished));
      // Replacement and disposal own their status; old completion cannot commit.
      if (ticket !== actionGeneration || ctx.signal.aborted) return;
      actionStatus = results.some((result) => result.status === 'failed')
        ? 'failed'
        : results.some((result) => result.status === 'cancelled')
          ? 'cancelled'
          : 'completed';
    } catch (error) {
      abort.abort();
      await Promise.all(handles.map((handle) => handle.finished));
      if (ticket !== actionGeneration || ctx.signal.aborted) return;
      actionStatus = 'failed';
      report(error);
    } finally {
      if (ticket === actionGeneration) {
        actionAbort = undefined;
        sync();
      }
    }
  };
  const feedback = new Map<HTMLElement, TimelineHandle | ValueTweenHandle>();
  const levels = new WeakMap<HTMLElement, number>();
  const stopContent = () => {
    content?.cancel('view-changed');
    content = undefined;
    for (const handle of feedback.values()) handle.cancel('view-changed');
    feedback.clear();
  };
  const startContent = (paused = false) => {
    stopContent();
    const view = navigation?.currentView ?? 'explore';
    const entries = contentEntries(view, bindingFor);
    contentPassMs = displayTracks(view, entries);
    const mode = reducedInput.checked ? 'once' : get<HTMLSelectElement>('repeat').value;
    contentYoyo = mode === 'yoyo';
    content = motion.timeline({
      tweens: entries,
      iterations: mode === 'once' ? 1 : 2,
      yoyo: contentYoyo,
      onUpdate: sync,
    });
    if (paused) content.pause();
    const current = content;
    void current.finished.then((result) => {
      if (ctx.signal.aborted || current !== content) return;
      message(
        result.status === 'completed'
          ? 'Sequence complete. Replay it, or explore another view.'
          : `Sequence ${result.status}.`,
      );
      sync();
    });
    message('Watch the shared clock coordinate each track.');
    sync();
  };
  replay = () => {
    if (ctx.signal.aborted || navigation?.transitioning) return;
    startContent();
  };
  scrub = (progress) => {
    if (ctx.signal.aborted || navigation?.transitioning || reducedInput.checked) return;
    if (!content || ['completed', 'cancelled', 'failed'].includes(content.status))
      startContent(true);
    content!.pause();
    content!.seek(progress * content!.durationMs);
    message('Sequence paused at the selected time. Resume sequence to continue from here.');
    sync();
  };
  navigation = createViewNavigation(ctx, motion, 'explore' as View, {
    show,
    outgoing(current) {
      const panel = get(current);
      return {
        onUpdate: sync,
        tweens: [
          tweenEntry(0, 300, (value) => {
            panel.style.opacity = String(1 - value);
            panel.style.transform = `translateX(${-24 * value}px)`;
          }),
          tweenEntry(80, 360, (value) => {
            veil.style.opacity = String(value * 0.8);
            veil.style.transform = `translateX(${-100 + 100 * value}%)`;
          }),
        ],
      };
    },
    incoming(destination) {
      const panel = get(destination);
      panel.style.opacity = '0';
      veil.style.opacity = '.8';
      veil.style.transform = 'translateX(0)';
      return {
        onUpdate: sync,
        tweens: [
          tweenEntry(0, 420, (value) => {
            veil.style.opacity = String((1 - value) * 0.8);
            veil.style.transform = `translateX(${100 * value}%)`;
          }),
          tweenEntry(90, 480, (value) => {
            panel.style.opacity = String(value);
            panel.style.transform = `translateY(${20 * (1 - value)}px)`;
          }),
        ],
      };
    },
    activated() {
      replay();
    },
  });
  navigate = (view) => {
    if (ctx.signal.aborted) return;
    stopContent();
    // Normalize every child before an interrupted destination is shown again.
    for (const target of document.querySelectorAll<HTMLElement>(
      '.explore-item,.shape,.node,.composition-ring',
    )) {
      target.style.opacity = '1';
      target.inert = false;
    }
    void navigation!
      .navigate(view)
      .then(() => sync())
      .catch(report);
    message(`Moving to ${view}. A newer request takes priority.`);
    sync();
  };
  highlight = (card, value) => {
    if (ctx.signal.aborted || get('explore').hidden) return;
    const previous = feedback.get(card);
    if (previous && 'retarget' in previous && previous.retarget(value)) return;
    previous?.cancel('replaced');
    const handle = motion.tween({
      from: levels.get(card) ?? 0,
      to: value,
      durationMs: 220,
      easing: 'ease-out',
      onUpdate(level) {
        levels.set(card, level);
        card.style.transform = `translateY(${-8 * level}px) scale(${1 + 0.035 * level})`;
        sync();
      },
    });
    feedback.set(card, handle);
    void handle.finished.then(() => {
      if (feedback.get(card) === handle) feedback.delete(card);
      sync();
    });
  };
  pulseNode = (node) => {
    if (ctx.signal.aborted || get('connect').hidden) return;
    feedback.get(node)?.cancel('replaced');
    const handle = motion.timeline({
      onUpdate: sync,
      tweens: [
        tweenEntry(0, 220, (value) => {
          node.style.transform = `scale(${1 + value * 0.2})`;
        }),
        tweenEntry(220, 320, (value) => {
          node.style.transform = `scale(${1.2 - value * 0.2})`;
        }),
      ],
    });
    feedback.set(node, handle);
    void handle.finished.then(() => {
      if (feedback.get(node) === handle) feedback.delete(node);
      sync();
    });
  };
  show('explore');
  ctx.scope.defer(ctx.subscribeLifecycle(sync));
  ctx.scope.defer(stopContent);
}

async function startFresh(): Promise<void> {
  if (busy) return;
  busy = true;
  if (kernel) {
    sync();
    await kernel.shutdown('lab:restart');
  }
  api = undefined;
  content = undefined;
  navigation = undefined;
  instance++;
  kernel = createKernel({
    id: `motion-lab-${instance}`,
    frameMode: 'auto',
    adapters: [createMotionAdapter()],
    controllers: [
      { id: 'motion-lab', start: configure, onStateChange: sync },
    ],
  });
  try {
    await kernel.boot();
    await kernel.getContext().state.transition('ready', 'lab:boot');
    replay();
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
on('next', () => navigate(views[(views.indexOf(navigation!.requestedView) + 1) % views.length]!));
on('previous', () =>
  navigate(views[(views.indexOf(navigation!.requestedView) + views.length - 1) % views.length]!),
);
on('replay', () => {
  if (navigation?.transitioning) {
    void navigation.cancel().then(replay).catch(report);
  } else replay();
});
on('pause', () => {
  kernel.pause('lab:pause');
  sync();
  message('Runtime paused. Motion holds its exact position.');
});
on('resume', () => {
  kernel.resume('lab:resume');
  sync();
  message('Runtime resumed. Continuing from the retained position.');
});
on('cancel', async () => {
  await navigation?.cancel();
  message('Transition cancelled. Restored the last active view.');
  sync();
});
on('compose', () => {
  composition++;
  replay();
});
on('send-signal', () => replay());
on('timeline-toggle', () => {
  if (content?.status === 'paused') content.resume();
  else content?.pause();
  sync();
});
on('dispose', async () => {
  busy = true;
  sync();
  try {
    await kernel.shutdown('lab:dispose');
    message('Runtime disposed. All motion settled. Start with a fresh kernel.');
  } finally {
    busy = false;
    sync();
  }
});
on('restart', startFresh);
on('preset-apply', () => applyPresetSettings());
on('preset-reset', () => applyPresetSettings(true));
for (const { input } of presetControls) {
  input.addEventListener('input', updatePresetDraft, { signal: listeners.signal });
}
updatePresetDraft();
on('run-action', () => runAction());
on('cancel-action', () => {
  cancelAction();
  message('Shared action cancelled. Other motion keeps its current state.');
});
get<HTMLSelectElement>('repeat').addEventListener('change', () => replay(), {
  signal: listeners.signal,
});
get<HTMLSelectElement>('speed').addEventListener(
  'change',
  () => {
    try {
      motionGroup?.setPlaybackRate(Number(get<HTMLSelectElement>('speed').value));
      message(`Playback speed: ${motionGroup?.playbackRate}×. Selected positions stay unchanged.`);
    } catch (error) {
      report(error);
    }
  },
  { signal: listeners.signal },
);
get<HTMLInputElement>('scrubber').addEventListener(
  'input',
  (event) => {
    try {
      scrub(Number((event.currentTarget as HTMLInputElement).value) / 1000);
    } catch (error) {
      report(error);
    }
  },
  { signal: listeners.signal },
);
for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
  tab.addEventListener('click', () => navigate(tab.dataset.view as View), {
    signal: listeners.signal,
  });
}
for (const card of document.querySelectorAll<HTMLButtonElement>('.sample-card')) {
  const leave = () => highlight(card, card.getAttribute('aria-pressed') === 'true' ? 0.6 : 0);
  card.addEventListener('pointerenter', () => highlight(card, 1), {
    signal: listeners.signal,
  });
  card.addEventListener('pointerleave', leave, { signal: listeners.signal });
  card.addEventListener('focus', () => highlight(card, 1), {
    signal: listeners.signal,
  });
  card.addEventListener('blur', leave, { signal: listeners.signal });
  card.addEventListener(
    'click',
    () => {
      for (const other of document.querySelectorAll<HTMLElement>('.sample-card')) {
        other.setAttribute('aria-pressed', String(other === card));
        highlight(other, other === card ? 1 : 0);
      }
      get('selection-label').textContent =
        `${card.getAttribute('aria-label')!.replace('Select ', '')} SELECTED — KEEP EXPLORING`;
    },
    { signal: listeners.signal },
  );
}
for (const node of document.querySelectorAll<HTMLButtonElement>('.node')) {
  node.addEventListener('click', () => pulseNode(node), {
    signal: listeners.signal,
  });
}
reducedInput.addEventListener(
  'change',
  () => {
    reducedOverride = reducedInput.checked;
    api?.setReducedMotion(reducedOverride);
    preferenceLabel();
    if (reducedInput.checked && !navigation?.transitioning) replay();
    sync();
  },
  { signal: listeners.signal },
);
const preferenceChanged = () => {
  preferenceLabel();
  if (reducedInput.checked && !navigation?.transitioning) replay();
  sync();
};
preference.addEventListener('change', preferenceChanged);
preferenceLabel();
const stop = () => {
  void kernel?.shutdown('lab:unload').catch(report);
};
const restore = (event: PageTransitionEvent) => {
  if (event.persisted) void startFresh().catch(report);
};
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', restore);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    listeners.abort();
    preference.removeEventListener('change', preferenceChanged);
    window.removeEventListener('pagehide', stop);
    window.removeEventListener('pageshow', restore);
    stop();
  });
void startFresh().catch(report);
