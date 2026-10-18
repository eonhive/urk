/**
 * Company: EonHive Inc. | Title: Orbit Gallery Scene
 * Purpose: Render a borrowed film in a demand-driven, scoped Three.js gallery.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import * as THREE from 'three';
import { createThreeAdapter, type ThreeContextEventPayload } from '@urk/adapters/three';
import { createVideoTexture } from '@urk/adapters/three/video';
import type { RuntimeContext } from '@urk/core';
import type { VideoHandle } from '@urk/adapters/video';
import { createVideoTimeSource } from '../media/video-time.js';
import type { Branch } from './bookmarks.js';
import type { createMediaView } from './view.js';
import { mountSoundReaction } from './reaction.js';

export async function mountGalleryScene(
  ctx: RuntimeContext,
  view: ReturnType<typeof createMediaView>,
  player: VideoHandle,
  choose: (branch: Branch) => void,
) {
  const three = await createThreeAdapter('orbit-gallery').setup(ctx);
  if (ctx.signal.aborted) throw new DOMException('Gallery cancelled.', 'AbortError');
  const scene = three.getScene();
  scene.background = new THREE.Color('#06101b');
  const group = new THREE.Group();
  scene.add(group);
  ctx.scope.defer(() => { scene.remove(group); });
  const geometry = <T extends THREE.BufferGeometry>(value: T): T => {
    ctx.scope.defer(() => value.dispose());
    return value;
  };
  const material = <T extends THREE.Material>(value: T): T => {
    ctx.scope.defer(() => value.dispose());
    return value;
  };
  group.add(new THREE.HemisphereLight(0xb7dcff, 0x10132c, 2.4));
  const light = new THREE.PointLight(0x55e3eb, 35, 15);
  light.position.set(-2, 2, 3);
  group.add(light);
  const binding = createVideoTexture(player, ctx);
  const screen = new THREE.Mesh(geometry(new THREE.PlaneGeometry(3.4, 1.9125)),
    material(new THREE.MeshBasicMaterial({ map: binding.texture, toneMapped: false })));
  screen.position.set(0, 0.25, 0.1);
  group.add(screen);
  const bezel = new THREE.Mesh(geometry(new THREE.BoxGeometry(3.52, 2.03, 0.12)),
    material(new THREE.MeshStandardMaterial({ color: 0x243b52, metalness: 0.7, roughness: 0.3 })));
  bezel.position.set(0, 0.25, 0);
  group.add(bezel);
  const floor = new THREE.Mesh(geometry(new THREE.CircleGeometry(4.6, 64)),
    material(new THREE.MeshStandardMaterial({ color: 0x0d2031, metalness: 0.4, roughness: 0.7 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.3;
  group.add(floor);
  const colors = { explore: 0x55e3eb, create: 0xb596ff };
  const objects = (['explore', 'create'] as const).map((name, index) => {
    const shape = index === 0 ? new THREE.IcosahedronGeometry(0.48) : new THREE.OctahedronGeometry(0.52);
    const mesh = new THREE.Mesh(geometry(shape), material(new THREE.MeshStandardMaterial({
      color: colors[name], emissive: colors[name], emissiveIntensity: 0.2, metalness: 0.45, roughness: 0.3,
    })));
    mesh.position.set(index === 0 ? -2.35 : 2.35, -0.35, 0.4);
    mesh.rotation.set(0.2, index === 0 ? 0.4 : -0.3, 0.1);
    mesh.userData.branch = name;
    group.add(mesh);
    return mesh;
  });
  let suspended = false;
  let lost = false;
  let pending: number | undefined;
  let stopFrames = () => {};
  let branch: Branch = null;
  let time = 0;
  let reactionLevel = 0;
  let reactionBass = 0;
  const appearance = () => {
    light.color.setHex(colors[branch === 'create' ? 'create' : 'explore']);
    light.intensity = (time >= 5 ? 45 : time >= 2 ? 32 : 22) + reactionLevel * 24;
    for (const object of objects) {
      const selected = object.userData.branch === branch;
      object.scale.setScalar((selected ? 1.18 : 1) + reactionBass * 0.18);
      object.position.y = -0.35 + reactionLevel * 0.12;
      object.material.emissiveIntensity = (selected ? 0.6 : 0.15) + reactionLevel * 0.65;
    }
  };
  const cancel = () => {
    if (pending !== undefined) cancelAnimationFrame(pending);
    pending = undefined;
  };
  const request = () => {
    if (ctx.signal.aborted || suspended || lost || pending !== undefined) return;
    pending = requestAnimationFrame(() => {
      pending = undefined;
      if (ctx.signal.aborted || suspended || lost) return;
      // A paused seek still needs a texture upload, even without a decoded-frame callback.
      if (player.element.readyState >= 2) binding.texture.needsUpdate = true;
      three.render();
    });
  };
  const frames = createVideoTimeSource(player, { frames: true });
  const reaction = mountSoundReaction(ctx, view, (level, bass) => {
    if (level === reactionLevel && bass === reactionBass) return;
    reactionLevel = level;
    reactionBass = bass;
    appearance();
    request();
  });
  const observeFrames = () => {
    stopFrames();
    stopFrames = !suspended && !lost && !ctx.signal.aborted ? frames.subscribe(request) : () => {};
  };
  const resize = () => {
    const camera = three.getCamera();
    // Fit both objects in portrait layouts without shrinking the controls.
    camera.position.z = Math.max(6.5, 3.3 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.aspect);
    camera.updateProjectionMatrix();
    request();
  };
  const matches = (payload: unknown) => (payload as ThreeContextEventPayload)?.host === view.gallerySurface;
  ctx.scope.defer(ctx.events.on('three:resize', event => { if (matches(event.payload)) resize(); }));
  ctx.scope.defer(ctx.events.on('three:context-lost', event => {
    if (!matches(event.payload)) return;
    lost = true;
    reaction.suspend(true);
    player.pause();
    cancel();
    observeFrames();
    view.galleryStatus.textContent = 'Graphics paused. Waiting for recovery…';
  }));
  ctx.scope.defer(ctx.events.on('three:context-restored', event => {
    if (!matches(event.payload)) return;
    lost = false;
    reaction.suspend(suspended);
    view.galleryStatus.textContent = 'Graphics restored. Press Play when ready.';
    observeFrames();
    resize();
  }));
  ctx.scope.defer(player.subscribe((_snapshot, event) => {
    if (['loadeddata', 'seeked', 'pause', 'ended'].includes(event)) request();
  }));
  const pick = (event: MouseEvent) => {
    if (suspended || lost || ctx.signal.aborted) return;
    const hit = three.raycast(event.clientX, event.clientY, objects)[0];
    if (hit) choose(hit.object.userData.branch as Branch);
  };
  view.gallerySurface.addEventListener('click', pick);
  ctx.scope.defer(() => view.gallerySurface.removeEventListener('click', pick));
  const abort = () => { cancel(); stopFrames(); };
  ctx.signal.addEventListener('abort', abort, { once: true });
  ctx.scope.defer(() => { abort(); ctx.signal.removeEventListener('abort', abort); });
  observeFrames();
  resize();
  return {
    sync(nextBranch: Branch, nextTime: number) {
      branch = nextBranch;
      time = nextTime;
      appearance();
      request();
    },
    suspend(value: boolean) {
      if (suspended === value) return;
      suspended = value;
      reaction.suspend(value || lost);
      if (value) cancel();
      observeFrames();
      if (!value) resize();
    },
    resize,
  };
}
