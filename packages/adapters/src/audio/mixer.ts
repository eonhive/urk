/**
 * Company: EonHive Inc. | Title: Optional Audio Mixer
 * Purpose: Compose existing audio transports with independent groups and cancellable finite fades.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */

import { ResourceScope, token, type AdapterRegistration } from '@urk/core';
import { createAudioAdapter, type AudioAdapterApi } from './index.js';

export type AudioGroup = 'music' | 'narration' | 'effects' | 'ambience';
export interface AudioChannelDefinition {
  id: string;
  group: AudioGroup;
}
export interface AudioMixerOptions {
  id?: string;
  channels: readonly AudioChannelDefinition[];
}
export interface AudioMixerApi {
  channel(id: string): AudioAdapterApi;
  setMuted(muted: boolean): void;
  setGroupVolume(group: AudioGroup, volume: number): void;
  /** Fade a channel's own level. Group volume and ducking still apply. */
  fadeChannel(id: string, level: number, durationMs: number, signal?: AbortSignal): Promise<void>;
  /** Fade a separate group multiplier, preserving the user's volume setting. */
  fadeGroup(
    group: AudioGroup,
    level: number,
    durationMs: number,
    signal?: AbortSignal,
  ): Promise<void>;
  getGroupSnapshot(group: AudioGroup): { volume: number; level: number };
  stop(): void;
}

type Gain = { value: number; cancel?: () => void };
type Channel = {
  group: AudioGroup;
  gain: Gain;
  transport: AudioAdapterApi;
  api: AudioAdapterApi;
  muted: boolean;
};
const groups: readonly AudioGroup[] = ['music', 'narration', 'effects', 'ambience'];
const cancelled = () => new DOMException('Audio fade cancelled.', 'AbortError');
function level(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new RangeError('Audio level must be between zero and one.');
  return value;
}

export const AudioMixerCapability = token<AudioMixerApi>('audio:mixer');

export function createAudioMixerAdapter(
  options: AudioMixerOptions,
): AdapterRegistration<AudioMixerApi> {
  const definitions = options.channels.map((channel) => ({ ...channel }));
  const ids = new Set<string>();
  for (const channel of definitions) {
    if (!channel.id.trim() || ids.has(channel.id))
      throw new Error(`Duplicate or empty audio channel: ${channel.id}`);
    if (!groups.includes(channel.group)) throw new Error(`Unknown audio group: ${channel.group}`);
    ids.add(channel.id);
  }
  const id = options.id ?? 'audio-mixer';
  return {
    id,
    capability: 'audio:mixer',
    token: AudioMixerCapability,
    isSupported: () => typeof window !== 'undefined' && typeof Audio !== 'undefined',
    async setup(ctx) {
      const channels = new Map<string, Channel>();
      const levels = new Map(
        groups.map((group) => [group, { volume: 1, gain: { value: 1 } as Gain }]),
      );
      let muted = false;
      const active = () => {
        if (ctx.signal.aborted) throw cancelled();
      };
      const groupState = (group: AudioGroup) => {
        const state = levels.get(group);
        if (!state) throw new Error(`Unknown audio group: ${group}`);
        return state;
      };
      const requireChannel = (name: string) => {
        const channel = channels.get(name);
        if (!channel) throw new Error(`Unknown audio channel: ${name}`);
        return channel;
      };
      const apply = (channel: Channel) => {
        const group = groupState(channel.group);
        channel.transport.setVolume(channel.gain.value * group.volume * group.gain.value);
      };
      const applyGroup = (group: AudioGroup) => {
        for (const channel of channels.values()) if (channel.group === group) apply(channel);
      };
      const stop = () => {
        for (const group of levels.values()) group.gain.cancel?.();
        for (const channel of channels.values()) {
          channel.gain.cancel?.();
          channel.transport.stop();
        }
      };
      ctx.signal.addEventListener('abort', stop, { once: true });
      ctx.scope.defer(() => {
        ctx.signal.removeEventListener('abort', stop);
        channels.clear();
      });
      for (const definition of definitions) {
        active();
        const scope = new ResourceScope();
        ctx.scope.defer(() => scope.dispose());
        const transport = await createAudioAdapter(`${id}:${definition.id}`).setup({
          ...ctx,
          scope,
        });
        const gain: Gain = { value: 1 };
        const channel = {
          group: definition.group,
          gain,
          transport,
          muted: false,
        } as Channel;
        const snapshot = () => ({
          ...transport.getSnapshot(),
          volume: gain.value,
        });
        channel.api = {
          ...transport,
          pause() {
            gain.cancel?.();
            transport.pause();
          },
          stop() {
            gain.cancel?.();
            transport.stop();
          },
          setVolume(value) {
            active();
            const next = level(value);
            gain.cancel?.();
            gain.value = next;
            apply(channel);
          },
          setMuted(value) {
            active();
            channel.muted = Boolean(value);
            transport.setMuted(muted || channel.muted);
          },
          getSnapshot: snapshot,
          subscribe: (listener) => transport.subscribe(() => listener(snapshot())),
        };
        channels.set(definition.id, channel);
      }
      ctx.scope.defer(stop);

      const fade = (
        gain: Gain,
        target: number,
        duration: number,
        update: () => void,
        signal?: AbortSignal,
      ): Promise<void> => {
        try {
          active();
          level(target);
        } catch (error) {
          return Promise.reject(error);
        }
        if (!Number.isFinite(duration) || duration < 0)
          return Promise.reject(new RangeError('Fade duration must be finite and nonnegative.'));
        if (signal?.aborted) return Promise.reject(cancelled());
        gain.cancel?.();
        if (duration === 0 || target === gain.value) {
          gain.value = target;
          update();
          return Promise.resolve();
        }
        return new Promise<void>((resolve, reject) => {
          const start = performance.now(),
            from = gain.value;
          let frame: number | undefined;
          const clean = () => {
            if (frame !== undefined) cancelAnimationFrame(frame);
            frame = undefined;
            signal?.removeEventListener('abort', abort);
            if (gain.cancel === abort) gain.cancel = undefined;
          };
          const abort = () => {
            clean();
            reject(cancelled());
          };
          const tick = (now: number) => {
            frame = undefined;
            const progress = Math.min(1, Math.max(0, (now - start) / duration));
            gain.value = from + (target - from) * progress;
            try {
              update();
            } catch (error) {
              clean();
              reject(error);
              return;
            }
            // A subscriber may cancel or replace this fade during update.
            if (gain.cancel !== abort) return;
            if (progress === 1) {
              clean();
              resolve();
            } else frame = requestAnimationFrame(tick);
          };
          gain.cancel = abort;
          signal?.addEventListener('abort', abort, { once: true });
          frame = requestAnimationFrame(tick);
        });
      };
      return {
        channel(name) {
          active();
          return requireChannel(name).api;
        },
        setMuted(value) {
          active();
          muted = Boolean(value);
          for (const channel of channels.values())
            channel.transport.setMuted(muted || channel.muted);
        },
        setGroupVolume(group, value) {
          active();
          groupState(group).volume = level(value);
          applyGroup(group);
        },
        fadeChannel(name, target, duration, signal) {
          const channel = requireChannel(name);
          return fade(channel.gain, target, duration, () => apply(channel), signal);
        },
        fadeGroup(group, target, duration, signal) {
          return fade(groupState(group).gain, target, duration, () => applyGroup(group), signal);
        },
        getGroupSnapshot(group) {
          const state = groupState(group);
          return { volume: state.volume, level: state.gain.value };
        },
        stop,
      };
    },
  };
}
