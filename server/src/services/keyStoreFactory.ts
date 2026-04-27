/**
 * keyStoreFactory.ts
 * ==================
 * Returns the active key store implementation based on the 0G integration flag.
 * Import activeKeyStore throughout the server instead of KeyStore directly.
 */

import { INTEGRATIONS } from "../config/integrations";
import { KeyStore } from "./keyStore";
import { ZeroGKeyStore } from "./zerogKeyStore";

// Unified interface both implementations satisfy
export interface IKeyStore {
  set(node: string, publicKey: Buffer, agentLabel: string): Promise<void> | void;
  get(node: string): Promise<any | undefined> | any | undefined;
  has(node: string): boolean | Promise<boolean>;
  list(): any[] | Promise<any[]>;
  count(): number | Promise<number>;
}

function createKeyStore(): IKeyStore {
  if (INTEGRATIONS.ZERO_G.ENABLED) {
    if (!INTEGRATIONS.ZERO_G.PRIVATE_KEY) {
      console.warn("[0G] ENABLE_ZERO_G=true but ZERO_G_PRIVATE_KEY is not set. Falling back to in-memory store.");
      return KeyStore;
    }
    return new ZeroGKeyStore();
  }
  return KeyStore;
}

export const activeKeyStore = createKeyStore();
