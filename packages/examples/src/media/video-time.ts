/**
 * Company: EonHive Inc. | Title: Video Time Source
 * Purpose: Observe native video time, with opt-in frame callbacks and no idle loop.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

import type { VideoHandle } from '@urk/adapters/video';
import type { TimeSource } from './time-source.js';

export function createVideoTimeSource(player: VideoHandle, options: { frames?: boolean } = {}): TimeSource {
  return {
    getTime: () => player.element.currentTime,
    subscribe(listener) {
      const video = player.element;
      const nativeFrames = typeof video.requestVideoFrameCallback === 'function';
      let pending: number | undefined;
      let active = true;
      let seeking = video.seeking;
      let seekTarget: number | undefined;
      const cancel = () => {
        if (pending === undefined) return;
        if (nativeFrames) video.cancelVideoFrameCallback(pending);
        else cancelAnimationFrame(pending);
        pending = undefined;
      };
      const schedule = () => {
        if (
          !options.frames ||
          !active ||
          pending !== undefined ||
          video.paused ||
          video.ended ||
          video.seeking ||
          seeking ||
          player.getSnapshot().status !== 'playing'
        )
          return;
        const deliver = (time: number) => {
          pending = undefined;
          if (
            !active ||
            video.paused ||
            video.seeking ||
            seeking ||
            player.getSnapshot().status === 'disposed'
          )
            return;
          listener({ time, kind: 'tick' });
          schedule();
        };
        pending = nativeFrames
          ? video.requestVideoFrameCallback((_now, frame) => deliver(frame.mediaTime))
          : requestAnimationFrame(() => deliver(video.currentTime));
      };
      const off = player.subscribe((snapshot, event) => {
        if (snapshot.status === 'disposed') {
          active = false;
          cancel();
          return;
        }
        if (
          snapshot.paused ||
          snapshot.seeking ||
          snapshot.status === 'error' ||
          snapshot.status === 'buffering'
        )
          cancel();
        if (event === 'seek' || event === 'seeking' || event === 'seeked') {
          if (event === 'seek' || seekTarget === undefined) seekTarget = snapshot.currentTime;
          seeking = event !== 'seeked';
          cancel();
          // Playback may already have advanced when seeked arrives. Keep the
          // requested boundary so replay does not skip a cue at exactly zero.
          listener({ time: seekTarget, kind: 'seek' });
          if (!seeking) seekTarget = undefined;
        } else if (event === 'source' || event === 'emptied') {
          seeking = false;
          seekTarget = undefined;
          cancel();
          listener({ time: 0, kind: 'reset' });
        } else if (event === 'ended') listener({ time: snapshot.currentTime, kind: 'ended' });
        else if (
          event === 'timeupdate' &&
          !options.frames &&
          !snapshot.paused &&
          !snapshot.seeking &&
          !seeking
        )
          listener({ time: snapshot.currentTime, kind: 'tick' });
        if (snapshot.status === 'playing' && !snapshot.seeking) schedule();
      });
      schedule();
      return () => {
        active = false;
        off();
        cancel();
      };
    },
  };
}
