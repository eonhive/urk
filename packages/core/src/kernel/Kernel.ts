/**
 * Company: EonHive Inc.
 * Title: Kernel
 * Purpose: Provide the canonical URK kernel entrypoint and lifecycle.
 * Author: Stan Nesi
 * Created: 2026-04-12
 * Updated: 2026-04-12
 * Notes: Vibe coded with Codex.
 */

import { EventBus } from '../events/EventBus.js';
import { AdapterRegistry } from '../adapters/AdapterRegistry.js';
import { ControllerRegistry } from '../controllers/ControllerRegistry.js';
import { ServiceRegistry } from '../runtime/ServiceRegistry.js';
import { createRuntimeInspector } from '../runtime/RuntimeInspector.js';
import { RuntimeStore } from '../runtime/RuntimeStore.js';
import { BrowserFrameScheduler } from '../scheduler/BrowserFrameScheduler.js';
import { CleanupError, ResourceScope } from '../resources/ResourceScope.js';
import { LifecycleStore } from '../lifecycle/LifecycleStore.js';
import { planAdapters } from '../adapters/planAdapters.js';
import type { CapabilityToken } from '../capabilities/token.js';
import type {
  AdapterRegistration,
  AdapterStartup,
  ControllerRegistration,
  FrameInfo,
  FrameMode,
  KernelConfig,
  KernelEvent,
  LifecycleListener,
  LifecycleSnapshot,
  RuntimeContext,
  RuntimePhase,
  RuntimeSnapshot,
} from '../types.js';
import type { RuntimeInspector } from '../runtime/RuntimeInspector.js';

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
  private readonly lifecycle = new LifecycleStore();
  private readonly ctx: RuntimeContext;
  private readonly inspector: ReturnType<typeof createRuntimeInspector>;
  private readonly initialAdapters: Array<AdapterRegistration<unknown>>;
  private readonly initialControllers: ControllerRegistration[];
  private readonly unsubscribeState: () => void;
  private booted = false;
  private bootPromise: Promise<void> | null = null;
  private startupFailure?: { error: unknown };
  private shutdownPromise: Promise<void> | null = null;
  private readonly cancellation = new AbortController();
  private readonly shutdownErrors: unknown[] = [];
  private cleanupErrors: readonly unknown[] = Object.freeze([]);
  private frameCount = 0;
  private resumePhase: RuntimePhase = 'ready';
  private readonly frameMode: FrameMode;
  private readonly adapterStartup: AdapterStartup;
  private phaseCleanup: Promise<void> = Promise.resolve();

  private get disposed(): boolean {
    const state = this.lifecycle.getSnapshot().state;
    return state === 'disposing' || state === 'disposed';
  }

  constructor(config: KernelConfig = {}) {
    const state = new RuntimeStore('boot');
    const events = new EventBus<KernelEvent>();
    const scheduler = config.scheduler ?? new BrowserFrameScheduler();
    this.frameMode = config.frameMode ?? 'continuous';
    this.adapterStartup = config.adapterStartup ?? 'sequential';
    const reservedTokens = new Set<symbol>();
    const assertKernelActive = (): void => this.assertActive();
    const adapters = new AdapterRegistry(reservedTokens, assertKernelActive, error => {
      if (this.lifecycle.getSnapshot().state !== 'starting') return;
      // Signal sibling work before failed setup starts its potentially async cleanup.
      this.startupFailure = { error };
      this.fail(error, 'runtime:boot');
      void this.shutdown('runtime:boot').catch(() => {});
    });
    const services = new ServiceRegistry(reservedTokens, assertKernelActive);
    const get = <TValue>(key: string | CapabilityToken<TValue>): TValue | undefined => {
      const adapter = adapters.get(key);
      const service = services.get(key);
      if (adapter !== undefined && service !== undefined) {
        const name = typeof key === 'string' ? key : key.name;
        throw new Error(`Ambiguous capability: ${name}. Use the adapter or service registry explicitly.`);
      }
      return adapter !== undefined ? adapter : service;
    };

    this.ctx = {
      id: config.id ?? createKernelId(),
      state,
      adapters,
      controllers: new ControllerRegistry(() => this.syncFrames(), assertKernelActive),
      services,
      get,
      require: (key) => {
        const value = get(key);
        if (value === undefined) {
          const name = typeof key === 'string' ? key : key.name;
          throw new Error(`Missing required capability: ${name}`);
        }
        return value;
      },
      events,
      scheduler: {
        start: (callback) => { this.assertActive(); scheduler.start(callback); },
        stop: () => scheduler.stop(),
        isRunning: () => scheduler.isRunning(),
      },
      signal: this.cancellation.signal,
      scope: new ResourceScope(),
    };
    this.inspector = createRuntimeInspector(this.ctx, () => ({
      booted: this.booted,
      disposed: this.disposed,
      schedulerRunning: this.ctx.scheduler.isRunning(),
      frameCount: this.frameCount,
    }));

    this.initialAdapters = [...(config.adapters ?? [])];
    this.initialControllers = [...(config.controllers ?? [])];
    this.unsubscribeState = state.subscribe((next, previous) => {
      if (next.phase !== 'paused') {
        this.resumePhase = next.phase;
      }

      return this.handleStateChange(next, previous);
    });

    for (const [name, value] of Object.entries(config.services ?? {})) {
      this.ctx.services.register(name, value);
      this.emit('service:registered', { name }, 'kernel');
    }
    for (const { token, value } of config.serviceBindings ?? []) this.registerService(token, value);
  }

  getContext(): RuntimeContext {
    return this.ctx;
  }

  getState(): RuntimeSnapshot {
    return this.ctx.state.getSnapshot();
  }

  getLifecycleSnapshot(): LifecycleSnapshot {
    return this.lifecycle.getSnapshot();
  }

  subscribeLifecycle(listener: LifecycleListener): () => void {
    return this.lifecycle.subscribe(listener);
  }

  getEventBus(): EventBus<KernelEvent> {
    return this.ctx.events;
  }

  getInspector(): RuntimeInspector {
    return this.inspector;
  }

  getCleanupErrors(): readonly unknown[] {
    return this.cleanupErrors;
  }

  async registerAdapter<TApi>(registration: AdapterRegistration<TApi>): Promise<TApi> {
    this.assertActive();
    const { id, capability } = registration;

    const api = await this.ctx.adapters.register(registration, this.ctx);
    this.assertActive();
    this.emit(
      'adapter:registered',
      { id, capability },
      id,
    );

    return api;
  }

  registerService<TValue>(key: string | CapabilityToken<TValue>, value: TValue): TValue {
    this.assertActive();

    const name = typeof key === 'string' ? key : key.name;
    const service = this.ctx.services.register(key, value);
    this.emit('service:registered', { name }, 'kernel');

    return service;
  }

  async registerController(registration: ControllerRegistration): Promise<void> {
    this.assertActive();
    const { id } = registration;

    this.ctx.controllers.register(registration);
    this.emit('controller:registered', { id }, id);

    if (this.booted) {
      try {
        await this.ctx.controllers.startOne(id, this.ctx);
        this.assertActive();
        this.publishInspector();
      } catch (error) {
        await this.rollback(error, 'controller:start');
        throw error;
      }
    }
  }

  boot(): Promise<void> {
    try {
      this.assertActive();
    } catch (error) {
      return Promise.reject(error);
    }

    if (this.bootPromise) {
      return this.bootPromise;
    }

    // Defer user hooks until every concurrent/reentrant caller can see this operation.
    this.bootPromise = Promise.resolve().then(async () => {
      try {
        await this.doBoot();
      } catch (error) {
        const failure = this.startupFailure ? this.startupFailure.error : error;
        await this.rollback(failure, 'runtime:boot');
        throw failure;
      }
    });
    this.lifecycle.transition('starting', 'kernel:boot');
    return this.bootPromise;
  }

  pause(reason = 'kernel:pause'): void {
    this.assertBooted();

    if (this.lifecycle.getSnapshot().state === 'paused') {
      return;
    }

    const snapshot = this.ctx.state.getSnapshot();
    // Application phases can change independently of operational pause/resume.
    if (snapshot.phase !== 'paused') {
      this.resumePhase = snapshot.phase === 'boot' ? 'ready' : snapshot.phase;
    }
    this.lifecycle.commit('paused', reason);
    try {
      this.ctx.scheduler.stop();
      this.ctx.state.setPhase('paused', reason);
      this.emit('runtime:paused', { resumePhase: this.resumePhase }, 'kernel');
    } finally {
      this.lifecycle.publish();
    }
  }

  resume(reason = 'kernel:resume'): void {
    this.assertBooted();

    if (this.lifecycle.getSnapshot().state !== 'paused') {
      return;
    }

    this.lifecycle.commit('running', reason);

    const nextPhase =
      this.resumePhase === 'boot' || this.resumePhase === 'paused'
        ? 'ready'
        : this.resumePhase;

    try {
      this.syncFrames();
      this.ctx.state.setPhase(nextPhase, reason);
      this.emit('runtime:resumed', { phase: nextPhase }, 'kernel');
    } finally {
      this.lifecycle.publish();
    }
  }

  shutdown(reason = 'kernel:shutdown'): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    // Install completion before abort/stop callbacks can request shutdown again.
    this.shutdownPromise = Promise.resolve().then(() => this.doShutdown(reason));
    this.lifecycle.commit('disposing', reason);
    this.ctx.controllers.beginShutdown();
    this.ctx.adapters.beginShutdown();
    this.ctx.services.beginShutdown();
    this.phaseCleanup = this.ctx.state.cancelTransitions(new Error('Cannot transition a disposed kernel.'));
    this.unsubscribeState();
    // Abort listeners must already see disposal intent; publish after frames stop.
    this.cancellation.abort();

    try {
      this.ctx.scheduler.stop();
    } catch (error) {
      this.recordCleanupError(error);
    }

    this.lifecycle.publish();
    return this.shutdownPromise;
  }

  private async doShutdown(reason: string): Promise<void> {
    await this.phaseCleanup;
    try {
      await this.ctx.controllers.disposeAll(this.ctx);
    } catch (error) {
      this.recordCleanupError(error);
      this.reportError(error, 'controllers');
    }

    try {
      await this.ctx.adapters.disposeAll(this.ctx);
    } catch (error) {
      this.recordCleanupError(error);
      this.reportError(error, 'adapters');
    }

    try {
      await this.ctx.scope.dispose();
    } catch (error) {
      this.recordCleanupError(error);
      this.reportError(error, 'kernel:scope');
    }

    this.ctx.services.clear();
    this.cleanupErrors = Object.freeze([...this.shutdownErrors]);
    this.emit('runtime:shutdown', { reason }, 'kernel');
    this.ctx.events.clear();
    this.inspector.dispose();
    this.lifecycle.transition('disposed', reason);

    if (this.cleanupErrors.length > 0) {
      throw new CleanupError(this.cleanupErrors, 'Kernel cleanup failed');
    }
  }

  private async doBoot(): Promise<void> {
    this.assertActive();
    const batches = planAdapters(this.initialAdapters, this.ctx, this.adapterStartup);
    const controllerIds = new Set(this.ctx.controllers.list().map(controller => controller.id));
    for (const { id } of this.initialControllers) {
      if (controllerIds.has(id)) throw new Error(`Controller already registered: ${id}`);
      controllerIds.add(id);
    }
    for (const batch of batches) {
      await Promise.all(batch.map(registration => this.registerAdapter(registration)));
    }

    for (const registration of this.initialControllers) {
      this.assertActive();
      this.ctx.controllers.register(registration);
      this.emit('controller:registered', { id: registration.id }, registration.id);
    }

    await this.ctx.controllers.initializeAll(this.ctx);

    this.assertActive();
    this.ctx.state.setPhase('loading', 'kernel:boot');
    this.assertActive();
    this.emit('runtime:booted', { phase: 'loading' }, 'kernel');

    this.assertActive();
    // Registrations can arrive while an async startup pass settles, even if it was empty.
    // Finish every admitted controller before committing boot completion synchronously.
    do {
      await this.ctx.controllers.startAll(this.ctx);
      this.assertActive();
    } while (this.ctx.controllers.hasPendingStarts());
    this.booted = true;
    this.lifecycle.commit('running', 'kernel:boot');
    this.syncFrames();
    this.assertActive();
    this.lifecycle.publish();
    this.publishInspector();
  }

  private readonly handleFrame = (frame: FrameInfo): void => {
    if (this.lifecycle.getSnapshot().state !== 'running') {
      return;
    }

    try {
      this.frameCount += 1;
      this.ctx.controllers.updateAll(frame, this.ctx);
    } catch (error) {
      this.fail(error, 'runtime:update');
    }
  };

  private syncFrames(): void {
    if (this.lifecycle.getSnapshot().state !== 'running') return;
    if (this.frameMode === 'auto' && this.ctx.controllers.getActiveUpdateCount() === 0) {
      this.ctx.scheduler.stop();
    } else if (!this.ctx.scheduler.isRunning()) {
      this.ctx.scheduler.start(this.handleFrame);
    }
  }

  private async handleStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.emit('runtime:phase-changed', { next, previous }, 'state');

    try {
      await this.ctx.controllers.notifyStateChange(next, previous, this.ctx);
    } catch (error) {
      this.fail(error, 'runtime:state-change');
      throw error;
    }
  }

  private emit(type: string, payload: unknown, source: string): void {
    try {
      this.ctx.events.emit({ type, source, payload, timestamp: Date.now() });
    } catch {
      // Observers cannot own lifecycle completion; do not recursively dispatch their errors.
    }
  }

  private fail(error: unknown, source: string): void {
    if (this.disposed || this.lifecycle.getSnapshot().state === 'failed') {
      return;
    }

    this.lifecycle.commit('failed', source);
    const runtimeError = normalizeError(error, `Runtime failure in ${source}`);
    void this.ctx.state.cancelTransitions(error);

    try {
      this.ctx.scheduler.stop();
    } catch (stopError) {
      this.recordCleanupError(stopError);
    }
    this.lifecycle.publish();
    this.reportError(runtimeError, source);
    try {
      if (this.ctx.state.getSnapshot().phase !== 'error') {
        this.ctx.state.setPhase('error', runtimeError.message);
      }
    } catch {
      // The store commits before notification; failed observers cannot prevent cleanup.
    }
  }

  private async rollback(error: unknown, source: string): Promise<void> {
    this.fail(error, source);
    try {
      await this.shutdown(source);
    } catch {
      // Preserve the initiating failure; cleanup failures remain in getCleanupErrors().
    }
  }

  private reportError(error: unknown, source: string): void {
    const runtimeError = normalizeError(error, `Runtime failure in ${source}`);
    this.emit('runtime:error', { message: runtimeError.message, source }, 'kernel');
  }

  private recordCleanupError(error: unknown): void {
    if (error instanceof CleanupError) {
      this.shutdownErrors.push(...error.errors);
    } else {
      this.shutdownErrors.push(error);
    }
  }

  private publishInspector(): void {
    try {
      this.inspector.publish();
    } catch {
      // Diagnostics are observers, not controller failures.
    }
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new Error('Cannot use a disposed kernel.');
    }
    if (this.lifecycle.getSnapshot().state === 'failed') {
      throw new Error('Cannot restart a failed kernel. Create a fresh kernel.');
    }
  }

  private assertBooted(): void {
    this.assertActive();

    if (!this.booted) {
      throw new Error('Kernel has not been booted yet.');
    }
  }
}
