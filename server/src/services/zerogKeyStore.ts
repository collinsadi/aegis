/**
 * zerogKeyStore.ts
 * ================
 * 0G Storage-backed implementation of the key store interface.
 * Stores full 1952-byte ML-DSA public keys on the 0G decentralized storage network.
 * Keys survive server restarts — content-addressed by Merkle root, indexed by ENS node.
 *
 * Used only when INTEGRATIONS.ZERO_G.ENABLED === true.
 * Falls back to in-memory KeyStoreService otherwise (see keyStoreFactory.ts).
 */

import { ethers } from "ethers";
import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { INTEGRATIONS } from "../config/integrations";

interface KeyRecord {
  node:         string;
  publicKey:    Buffer;
  pubKeyHash:   string;
  registeredAt: number;
  agentLabel:   string;
  merkleRoot?:  string; // 0G Storage root hash — used to retrieve the key
}

export class ZeroGKeyStore {
  private indexer: Indexer;
  private signer: ethers.Wallet;
  // Local index: ENS node → merkle root (in-memory cache for fast lookup)
  // In production this index itself would also live on 0G Storage or on-chain.
  private rootIndex = new Map<string, string>();
  // Also cache the key in memory after first fetch to avoid repeat downloads
  private cache     = new Map<string, KeyRecord>();

  constructor() {
    const provider = new ethers.JsonRpcProvider(INTEGRATIONS.ZERO_G.STORAGE_RPC);
    this.signer    = new ethers.Wallet(INTEGRATIONS.ZERO_G.PRIVATE_KEY, provider);
    this.indexer   = new Indexer(INTEGRATIONS.ZERO_G.STORAGE_INDEXER);
    console.log("[0G KeyStore] Initialized — keys will be persisted on 0G Storage");
  }

  /**
   * Upload the public key to 0G Storage and index it by ENS node.
   */
  async set(node: string, publicKey: Buffer, agentLabel: string): Promise<void> {
    if (publicKey.length !== 1952) {
      throw new Error(`Invalid ML-DSA key length: ${publicKey.length}. Expected 1952 bytes.`);
    }

    const pubKeyHash = ethers.keccak256(publicKey);
    console.log(`[0G KeyStore] Uploading key for ${agentLabel} to 0G Storage...`);

    // Wrap the key bytes as an in-memory file for the 0G SDK
    const memFile = new MemData(publicKey);

    const [result, uploadErr] = await this.indexer.upload(
      memFile,
      INTEGRATIONS.ZERO_G.STORAGE_RPC,
      this.signer,
      { expectedReplica: 1 }
    );
    if (uploadErr) throw new Error(`0G upload error: ${uploadErr}`);

    // result is the single-file variant since MemData is always a single file
    const merkleRoot = (result as { rootHash: string }).rootHash;

    // Index locally: node → merkleRoot
    this.rootIndex.set(node.toLowerCase(), merkleRoot);

    // Cache the record
    this.cache.set(node.toLowerCase(), {
      node:         node.toLowerCase(),
      publicKey,
      pubKeyHash,
      registeredAt: Math.floor(Date.now() / 1000),
      agentLabel,
      merkleRoot,
    });

    console.log(`[0G KeyStore] Stored: ${agentLabel} | merkleRoot: ${merkleRoot}`);
  }

  /**
   * Retrieve the public key from 0G Storage (or local cache).
   */
  async get(node: string): Promise<KeyRecord | undefined> {
    const key = node.toLowerCase();

    // Return from cache if available
    if (this.cache.has(key)) return this.cache.get(key);

    const merkleRoot = this.rootIndex.get(key);
    if (!merkleRoot) return undefined;

    console.log(`[0G KeyStore] Fetching key from 0G Storage | root: ${merkleRoot}`);

    // Download bytes from 0G Storage
    const [blob, downloadErr] = await this.indexer.downloadToBlob(merkleRoot);
    if (downloadErr || !blob) {
      console.error(`[0G KeyStore] Download error: ${downloadErr}`);
      return undefined;
    }

    const publicKey  = Buffer.from(await blob.arrayBuffer());
    const pubKeyHash = ethers.keccak256(publicKey);

    const record: KeyRecord = {
      node: key,
      publicKey,
      pubKeyHash,
      registeredAt: 0,
      agentLabel:   "unknown",
      merkleRoot,
    };

    this.cache.set(key, record);
    return record;
  }

  has(node: string): boolean {
    return this.rootIndex.has(node.toLowerCase()) || this.cache.has(node.toLowerCase());
  }

  list(): KeyRecord[] {
    return Array.from(this.cache.values());
  }

  count(): number {
    return this.rootIndex.size;
  }
}
