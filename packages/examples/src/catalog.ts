/**
 * Company: EonHive Inc.
 * Title: Example Catalog
 * Purpose: Expose public metadata and module loading helpers for website-consumed URK examples.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-09
 * Notes: Vibe coded with Codex.
 */

import { minimalRuntimeMeta } from './minimal-runtime/meta.js';
import { adapterRegistrationMeta } from './adapter-registration/meta.js';
import { controllerOrchestrationMeta } from './controller-orchestration/meta.js';
import { runtimeStateMeta } from './runtime-state/meta.js';
import { eventRoutingMeta } from './event-routing/meta.js';
import { sceneUiBridgeMeta } from './scene-ui-bridge/meta.js';
import { pointerInputOverlayMeta } from './pointer-input-overlay/meta.js';
import { embeddedDocsDemoMeta } from './embedded-docs-demo/meta.js';
import { plannedExampleMetas } from './planned.js';
import type { ExampleId, ExampleMeta, ExampleModule } from './types.js';

export const exampleCatalog: ExampleMeta[] = [
  minimalRuntimeMeta,
  adapterRegistrationMeta,
  controllerOrchestrationMeta,
  runtimeStateMeta,
  eventRoutingMeta,
  sceneUiBridgeMeta,
  pointerInputOverlayMeta,
  embeddedDocsDemoMeta,
  ...plannedExampleMetas,
];

export function getExampleMeta(id: ExampleId): ExampleMeta {
  const entry = exampleCatalog.find((example) => example.id === id);

  if (!entry) {
    throw new Error(`Unknown URK example: ${id}`);
  }

  return entry;
}

export async function loadExampleModule(id: ExampleId): Promise<ExampleModule> {
  switch (id) {
    case 'minimal-runtime': {
      const module = await import('./minimal-runtime/mount.js');

      return {
        meta: minimalRuntimeMeta,
        mount: module.mountMinimalRuntimeExample,
      };
    }
    case 'adapter-registration': {
      const module = await import('./adapter-registration/mount.js');

      return {
        meta: adapterRegistrationMeta,
        mount: module.mountAdapterRegistrationExample,
      };
    }
    case 'controller-orchestration': {
      const module = await import('./controller-orchestration/mount.js');

      return {
        meta: controllerOrchestrationMeta,
        mount: module.mountControllerOrchestrationExample,
      };
    }
    case 'runtime-state': {
      const module = await import('./runtime-state/mount.js');

      return {
        meta: runtimeStateMeta,
        mount: module.mountRuntimeStateExample,
      };
    }
    case 'event-routing': {
      const module = await import('./event-routing/mount.js');

      return {
        meta: eventRoutingMeta,
        mount: module.mountEventRoutingExample,
      };
    }
    case 'scene-ui-bridge': {
      const module = await import('./scene-ui-bridge/mount.js');

      return {
        meta: sceneUiBridgeMeta,
        mount: module.mountSceneUiBridgeExample,
      };
    }
    case 'pointer-input-overlay': {
      const module = await import('./pointer-input-overlay/mount.js');

      return {
        meta: pointerInputOverlayMeta,
        mount: module.mountPointerInputOverlayExample,
      };
    }
    case 'embedded-docs-demo': {
      const module = await import('./embedded-docs-demo/mount.js');

      return {
        meta: embeddedDocsDemoMeta,
        mount: module.mountEmbeddedDocsDemoExample,
      };
    }
    default:
      throw new Error(`URK example is not runnable yet: ${id}`);
  }
}
