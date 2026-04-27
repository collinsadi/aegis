/**
 * ccip.ts
 * =======
 * CCIP-Read (EIP-3668) gateway routes.
 *
 * When the AegisENSResolver.pubKey(node) function is called on-chain,
 * it reverts with OffchainLookup pointing to this server.
 * The ENS client (ethers.js, viem) catches the revert, calls this endpoint,
 * and passes the response back to AegisENSResolver.pubKeyWithProof().
 *
 * Endpoint: GET /ccip/:sender/:data.json
 *   - sender: the AegisENSResolver contract address
 *   - data:   ABI-encoded bytes containing the ENS node hash
 *
 * Response: ABI-encoded bytes of the full 1952-byte ML-DSA public key
 *
 * Also exposes:
 *   POST /register  — register a public key (called by SDK after agent deploy)
 *   GET  /keys      — list all registered keys (debug)
 *   GET  /health    — liveness check
 */

import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { activeKeyStore as KeyStore } from "../services/keyStoreFactory";
import { verifyKeyAgainstChain } from "../services/onChain";

const router = Router();

// ── Health check ─────────────────────────────────────────────────────────────

router.get("/health", async (_req: Request, res: Response) => {
  const count = await KeyStore.count();
  return res.json({
    status:    "ok",
    gateway:   "Aegis CCIP-Read Gateway",
    timestamp: Math.floor(Date.now() / 1000),
    keys:      count,
  });
});

// ── CCIP-Read endpoint ────────────────────────────────────────────────────────

router.get("/ccip/:sender/:data", async (req: Request, res: Response) => {
  const { sender, data: rawData } = req.params;

  // Remove .json suffix if present (CCIP-Read clients append it)
  const data = rawData.endsWith(".json") ? rawData.slice(0, -5) : rawData;

  console.log(`[CCIP] Request from sender=${sender} data=${data.slice(0, 20)}…`);

  try {
    // The callData is ABI-encoded bytes containing the ENS node
    // abi.encode(bytes32 node) — 32 bytes padded to 64 hex chars
    let node: string;
    try {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["bytes32"], data);
      node = decoded[0] as string;
    } catch {
      const outerDecoded = ethers.AbiCoder.defaultAbiCoder().decode(["bytes"], data);
      const inner = outerDecoded[0] as string;
      const decoded2 = ethers.AbiCoder.defaultAbiCoder().decode(["bytes32"], inner);
      node = decoded2[0] as string;
    }

    console.log(`[CCIP] Looking up node: ${node}`);

    const record = await KeyStore.get(node);
    if (!record) {
      console.warn(`[CCIP] Key not found for node: ${node}`);
      return res.status(404).json({
        error:   "key_not_found",
        node,
        message: "No ML-DSA public key registered for this ENS node. " +
                 "Call POST /register first.",
      });
    }

    // ABI-encode the public key bytes as the gateway response
    // The on-chain callback (pubKeyWithProof) will decode this as:
    //   bytes memory fullPubKey = abi.decode(result, (bytes))
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes"],
      [record.publicKey]
    );

    console.log(`[CCIP] Responding with ${record.publicKey.length}-byte key for ${record.agentLabel}`);

    return res.json({ data: encoded });
  } catch (e: any) {
    console.error(`[CCIP] Error processing request: ${e.message}`);
    return res.status(400).json({
      error:   "decode_error",
      message: e.message,
    });
  }
});

// ── Register endpoint ─────────────────────────────────────────────────────────

router.post("/register", async (req: Request, res: Response) => {
  const { node, publicKeyHex, agentLabel } = req.body;

  if (!node || !publicKeyHex || !agentLabel) {
    return res.status(400).json({
      error:   "missing_fields",
      message: "Required: node (bytes32 hex), publicKeyHex (0x-prefixed hex), agentLabel (string)",
    });
  }

  if (!node.startsWith("0x") || node.length !== 66) {
    return res.status(400).json({
      error:   "invalid_node",
      message: "node must be a 0x-prefixed 32-byte hex string (66 characters total)",
    });
  }

  const keyBuffer = Buffer.from(publicKeyHex.replace("0x", ""), "hex");

  if (keyBuffer.length !== 1952) {
    return res.status(400).json({
      error:   "invalid_key_length",
      message: `Expected 1952-byte ML-DSA-65 public key, got ${keyBuffer.length} bytes.`,
    });
  }

  // Verify the submitted key matches the pubKeyHash stored on-chain.
  // Only the agent that knows the real 1952-byte key can pass this check.
  const check = await verifyKeyAgainstChain(node, keyBuffer);
  if (!check.ok) {
    return res.status(403).json({ error: "verification_failed", message: check.reason });
  }

  try {
    await KeyStore.set(node, keyBuffer, agentLabel);
    const pubKeyHash = ethers.keccak256(keyBuffer);
    return res.json({
      success:   true,
      node,
      agentLabel,
      pubKeyHash,
      keyLength:  keyBuffer.length,
      message:    "Public key registered. CCIP-Read gateway will now serve this key.",
    });
  } catch (e: any) {
    return res.status(500).json({ error: "store_error", message: e.message });
  }
});

// ── List all keys (debug/demo only) ──────────────────────────────────────────

router.get("/keys", async (_req: Request, res: Response) => {
  const records = await KeyStore.list();
  const keys = records.map(r => ({
    node:         r.node,
    agentLabel:   r.agentLabel,
    pubKeyHash:   r.pubKeyHash,
    registeredAt: r.registeredAt,
    keyLength:    r.publicKey.length,
  }));
  res.json({ count: keys.length, keys });
});

export default router;
