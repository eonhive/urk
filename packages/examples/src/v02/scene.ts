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
import { ThreeCapability } from '@urk/adapters/three';

export const choices = ['Explore', 'Create', 'Connect'] as const;
export type Choice = typeof choices[number];
export function isChoice(value: unknown): value is Choice {
  return choices.some(choice => choice === value);
}

export function createPlaygroundScene(ctx: RuntimeContext) {
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
  const cancelRender = (): void => {
    if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame);
    pendingFrame = undefined;
    host.dataset.renderPending = 'false';
  };
  const requestRender = (): void => {
    if (paused || ctx.signal.aborted || pendingFrame !== undefined) return;
    host.dataset.renderPending = 'true';
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = undefined;
      host.dataset.renderPending = 'false';
      if (paused || ctx.signal.aborted) return;
      // Resize before drawing, after the adapter's resize observer has settled.
      three.resize();
      const camera = three.getCamera();
      camera.position.z = Math.max(5.75, 3 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
      camera.updateMatrixWorld();
      three.render();
      host.dataset.renderCount = String(++renders);
    });
  };
  ctx.signal.addEventListener('abort', cancelRender, { once: true });
  ctx.scope.defer(() => { cancelRender(); ctx.signal.removeEventListener('abort', cancelRender); });
  // Theme changes can invalidate a composited canvas without resizing its host.
  const themeObserver = new MutationObserver(requestRender);
  ctx.scope.defer(() => themeObserver.disconnect());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(requestRender);
    ctx.scope.defer(() => observer.disconnect());
    observer.observe(host);
  } else {
    window.addEventListener('resize', requestRender);
    ctx.scope.defer(() => window.removeEventListener('resize', requestRender));
  }

  return {
    select(choice: Choice): void {
      selected = choice;
      for (const mesh of objects) {
        const active = mesh.name === choice;
        mesh.scale.setScalar(active ? 1.12 : 1);
        mesh.material.emissive.set(active ? mesh.material.color : 0x000000);
        mesh.material.emissiveIntensity = active ? 0.22 : 0;
      }
      host.dataset.selected = choice;
      requestRender();
    },
    pick(clientX: number, clientY: number): Choice | undefined {
      group.updateMatrixWorld(true);
      const name = three.raycast(clientX, clientY, objects)[0]?.object.name;
      return isChoice(name) ? name : undefined;
    },
    rotate(x: number, y: number): void {
      if (paused || ctx.signal.aborted) return;
      const mesh = objects[choices.indexOf(selected)];
      mesh.rotation.x += x;
      mesh.rotation.y += y;
      host.dataset.rotation = `${mesh.rotation.x.toFixed(2)},${mesh.rotation.y.toFixed(2)}`;
      requestRender();
    },
    setPaused(value: boolean): void {
      paused = value;
      if (paused) cancelRender();
      else requestRender();
    },
  };
}
