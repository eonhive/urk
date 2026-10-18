/**
 * Company: EonHive Inc. | Title: uRK Web Player
 * Purpose: Host trusted exported experiences in independent, separately originated iframes.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */

export type PlayerState = 'idle' | 'loading' | 'loaded' | 'error';
export type PlayerStateDetail = { state: PlayerState; src: string; message: string };

const LOAD_TIMEOUT_MS = 15_000;
const template = `
  <style>
    :host { display:flex; flex-direction:column; width:100%; height:var(--urk-player-height, 70vh); min-height:260px;
      box-sizing:border-box; overflow:hidden; border:1px solid #cbd5e1; border-radius:12px;
      background:#f8fafc; color:#0f172a; font:14px/1.45 system-ui,sans-serif; }
    :host([hidden]) { display:none; }
    :host(:fullscreen) { width:100%; height:100%; border:0; border-radius:0; }
    * { box-sizing:border-box; }
    .toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:10px; border-bottom:1px solid #cbd5e1; }
    button { font:inherit; border:1px solid #94a3b8; border-radius:6px; padding:6px 12px; background:white; color:inherit; cursor:pointer; }
    button:focus-visible { outline:3px solid #2563eb; outline-offset:2px; }
    button:disabled { opacity:.5; cursor:default; }
    button[hidden], [hidden] { display:none; }
    .stage { position:relative; flex:1; min-height:0; }
    iframe { display:block; width:100%; height:100%; border:0; background:white; }
    .placeholder { display:grid; place-content:center; height:100%; padding:24px; text-align:center; color:#475569; }
    .placeholder[hidden] { display:none; }
    .status { margin:0; padding:8px 12px; overflow-wrap:anywhere; border-top:1px solid #cbd5e1; }
    :host([data-state="error"]) .status { color:#991b1b; }
  </style>
  <div class="toolbar" part="controls" role="group" aria-label="Experience controls">
    <button type="button" data-action="play">Play</button>
    <button type="button" data-action="reload">Reload</button>
    <button type="button" data-action="unload">Unload</button>
    <button type="button" data-action="fullscreen" hidden>Fullscreen</button>
  </div>
  <div class="stage" part="stage"><div class="placeholder" aria-hidden="true">uRK experience</div></div>
  <p class="status" part="status" role="status" aria-live="polite">Set an experience URL to begin.</p>
`;

