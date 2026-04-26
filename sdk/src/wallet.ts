import { ml_dsa65 } from "@noble/post-quantum/ml-dsa";
import { randomBytes } from "crypto";

// ml_dsa65 is the NIST-standardized post-quantum signature scheme (Dilithium).
// Public key size: 1952 bytes | Secret key size: 4032 bytes | Signature size: 3309 bytes

export interface PQKeyPair {
  publicKey:    Uint8Array;  // 1952 bytes
  secretKey:    Uint8Array;  // 4032 bytes — store securely, never expose
  publicKeyHex: string;      // publicKey as 0x-prefixed hex string
}

export interface SignedOperation {
  message:   Uint8Array;
  signature: Uint8Array;  // 3309 bytes raw ML-DSA signature
  sigHex:    string;      // signature as 0x-prefixed hex string
}

export class AegisWallet {
  public readonly keyPair: PQKeyPair;

  constructor(public readonly agentId: string) {
    const seed    = randomBytes(32);
    const raw     = ml_dsa65.keygen(seed);

    this.keyPair = {
      publicKey:    raw.publicKey,
      secretKey:    raw.secretKey,
      publicKeyHex: "0x" + Buffer.from(raw.publicKey).toString("hex"),
    };
  }

  /**
   * Sign a message with an ML-DSA-65 secret key.
   *
   * By default uses the wallet's own secret key. Pass `secretKey` explicitly
   * when the key is loaded from secure storage rather than held in memory —
   * the recommended pattern for production agents.
   *
   * @param message    Raw bytes to sign (e.g. ABI-encoded operation calldata)
   * @param secretKey  Optional 4032-byte ML-DSA secret key. Defaults to
   *                   `this.keyPair.secretKey` if omitted.
   */
  sign(message: Uint8Array, secretKey?: Uint8Array): SignedOperation {
    const key       = secretKey ?? this.keyPair.secretKey;
    const signature = ml_dsa65.sign(key, message);
    return {
      message,
      signature,
      sigHex: "0x" + Buffer.from(signature).toString("hex"),
    };
  }

  /**
   * Verify a signature against this wallet's public key.
   */
  verify(message: Uint8Array, signature: Uint8Array): boolean {
    return ml_dsa65.verify(this.keyPair.publicKey, message, signature);
  }

  /**
   * keccak256 of the public key — this is what gets stored on-chain.
   */
  publicKeyHash(): string {
    const { keccak256, hexlify } = require("ethers");
    return keccak256(hexlify(this.keyPair.publicKey));
  }
}
