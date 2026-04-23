/**
 * Event bus for runtime event routing.
 */

export type EventListener<TEvent> = (event: TEvent) => void;

export class EventBus<TEvent extends { type: string }> {
  private listeners: Map<string, Set<EventListener<TEvent>>> = new Map();

  on(eventType: string, listener: EventListener<TEvent>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)?.add(listener);

    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  once(eventType: string, listener: EventListener<TEvent>): () => void {
    const unsubscribe = this.on(eventType, (event) => {
      unsubscribe();
      listener(event);
    });

    return unsubscribe;
  }

  emit(event: TEvent): void {
    const listeners = this.listeners.get(event.type);

    if (!listeners) {
      return;
    }

    for (const listener of [...listeners]) {
      listener(event);
    }
  }

  clear(eventType?: string): void {
    if (eventType) {
      this.listeners.delete(eventType);
      return;
    }

    this.listeners.clear();
  }
}
