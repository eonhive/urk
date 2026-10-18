/**
 * Company: EonHive Inc. | Title: Audio Analysis Contracts
 * Purpose: Verify opt-in acquisition, normalization, source reuse, and transport cleanup.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler } from '@urk/core';
import { createAudioAdapter, AudioCapability } from '../dist/audio/index.js';

class Media extends EventTarget {
  static instances = [];
  paused = true;
  ended = false;
  readyState = 4;
  volume = 1;
  muted = false;
  currentTime = 0;
  playCalls = 0;
  constructor() { super(); Media.instances.push(this); }
  play() { this.playCalls++; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
}
class Node {
  outputs = new Set();
  connect(node) { this.outputs.add(node); }
  disconnect() { this.outputs.clear(); }
}
class Analyser extends Node {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  getFloatTimeDomainData(array) { array.fill(0.5); }
  getByteFrequencyData(array) { array.fill(128); }
}
class Context {
  static instances = [];
  state = 'suspended';
  sampleRate = 48000;
  destination = new Node();
  sources = new Map();
  analysers = [];
  closes = 0;
  constructor() { Context.instances.push(this); }
  createAnalyser() { const node = new Analyser(); this.analysers.push(node); return node; }
  createMediaElementSource(element) {
    assert.equal(this.sources.has(element), false, 'A media source must never be captured twice');
    const node = new Node(); this.sources.set(element, node); return node;
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.closes++; this.state = 'closed'; return Promise.resolve(); }
}
async function setup(t) {
  const saved = new Map(['Audio', 'AudioContext', 'document', 'location'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, { Audio: Media, AudioContext: Context, document: { baseURI: 'https://urk.test/' }, location: { origin: 'https://urk.test' } });
  Context.instances = []; Media.instances = [];
  const scheduler = new ManualFrameScheduler();
  const adapter = createAudioAdapter();
  const kernel = createKernel({ frameMode: 'auto', scheduler, adapters: [{ ...adapter, isSupported: () => true }] });
  await kernel.boot();
  t.after(async () => {
    await kernel.shutdown();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const audio = kernel.getContext().require(AudioCapability);
  audio.registerTrack({ id: 'one', label: 'One', src: '/one.wav' });
  return { kernel, audio, scheduler, element: Media.instances[0] };
}

test('ordinary playback and configuration acquire no context, nodes, or frames', async t => {
  const { audio, scheduler } = await setup(t);
  assert.equal(audio.analysis.enabled, false);
  assert.equal(audio.analysis.read().waveform.length, 0);
  audio.analysis.configure({ fftSize: 512 });
  await audio.play('one');
  audio.pause();
  await audio.play();
  audio.stop();
  assert.equal(Context.instances.length, 0);
  assert.equal(scheduler.isRunning(), false);
});

test('one analyser provides normalized RMS and band magnitudes with reusable buffers', async t => {
  const { audio, element } = await setup(t);
  const enabling = audio.analysis.enable({ fftSize: 512, smoothing: 0.3 });
  const playing = audio.play('one');
  assert.equal(element.playCalls, 1, 'Native play stays inside the initiating gesture');
  await Promise.all([enabling, playing]);
  const context = Context.instances[0];
  assert.equal(context.analysers.length, 1);
  assert.equal(context.sources.size, 1);
  const first = audio.analysis.read();
  const waveform = first.waveform, spectrum = first.spectrum;
  assert.equal(first.level, 0.5);
  for (const name of ['bass', 'mids', 'treble']) assert.equal(first[name], 128 / 255);
  assert.equal(first.sampleRate, 48000);
  assert.equal(waveform.length, 512);
  assert.equal(spectrum.length, 256);
  assert.equal(audio.analysis.read(), first);
  assert.equal(first.waveform, waveform);
  assert.equal(first.spectrum, spectrum);
  audio.setMuted(true);
  assert.equal(audio.analysis.read().level, 0);
  assert.equal(spectrum.some(Boolean), false);
});

test('frequency bands use actual sample rate, clip at Nyquist, and configuration validates atomically', async t => {
  const { audio } = await setup(t);
  await audio.analysis.enable({ fftSize: 32, bands: { bass: [0, 1500], mids: [1500, 3000], treble: [24000, 30000] } });
  await audio.play('one');
  const node = Context.instances[0].analysers[0];
  node.getByteFrequencyData = array => { array.fill(0); array[0] = 255; array[1] = 64; };
  assert.equal(audio.analysis.read().bass, 1);
  assert.equal(audio.analysis.read().mids, 64 / 255);
  assert.equal(audio.analysis.read().treble, 0);
  for (const options of [{ fftSize: 33 }, { fftSize: Infinity }, { smoothing: -1 }, { bands: { bass: [20, 10] } }])
    assert.throws(() => audio.analysis.configure(options), RangeError);
  assert.equal(node.fftSize, 32);
  audio.analysis.configure({ fftSize: 1024, smoothing: 0 });
  assert.equal(audio.analysis.read().spectrum.length, 512);
  assert.equal(node.smoothingTimeConstant, 0);
});

test('pause, track switching, disable/re-enable, and stop preserve one context and cached sources', async t => {
  const { audio, element } = await setup(t);
  audio.registerTrack({ id: 'two', label: 'Two', src: '/two.wav' });
  await audio.analysis.enable();
  await audio.play('one');
  const context = Context.instances[0], analyser = context.analysers[0];
  audio.pause();
  assert.equal(audio.analysis.read().bass, 0);
  assert.equal(analyser.outputs.size, 0);
  await audio.play('two');
  assert.equal(element.paused, true);
  await audio.play('one');
  assert.equal(context.sources.size, 2);
  audio.analysis.disable();
  assert.equal(audio.analysis.read().level, 0);
  assert.equal(element.paused, false);
  assert.deepEqual([...context.sources.get(element).outputs], [context.destination]);
  await audio.analysis.enable();
  assert.equal(Context.instances.length, 1);
  assert.equal(context.analysers.length, 1);
  audio.stop();
  assert.equal(analyser.outputs.size, 0);
  assert.equal(audio.analysis.read().waveform.some(Boolean), false);
});

test('shutdown closes context once, disconnects every node, and rejects later enable', async t => {
  const { audio, kernel, element } = await setup(t);
  await audio.analysis.enable();
  await audio.play('one');
  const context = Context.instances[0];
  await kernel.shutdown();
  await kernel.shutdown();
  assert.equal(context.closes, 1);
  for (const node of [...context.sources.values(), ...context.analysers]) assert.equal(node.outputs.size, 0);
  assert.equal(element.src, '');
  assert.equal(audio.analysis.enabled, false);
  assert.equal(audio.analysis.read().level, 0);
  await assert.rejects(audio.analysis.enable(), /disposed/);
});

test('unsupported Web Audio and known non-CORS tracks fail without capturing ordinary playback', async t => {
  const { audio } = await setup(t);
  delete globalThis.AudioContext;
  await assert.rejects(audio.analysis.enable(), /unavailable/);
  await audio.play('one');
  globalThis.AudioContext = Context;
  audio.registerTrack({ id: 'remote', label: 'Remote', src: 'https://elsewhere.test/music.wav' });
  await audio.play('remote');
  await assert.rejects(audio.analysis.enable(), /CORS/);
  assert.equal(audio.analysis.enabled, false);
  assert.equal(Context.instances[0].sources.size, 0);
  assert.equal(Media.instances[1].paused, false);
  audio.registerTrack({ id: 'cors', label: 'CORS', src: 'https://elsewhere.test/allowed.wav', crossOrigin: 'anonymous' });
  await audio.play('cors');
  await audio.analysis.enable();
  assert.equal(Context.instances[0].sources.size, 1);
});

test('failed context resumption cannot let late native playback restart audio', async t => {
  const { audio, element } = await setup(t);
  await audio.analysis.enable();
  const context = Context.instances[0];
  context.state = 'suspended';
  context.resume = () => Promise.reject(new Error('Resume blocked'));
  let finishPlay;
  element.play = () => new Promise(resolve => { finishPlay = () => { element.paused = false; resolve(); }; });
  await assert.rejects(audio.play('one'), /Resume blocked/);
  context.state = 'running';
  audio.registerTrack({ id: 'two', label: 'Two', src: '/two.wav' });
  await audio.play('two');
  finishPlay();
  await Promise.resolve();
  assert.equal(element.paused, true);
  assert.equal(audio.getSnapshot().activeTrackId, 'two');
  assert.equal(audio.getSnapshot().status, 'playing');
});

test('concurrent enables share acquisition and shutdown cancels pending enable', async t => {
  const { audio, kernel } = await setup(t);
  await Promise.all([audio.analysis.enable(), audio.analysis.enable()]);
  assert.equal(Context.instances.length, 1);
  const context = Context.instances[0];
  context.state = 'suspended';
  let resume;
  context.resume = () => new Promise(resolve => { resume = resolve; });
  const pending = assert.rejects(audio.analysis.enable(), { name: 'AbortError' });
  await kernel.shutdown();
  resume();
  await pending;
  assert.equal(audio.analysis.enabled, false);
  assert.equal(context.closes, 1);
});
