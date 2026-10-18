/**
 * Company: EonHive Inc.
 * Title: UI Overlay Adapter Exports
 * Purpose: Name the existing overlay capability without duplicating its identity.
 * Author: Stan Nesi
 * Created: 2026-10-12
 * Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

export * from '../ui-widgets/index.js';
export * from './types.js';
export {
  createUiWidgetsAdapter as createUiOverlayAdapter,
  UiWidgetsCapability as UiOverlayCapability,
  type UiWidgetsAdapterApi as UiOverlayAdapterApi,
  type UiWidgetCallout as UiOverlayCallout,
} from '../ui-widgets/index.js';
