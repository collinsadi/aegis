import { ethers } from "ethers";
import { ENS_CONFIG } from "../../config/ens.config";

export interface GatewayRegistrationResult {
  success:    boolean;
  node:       string;
  agentLabel: string;
  pubKeyHash: string;
  keyLength:  number;
  message:    string;
}

/**
 * AegisGateway
 * ============
 * Client for the Aegis CCIP-Read gateway.
 *
 * The gateway stores the full 1952-byte ML-DSA public keys that
 * AegisENSResolver cannot hold on-chain. Call registerKey() after
 * AegisENS.registerAgent() and rotateKey() after AegisENS.rotateKey().
 *
 * The gateway verifies every submission against the on-chain pubKeyHash
 * before storing — only the agent that knows the real key can register it.
 *
 * Usage:
 *   import { AegisGateway } from "@0xaegis/sdk";
 *
 *   const gateway = new AegisGateway("https://gateway.0xaegis.eth");
 *
 *   // After AegisENS.registerAgent():
 *   await gateway.registerKey("alice", wallet.keyPair.publicKey, "alice-agent");
 *
 *   // After AegisENS.rotateKey():
 *   await gateway.rotateKey("alice", newWallet.keyPair.publicKey, "alice-agent");
 */
export class AegisGateway {
  private readonly url: string;

  /**
   * @param gatewayUrl  Base URL of the Aegis CCIP-Read gateway.
   *                    Example: "https://gateway.0xaegis.eth"
   *                    Trailing slash is stripped automatically.
   */
  constructor(gatewayUrl: string) {
    this.url = gatewayUrl.replace(/\/$/, "");
  }

  /**
   * Publish a new agent's full ML-DSA public key to the gateway.
   *
   * Call this AFTER AegisENS.registerAgent() has confirmed on-chain.
   * The gateway verifies that keccak256(publicKey) matches the on-chain
   * pubKeyHash before storing — no auth token needed.
   *
   * @param label      Agent subdomain label e.g. "alice" → alice.0xaegis.eth
   * @param publicKey  Full 1952-byte ML-DSA-65 public key
   * @param agentLabel Human-readable label for gateway logs (can match label)
   *
   * @throws if the gateway is unreachable, the key length is wrong,
   *         or the key does not match the on-chain pubKeyHash.
   */
  async registerKey(
    label:      string,
    publicKey:  Uint8Array | Buffer,
    agentLabel: string
  ): Promise<GatewayRegistrationResult> {
    const node = this._nodeFor(label);
    return this._post(node, publicKey, agentLabel);
  }

  /**
   * Update the gateway after an on-chain key rotation.
   *
   * Call this AFTER AegisENS.rotateKey() has confirmed on-chain.
   * Until this is called, CCIP-Read will serve the old key (which will
   * fail the on-chain hash check and make the key unresolvable).
   *
   * @param label         Agent subdomain label e.g. "alice"
   * @param newPublicKey  The new 1952-byte ML-DSA-65 public key
   * @param agentLabel    Human-readable label for gateway logs
   */
  async rotateKey(
    label:        string,
    newPublicKey: Uint8Array | Buffer,
    agentLabel:   string
  ): Promise<GatewayRegistrationResult> {
    const node = this._nodeFor(label);
    return this._post(node, newPublicKey, agentLabel);
  }

  /**
   * Check gateway liveness and get the current registered key count.
   */
  async health(): Promise<{ status: string; keys: number; timestamp: number }> {
    const res = await fetch(`${this.url}/health`);
    if (!res.ok) throw new Error(`Gateway health check failed: ${res.status}`);
    return res.json() as Promise<{ status: string; keys: number; timestamp: number }>;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _nodeFor(label: string): string {
    return ethers.namehash(`${label}.${ENS_CONFIG.PARENT_DOMAIN}`);
  }

  private async _post(
    node:       string,
    publicKey:  Uint8Array | Buffer,
    agentLabel: string
  ): Promise<GatewayRegistrationResult> {
    const publicKeyHex = "0x" + Buffer.from(publicKey).toString("hex");

    const res = await fetch(`${this.url}/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ node, publicKeyHex, agentLabel }),
    });

    const body = await res.json() as any;

    if (!res.ok) {
      throw new Error(
        `[AegisGateway] Registration failed (HTTP ${res.status}): ${body.message ?? JSON.stringify(body)}`
      );
    }

    return body as GatewayRegistrationResult;
  }
}
