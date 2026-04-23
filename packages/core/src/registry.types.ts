/**
 * Registry type definitions.
 *
 * Adapters are keyed by capability contract.
 * Controllers are keyed by id.
 * Services are generic service lookups.
 */

import type { AdapterRegistration, ControllerRegistration } from './types';

export interface RegisteredAdapter<TApi = unknown> {
  id: string;
  capability: string;
  api: TApi;
  registration: AdapterRegistration<TApi>;
}

export interface RegisteredController {
  id: string;
  initialized: boolean;
  started: boolean;
  registration: ControllerRegistration;
}

export interface RegisteredService<TValue = unknown> {
  name: string;
  value: TValue;
}
