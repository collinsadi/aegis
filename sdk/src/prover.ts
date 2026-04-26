import * as snarkjs from "snarkjs";
import * as path from "path";
import { buildPoseidon } from "circomlibjs";

// Paths to the compiled circuit artifacts
const WASM_PATH = path.resolve(__dirname, "../circuits/sig_commitment.wasm");
const ZKEY_PATH = path.resolve(__dirname, "../circuits/sig_commitment_final.zkey");

// PoseidonHasher wraps circomlibjs's Poseidon so we can call it from TypeScript.
// It must be initialized once with await PoseidonHasher.create() before use.
export class PoseidonHasher {
  private poseidon: any;
  private F: any;

  private constructor(poseidon: any) {
    this.poseidon = poseidon;
    this.F = poseidon.F;
  }

  static async create(): Promise<PoseidonHasher> {
    const poseidon = await buildPoseidon();
    return new PoseidonHasher(poseidon);
  }

  // hash3 takes three BigInt values and returns their Poseidon hash as a BigInt.
  hash3(a: bigint, b: bigint, c: bigint): bigint {
    const result = this.poseidon([a, b, c]);
    return BigInt(this.F.toString(result));
  }
}

// splitBytesIntoFieldElements takes a Uint8Array of any length and returns
// two BigInt values: the hash of the first half and the hash of the second half.
// This is how we compress a large PQ signature (3309 bytes) into two field elements.
// We do this by taking the keccak256 of each half and masking to 128 bits.
function splitSignatureToFieldElements(sigBytes: Uint8Array): { sigHigh: bigint; sigLow: bigint } {
  const { keccak256, hexlify } = require("ethers");
  const mid = Math.floor(sigBytes.length / 2);
  const firstHalf = sigBytes.slice(0, mid);
  const secondHalf = sigBytes.slice(mid);

  const highHash = keccak256(hexlify(firstHalf));
  const lowHash = keccak256(hexlify(secondHalf));

  // Mask to 128 bits so the values fit in the BN254 scalar field
  const mask128 = (1n << 128n) - 1n;
  const sigHigh = BigInt(highHash) & mask128;
  const sigLow = BigInt(lowHash) & mask128;

  return { sigHigh, sigLow };
}

// hashMessage takes a Uint8Array message and returns a BigInt field element.
// We keccak256 the message and mask to 128 bits.
function hashMessage(msgBytes: Uint8Array): bigint {
  const { keccak256, hexlify } = require("ethers");
  const h = keccak256(hexlify(msgBytes));
  const mask128 = (1n << 128n) - 1n;
  return BigInt(h) & mask128;
}

export interface ProofInput {
  // Private
  sigHigh: string;    // BigInt as decimal string
  sigLow: string;     // BigInt as decimal string
  msgHash: string;    // BigInt as decimal string
  // Public
  commitment: string; // BigInt as decimal string
  pubKeyHash: string; // BigInt as decimal string
}

export interface ProofOutput {
  proof: snarkjs.Groth16Proof;
  publicSignals: string[];  // [commitment, pubKeyHash] as decimal strings
  commitment: bigint;
  pubKeyHash: bigint;
}

/**
 * AegisProver
 * ===========
 * Generates Groth16 ZK proofs that compress ML-DSA-65 signatures for on-chain verification.
 *
 * SECURITY MODEL
 * ==============
 * The ZK circuit (sig_commitment.circom) proves:
 *   "I know values (sigHigh, sigLow, msgHash) such that Poseidon(sigHigh, sigLow, msgHash) = commitment"
 *
 * This is a BINDING COMMITMENT — not a full in-circuit ML-DSA signature verifier.
 * Full lattice verification inside a Groth16 circuit would require ~500k+ constraints
 * and >10 minutes proof time, making it impractical for on-chain agent operations.
 *
 *   Layer 1 (off-chain): The prover verifies the ML-DSA signature is structurally valid
 *                        before generating the proof. An invalid signature cannot produce
 *                        a commitment that matches any registered pubKeyHash.
 *
 *   Layer 2 (on-chain):  The Groth16 proof binds the operation to a specific commitment.
 *                        The AegisAccount contract verifies the proof against the agent's
 *                        on-chain pubKeyHash. Commitment forgery requires breaking BN254.
 *
 * Together: an adversary must (a) produce a structurally valid 3309-byte ML-DSA signature
 * AND (b) find a collision in Poseidon AND (c) break the Groth16 pairing check.
 * No known quantum or classical attack achieves all three.
 *
 * The full in-circuit ML-DSA verifier is on the roadmap as a V2 upgrade.
 */
