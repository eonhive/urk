/**
 * Company: EonHive Inc. | Title: Video Proof Controller
 * Purpose: Compose two independent video handles, user controls, and explicit experience cleanup.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

import { createKernel, type RuntimeContext } from '@urk/core';
import { createVideoAdapter, VideoCapability, type VideoHandle } from '@urk/adapters/video';
import { createPlayerView } from './view.js';
import { videoProofStyles } from './styles.js';
import { mountMediaInspector } from '../media/inspector.js';

function mountPlayer(ctx: RuntimeContext, host: HTMLElement, index: number) {
  const view = createPlayerView(index);
  host.append(view.root);
  ctx.scope.defer(() => view.root.remove());
  let videoUrl: string | undefined;
  let captionUrl: string | undefined;
  // The controller owns its DOM/media sources; the adapter borrows this element.
  ctx.scope.defer(() => {
    view.video.pause();
    view.video.removeAttribute('src');
    view.video.replaceChildren();
    view.video.load();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (captionUrl) URL.revokeObjectURL(captionUrl);
  });
  const videos = ctx.require(VideoCapability);
  const player = videos.register({
    id: `player-${index + 1}`,
    element: view.video,
    src: '/video/orbit.mp4',
    visibility: {
      target: view.root,
      loadWhenVisible: true,
      pauseWhenHidden: true,
      pauseWhenOffscreen: true,
    },
  });
  ctx.scope.defer(() => videos.unregister(player.id));
  ctx.scope.defer(player.subscribe(view.render));
  view.render(player.getSnapshot());
  const signal = ctx.signal;
  const report = (error: unknown) => {
    if (!signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) {
      view.message.textContent = error instanceof Error ? error.message : 'Video command failed.';
    }
  };
  const run = (action: () => void | Promise<void>) => {
    try {
      void Promise.resolve(action()).catch(report);
    } catch (error) {
      report(error);
    }
  };
  const listen = (target: EventTarget, event: string, action: () => void | Promise<void>) => {
    target.addEventListener(event, () => run(action), { signal });
  };
  listen(view.play, 'click', () => {
    return player.play();
  });
  listen(view.pause, 'click', () => player.pause());
  listen(view.stop, 'click', () => player.stop());
  listen(view.seek, 'input', () => player.seek(Number(view.seek.value)));
  listen(view.volume, 'input', () => player.setVolume(Number(view.volume.value)));
  listen(view.mute, 'click', () => player.setMuted(!player.getSnapshot().muted));
  listen(view.speed, 'change', () => player.setPlaybackRate(Number(view.speed.value)));
  listen(view.loop, 'change', () => player.setLoop(view.loop.checked));
  listen(view.captions, 'change', () =>
    player.setTextTrack(view.captions.value === '' ? null : Number(view.captions.value)),
  );

  const replaceCaptions = (src?: string) => {
    view.video.querySelectorAll('track').forEach((track) => {
      // Removing a showing track alone can leave its cues painted over the next track.
      track.track.mode = 'disabled';
      track.remove();
    });
    if (captionUrl) {
      URL.revokeObjectURL(captionUrl);
      captionUrl = undefined;
    }
    if (src) {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.label = 'English · Orbit';
      track.srclang = 'en';
      track.src = src;
      view.video.append(track);
    }
  };
  listen(view.file, 'change', () => {
    const file = view.file.files?.[0];
    if (!file) return;
    const next = URL.createObjectURL(file);
    try {
      player.setSource(next);
    } catch (error) {
      URL.revokeObjectURL(next);
      throw error;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = next;
    replaceCaptions();
    view.source.textContent = file.name;
    view.message.textContent = 'Local file ready to load. Nothing was uploaded.';
    view.file.value = '';
  });
  listen(view.trackFile, 'change', () => {
    const file = view.trackFile.files?.[0];
    if (!file) return;
    replaceCaptions();
    captionUrl = URL.createObjectURL(new Blob([file], { type: 'text/vtt' }));
    const track = document.createElement('track');
    track.kind = 'captions';
    track.label = file.name;
    track.src = captionUrl;
    track.addEventListener(
      'error',
      () => {
        view.message.textContent = 'Captions could not load. Choose a valid WebVTT file.';
      },
      { signal },
    );
    view.video.append(track);
    track.track.mode = 'showing';
    view.trackFile.value = '';
  });
  listen(view.sample, 'click', () => {
    player.setSource('/video/orbit.mp4');
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      videoUrl = undefined;
    }
    replaceCaptions('/video/orbit.vtt');
    view.source.textContent = 'Orbit · original silent sample · 8 seconds';
    view.message.textContent = 'Press Play to begin.';
  });
  return { player, controls: view.controls };
}

export function mountVideoProof(host: HTMLElement) {
  const root = document.createElement('section');
  root.className = 'urk-video-proof';
  const style = document.createElement('style');
  style.textContent = videoProofStyles;
  root.innerHTML = `
    <span class="video-kicker">URK MEDIA / VIDEO FOUNDATION</span>
    <h2>Two channels.<br />Your direction.</h2>
    <p>Independent players. Native captions. One small runtime.</p>
    <div class="video-toolbar" aria-label="Experience controls">
      <span class="video-runtime">Runtime <output data-lifecycle>created</output> · <output data-frames>Idle</output></span>
      <button data-runtime-pause>Pause experience</button><button data-runtime-resume>Resume experience</button>
      <button data-restart>Start fresh</button><button data-dispose>Dispose</button>
      <button data-inspect disabled>Show diagnostics</button>
    </div>
    <div class="video-decks"></div>
    <div data-inspector-host></div>
    <p class="video-notes">Orbit is an original, silent animation. Each player loads when visible or when you press Play, and pauses offscreen or in a hidden tab. Returning never starts playback automatically. Local files stay on your device.</p>
    <p data-result role="status"></p>`;
  host.append(style, root);
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const decks = find<HTMLElement>('.video-decks');
  const result = find<HTMLElement>('[data-result]');
  const pauseButton = find<HTMLButtonElement>('[data-runtime-pause]');
  const resumeButton = find<HTMLButtonElement>('[data-runtime-resume]');
  const restartButton = find<HTMLButtonElement>('[data-restart]');
  const disposeButton = find<HTMLButtonElement>('[data-dispose]');
  const inspectButton = find<HTMLButtonElement>('[data-inspect]');
  const listeners = new AbortController();
  let players: Array<{ player: VideoHandle; controls: HTMLFieldSetElement }> = [];
  let offLifecycle = () => {};
  let closed = false;
  let restarting = false;

  function makeKernel() {
    return createKernel({
      frameMode: 'auto',
      adapters: [createVideoAdapter()],
      controllers: [
        {
          id: 'video-proof',
          start(ctx) {
            players = [];
            for (let index = 0; index < 2; index++) players.push(mountPlayer(ctx, decks, index));
            mountMediaInspector(ctx, kernel, inspectButton, find<HTMLElement>('[data-inspector-host]'));
            ctx.state.setPhase('ready', 'video-proof:ready');
          },
        },
      ],
    });
  }
  let kernel = makeKernel();
  const observe = () => {
    const sync = () => {
      const state = kernel.getLifecycleSnapshot().state;
      find<HTMLOutputElement>('[data-lifecycle]').textContent = state;
      pauseButton.disabled = state !== 'running';
      resumeButton.disabled = state !== 'paused';
      disposeButton.disabled = state === 'disposed' || state === 'disposing';
      for (const { controls } of players) controls.disabled = state !== 'running';
      if (state === 'disposed') {
        players = [];
        result.textContent = 'Players released. Start fresh to create a new runtime.';
      }
    };
    offLifecycle = kernel.subscribeLifecycle(sync);
    sync();
  };
  const showError = (error: unknown) => {
    if (!closed) result.textContent = error instanceof Error ? error.message : 'Video proof failed.';
  };
  const pauseMedia = () => {
    for (const { player } of players) player.pause();
  };
  observe();
  const ready = kernel.boot().catch(showError);
  const listen = (target: EventTarget, event: string, action: () => void) =>
    target.addEventListener(event, action, { signal: listeners.signal });
  listen(pauseButton, 'click', () => {
    pauseMedia();
    kernel.pause('video-proof:pause');
  });
  listen(resumeButton, 'click', () => kernel.resume('video-proof:resume'));
  listen(disposeButton, 'click', () => {
    void kernel.shutdown('video-proof:dispose').catch(showError);
  });
  listen(restartButton, 'click', () => {
    if (restarting || closed) return;
    restarting = true;
    restartButton.disabled = true;
    void kernel
      .shutdown('video-proof:restart')
      .then(async () => {
        offLifecycle();
        if (closed) return;
        decks.replaceChildren();
        result.textContent = '';
        kernel = makeKernel();
        observe();
        await kernel.boot();
      })
      .catch(showError)
      .finally(() => {
        restarting = false;
        restartButton.disabled = false;
      });
  });
  let teardown: Promise<void> | undefined;
  return {
    get kernel() {
      return kernel;
    },
    ready,
    teardown() {
      if (!teardown) {
        closed = true;
        listeners.abort();
        offLifecycle();
        teardown = kernel.shutdown('video-proof:unmount').finally(() => {
          root.remove();
          style.remove();
        });
      }
      return teardown;
    },
  };
}
