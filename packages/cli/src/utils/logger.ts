/**
 * Company: EonHive Inc.
 * Title: CLI Logger Helpers
 * Purpose: Provide plain console logging helpers for the first lightweight URK CLI slice.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

/**
 * Print a neutral informational message for normal CLI progress updates.
 */
export function info(message: string): void {
  console.log(`[info] ${message}`);
}

/**
 * Print a positive completion message without introducing color or formatting dependencies.
 */
export function success(message: string): void {
  console.log(`[success] ${message}`);
}

/**
 * Print a warning message for non-fatal CLI situations.
 */
export function warn(message: string): void {
  console.warn(`[warn] ${message}`);
}

/**
 * Print an error message for fatal or blocking CLI situations.
 */
export function error(message: string): void {
  console.error(`[error] ${message}`);
}
