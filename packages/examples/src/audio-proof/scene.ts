/**
 * Company: EonHive Inc. | Title: Audio Reactive Scene
 * Purpose: Map measured audio to a borrowed Three scene and tween discrete layout changes.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-19
 * Notes: Vibe coded with Codex.
 */
import * as THREE from 'three';
import type { RuntimeContext } from '@urk/core';
import type { AudioAnalysisSnapshot } from '@urk/adapters/audio';
import { MotionCapability } from '@urk/adapters/motion';
import { createThreeAdapter, type ThreeContextEventPayload } from '@urk/adapters/three';
import { scaleAudioReaction, type AudioReactionSettings } from '../audio-widget/reactions.js';

export async function mountAudioScene(ctx: RuntimeContext, redraw: () => void, status: HTMLElement) {
  const three = await createThreeAdapter('audio-lab-scene').setup(ctx);
  if (ctx.signal.aborted) throw new DOMException('Scene cancelled.', 'AbortError');
  const scene = three.getScene();
  const group = new THREE.Group();
  scene.add(group);
  ctx.scope.defer(() => { scene.remove(group); });
  const own = <T extends THREE.BufferGeometry | THREE.Material>(resource: T) => {
    ctx.scope.defer(() => resource.dispose());
    return resource;
  };
  group.add(new THREE.HemisphereLight(0xccddff, 0x171a32, 2.5));
  const light = new THREE.PointLight(0x9beede, 35);
  light.position.set(2, 3, 4);
  group.add(light);
  const material = own(new THREE.MeshStandardMaterial({ color: 0x7be3cd, metalness: 0.45, roughness: 0.28, flatShading: true }));
  const core = new THREE.Mesh(own(new THREE.IcosahedronGeometry(0.67, 1)), material);
  core.rotation.set(0.25, 0.4, 0.1);
  group.add(core);
  const geometry = own(new THREE.OctahedronGeometry(0.075));
  const satelliteMaterial = own(new THREE.MeshStandardMaterial({ color: 0xb0a8ff, emissive: 0x453880, emissiveIntensity: 0.4 }));
  const satellites = Array.from({ length: 8 }, () => {
    const mesh = new THREE.Mesh(geometry, satelliteMaterial);
    group.add(mesh);
    return mesh;
  });
  const layout = { blend: 0 };
  const motion = ctx.require(MotionCapability).scoped(ctx.scope);
  const matches = (payload: unknown) => (payload as ThreeContextEventPayload)?.host === three.getHost();
  const resize = () => {
    const camera = three.getCamera();
    camera.position.z = Math.max(4.9, 4.2 / camera.aspect);
    camera.updateProjectionMatrix();
    redraw();
  };
  ctx.scope.defer(ctx.events.on('three:resize', event => { if (matches(event.payload)) resize(); }));
  ctx.scope.defer(ctx.events.on('three:context-lost', event => {
    if (matches(event.payload)) status.textContent = 'Graphics paused. Audio and plots remain available.';
  }));
  ctx.scope.defer(ctx.events.on('three:context-restored', event => {
    if (!matches(event.payload)) return;
    status.textContent = 'Graphics restored.';
    resize();
  }));
  resize();
  status.textContent = 'Bass scales the sculpture. Mids color it. Treble shapes the satellites.';
  return {
    render(snapshot: AudioAnalysisSnapshot, reduced: boolean, reactions: Readonly<AudioReactionSettings>) {
      if (ctx.signal.aborted) return;
      const bass = scaleAudioReaction(snapshot.bass, reactions.intensity, reactions.bass);
      const mids = scaleAudioReaction(snapshot.mids, reactions.intensity, reactions.mids);
      const treble = scaleAudioReaction(snapshot.treble, reactions.intensity, reactions.treble);
      core.scale.setScalar(1 + (reduced ? 0 : bass * 0.5));
      core.position.y = layout.blend * 0.3;
      material.color.setHSL(0.46 + mids * 0.34, 0.65, 0.58);
      const size = 1 + (reduced ? 0 : treble * 3);
      for (let i = 0; i < satellites.length; i++) {
        const angle = i * Math.PI / 4;
        satellites[i].position.set(
          Math.cos(angle) * 1.45 * (1 - layout.blend) + (i - 3.5) * 0.4 * layout.blend,
          Math.sin(angle) * 1.45 * (1 - layout.blend) - 1.2 * layout.blend,
          Math.sin(angle) * 0.3 * (1 - layout.blend),
        );
        satellites[i].scale.setScalar(size);
      }
      three.render();
    },
    setLayout(next: string) {
      const playback = motion.tween(layout, { blend: next === 'row' ? 1 : 0 }, {
        durationMs: 450, easing: 'ease-in-out', onUpdate: redraw,
      });
      void playback.finished.then(result => {
        if (result.status === 'failed' && !ctx.signal.aborted) status.textContent = 'Scene transition failed. Select a layout to retry.';
      });
    },
  };
}
