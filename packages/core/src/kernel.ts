/**
 * Company: EonHive Inc.
 * Title: Kernel
 * Purpose: Provide the canonical URK kernel entrypoint and lifecycle.
 * Author: Stan Nesi
 * Created: 2026-04-12
 * Updated: 2026-04-12
 * Notes: Vibe coded with Codex.
 */

import { EventBus } from './events.js';
import { AdapterRegistry, ControllerRegistry, ServiceRegistry } from './registry.js';
import { RuntimeStore } from './runtime-store.js';
import { BrowserFrameScheduler } from './scheduler.js';
import type {
  AdapterRegistration,
  ControllerRegistration,
  FrameInfo,
  KernelConfig,
  KernelEvent,
  RuntimeContext,
  RuntimePhase,
  RuntimeSnapshot,
} from './types.js';

function createKernelId(): string {
  return `urk-kernel-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallback);
}

export class Kernel {
  private readonly ctx: RuntimeContext;
  private readonly initialAdapters: Array<AdapterRegistration<unknown>>;
  private readonly initialControllers: ControllerRegistration[];
  private readonly unsubscribeState: () => void;
  private booted = false;
  private bootPromise: Promise<void> | null = null;
  private disposed = false;
  private resumePhase: RuntimePhase = 'ready';

  constructor(config: KernelConfig = {}) {
    const state = new RuntimeStore('boot');
    const events = new EventBus<KernelEvent>();

    this.ctx = {
      id: config.id ?? createKernelId(),
      state,
      adapters: new AdapterRegistry(),
      controllers: new ControllerRegistry(),
      services: new ServiceRegistry(),
      events,
      scheduler: config.scheduler ?? new BrowserFrameScheduler(),
    };

    this.initialAdapters = [...(config.adapters ?? [])];
    this.initialControllers = [...(config.controllers ?? [])];
    this.unsubscribeState = state.subscribe((next, previous) => {
      if (next.phase !== 'paused') {
        this.resumePhase = next.phase;
      }

      void this.handleStateChange(next, previous);
    });

    for (const [name, value] of Object.entries(config.services ?? {})) {
      this.ctx.services.register(name, value);
      this.emit('service:registered', { name }, 'kernel');
    }
  }

  getContext(): RuntimeContext {
    return this.ctx;
  }

  getState(): RuntimeSnapshot {
    return this.ctx.state.getSnapshot();
  }

  getEventBus(): EventBus<KernelEvent> {
    return this.ctx.events;
  }

  async registerAdapter<TApi>(registration: AdapterRegistration<TApi>): Promise<TApi> {
    this.assertActive();

    const api = await this.ctx.adapters.register(registration, this.ctx);
    this.emit(
      'adapter:registered',
      { id: registration.id, capability: registration.capability },
      registration.id,
    );

    return api;
  }

  registerService<TValue>(name: string, value: TValue): TValue {
    this.assertActive();

    const service = this.ctx.services.register(name, value);
    this.emit('service:registered', { name }, 'kernel');

    return service;
  }

  async registerController(registration: ControllerRegistration): Promise<void> {
    this.assertActive();

    this.ctx.controllers.register(registration);
    this.emit('controller:registered', { id: registration.id }, registration.id);

    if (this.booted) {
      await this.ctx.controllers.initializeOne(registration.id, this.ctx);
      await this.ctx.controllers.startOne(registration.id, this.ctx);
    }
  }

  async boot(): Promise<void> {
    this.assertActive();

    if (this.booted) {
      return;
    }

    if (this.bootPromise) {
      return this.bootPromise;
    }

    this.bootPromise = this.doBoot();

    try {
      await this.bootPromise;
    } finally {
      this.bootPromise = null;
    }
  }

  pause(reason = 'kernel:pause'): void {
    this.assertBooted();

    const snapshot = this.ctx.state.getSnapshot();

    if (snapshot.phase === 'paused') {
      return;
    }

    this.resumePhase = snapshot.phase === 'boot' ? 'ready' : snapshot.phase;
    this.ctx.scheduler.stop();
    this.ctx.state.setPhase('paused', reason);
    this.emit('runtime:paused', { resumePhase: this.resumePhase }, 'kernel');
  }

  resume(reason = 'kernel:resume'): void {
    this.assertBooted();

    if (this.ctx.state.getSnapshot().phase !== 'paused') {
      return;
    }

    this.ctx.scheduler.start(this.handleFrame);

    const nextPhase =
      this.resumePhase === 'boot' || this.resumePhase === 'paused'
        ? 'ready'
        : this.resumePhase;

    this.ctx.state.setPhase(nextPhase, reason);
    this.emit('runtime:resumed', { phase: nextPhase }, 'kernel');
  }

  async shutdown(reason = 'kernel:shutdown'): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.ctx.scheduler.stop();
    this.unsubscribeState();

    let firstError: Error | null = null;

    try {
      await this.ctx.controllers.disposeAll(this.ctx);
    } catch (error) {
      firstError = normalizeError(error, 'Failed to dispose controllers');
      this.emit('runtime:error', { message: firstError.message, source: 'controllers' }, 'kernel');
    }

    try {
      await this.ctx.adapters.disposeAll(this.ctx);
    } catch (error) {
      if (!firstError) {
        firstError = normalizeError(error, 'Failed to dispose adapters');
      }

      this.emit('runtime:error', { message: firstError.message, source: 'adapters' }, 'kernel');
    }

    this.emit('runtime:shutdown', { reason }, 'kernel');
    this.ctx.events.clear();

    if (firstError) {
      throw firstError;
    }
  }

  private async doBoot(): Promise<void> {
    for (const registration of this.initialAdapters) {
      await this.registerAdapter(registration);
    }

    for (const registration of this.initialControllers) {
      this.ctx.controllers.register(registration);
      this.emit('controller:registered', { id: registration.id }, registration.id);
    }

    await this.ctx.controllers.initializeAll(this.ctx);

    this.booted = true;
    this.ctx.state.setPhase('loading', 'kernel:boot');
    this.emit('runtime:booted', { phase: 'loading' }, 'kernel');

    await this.ctx.controllers.startAll(this.ctx);
    this.ctx.scheduler.start(this.handleFrame);
  }

  private readonly handleFrame = (frame: FrameInfo): void => {
    if (this.disposed) {
      return;
    }

    try {
      this.ctx.controllers.updateAll(frame, this.ctx);
    } catch (error) {
      this.fail(error, 'runtime:update');
    }
  };

  private async handleStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.emit('runtime:phase-changed', { next, previous }, 'state');

    try {
      await this.ctx.controllers.notifyStateChange(next, previous, this.ctx);
    } catch (error) {
      this.fail(error, 'runtime:state-change');
    }
  }

  private emit(type: string, payload: unknown, source: string): void {
    this.ctx.events.emit({
      type,
      source,
      payload,
      timestamp: Date.now(),
    });
  }

  private fail(error: unknown, source: string): void {
    const runtimeError = normalizeError(error, `Runtime failure in ${source}`);

    this.ctx.scheduler.stop();
    this.emit('runtime:error', { message: runtimeError.message, source }, 'kernel');

    if (this.ctx.state.getSnapshot().phase !== 'error') {
      this.ctx.state.setPhase('error', runtimeError.message);
    }
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new Error('Cannot use a disposed kernel.');
    }
  }

  private assertBooted(): void {
    this.assertActive();

    if (!this.booted) {
      throw new Error('Kernel has not been booted yet.');
    }
  }
}

export function createKernel(config: KernelConfig = {}): Kernel {
  return new Kernel(config);
}
