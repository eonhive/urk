/**
 * Company: EonHive Inc.
 * Title: Three Adapter
 * Purpose: Mount a small Three.js scene surface behind a stable URK capability contract.
 * Author: Stan Nesi
 * Created: 2026-04-22
 * Updated: 2026-04-22
 * Notes: Vibe coded with Codex.
 */

import type { AdapterRegistration } from '@urk/core';
import * as THREE from 'three';

export interface ThreeAdapterSize {
  width: number;
  height: number;
}

export interface ThreeAdapterApi {
  getHost(): HTMLElement;
  getCanvas(): HTMLCanvasElement;
  getScene(): THREE.Scene;
  getCamera(): THREE.PerspectiveCamera;
  getRenderer(): THREE.WebGLRenderer;
  getSize(): ThreeAdapterSize;
  resize(): void;
  render(): void;
  raycast(
    clientX: number,
    clientY: number,
    objects: THREE.Object3D[],
  ): THREE.Intersection<THREE.Object3D>[];
}

function assertHtmlElement(value: unknown, serviceName: string): HTMLElement {
  if (typeof HTMLElement === 'undefined' || !(value instanceof HTMLElement)) {
    throw new Error(`Service ${serviceName} must be an HTMLElement.`);
  }

  return value;
}

function getHostSize(host: HTMLElement): ThreeAdapterSize {
  return {
    width: Math.max(host.clientWidth, 1),
    height: Math.max(host.clientHeight, 1),
  };
}

function getPixelRatio(): number {
  if (typeof window === 'undefined') {
    return 1;
  }

  return Math.min(window.devicePixelRatio || 1, 2);
}

export function createThreeAdapter(
  id = 'three-adapter',
): AdapterRegistration<ThreeAdapterApi> {
  let disposeResizeTracking: (() => void) | null = null;

  return {
    id,
    capability: 'three',
    isSupported() {
      return typeof window !== 'undefined' && typeof document !== 'undefined';
    },
    setup(ctx) {
      const host = assertHtmlElement(ctx.services.require('three:host'), 'three:host');
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      const raycaster = new THREE.Raycaster();
      const raycastPointer = new THREE.Vector2();

      camera.position.set(0, 0, 5.75);
      camera.lookAt(0, 0, 0);

      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.pointerEvents = 'none';

      host.append(renderer.domElement);

      let size = getHostSize(host);

      const resize = (): void => {
        size = getHostSize(host);
        renderer.setPixelRatio(getPixelRatio());
        renderer.setSize(size.width, size.height, false);
        camera.aspect = size.width / size.height;
        camera.updateProjectionMatrix();
      };

      resize();

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          resize();
        });

        observer.observe(host);
        disposeResizeTracking = () => {
          observer.disconnect();
        };
      } else if (typeof window !== 'undefined') {
        const onResize = (): void => {
          resize();
        };

        window.addEventListener('resize', onResize);
        disposeResizeTracking = () => {
          window.removeEventListener('resize', onResize);
        };
      } else {
        disposeResizeTracking = null;
      }

      return {
        getHost() {
          return host;
        },
        getCanvas() {
          return renderer.domElement;
        },
        getScene() {
          return scene;
        },
        getCamera() {
          return camera;
        },
        getRenderer() {
          return renderer;
        },
        getSize() {
          return { ...size };
        },
        resize,
        render() {
          renderer.render(scene, camera);
        },
        raycast(clientX, clientY, objects) {
          if (objects.length === 0) {
            return [];
          }

          const bounds = renderer.domElement.getBoundingClientRect();

          if (bounds.width <= 0 || bounds.height <= 0) {
            return [];
          }

          raycastPointer.set(
            ((clientX - bounds.left) / bounds.width) * 2 - 1,
            -((clientY - bounds.top) / bounds.height) * 2 + 1,
          );

          raycaster.setFromCamera(raycastPointer, camera);

          return raycaster.intersectObjects(objects, true);
        },
      };
    },
    dispose(_ctx, api) {
      disposeResizeTracking?.();
      disposeResizeTracking = null;
      api.getRenderer().dispose();
      api.getCanvas().remove();
    },
  };
}
