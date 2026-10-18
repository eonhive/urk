/**
 * Company: EonHive Inc.
 * Title: UI Overlay Contracts
 * Purpose: Define owned overlay handles and serializable observation.
 * Author: Stan Nesi
 * Created: 2026-10-15
 * Updated: 2026-10-15
 * Notes: Vibe coded with Codex.
 */

export type UiOverlayPlacement = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
export type UiOverlayTone = 'neutral' | 'active' | 'selected';

export interface UiOverlayContent {
  status: { message: string; progress?: number | null };
  callout: { title: string; body: string; tone?: UiOverlayTone };
  panel: { title: string; mount(container: HTMLElement): void | (() => void) };
}

export type UiOverlayKind = keyof UiOverlayContent;
export type UiOverlayOptions<K extends UiOverlayKind = UiOverlayKind> = {
  [P in K]: { id: string; kind: P; placement?: UiOverlayPlacement } & UiOverlayContent[P];
}[K];
export type UiOverlayUpdate<K extends UiOverlayKind> =
  Partial<Omit<UiOverlayContent[K], 'mount'>> & { placement?: UiOverlayPlacement };

export interface UiOverlayHandle<K extends UiOverlayKind = UiOverlayKind> {
  readonly id: string;
  readonly closed: boolean;
  update(patch: UiOverlayUpdate<K>): void;
  close(): void;
}

export type UiOverlayState = {
  [K in UiOverlayKind]: Readonly<{ id: string; kind: K; placement: UiOverlayPlacement } &
    Omit<UiOverlayContent[K], 'mount'>>;
}[UiOverlayKind];

export interface UiOverlaySnapshot {
  readonly revision: number;
  readonly destroyed: boolean;
  readonly overlays: readonly UiOverlayState[];
}

export interface UiOverlayManagerApi {
  open<K extends UiOverlayKind>(options: UiOverlayOptions<K>): UiOverlayHandle<K>;
  getSnapshot(): UiOverlaySnapshot;
  subscribe(listener: () => void): () => void;
}
