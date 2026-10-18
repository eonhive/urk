/**
 * Company: EonHive Inc. | Title: Interactive Media View
 * Purpose: Present an accessible cinematic player, chapters, and two application-owned branches.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */

export function createMediaView() {
  const root = document.createElement('div');
  root.className = 'media-layout';
  root.innerHTML = `
    <div class="media-main">
      <div class="media-screen" role="group" aria-label="Orbit interactive film">
        <div data-film tabindex="-1" aria-label="Film scene">
        <video playsinline preload="metadata" poster="/video/orbit.svg" aria-label="Orbit film">
          <track kind="captions" label="English" srclang="en" src="/video/orbit.vtt" />
        </video>
        <div class="media-overlay"><span data-scene-label>01 / ARRIVAL</span><h3 data-title>A small world.<br />A new direction.</h3><p data-description>Press Play. Make it yours.</p></div>
        <button class="media-hotspot" data-hotspot hidden aria-label="Explore the signal">+ Explore the signal</button>
        </div>
        <section class="media-ending" data-ending hidden tabindex="-1" aria-label="Journey complete">
          <div class="media-orbit-mark" aria-hidden="true"><span></span></div>
          <span class="media-kicker">YOUR NEXT BEGINNING</span>
          <h3 data-ending-title>Every ending is an invitation.</h3>
          <p data-ending-description>Replay the film and choose another direction.</p>
          <fieldset disabled><legend class="media-sr-only">Continue your journey</legend>
            <button class="media-primary" data-enter-gallery>Enter 3D gallery</button><button data-watch-again>Watch again ↗</button><button data-return>Return to film</button>
          </fieldset>
        </section>
        <section class="media-gallery" data-gallery hidden tabindex="-1" aria-label="Orbit 3D gallery">
          <div class="media-gallery-heading"><span class="media-kicker">ORBIT / BEYOND THE FRAME</span><h3 data-gallery-title>Your next dimension.</h3></div>
          <div data-gallery-surface tabindex="0" role="group" aria-label="3D objects: press 1 for Explore, 2 for Create"></div>
          <div class="media-gallery-caption" data-gallery-caption hidden></div>
          <div class="media-gallery-footer"><p data-gallery-status role="status">Ready to enter the gallery.</p>
            <fieldset disabled><legend class="media-sr-only">Gallery controls</legend>
              <button data-gallery-branch="explore" aria-pressed="false">1 · Explore</button><button data-gallery-branch="create" aria-pressed="false">2 · Create</button>
              <button data-gallery-replay>Replay screen</button><button data-gallery-return>Return to film</button>
            </fieldset>
          </div>
        </section>
      </div>
      <div class="media-recovery" data-recovery hidden>
        <div><strong>Let’s get your film back.</strong><p data-recovery-message role="status"></p></div>
        <button class="media-primary" data-retry>Retry video</button>
      </div>
      <fieldset class="media-controls" disabled><legend class="media-sr-only">Playback controls</legend>
        <div class="media-transport"><button data-play class="media-primary">Play</button><button data-pause>Pause</button><button data-replay>Replay</button><output data-time aria-live="off">0.0 / 8.0</output></div>
        <label class="media-seek">Playback position<input data-seek type="range" min="0" max="8" step="0.1" value="0" /></label>
        <div class="media-options"><label><input data-captions type="checkbox" /> English captions</label><span data-status role="status">Loading metadata</span></div>
      </fieldset>
      <fieldset class="media-sound" disabled><legend>AN OPTIONAL SOUNDSCAPE</legend>
        <div class="media-transport"><button data-sound-toggle aria-pressed="false">Enable sound</button><button data-narrate disabled>Hear the guide</button></div>
        <div class="media-levels"><label>Music volume<input data-music-volume type="range" min="0" max="1" step="0.05" value="0.35" /></label><label>Narration volume<input data-narration-volume type="range" min="0" max="1" step="0.05" value="0.8" /></label></div>
        <p data-sound-status role="status">Sound is off.</p>
        <small>Guide transcript: “Follow the signal. Choose what comes next.”</small>
        <div class="media-reaction"><button data-react aria-pressed="false" disabled>React to sound</button><meter data-react-level min="0" max="1" value="0" aria-label="Sound reaction level"></meter></div>
        <p data-react-status role="status">Enter the 3D gallery to use sound reaction.</p>
      </fieldset>
      <div class="media-footnote"><span>ORBIT / An original silent film</span><span data-storage>Loading preferences</span></div>
    </div>
    <aside class="media-journey" aria-label="Story controls">
      <div data-inspector-host></div>
      <span class="media-kicker">YOUR JOURNEY</span><h3>Follow your curiosity.</h3>
      <p>A short film with a choice at its center. Every chapter is yours to revisit.</p>
      <fieldset data-story-controls disabled><legend class="media-sr-only">Chapters and direction</legend>
        <nav class="media-chapters" aria-label="Chapters">
          <button data-chapter="0" aria-current="step"><span>01</span><strong>Arrival<small>Find your bearings · 0:00</small></strong></button>
          <button data-chapter="2"><span>02</span><strong>The signal<small>Choose a direction · 0:02</small></strong></button>
          <button data-chapter="5"><span>03</span><strong>Beyond<small>See where it leads · 0:05</small></strong></button>
        </nav>
        <div class="media-choices" role="group" aria-label="Choose your direction">
          <span class="media-kicker">TWO WAYS FORWARD</span>
          <button data-branch="explore" aria-pressed="false"><strong>Explore ↗</strong><small>Follow the unknown.</small></button>
          <button data-branch="create" aria-pressed="false"><strong>Create ✧</strong><small>Shape what comes next.</small></button>
        </div>
      </fieldset>
      <p data-outcome role="status">Your next chapter starts with a choice.</p>
      <div class="media-cue"><span>LAST CUE</span><output data-cue>Waiting for playback</output></div>
    </aside>`;
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  return {
    root,
    inspector: find<HTMLElement>('[data-inspector-host]'),
    recovery: find<HTMLElement>('[data-recovery]'),
    recoveryMessage: find<HTMLElement>('[data-recovery-message]'),
    retry: find<HTMLButtonElement>('[data-retry]'),
    gallery: find<HTMLElement>('[data-gallery]'),
    gallerySurface: find<HTMLElement>('[data-gallery-surface]'),
    galleryStatus: find<HTMLElement>('[data-gallery-status]'),
    galleryTitle: find<HTMLElement>('[data-gallery-title]'),
    galleryCaption: find<HTMLElement>('[data-gallery-caption]'),
    enterGallery: find<HTMLButtonElement>('[data-enter-gallery]'),
    galleryReturn: find<HTMLButtonElement>('[data-gallery-return]'),
    galleryReplay: find<HTMLButtonElement>('[data-gallery-replay]'),
    galleryBranches: [...root.querySelectorAll<HTMLButtonElement>('[data-gallery-branch]')],
    screen: find<HTMLElement>('.media-screen'),
    film: find<HTMLElement>('[data-film]'),
    ending: find<HTMLElement>('[data-ending]'),
    endingTitle: find<HTMLElement>('[data-ending-title]'),
    endingDescription: find<HTMLElement>('[data-ending-description]'),
    watchAgain: find<HTMLButtonElement>('[data-watch-again]'),
    returnToFilm: find<HTMLButtonElement>('[data-return]'),
    overlay: find<HTMLElement>('.media-overlay'),
    video: find<HTMLVideoElement>('video'),
    play: find<HTMLButtonElement>('[data-play]'),
    pause: find<HTMLButtonElement>('[data-pause]'),
    replay: find<HTMLButtonElement>('[data-replay]'),
    seek: find<HTMLInputElement>('[data-seek]'),
    soundToggle: find<HTMLButtonElement>('[data-sound-toggle]'),
    narrate: find<HTMLButtonElement>('[data-narrate]'),
    musicVolume: find<HTMLInputElement>('[data-music-volume]'),
    narrationVolume: find<HTMLInputElement>('[data-narration-volume]'),
    soundStatus: find<HTMLElement>('[data-sound-status]'),
    reaction: find<HTMLButtonElement>('[data-react]'),
    reactionLevel: find<HTMLMeterElement>('[data-react-level]'),
    reactionStatus: find<HTMLElement>('[data-react-status]'),
    captions: find<HTMLInputElement>('[data-captions]'),
    controls: [...root.querySelectorAll<HTMLFieldSetElement>('fieldset')],
    chapters: [...root.querySelectorAll<HTMLButtonElement>('[data-chapter]')],
    branches: [...root.querySelectorAll<HTMLButtonElement>('[data-branch]')],
    hotspot: find<HTMLButtonElement>('[data-hotspot]'),
    title: find<HTMLElement>('[data-title]'),
    description: find<HTMLElement>('[data-description]'),
    sceneLabel: find<HTMLElement>('[data-scene-label]'),
    time: find<HTMLOutputElement>('[data-time]'),
    status: find<HTMLElement>('[data-status]'),
    storage: find<HTMLElement>('[data-storage]'),
    outcome: find<HTMLElement>('[data-outcome]'),
    cue: find<HTMLOutputElement>('[data-cue]'),
  };
}
