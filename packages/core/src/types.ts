/**
 * Core type definitions for URK runtime.
 */

import type { EventBus } from './events.js';
import type { AdapterRegistry, ControllerRegistry, ServiceRegistry } from './registry.js';
import type { RuntimeStore } from './runtime-store.js';
import type { ResourceScope } from './resources/ResourceScope.js';
import type { CapabilityToken } from './capabilities/token.js';

export type RuntimePhase = 'boot' | 'loading' | 'ready' | 'transition' | 'paused' | 'error';

export type LifecycleState =
  | 'created'
  | 'starting'
  | 'running'
  | 'paused'
  | 'failed'
  | 'disposing'
  | 'disposed';

export interface LifecycleSnapshot {
  readonly state: LifecycleState;
  readonly reason?: string;
  readonly revision: number;
  readonly updatedAt: number;
}

export type LifecycleListener = (snapshot: LifecycleSnapshot) => void;

export interface RuntimeSnapshot {
  phase: RuntimePhase;
  reason?: string;
  updatedAt: number;
}

export interface FrameInfo {
  timeMs: number;
  deltaMs: number;
  deltaSeconds: number;
  frame: number;
}

export type RuntimeStateListener = (next: RuntimeSnapshot, previous: RuntimeSnapshot) => void;
export type FrameCallback = (frame: FrameInfo) => void;
export type FrameMode = 'continuous' | 'auto';
export type AdapterStartup = 'sequential' | 'parallel';

export interface FrameScheduler {
  start(callback: FrameCallback): void;
  stop(): void;
  isRunning(): boolean;
}

export interface KernelEvent {
  type: string;
  timestamp: number;
  source: string;
  payload?: unknown;
}

export interface RuntimeContext {
  id: string;
  state: RuntimeStore;
  adapters: AdapterRegistry;
  controllers: ControllerRegistry;
  services: ServiceRegistry;
  events: EventBus<KernelEvent>;
  scheduler: FrameScheduler;
  signal: AbortSignal;
  scope: ResourceScope;
  getLifecycleSnapshot(): LifecycleSnapshot;
  subscribeLifecycle(listener: LifecycleListener): () => void;
  /** Request frames until released. Runs before controller updates, in registration order. */
  registerFrameWork(callback: FrameCallback): () => void;
  get<TValue = unknown>(key: string | CapabilityToken<TValue>): TValue | undefined;
  require<TValue = unknown>(key: string | CapabilityToken<TValue>): TValue;
}

export interface AdapterRegistration<TApi> {
  id: string;
  capability: string;
  token?: CapabilityToken<TApi>;
  dependsOn?: Array<string | CapabilityToken<unknown>>;
  isSupported?: (ctx: RuntimeContext) => boolean;
  setup(ctx: RuntimeContext): Promise<TApi> | TApi;
  dispose?(ctx: RuntimeContext, api: TApi): Promise<void> | void;
}

export interface ControllerRegistration {
  id: string;
  init?(ctx: RuntimeContext): Promise<void> | void;
  start?(ctx: RuntimeContext): Promise<void> | void;
  update?(frame: FrameInfo, ctx: RuntimeContext): void;
  onStateChange?(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx: RuntimeContext): Promise<void> | void;
  dispose?(ctx: RuntimeContext): Promise<void> | void;
}

export interface KernelConfig {
  id?: string;
  scheduler?: FrameScheduler;
  frameMode?: FrameMode;
  adapterStartup?: AdapterStartup;
  services?: Record<string, unknown>;
  serviceBindings?: Array<{ token: CapabilityToken<unknown>; value: unknown }>;
  adapters?: Array<AdapterRegistration<unknown>>;
  controllers?: ControllerRegistration[];
}
