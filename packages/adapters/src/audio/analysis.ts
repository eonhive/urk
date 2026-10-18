/**
 * Company: EonHive Inc. | Title: Optional Audio Analysis
 * Purpose: Read reusable waveform and spectrum data from the existing audio transport.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */

type FrequencyRange = readonly [number, number];
type Bands = { bass: FrequencyRange; mids: FrequencyRange; treble: FrequencyRange };

export interface AudioAnalysisOptions {
  fftSize?: number;
  smoothing?: number;
  /** Frequency intervals in Hz, lower inclusive and upper exclusive. */
  bands?: Partial<Bands>;
}

export interface AudioAnalysisSnapshot {
  level: number;
  bass: number;
  mids: number;
  treble: number;
  /** Reused mono samples, normally -1..1. Copy if retaining across reads. */
  waveform: Float32Array;
  /** Reused magnitudes, 0..255, in linearly spaced frequency bins. */
  spectrum: Uint8Array;
  sampleRate: number;
}

export interface AudioAnalysisApi {
  readonly enabled: boolean;
  /** Opt in and resume Web Audio from a user interaction. */
  enable(options?: AudioAnalysisOptions): Promise<void>;
  /** Bypass analysis, preserving playback and the source's context binding. */
  disable(): void;
  configure(options?: AudioAnalysisOptions): void;
  /** Returns a borrowed snapshot; this method does not schedule frames. */
  read(): AudioAnalysisSnapshot;
}

export function createAudioAnalysis(getActiveElement: () => HTMLAudioElement | undefined) {
  let enabled = false;
  let disposed = false;
  let context: AudioContext | undefined;
  let analyser: AnalyserNode | undefined;
  let active: HTMLAudioElement | undefined;
  let fftSize = 2048;
  let smoothing = 0.8;
  let bands: Bands = { bass: [20, 250], mids: [250, 2000], treble: [2000, 20000] };
  // Media elements can be bound only once. Keep their nodes until adapter disposal.
  const sources = new Map<HTMLAudioElement, MediaElementAudioSourceNode>();
  let waveform = new Float32Array(0);
  let spectrum = new Uint8Array(0);
  const snapshot: AudioAnalysisSnapshot = {
    level: 0, bass: 0, mids: 0, treble: 0, sampleRate: 0,
    waveform, spectrum,
  };
  let closing: Promise<void> | undefined;
  let revision = 0;

  const assertActive = () => {
    if (disposed) throw new Error('Audio analysis is disposed.');
  };
  const clear = () => {
    snapshot.level = snapshot.bass = snapshot.mids = snapshot.treble = 0;
    snapshot.waveform.fill(0);
    snapshot.spectrum.fill(0);
    return snapshot;
  };
  const detach = () => {
    const source = active && sources.get(active);
    if (source && context) {
      source.disconnect();
      source.connect(context.destination);
    }
    analyser?.disconnect();
    active = undefined;
    clear();
  };
  const configure = (options: AudioAnalysisOptions = {}) => {
    assertActive();
    const size = options.fftSize ?? fftSize;
    const nextSmoothing = options.smoothing ?? smoothing;
    if (!Number.isInteger(size) || size < 32 || size > 32768 || (size & (size - 1)) !== 0)
      throw new RangeError('Audio FFT size must be a power of two from 32 to 32768.');
    if (!Number.isFinite(nextSmoothing) || nextSmoothing < 0 || nextSmoothing > 1)
      throw new RangeError('Audio smoothing must be between zero and one.');
    const nextBands = { ...bands, ...options.bands };
    for (const range of Object.values(nextBands)) {
      if (!Array.isArray(range) || range.length !== 2 || !Number.isFinite(range[0]) ||
          !Number.isFinite(range[1]) || range[0] < 0 || range[1] <= range[0])
        throw new RangeError('Audio bands must contain finite increasing nonnegative frequencies.');
    }
    fftSize = size;
    smoothing = nextSmoothing;
    bands = { bass: [...nextBands.bass], mids: [...nextBands.mids], treble: [...nextBands.treble] };
    if (snapshot.waveform.length !== size) {
      snapshot.waveform = waveform = new Float32Array(size);
      snapshot.spectrum = spectrum = new Uint8Array(size / 2);
    }
    if (analyser) {
      analyser.fftSize = size;
      analyser.smoothingTimeConstant = smoothing;
    }
    clear();
  };
  const checkSource = (element: HTMLAudioElement) => {
    // Refuse known inaccessible URLs before irreversibly capturing the element.
    const url = new URL(element.currentSrc || element.src, document.baseURI);
    if (url.protocol !== 'data:' && url.origin !== location.origin && !element.crossOrigin)
      throw new Error('Audio analysis requires a same-origin source or a CORS-enabled track.');
  };
  const prepare = (element: HTMLAudioElement): Promise<void> | undefined => {
    assertActive();
    if (!context) return;
    if (enabled) {
      checkSource(element);
      if (active !== element) {
        detach();
        let source = sources.get(element);
        if (!source) {
          source = context.createMediaElementSource(element);
          sources.set(element, source);
        }
        source.disconnect();
        source.connect(analyser!);
        analyser!.connect(context.destination);
        active = element;
      }
    }
    // Even bypassed, a previously captured element needs its original context.
    if (context.state !== 'running') return context.resume();
    return undefined;
  };
  const energy = (range: FrequencyRange) => {
    const binHz = snapshot.sampleRate / fftSize;
    const start = Math.min(snapshot.spectrum.length, Math.ceil(range[0] / binHz));
    const end = Math.min(snapshot.spectrum.length, Math.ceil(range[1] / binHz));
    let total = 0;
    for (let i = start; i < end; i++) total += snapshot.spectrum[i];
    return end > start ? total / ((end - start) * 255) : 0;
  };
  const api: AudioAnalysisApi = {
    get enabled() { return enabled; },
    async enable(options) {
      configure(options);
      const current = revision;
      if (!context) {
        if (typeof AudioContext === 'undefined') throw new Error('Web Audio analysis is unavailable.');
        context = new AudioContext();
        snapshot.sampleRate = context.sampleRate;
      }
      if (!analyser) {
        analyser = context.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = smoothing;
      }
      enabled = true;
      try {
        const element = getActiveElement();
        await (element ? prepare(element) : context.resume());
        if (disposed || current !== revision) throw new DOMException('Audio analysis cancelled.', 'AbortError');
      } catch (error) {
        if (current === revision) api.disable();
        throw error;
      }
    },
    disable() {
      revision++;
      enabled = false;
      detach();
    },
    configure,
    read() {
      if (!enabled || !active || !analyser || context?.state !== 'running' ||
          active.paused || active.ended || active.muted || active.volume === 0) return clear();
      analyser.getFloatTimeDomainData(waveform);
      analyser.getByteFrequencyData(spectrum);
      let squares = 0;
      for (let i = 0; i < snapshot.waveform.length; i++) squares += snapshot.waveform[i] ** 2;
      snapshot.level = Math.min(1, Math.sqrt(squares / snapshot.waveform.length));
      snapshot.bass = energy(bands.bass);
      snapshot.mids = energy(bands.mids);
      snapshot.treble = energy(bands.treble);
      return snapshot;
    },
  };
  return {
    api, prepare, stop: detach,
    dispose(): Promise<void> {
      if (closing) return closing;
      disposed = true;
      api.disable();
      for (const source of sources.values()) source.disconnect();
      sources.clear();
      analyser = undefined;
      closing = context && context.state !== 'closed' ? context.close() : Promise.resolve();
      return closing;
    },
  };
}
