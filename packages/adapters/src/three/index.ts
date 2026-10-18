/**
 * Company: EonHive Inc.
 * Title: Three Adapter
 * Purpose: Mount a small Three.js scene surface behind a stable URK capability contract.
 * Author: Stan Nesi
 * Created: 2026-04-22
 * Updated: 2026-04-22
 * Notes: Vibe coded with Codex.
 */

import { token, type AdapterRegistration } from '@urk/core';
import * as THREE from 'three';

export interface ThreeAdapterSize {
  width: number;
  height: number;
}

export interface ThreeResizeEventPayload extends ThreeAdapterSize {
  host: HTMLElement;
  pixelRatio: number;
}

export interface ThreeContextEventPayload {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
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

export const ThreeCapability = token<ThreeAdapterApi>('three');

export function createThreeAdapter(
  id = 'three-adapter',
): AdapterRegistration<ThreeAdapterApi> {
  return {
    id,
    capability: 'three',
    token: ThreeCapability,
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
      ctx.scope.defer(() => renderer.dispose());
      ctx.scope.defer(() => renderer.domElement.remove());
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

      let size: ThreeAdapterSize = { width: 0, height: 0 };
      let pixelRatio = 0;
      let contextLost = false;
      const isContextLost = (): boolean => contextLost || renderer.getContext().isContextLost();

      const resize = (): void => {
        if (ctx.signal.aborted || isContextLost()) return;
        const nextSize = getHostSize(host);
        const nextRatio = getPixelRatio();
        if (size.width === nextSize.width && size.height === nextSize.height && pixelRatio === nextRatio) return;
        size = nextSize;
        if (pixelRatio !== nextRatio) renderer.setPixelRatio(nextRatio);
        pixelRatio = nextRatio;
        renderer.setSize(size.width, size.height, false);
        camera.aspect = size.width / size.height;
        camera.updateProjectionMatrix();
        ctx.events.emit({
          type: 'three:resize', source: id, timestamp: Date.now(),
          payload: { host, ...size, pixelRatio } satisfies ThreeResizeEventPayload,
        });
      };

      const publishContext = (type: string): void => {
        ctx.events.emit({
          type, source: id, timestamp: Date.now(),
          payload: { host, canvas: renderer.domElement } satisfies ThreeContextEventPayload,
        });
      };
      const onContextLost = (): void => {
        if (ctx.signal.aborted || contextLost) return;
        contextLost = true;
        publishContext('three:context-lost');
      };
      const onContextRestored = (): void => {
        if (ctx.signal.aborted || !contextLost) return;
        contextLost = false;
        resize();
        if (!ctx.signal.aborted) publishContext('three:context-restored');
      };
      // Three's earlier listeners allow restoration and rebuild its GPU resources first.
      ctx.scope.defer(() => renderer.domElement.removeEventListener('webglcontextlost', onContextLost));
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      ctx.scope.defer(() => renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored));
      renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

      resize();

      if (typeof window.matchMedia === 'function') {
        let resolutionQuery: MediaQueryList | undefined;
        const removeResolutionListener = (): void => {
          resolutionQuery?.removeEventListener('change', onResolutionChange);
        };
        const watchResolution = (): void => {
          removeResolutionListener();
          // Watch the uncapped ratio so changes above 2x still rearm the query.
          resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
          resolutionQuery.addEventListener('change', onResolutionChange);
        };
        const onResolutionChange = (): void => {
          if (ctx.signal.aborted) return;
          watchResolution();
          resize();
        };

        ctx.scope.defer(removeResolutionListener);
        watchResolution();
      }

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          resize();
        });

        ctx.scope.defer(() => observer.disconnect());
        observer.observe(host);
      } else if (typeof window !== 'undefined') {
        const onResize = (): void => {
          resize();
        };

        ctx.scope.defer(() => window.removeEventListener('resize', onResize));
        window.addEventListener('resize', onResize);
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
          if (ctx.signal.aborted || isContextLost()) return;
          renderer.render(scene, camera);
        },
        raycast(clientX, clientY, objects) {
          if (ctx.signal.aborted || isContextLost() || objects.length === 0 || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
            return [];
          }

          const bounds = renderer.domElement.getBoundingClientRect();

          if (bounds.width <= 0 || bounds.height <= 0 || clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) {
            return [];
          }

          raycastPointer.set(
            ((clientX - bounds.left) / bounds.width) * 2 - 1,
            -((clientY - bounds.top) / bounds.height) * 2 + 1,
          );

          // Demand-rendered scenes can be picked before the next render updates matrices.
          camera.updateWorldMatrix(true, false);
          for (const object of objects) object.updateWorldMatrix(true, true);
          raycaster.setFromCamera(raycastPointer, camera);

          return raycaster.intersectObjects(objects, true);
        },
      };
    },
  };
}
