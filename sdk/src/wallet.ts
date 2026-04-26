import { ml_dsa65 } from "@noble/post-quantum/ml-dsa";
import { randomBytes } from "crypto";

// ml_dsa65 is the NIST-standardized post-quantum signature scheme (Dilithium).
// It is used here instead of raw ECDSA.
// Public key size: 1952 bytes
// Signature size: 3309 bytes

export interface PQKeyPair {
  publicKey: Uint8Array;   // 1952 bytes
  secretKey: Uint8Array;   // 4032 bytes
  publicKeyHex: string;    // publicKey as 0x-prefixed hex string
}

export interface SignedOperation {
  message: Uint8Array;
  signature: Uint8Array;   // 3309 bytes raw Dilithium signature
  sigHex: string;          // signature as 0x-prefixed hex string
}

export class AegisWallet {
  public readonly keyPair: PQKeyPair;

  // agentId is a human-readable label like "agent-alice" or "agent-bob"
  constructor(public readonly agentId: string) {
    // Generate a fresh PQ keypair for this agent
    const seed = randomBytes(32); // 32-byte random seed
    const rawKeyPair = ml_dsa65.keygen(seed);

    this.keyPair = {
      publicKey: rawKeyPair.publicKey,
      secretKey: rawKeyPair.secretKey,
      publicKeyHex: "0x" + Buffer.from(rawKeyPair.publicKey).toString("hex"),
    };
  }

  // sign takes a message as a Uint8Array and returns a SignedOperation.
  // The message should be the raw bytes you want to authenticate —
  // for example, the ABI-encoded calldata of an operation.
  sign(message: Uint8Array): SignedOperation {
    const signature = ml_dsa65.sign(this.keyPair.secretKey, message);
    return {
      message,
      signature,
      sigHex: "0x" + Buffer.from(signature).toString("hex"),
    };
  }

  // verify checks that a signature is valid for a message under this wallet's public key.
  verify(message: Uint8Array, signature: Uint8Array): boolean {
    return ml_dsa65.verify(this.keyPair.publicKey, message, signature);
  }

  // publicKeyHash returns a hex string of the keccak256 hash of the public key.
  // This is what gets stored on-chain in the AegisAccount contract.
  publicKeyHash(): string {
    const { keccak256, hexlify } = require("ethers");
    return keccak256(hexlify(this.keyPair.publicKey));
  }
}
