/**
 * Company: EonHive Inc.
 * Title: Capability Tokens
 * Purpose: Identify adapter contracts independently of display names and infer their API types.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

declare const capabilityType: unique symbol;

export interface CapabilityToken<TApi> {
  readonly key: symbol;
  readonly name: string;
  // A declaration-only brand carries the API type without retaining an API value.
  readonly [capabilityType]: TApi;
}

export function token<TApi>(name: string): CapabilityToken<TApi> {
  return Object.freeze({ key: Symbol(name), name }) as CapabilityToken<TApi>;
}
