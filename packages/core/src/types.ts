/**
 * Core type definitions for URK runtime.
 */

import type { EventBus } from './events';
import type { AdapterRegistry, ControllerRegistry, ServiceRegistry } from './registry';
import type { RuntimeStore } from './runtime-store';

export type RuntimePhase = 'boot' | 'loading' | 'ready' | 'transition' | 'paused' | 'error';

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
}

export interface AdapterRegistration<TApi> {
  id: string;
  capability: string;
  dependsOn?: string[];
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
  services?: Record<string, unknown>;
  adapters?: Array<AdapterRegistration<unknown>>;
  controllers?: ControllerRegistration[];
}
