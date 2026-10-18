/**
 * Company: EonHive Inc. | Title: Video Contracts
 * Purpose: Describe independent native video players and observable media state.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

export type VideoStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'error'
  | 'disposed';

export interface VideoTextTrack {
  readonly index: number;
  readonly label: string;
  readonly language: string;
  readonly kind: TextTrackKind;
  readonly mode: TextTrackMode;
}

export interface VideoSnapshot {
  readonly id: string;
  readonly revision: number;
  readonly status: VideoStatus;
  readonly currentTime: number;
  /** null until known; Infinity for an unbounded live source. */
  readonly duration: number | null;
  readonly paused: boolean;
  readonly seeking: boolean;
  readonly readyState: number;
  readonly volume: number;
  readonly muted: boolean;
  readonly playbackRate: number;
  readonly loop: boolean;
  readonly textTracks: readonly VideoTextTrack[];
  readonly error: Readonly<{ name: string; message: string; code?: number }> | null;
}

export interface VideoRegistration {
  id: string;
  /** Supplied elements are borrowed unless ownership is explicitly transferred. */
  element?: HTMLVideoElement;
  ownership?: 'borrowed' | 'owned';
  src?: string;
  poster?: string;
  preload?: 'none' | 'metadata' | 'auto';
  muted?: boolean;
  loop?: boolean;
  /** Optional native visibility policies. None are enabled by default. */
  visibility?: VideoVisibilityOptions;
}

export interface VideoVisibilityOptions {
  /** Observe the experience container when the video is hidden for a texture or custom UI. */
  target?: Element;
  pauseWhenHidden?: boolean;
  pauseWhenOffscreen?: boolean;
  /** Defer the registration's src until visible or play(). Explicit setSource remains immediate. */
  loadWhenVisible?: boolean;
}

export interface VideoHandle {
  readonly id: string;
  readonly element: HTMLVideoElement;
  /** Concurrent requests share completion; pause/stop/source changes cancel it. */
  play(): Promise<void>;
  resume(): Promise<void>;
  pause(): void;
  stop(): void;
  setSource(src: string): void;
  /** Requests a native seek. Completion is observable through seeking/seeked events. */
  seek(seconds: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  setLoop(loop: boolean): void;
  /** Select a caption/subtitle track, or null to turn captions off. */
  setTextTrack(index: number | null): void;
  getSnapshot(): VideoSnapshot;
  subscribe(listener: (snapshot: VideoSnapshot, event: string) => void): () => void;
}

export interface VideoAdapterApi {
  register(options: VideoRegistration): VideoHandle;
  unregister(id: string): void;
  get(id: string): VideoHandle | undefined;
  getSnapshots(): readonly VideoSnapshot[];
}