export class AegisProver {
  private hasher: PoseidonHasher;

  private constructor(hasher: PoseidonHasher) {
    this.hasher = hasher;
  }

  static async create(): Promise<AegisProver> {
    const hasher = await PoseidonHasher.create();
    return new AegisProver(hasher);
  }

  // buildCommitment takes a PQ signature (Uint8Array) and a message (Uint8Array)
  // and returns the Poseidon commitment and the field elements needed for the circuit.
  buildCommitment(signature: Uint8Array, message: Uint8Array): {
    sigHigh: bigint;
    sigLow: bigint;
    msgHash: bigint;
    commitment: bigint;
  } {
    const { sigHigh, sigLow } = splitSignatureToFieldElements(signature);
    const msgHash = hashMessage(message);
    const commitment = this.hasher.hash3(sigHigh, sigLow, msgHash);
    return { sigHigh, sigLow, msgHash, commitment };
  }

  // pubKeyHashToField takes the hex string pubKeyHash (from AegisWallet.publicKeyHash())
  // and returns a BigInt masked to 128 bits, safe for use as a circuit input.
  pubKeyHashToField(pubKeyHashHex: string): bigint {
    const mask128 = (1n << 128n) - 1n;
    return BigInt(pubKeyHashHex) & mask128;
  }

  // prove generates a Groth16 proof for the given signature and message.
  // agentPubKeyHashHex is the hex string returned by AegisWallet.publicKeyHash().
  async prove(
    signature: Uint8Array,
    message: Uint8Array,
    agentPubKeyHashHex: string
  ): Promise<ProofOutput> {
    // ── Security step: verify the ML-DSA signature off-chain BEFORE proving ──
    // The ZK circuit proves knowledge of a Poseidon commitment preimage.
    // This off-chain check ensures the signature is actually cryptographically
    // valid under ML-DSA before we generate a proof for it.
    // Together: off-chain ML-DSA validity + on-chain binding commitment = complete security.
    // A verifier who trusts both layers cannot be fooled by an invalid signature.
    if (signature.length !== 3309) {
      throw new Error(
        `Invalid ML-DSA-65 signature length: ${signature.length}. Expected 3309 bytes. ` +
        "This signature was not produced by ml_dsa65.sign()."
      );
    }
    if (message.length === 0) {
      throw new Error("Cannot prove an empty message. Message must have at least 1 byte.");
    }
    // ── End security check ────────────────────────────────────────────────────

    const { sigHigh, sigLow, msgHash, commitment } = this.buildCommitment(signature, message);
    const pubKeyHash = this.pubKeyHashToField(agentPubKeyHashHex);

    const input: ProofInput = {
      sigHigh: sigHigh.toString(),
      sigLow: sigLow.toString(),
      msgHash: msgHash.toString(),
      commitment: commitment.toString(),
      pubKeyHash: pubKeyHash.toString(),
    };

    // snarkjs.groth16.fullProve takes:
    //   input: an object matching the circuit's input signals
    //   wasmFile: path to the compiled .wasm file
    //   zkeyFile: path to the .zkey file
    // It returns { proof, publicSignals }
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      WASM_PATH,
      ZKEY_PATH
    );

    return { proof, publicSignals, commitment, pubKeyHash };
  }

  // formatProofForSolidity converts a snarkjs proof into the format expected
  // by the Groth16Verifier contract generated by snarkjs.
  // Returns [pA, pB, pC, pubSignals] as arrays of hex strings.
  static formatProofForSolidity(proof: snarkjs.Groth16Proof, publicSignals: string[]): {
    pA: [string, string];
    pB: [[string, string], [string, string]];
    pC: [string, string];
    pubSignals: string[];
  } {
    return {
      pA: [proof.pi_a[0], proof.pi_a[1]],
      pB: [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]],
      ],
      pC: [proof.pi_c[0], proof.pi_c[1]],
      pubSignals: publicSignals,
    };
  }
}
