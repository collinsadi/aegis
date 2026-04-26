import { ethers } from "ethers";
import { prisma } from "../db/pool";

export interface KeyRecord {
  node:         string;
  publicKey:    Buffer;
  pubKeyHash:   string;
  registeredAt: number;
  agentLabel:   string;
}

class KeyStoreService {
  async init(): Promise<void> {
    await prisma.$connect();
    const count = await prisma.publicKey.count();
    console.log(`[KeyStore] Prisma connected — ${count} key(s) in database`);
  }

  async set(node: string, publicKey: Buffer, agentLabel: string): Promise<void> {
    if (publicKey.length !== 1952) {
      throw new Error(`Invalid public key length: ${publicKey.length}. Expected 1952 bytes.`);
    }
    const key        = node.toLowerCase();
    const pubKeyHash = ethers.keccak256(publicKey);

    await prisma.publicKey.upsert({
      where:  { node: key },
      create: { node: key, agentLabel, publicKey, pubKeyHash },
      update: { agentLabel, publicKey, pubKeyHash },
    });

    console.log(`[KeyStore] Registered: ${agentLabel}  (node: ${key.slice(0, 10)}…)`);
  }

  async get(node: string): Promise<KeyRecord | undefined> {
    const row = await prisma.publicKey.findUnique({ where: { node: node.toLowerCase() } });
    return row ? this._map(row) : undefined;
  }

  async has(node: string): Promise<boolean> {
    const count = await prisma.publicKey.count({ where: { node: node.toLowerCase() } });
    return count > 0;
  }

  async list(): Promise<KeyRecord[]> {
    const rows = await prisma.publicKey.findMany({ orderBy: { registeredAt: "desc" } });
    return rows.map(r => this._map(r));
  }

  async count(): Promise<number> {
    return prisma.publicKey.count();
  }

  private _map(row: { node: string; agentLabel: string; publicKey: Buffer; pubKeyHash: string; registeredAt: Date }): KeyRecord {
    return {
      node:         row.node,
      publicKey:    Buffer.from(row.publicKey),
      pubKeyHash:   row.pubKeyHash,
      registeredAt: Math.floor(row.registeredAt.getTime() / 1000),
      agentLabel:   row.agentLabel,
    };
  }
}

export const KeyStore = new KeyStoreService();
