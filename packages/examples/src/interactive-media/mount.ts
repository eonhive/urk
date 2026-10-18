/**
 * Company: EonHive Inc. | Title: Interactive Media Controller
 * Purpose: Compose video, cues, chapters, branching overlays, and saved playback with URK scopes.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */

import { createKernel, type RuntimeContext } from '@urk/core';
import { createAudioMixerAdapter } from '@urk/adapters/audio/mixer';
import { createMotionAdapter } from '@urk/adapters/motion';
import { createGallery } from './gallery-controller.js';
import { createStoryStage } from './stage.js';
import { createStorySound } from './sound.js';
import { createVideoAdapter, VideoCapability } from '@urk/adapters/video';
import { createStorageAdapter, StorageCapability } from '@urk/adapters/storage';
import { createCues, createVideoTimeSource, createTransitions } from '../media/index.js';
import { reloadFilm } from './reload.js';
import { mountMediaInspector } from '../media/inspector.js';
import { borrowMediaStorage, readBookmark, type Branch } from './bookmarks.js';
import { createMediaView } from './view.js';
import type { ExampleMountOptions } from '../types.js';
import { mediaStyles } from './styles.js';

export function mountInteractiveMedia(host: HTMLElement, options: ExampleMountOptions & { mode?: 'interactive' | 'showcase' } = {}) {
  const showcase = options.mode === 'showcase';
  const root = document.createElement('section');
  root.className = 'urk-interactive-media';
  root.innerHTML = `<span class="media-kicker">URK MEDIA / AN INTERACTIVE SHORT</span>
    <h2>${showcase ? "Beyond the frame." : "Where will you go?"}</h2><p>${showcase ? "A film becomes a world. Step into your next dimension." : "One film. Two directions. Your story to shape."}</p>
    <div class="media-toolbar" aria-label="Experience controls"><span class="media-runtime">Runtime <output data-lifecycle>created</output> / event-driven</span>
      <button data-suspend>Pause experience</button><button data-resume>Resume experience</button><button data-fresh>Start fresh</button><button data-dispose>Dispose</button><button data-inspect disabled>Show diagnostics</button></div>
    <div data-stage></div><p data-result role="status"></p>`;
  const style = document.createElement('style');
  style.textContent = mediaStyles;
  host.append(style, root);
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const stage = find<HTMLElement>('[data-stage]');
  const result = find<HTMLElement>('[data-result]');
  const suspend = find<HTMLButtonElement>('[data-suspend]');
  const resume = find<HTMLButtonElement>('[data-resume]');
  const fresh = find<HTMLButtonElement>('[data-fresh]');
  const dispose = find<HTMLButtonElement>('[data-dispose]');
  const listeners = new AbortController();
  let closed = false;
  let restarting = false;
  let offLifecycle = () => {};
  let sessionOnly = false;
  let showStorage = () => {};

  const report = (error: unknown) => {
    if (closed || (error instanceof DOMException && error.name === 'AbortError')) return;
    result.textContent =
      error instanceof Error ? error.message : 'The experience could not complete this action.';
  };

  function startStory(ctx: RuntimeContext) {
    const view = createMediaView();
    stage.append(view.root);
    ctx.scope.defer(() => {
      showStorage = () => {};
      view.root.remove();
    });
    ctx.scope.defer(() => {
      view.video.pause();
      view.video.removeAttribute('src');
      view.video.replaceChildren();
      view.video.load();
    });
    const videos = ctx.require(VideoCapability);
    const player = videos.register({
      id: 'orbit',
      element: view.video,
      src: '/video/orbit.mp4',
      visibility: {
        // The native video is hidden while its texture plays in the gallery.
        target: view.root,
        loadWhenVisible: true,
        pauseWhenHidden: true,
        pauseWhenOffscreen: true,
      },
    });
    ctx.scope.defer(() => videos.unregister(player.id));
    const storyStage = createStoryStage(ctx, view, report);
    const storage = ctx.require(StorageCapability);
    let bookmark = readBookmark(null);
    try {
      bookmark = readBookmark(storage.getItem('bookmark'));
    } catch {
      /* Malformed preferences are ignored. */
    }
    let branch: Branch = bookmark.branch;
    let position = bookmark.position;
    let recovery: 'failed' | 'retrying' | undefined;
    let recoveryMessage = '';
    let recoveryError = '';
    let refreshDiagnostics = () => {};
    let retryTask: Promise<void> | undefined;
    const retries = createTransitions(ctx.signal);
    ctx.scope.defer(() => retries.dispose());
    let preserveSound = false;
    let saveSound = () => {};
    const sound = createStorySound(
      ctx,
      view,
      bookmark,
      () => branch,
      () => saveSound(),
    );
    const gallery = createGallery(ctx, view, player, value => { void choose(value).catch(report); });
    let inGallery = false;
    const enterGallery = async () => {
      if (ctx.signal.aborted || recovery || kernel.getLifecycleSnapshot().state !== 'running') return;
      inGallery = true;
      sound.stop();
      player.pause();
      storyStage.gallery();
      await gallery.open();
      if (!ctx.signal.aborted && inGallery) gallery.resize();
    };
    const leaveGallery = () => {
      cancelRetry();
      inGallery = false;
      sound.stop();
      player.pause();
      storyStage.film();
      void gallery.close().catch(report);
    };
    const transportScene = () => { if (!inGallery) storyStage.film(); };
    const syncCaptions = () => {
      const track = view.video.textTracks[0];
      const cues = track?.activeCues;
      view.galleryCaption.textContent = view.captions.checked && cues
        ? Array.from(cues).map(cue => (cue as VTTCue).text).join('\n') : '';
      view.galleryCaption.hidden = !view.galleryCaption.textContent;
    };
    const captionTrack = view.video.querySelector('track')!.track;
    captionTrack.addEventListener('cuechange', syncCaptions);
    ctx.scope.defer(() => captionTrack.removeEventListener('cuechange', syncCaptions));
    ctx.scope.defer(ctx.events.on('media:stage', event => {
      if ((event.payload as { state: string }).state === 'gallery') gallery.resize();
    }));
    let restored = false;
    let chapter = -1;
    let savedSecond = -1;
    showStorage = () => {
      view.storage.textContent = sessionOnly ? 'Session only' : 'Progress saved on this device';
    };
    showStorage();
    view.captions.checked = bookmark.captions;

    const emit = (type: string, payload: unknown) =>
      ctx.events.emit({
        type,
        payload,
        source: 'interactive-media',
        timestamp: Date.now(),
      });
    const recordCue = (name: string) => {
      view.cue.textContent = name;
      emit('media:cue', { name, time: player.element.currentTime });
    };
    const source = createVideoTimeSource(player);
    const cues = createCues({
      source,
      signal: ctx.signal,
      onError: report,
      cues: [
        {
          id: 'arrival',
          group: 'film',
          when: { at: 0 },
          run: () => recordCue('00:00 / Arrival'),
        },
        {
          id: 'signal',
          group: 'film',
          when: { at: 2 },
          run: ({ signal }) => {
            recordCue('00:02 / The signal');
            return sound.narrate(signal);
          },
        },
        {
          id: 'beyond',
          group: 'film',
          when: { at: 5 },
          run: () => recordCue('00:05 / Beyond'),
        },
        {
          id: 'first-choice',
          once: true,
          when: { event: 'choice' },
          run: () => recordCue('Interaction / A direction chosen'),
        },
        {
          id: 'chapter',
          when: { event: 'chapter' },
          run: () => emit('media:chapter-ready', { chapter }),
        },
        {
          id: 'complete',
          when: { event: 'ended' },
          run: () => {
            recordCue('Media ended / Journey complete');
            view.outcome.textContent =
              branch === 'create'
                ? 'You chose to create. Every ending is a beginning.'
                : branch === 'explore'
                  ? 'You chose to explore. There is always more beyond.'
                  : 'A journey complete. Replay and choose a direction.';
            emit('media:complete', { branch });
          },
        },
      ],
    });
    ctx.scope.defer(() => cues.dispose());
    ctx.scope.defer(
      ctx.events.on('media:chapter', (event) => cues.trigger('chapter', event.payload)),
    );
    ctx.scope.defer(
      ctx.events.on('media:choice', (event) => cues.trigger('choice', event.payload)),
    );

    ctx.scope.defer(ctx.events.on('media:complete', () => {
      if (inGallery) view.galleryStatus.textContent = 'Journey complete. Replay the screen or choose another direction.';
      else if (showcase) void enterGallery().catch(report);
      else storyStage.ending(branch);
    }));

    const persist = (force = false) => {
      if (!restored) return;
      const second = Math.floor(position / 2);
      if (!force && second === savedSecond) return;
      savedSecond = second;
      storage.setItem('bookmark', {
        version: 1,
        position,
        branch,
        captions: view.captions.checked,
        musicVolume: Number(view.musicVolume.value),
        narrationVolume: Number(view.narrationVolume.value),
      });
      showStorage();
    };
    saveSound = () => persist(true);
    ctx.signal.addEventListener('abort', () => persist(true), { once: true });
    const render = () => {
      const snapshot = player.getSnapshot();
      const time = recovery || !restored ? position : snapshot.currentTime;
      const next = time >= 5 ? 2 : time >= 2 ? 1 : 0;
      const titles = [
        'A small world.\nA new direction.',
        'There is something\nout there.',
        branch === 'create'
          ? 'Make room for\nsomething new.'
          : branch === 'explore'
            ? 'Go beyond\nthe familiar.'
            : 'The next move\nis yours.',
      ];
      const descriptions = [
        'Press Play. Make it yours.',
        'Follow the signal, or make your own.',
        branch === 'create'
          ? 'Your imagination sets the course.'
          : 'A new perspective changes everything.',
      ];
      view.title.textContent = titles[next];
      view.description.textContent = descriptions[next];
      view.sceneLabel.textContent = ['01 / ARRIVAL', '02 / THE SIGNAL', '03 / BEYOND'][next];
      storyStage.reveal(`${next}:${branch ?? 'none'}`);
      gallery.sync(branch, time);
      view.galleryTitle.textContent = ['A new perspective.', 'Follow the signal.', branch === 'create' ? 'Make the next beginning.' : 'Go beyond the familiar.'][next];
      for (const button of view.galleryBranches)
        button.setAttribute('aria-pressed', String(button.dataset.galleryBranch === branch));
      syncCaptions();
      view.hotspot.hidden = next !== 1;
      view.root.style.setProperty('--media-accent', branch === 'create' ? '#b596ff' : '#55e3eb');
      view.time.textContent = `${time.toFixed(1)} / ${(snapshot.duration ?? 8).toFixed(1)}`;
      view.seek.value = String(time);
      const duration = snapshot.duration;
      if (duration && Number.isFinite(duration)) view.seek.max = String(duration);
      view.status.textContent =
        snapshot.error?.message ??
        (snapshot.status === 'idle' ? 'Ready when you are' : snapshot.status);
      const running = kernel.getLifecycleSnapshot().state === 'running';
      const hasMetadata = snapshot.readyState > 0 && !recovery;
      for (const controls of view.controls)
        controls.disabled = !running || Boolean(recovery) || (!hasMetadata && !controls.contains(view.play));
      // Leaving a failed gallery remains available while playback controls wait for recovery.
      if (inGallery) {
        view.galleryReturn.closest('fieldset')!.disabled = !running;
        for (const button of [...view.galleryBranches, view.galleryReplay]) button.disabled = !hasMetadata;
      }
      const retryFocused = document.activeElement === view.retry;
      view.recovery.hidden = !recovery;
      view.recovery.setAttribute('aria-busy', String(recovery === 'retrying'));
      if (view.recoveryMessage.textContent !== recoveryMessage) view.recoveryMessage.textContent = recoveryMessage;
      view.retry.textContent = recovery === 'retrying' ? 'Cancel retry' : 'Retry video';
      view.retry.disabled = !running;
      // Play can load deferred media in the original user gesture. Seeking needs metadata.
      view.seek.disabled = !hasMetadata;
      view.replay.disabled = !hasMetadata;
      view.captions.disabled = !hasMetadata;
      view.hotspot.disabled = !running || !hasMetadata;
      view.play.disabled = !snapshot.paused;
      view.pause.disabled = snapshot.paused && snapshot.status !== 'loading' && snapshot.status !== 'buffering';
      if (!recovery && retryFocused) view.play.focus({ preventScroll: true });
      for (const button of view.chapters) {
        const current = Number(button.dataset.chapter) === [0, 2, 5][next];
        if (current) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      }
      for (const button of view.branches)
        button.setAttribute('aria-pressed', String(button.dataset.branch === branch));
      const complete = duration !== null && time >= duration && !snapshot.seeking;
      view.outcome.textContent = complete
        ? branch === 'create'
          ? 'You chose to create. Every ending is a beginning.'
          : branch === 'explore'
            ? 'You chose to explore. There is always more beyond.'
            : 'A journey complete. Replay and choose a direction.'
        : branch === 'create'
          ? 'Create selected. Shape what comes next.'
          : branch === 'explore'
            ? 'Explore selected. Follow the unknown.'
            : 'Your next chapter starts with a choice.';
      if (chapter !== next) {
        chapter = next;
        emit('media:chapter', { chapter, time });
      }
    };
    const restore = () => {
      if (restored || recovery || view.video.readyState === 0) return;
      restored = true;
      if (bookmark.position <= view.video.duration && bookmark.position > 0) {
        player.seek(bookmark.position);
        result.textContent = 'Progress restored. Press Play when you’re ready.';
      }
      const track = view.video.querySelector('track');
      if (track) track.track.mode = bookmark.captions ? 'showing' : 'disabled';
    };
    ctx.scope.defer(
      player.subscribe((snapshot, event) => {
        const mediaFailure = event === 'error' || event === 'source-error' ||
          (event === 'playback-error' && snapshot.error?.name !== 'NotAllowedError' && snapshot.error?.name !== 'AbortError');
        if (mediaFailure && recovery !== 'failed') failFilm();
        if (!recovery && snapshot.readyState > 0 && !snapshot.error &&
          ['timeupdate', 'seek', 'seeked', 'pause', 'ended'].includes(event)) position = snapshot.currentTime;
        if (
          (event === 'seek' && !preserveSound) ||
          event === 'ended' ||
          (event === 'pause' && snapshot.paused)
        )
          sound.stop();
        restore();
        render();
        if (event === 'pause') cues.cancel();
        if (event === 'pause' || event === 'seeked' || event === 'ended') persist(true);
        else if (event === 'timeupdate') persist();
      }),
    );
    const syncLifecycle = () => {
      const active = kernel.getLifecycleSnapshot().state === 'running';
      storyStage.suspend(!active || document.hidden);
      gallery.suspend(!active || document.hidden || Boolean(recovery));
      cues.suspend(!active || document.hidden || Boolean(recovery));
      if (!active) {
        cancelRetry();
        sound.stop();
        player.pause();
      }
      render();
    };
    ctx.scope.defer(kernel.subscribeLifecycle(syncLifecycle));
    function failFilm(message = 'Video could not load. Your chapter and preferences are saved.') {
      const failure = player.getSnapshot().error;
      if (failure) recoveryError = `${failure.name}: ${failure.message}`;
      retryTask = undefined;
      retries.cancel();
      recovery = 'failed';
      recoveryMessage = message;
      sound.stop();
      cues.suspend(true);
      gallery.suspend(true);
      void gallery.close().catch(report);
      player.pause();
      persist(true);
      render();
      refreshDiagnostics();
    }
    function cancelRetry() {
      if (recovery !== 'retrying') return;
      failFilm('Retry cancelled. Your progress is safe; try again when you’re ready.');
    }
    function retryFilm() {
      if (recovery !== 'failed' || ctx.signal.aborted || kernel.getLifecycleSnapshot().state !== 'running') return;
      recovery = 'retrying';
      recoveryMessage = 'Reloading your film… It will return paused at your saved position.';
      render();
      refreshDiagnostics();
      const task = retries.run(async signal => {
        // A texture must be recreated after source replacement. Close graphics first.
        await gallery.close();
        signal.throwIfAborted();
        await reloadFilm(player, '/video/orbit.mp4', position, signal);
        signal.throwIfAborted();
        player.setTextTrack(view.captions.checked ? 0 : null);
        if (inGallery) await gallery.open();
        signal.throwIfAborted();
      });
      retryTask = task;
      void task.then(() => {
        if (retryTask !== task || ctx.signal.aborted) return;
        retryTask = undefined;
        recovery = undefined;
        recoveryError = '';
        restored = true;
        position = player.getSnapshot().currentTime;
        result.textContent = 'Film restored. Press Play when you’re ready.';
        syncLifecycle();
        persist(true);
        refreshDiagnostics();
      }, () => {
        if (retryTask !== task || ctx.signal.aborted) return;
        retryTask = undefined;
        failFilm('The film is still unavailable. Your progress is safe; you can retry again.');
      }).catch(report);
    }
    const listen = (target: EventTarget, event: string, action: () => void | Promise<void>) => {
      target.addEventListener(
        event,
        () => {
          if (ctx.signal.aborted) return;
          try {
            void Promise.resolve(action()).catch(report);
          } catch (error) {
            report(error);
          }
        },
        { signal: ctx.signal },
      );
    };
    listen(view.enterGallery, 'click', enterGallery);
    listen(view.retry, 'click', () => recovery === 'retrying' ? cancelRetry() : retryFilm());
    listen(view.galleryReturn, 'click', leaveGallery);
    listen(view.play, 'click', () => {
      result.textContent = '';
      transportScene();
      return player.play();
    });
    listen(view.pause, 'click', () => {
      sound.stop();
      player.pause();
    });
    const replay = () => {
      transportScene();
      cues.reset();
      player.seek(0);
      return player.play();
    };
    listen(view.replay, 'click', replay);
    listen(view.watchAgain, 'click', replay);
    listen(view.galleryReplay, 'click', replay);
    listen(view.returnToFilm, 'click', () => {
      transportScene();
      player.pause();
      player.seek(0);
    });
    listen(view.seek, 'input', () => {
      transportScene();
      player.seek(Number(view.seek.value));
    });
    listen(view.captions, 'change', () => {
      player.setTextTrack(view.captions.checked ? 0 : null);
      syncCaptions();
      persist(true);
    });
    for (const button of view.chapters)
      listen(button, 'click', () => {
        transportScene();
        player.pause();
        player.seek(Number(button.dataset.chapter));
      });
    async function choose(value: Branch) {
      if (recovery) return;
      transportScene();
      branch = value;
      view.outcome.textContent =
        value === 'create'
          ? 'Create selected. Shape what comes next.'
          : 'Explore selected. Follow the unknown.';
      emit('media:choice', { branch });
      preserveSound = true;
      try {
        player.seek(5);
      } finally {
        preserveSound = false;
      }
      void sound.choose(branch);
      persist(true);
      return player.play();
    };
    for (const button of view.branches)
      listen(button, 'click', () => choose(button.dataset.branch as Branch));
    for (const button of view.galleryBranches)
      listen(button, 'click', () => choose(button.dataset.galleryBranch as Branch));
    view.gallerySurface.addEventListener('keydown', event => {
      if (ctx.signal.aborted || kernel.getLifecycleSnapshot().state !== 'running' || document.hidden) return;
      if (event.key !== '1' && event.key !== '2') return;
      event.preventDefault();
      void choose(event.key === '1' ? 'explore' : 'create').catch(report);
    }, { signal: ctx.signal });
    listen(view.hotspot, 'click', () => choose('explore'));
    listen(document, 'visibilitychange', () => {
      if (document.hidden) cancelRetry();
      storyStage.suspend(document.hidden || kernel.getLifecycleSnapshot().state !== 'running');
      gallery.suspend(document.hidden || kernel.getLifecycleSnapshot().state !== 'running');
      if (document.hidden) {
        sound.stop();
        cues.cancel();
      }
      syncLifecycle();
    });
    const diagnostics = mountMediaInspector(ctx, kernel, find<HTMLButtonElement>('[data-inspect]'), view.inspector, () => ({
      scene: view.screen.dataset.scene ?? 'film',
      branch: branch ?? 'Not selected',
      cue: view.cue.textContent ?? 'Waiting for playback',
      recovery: recovery ? `${recovery} · ${recoveryMessage}` : 'None',
      error: recoveryError || 'None',
    }));
    refreshDiagnostics = diagnostics.refresh;
    restore();
    render();
  }

  function makeKernel() {
    const storage = createStorageAdapter({ namespace: 'urk:media' });
    storage.dependsOn = ['media:storage'];
    return createKernel({
      frameMode: 'auto',
      adapters: [
        {
          id: 'media-storage',
          capability: 'media:storage',
          setup(ctx) {
            sessionOnly = false;
            const backend = borrowMediaStorage(() => {
              sessionOnly = true;
              showStorage();
            });
            ctx.services.register('storage:local', backend);
            ctx.services.register('storage:session', backend);
            return backend;
          },
        },
        storage,
        createVideoAdapter(),
        createMotionAdapter(),
        createAudioMixerAdapter({
          channels: [
            { id: 'explore', group: 'music' },
            { id: 'create', group: 'music' },
            { id: 'guide', group: 'narration' },
          ],
        }),
      ],
      controllers: [{ id: 'interactive-media', start: startStory }],
    });
  }
  let kernel = makeKernel();
  const observe = () => {
    const render = () => {
      const state = kernel.getLifecycleSnapshot().state;
      find<HTMLOutputElement>('[data-lifecycle]').textContent = state;
      suspend.disabled = state !== 'running';
      resume.disabled = state !== 'paused';
      dispose.disabled = state === 'disposed' || state === 'disposing';
      if (state === 'disposed')
        result.textContent = 'Experience released. Start fresh to restore your journey.';
    };
    offLifecycle = kernel.subscribeLifecycle(render);
    render();
  };
  observe();
  const ready = kernel.boot().catch(report);
  suspend.addEventListener('click', () => kernel.pause('media:pause'), {
    signal: listeners.signal,
  });
  resume.addEventListener('click', () => kernel.resume('media:resume'), {
    signal: listeners.signal,
  });
  dispose.addEventListener(
    'click',
    () => {
      void kernel.shutdown('media:dispose').catch(report);
    },
    { signal: listeners.signal },
  );
  fresh.addEventListener(
    'click',
    () => {
      if (closed || restarting) return;
      restarting = true;
      fresh.disabled = true;
      void kernel
        .shutdown('media:fresh')
        .then(async () => {
          offLifecycle();
          if (closed) return;
          result.textContent = '';
          kernel = makeKernel();
          observe();
          await kernel.boot();
        })
        .catch(report)
        .finally(() => {
          restarting = false;
          fresh.disabled = false;
        });
    },
    { signal: listeners.signal },
  );
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
        teardown = kernel.shutdown('media:unmount').finally(() => {
          root.remove();
          style.remove();
        });
      }
      return teardown;
    },
  };
}
