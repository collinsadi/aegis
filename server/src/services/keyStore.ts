/**
 * keyStore.ts
 * ===========
 * In-memory key store for the CCIP-Read gateway.
 *
 * Stores full ML-DSA public keys indexed by ENS node hash.
 * In production this would be backed by a database or IPFS.
 * For the hackathon demo, keys are stored in memory and persist
 * for the lifetime of the server process.
 *
 * API:
 *   KeyStore.set(node, publicKey, agentLabel)  — store a key
 *   KeyStore.get(node)                          — retrieve a key
 *   KeyStore.has(node)                          — check existence
 *   KeyStore.list()                             — all registered nodes
 */

import { ethers } from "ethers";

interface KeyRecord {
  node:          string;   // ENS namehash hex string
  publicKey:     Buffer;   // full 1952-byte ML-DSA public key
  pubKeyHash:    string;   // keccak256(publicKey) — used for verification
  registeredAt:  number;   // unix timestamp
  agentLabel:    string;   // human-readable label e.g. "alice"
}

class KeyStoreService {
  private store = new Map<string, KeyRecord>();

  /**
   * Store a public key for a node.
   * @param node       ENS namehash of the agent subdomain (hex string with 0x prefix)
   * @param publicKey  Buffer of exactly 1952 bytes (ML-DSA-65 public key)
   * @param agentLabel Human-readable label for logging
   */
  set(node: string, publicKey: Buffer, agentLabel: string): void {
    if (publicKey.length !== 1952) {
      throw new Error(`Invalid public key length: ${publicKey.length}. Expected 1952 bytes.`);
    }
    const pubKeyHash = ethers.keccak256(publicKey);
    this.store.set(node.toLowerCase(), {
      node:         node.toLowerCase(),
      publicKey,
      pubKeyHash,
      registeredAt: Math.floor(Date.now() / 1000),
      agentLabel,
    });
    console.log(`[KeyStore] Registered: ${agentLabel}  (node: ${node.slice(0, 10)}…)`);
  }

  get(node: string): KeyRecord | undefined {
    return this.store.get(node.toLowerCase());
  }

  has(node: string): boolean {
    return this.store.has(node.toLowerCase());
  }

  list(): KeyRecord[] {
    return Array.from(this.store.values());
  }

  count(): number {
    return this.store.size;
  }
}

export const KeyStore = new KeyStoreService();