/** Browser-only optional host. The embedded application continues to own its kernel and adapters. */
export class UrkPlayer extends HTMLElement {
  static observedAttributes = ['src', 'title', 'fullscreen', 'check-src'];
  private readonly root: ShadowRoot;
  private readonly stage: HTMLElement;
  private readonly statusElement: HTMLElement;
  private readonly placeholder: HTMLElement;
  private frame?: HTMLIFrameElement;
  private request?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  private currentState: PlayerState = 'idle';
  private connected = false;
  private readonly fullscreenChanged = () => this.updateControls();

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.root.innerHTML = template;
    this.stage = this.root.querySelector('.stage')!;
    this.statusElement = this.root.querySelector('.status')!;
    this.placeholder = this.root.querySelector('.placeholder')!;
    this.button('play').addEventListener('click', () => this.play());
    this.button('reload').addEventListener('click', () => this.reload());
    this.button('unload').addEventListener('click', () => this.unload());
    this.button('fullscreen').addEventListener('click', () => { void this.toggleFullscreen(); });
  }

  get src(): string { return this.getAttribute('src') ?? ''; }
  set src(value: string) { this.setAttribute('src', value); }
  get state(): PlayerState { return this.currentState; }

  connectedCallback(): void {
    this.connected = true;
    this.ownerDocument.addEventListener('fullscreenchange', this.fullscreenChanged);
    this.updateControls();
    if (this.src) this.reload();
    else this.setState('idle', 'Set an experience URL to begin.');
  }

  disconnectedCallback(): void {
    this.connected = false;
    this.ownerDocument.removeEventListener('fullscreenchange', this.fullscreenChanged);
    this.releaseFrame();
    this.setState('idle', 'Experience unloaded.');
  }

  attributeChangedCallback(name: string, previous: string | null, value: string | null): void {
    // Upgrade delivers initial attributes before connectedCallback, even for elements already in the DOM.
    if (previous === value || !this.connected) return;
    if (name === 'src' || name === 'check-src') {
      if (this.src) this.reload();
      else this.unload();
    } else {
      if (this.frame) this.configureFrame(this.frame);
      this.updateControls();
    }
  }

  /** Load after unload, or focus an already loaded experience. This does not bypass media activation rules. */
  play(): void {
    if (this.frame && this.currentState === 'loaded') this.frame.focus();
    else if (this.currentState !== 'loading') this.reload();
  }

  /** Discard the previous document and navigate a new iframe to src. */
  reload(): void {
    this.releaseFrame();
    if (!this.isConnected) return;
    if (!this.src) { this.setState('idle', 'Set an experience URL to begin.'); return; }
    let url: URL;
    try { url = this.experienceUrl(this.src); }
    catch (error) { this.fail(error); return; }
    const request = new AbortController();
    this.request = request;
    this.setState('loading', 'Loading experience…');
    // A state listener may synchronously remove, unload, or change this Player.
    if (this.request !== request || request.signal.aborted || !this.isConnected) return;
    this.timer = setTimeout(() => {
      if (this.request === request) this.fail(new Error('Loading timed out. Check the experience URL and framing policy, then retry.'));
    }, LOAD_TIMEOUT_MS);
    void this.loadFrame(url, request);
  }

  /** Remove the browsing context; the browser stops its rendering, input, timers, and media. */
  unload(): void {
    this.releaseFrame();
    this.setState('idle', 'Experience unloaded. Press Play to load it again.');
  }

  private experienceUrl(source: string): URL {
    const host = this.ownerDocument.location;
    if (!host || !['http:', 'https:'].includes(host.protocol)) throw new Error('Serve the Player page through HTTP or HTTPS.');
    const url = new URL(source, this.baseURI);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP or HTTPS experience URL without embedded credentials.');
    if (url.origin === host.origin) throw new Error('Use a separate experience origin, such as a different localhost port. Same-origin experiences are not supported in this MVP.');
    if (host.protocol === 'https:' && url.protocol !== 'https:') throw new Error('An HTTPS Player requires an HTTPS experience URL.');
    if (url.pathname.toLowerCase().endsWith('.urkpkg')) throw new Error('Unpack the .urkpkg and host its index.html; the Player does not mount archives.');
    return url;
  }

  private async loadFrame(url: URL, request: AbortController): Promise<void> {
    try {
      if (this.hasAttribute('check-src')) {
        // HTTP status is observable only when the experience host permits CORS. No HTML/code is imported into the parent.
        const response = await fetch(url, { method: 'HEAD', credentials: 'omit', signal: request.signal });
        // Finish the bodyless check before retaining the signal for iframe cleanup.
        await response.arrayBuffer();
        if (!response.ok) throw new Error(`Experience host returned HTTP ${response.status}. Check the URL and retry.`);
        this.experienceUrl(response.url);
        if (!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type') ?? '')) {
          throw new Error('The experience URL must serve an HTML document.');
        }
      }
      if (request.signal.aborted || this.request !== request || !this.isConnected) return;
      const frame = this.ownerDocument.createElement('iframe');
      this.frame = frame;
      this.configureFrame(frame);
      frame.addEventListener('load', () => {
        if (this.frame !== frame || request.signal.aborted) return;
        this.clearTimer();
        // A cross-origin load event confirms navigation, not successful application startup.
        this.setState('loaded', 'Loaded. Click inside to interact; audio may require a click inside the experience.');
      }, { signal: request.signal });
      frame.src = url.href;
      this.placeholder.hidden = true;
      this.stage.append(frame);
      this.updateControls();
    } catch (error) {
      if (!request.signal.aborted && this.request === request) {
        const message = error instanceof TypeError
          ? new Error('Could not check the experience URL. Check network access and enable CORS for check-src, or omit check-src.')
          : error;
        this.fail(message);
      }
    }
  }

  private configureFrame(frame: HTMLIFrameElement): void {
    frame.title = this.getAttribute('title') || 'uRK experience';
    // allow-same-origin preserves the EXPERIENCE origin. experienceUrl rejects the hosting page's origin.
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-forms');
    const fullscreen = this.hasAttribute('fullscreen');
    frame.allow = `autoplay 'src'; fullscreen ${fullscreen ? "'src'" : "'none'"}; camera 'none'; microphone 'none'; geolocation 'none'`;
    frame.allowFullscreen = fullscreen;
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('part', 'frame');
  }

  private releaseFrame(): void {
    this.request?.abort();
    this.request = undefined;
    this.clearTimer();
    this.frame?.remove();
    this.frame = undefined;
    this.placeholder.hidden = false;
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private fail(error: unknown): void {
    this.releaseFrame();
    this.setState('error', error instanceof Error ? error.message : 'Unable to load this experience.');
  }

  private setState(state: PlayerState, message: string): void {
    this.currentState = state;
    this.dataset.state = state;
    this.stage.setAttribute('aria-busy', String(state === 'loading'));
    this.statusElement.textContent = message;
    this.updateControls();
    this.dispatchEvent(new CustomEvent<PlayerStateDetail>('urk-player-statechange', {
      bubbles: true, composed: true, detail: { state, src: this.src, message },
    }));
  }

  private button(action: string): HTMLButtonElement {
    return this.root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  }

  private updateControls(): void {
    this.button('play').disabled = !this.src || this.currentState === 'loading';
    this.button('reload').disabled = !this.src;
    this.button('unload').disabled = !this.request && !this.frame;
    const fullscreen = this.button('fullscreen');
    fullscreen.hidden = !this.hasAttribute('fullscreen') || !this.ownerDocument.fullscreenEnabled;
    fullscreen.textContent = this.ownerDocument.fullscreenElement === this ? 'Exit fullscreen' : 'Fullscreen';
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (this.ownerDocument.fullscreenElement === this) await this.ownerDocument.exitFullscreen();
      else await this.requestFullscreen();
    } catch {
      if (this.isConnected) this.statusElement.textContent = 'Fullscreen is unavailable here. You can continue in the embedded view.';
    }
  }
}

if (!customElements.get('urk-player')) customElements.define('urk-player', UrkPlayer);

declare global {
  interface HTMLElementTagNameMap { 'urk-player': UrkPlayer; }
}
