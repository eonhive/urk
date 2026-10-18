/**
 * Company: EonHive Inc.
 * Title: Playground Scene
 * Purpose: Own a selectable Three.js scene that renders only when its view changes.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-11
 * Notes: Vibe coded with Codex.
 */

import * as THREE from 'three';
import type { RuntimeContext } from '@urk/core';
import { ThreeCapability, type ThreeContextEventPayload, type ThreeResizeEventPayload } from '@urk/adapters/three';

export const choices = ['Explore', 'Create', 'Connect'] as const;
export type Choice = typeof choices[number];
export type SceneLayout = 'row' | 'arc';
export function isChoice(value: unknown): value is Choice {
  return choices.some(choice => choice === value);
}

export function createPlaygroundScene(
  ctx: RuntimeContext,
  onLayoutSettled: () => void,
  onContextChange: (lost: boolean) => void,
) {
  ctx.signal.throwIfAborted();
  const three = ctx.require(ThreeCapability);
  const host = three.getHost();
  const group = new THREE.Group();
  three.getScene().add(group);
  ctx.scope.defer(() => { group.removeFromParent(); });
  group.add(new THREE.HemisphereLight(0xe3f7ff, 0x25334f, 3));
  const light = new THREE.DirectionalLight(0xffffff, 4);
  light.position.set(2, 4, 5);
  group.add(light);

  const geometryFactories = [
    () => new THREE.IcosahedronGeometry(0.68, 1),
    () => new THREE.BoxGeometry(1.05, 1.05, 1.05),
    () => new THREE.TorusKnotGeometry(0.43, 0.15, 96, 16),
  ];
  const colors = [0x35dff2, 0xb38bff, 0x6dabff];
  const objects = choices.map((name, index) => {
    const geometry = geometryFactories[index]();
    ctx.scope.defer(() => geometry.dispose());
    const material = new THREE.MeshStandardMaterial({ color: colors[index], roughness: 0.3, metalness: 0.25 });
    ctx.scope.defer(() => material.dispose());
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set((index - 1) * 1.85, 0, 0);
    mesh.rotation.set(0.2, 0.35, 0);
    group.add(mesh);
    return mesh;
  });

  let selected: Choice = 'Explore';
  let paused = false;
  let pendingFrame: number | undefined;
  let renders = 0;
  let repaintPaused = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let contextLost = three.getRenderer().getContext().isContextLost();
  const isContextLost = (): boolean => contextLost || three.getRenderer().getContext().isContextLost();
  let transition: {
    starts: THREE.Vector3[];
    ends: THREE.Vector3[];
    elapsed: number;
    lastTime?: number;
  } | undefined;
  host.dataset.layout = 'row';
  host.dataset.transitionProgress = '1';
  host.dataset.contextState = contextLost ? 'lost' : 'ready';

  const cancelRender = (): void => {
    if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame);
    pendingFrame = undefined;
    repaintPaused = false;
    host.dataset.renderPending = 'false';
  };
  const requestRender = (force = false): void => {
    if (ctx.signal.aborted || isContextLost()) return;
    repaintPaused ||= force;
    if ((paused && !repaintPaused) || pendingFrame !== undefined) return;
    host.dataset.renderPending = 'true';
    pendingFrame = requestAnimationFrame(time => {
      pendingFrame = undefined;
      host.dataset.renderPending = 'false';
      if ((paused && !repaintPaused) || ctx.signal.aborted || isContextLost()) return;
      repaintPaused = false;
      let settled = false;
      if (transition && !paused) {
        if (transition.lastTime !== undefined) transition.elapsed += time - transition.lastTime;
        transition.lastTime = time;
        // Read the live preference on existing frames; paused scenes remain frozen.
        const progress = reducedMotion.matches ? 1 : Math.min(transition.elapsed / 650, 1);
        const eased = THREE.MathUtils.smoothstep(progress, 0, 1);
        objects.forEach((mesh, index) => mesh.position.lerpVectors(transition!.starts[index], transition!.ends[index], eased));
        host.dataset.transitionProgress = progress.toFixed(3);
        if (progress === 1) { transition = undefined; settled = true; }
      }
      const camera = three.getCamera();
      camera.position.z = Math.max(5.75, 3 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
      camera.updateMatrixWorld();
      three.render();
      host.dataset.renderCount = String(++renders);
      if (settled) onLayoutSettled();
      if (transition && !paused) requestRender();
    });
  };
  ctx.signal.addEventListener('abort', cancelRender, { once: true });
  ctx.scope.defer(() => { cancelRender(); ctx.signal.removeEventListener('abort', cancelRender); });
  // Theme changes can invalidate a composited canvas without resizing its host.
  const themeObserver = new MutationObserver(() => requestRender(true));
  ctx.scope.defer(() => themeObserver.disconnect());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  // The adapter owns sizing; repaint a paused scene without advancing its transition.
  ctx.scope.defer(ctx.events.on('three:resize', event => {
    if ((event.payload as ThreeResizeEventPayload).host === host) requestRender(true);
  }));
  ctx.scope.defer(ctx.events.on('three:context-lost', event => {
    if ((event.payload as ThreeContextEventPayload).host !== host || ctx.signal.aborted) return;
    contextLost = true;
    host.dataset.contextState = 'lost';
    cancelRender();
    if (transition) transition.lastTime = undefined;
    onContextChange(true);
  }));
  ctx.scope.defer(ctx.events.on('three:context-restored', event => {
    if ((event.payload as ThreeContextEventPayload).host !== host || ctx.signal.aborted) return;
    contextLost = false;
    host.dataset.contextState = 'ready';
    // Exclude the unavailable interval, and repaint even when operationally paused.
    if (transition) transition.lastTime = undefined;
    requestRender(true);
    onContextChange(false);
  }));

  const reportRotation = (): void => {
    const mesh = objects[choices.indexOf(selected)];
    host.dataset.rotation = `${mesh.rotation.x.toFixed(2)},${mesh.rotation.y.toFixed(2)}`;
  };

  return {
    isContextLost,
    select(choice: Choice): void {
      selected = choice;
      for (const mesh of objects) {
        const active = mesh.name === choice;
        mesh.scale.setScalar(active ? 1.12 : 1);
        mesh.material.emissive.set(active ? mesh.material.color : 0x000000);
        mesh.material.emissiveIntensity = active ? 0.22 : 0;
      }
      host.dataset.selected = choice;
      host.dataset.wireframe = String(objects[choices.indexOf(selected)].material.wireframe);
      reportRotation();
      requestRender();
    },
    pick(clientX: number, clientY: number): Choice | undefined {
      const name = three.raycast(clientX, clientY, objects)[0]?.object.name;
      return isChoice(name) ? name : undefined;
    },
    rotate(x: number, y: number): void {
      if (paused || ctx.signal.aborted) return;
      const mesh = objects[choices.indexOf(selected)];
      mesh.rotation.x += x;
      mesh.rotation.y = THREE.MathUtils.euclideanModulo(mesh.rotation.y + y + Math.PI, Math.PI * 2) - Math.PI;
      reportRotation();
      requestRender();
    },
    getRotation(): number {
      return Math.round(THREE.MathUtils.radToDeg(objects[choices.indexOf(selected)].rotation.y));
    },
    getWireframe(): boolean {
      return objects[choices.indexOf(selected)].material.wireframe;
    },
    setWireframe(value: boolean): void {
      if (paused || ctx.signal.aborted || isContextLost()) return;
      const material = objects[choices.indexOf(selected)].material;
      if (material.wireframe === value) return;
      material.wireframe = value;
      host.dataset.wireframe = String(value);
      requestRender();
    },
    setRotation(degrees: number): void {
      if (paused || ctx.signal.aborted || !Number.isFinite(degrees)) return;
      objects[choices.indexOf(selected)].rotation.y = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(degrees, -180, 180));
      reportRotation();
      requestRender();
    },
    setLayout(layout: SceneLayout): void {
      if (ctx.signal.aborted) return;
      const ends = objects.map((_, index) => new THREE.Vector3(
        (index - 1) * 1.85, layout === 'arc' ? (index === 1 ? 0.6 : -0.5) : 0, 0,
      ));
      host.dataset.layout = layout;
      if (reducedMotion.matches && !paused && !isContextLost()) {
        objects.forEach((mesh, index) => mesh.position.copy(ends[index]));
        transition = undefined;
        host.dataset.transitionProgress = '1';
        requestRender();
        onLayoutSettled();
        return;
      }
      transition = { starts: objects.map(mesh => mesh.position.clone()), ends, elapsed: 0 };
      host.dataset.transitionProgress = '0';
      requestRender();
    },
    setPaused(value: boolean): void {
      if (paused === value) return;
      paused = value;
      if (transition) transition.lastTime = undefined;
      if (paused) cancelRender();
      else requestRender();
    },
  };
}
