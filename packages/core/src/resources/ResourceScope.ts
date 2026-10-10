/**
 * Company: EonHive Inc.
 * Title: Resource Scope
 * Purpose: Track owned acquisitions and complete their cleanup once in reverse order.
 * Author: Stan Nesi
 * Created: 2026-10-03
 * Updated: 2026-10-03
 * Notes: Vibe coded with Codex.
 */

type ResourceCleanup = () => void | Promise<void>;

export class CleanupError extends Error {
  readonly errors: readonly unknown[];

  constructor(errors: readonly unknown[], message = 'Resource cleanup failed') {
    super(message);
    this.name = 'CleanupError';
    this.errors = Object.freeze(errors.flatMap((error) =>
      error instanceof CleanupError ? error.errors : [error],
    ));
  }
}

export class ResourceScope {
  private readonly cleanups: ResourceCleanup[] = [];
  private disposePromise: Promise<void> | null = null;

  defer(cleanup: ResourceCleanup): void {
    if (this.disposePromise) {
      throw new Error('Cannot register cleanup after resource scope disposal begins.');
    }

    this.cleanups.push(cleanup);
  }

  dispose(): Promise<void> {
    if (!this.disposePromise) {
      // Publish completion before running callbacks so reentrant disposal shares it.
      this.disposePromise = Promise.resolve().then(() => this.disposeResources());
    }

    return this.disposePromise;
  }

  private async disposeResources(): Promise<void> {
    const errors: unknown[] = [];

    while (this.cleanups.length > 0) {
      const cleanup = this.cleanups.pop()!;

      try {
        await cleanup();
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new CleanupError(errors);
    }
  }
}
