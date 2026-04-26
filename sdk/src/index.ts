/**
 * @0xaegis/sdk
 * ============
 * Post-quantum agent wallet SDK for Ethereum.
 *
 * Usage:
 *   import { AegisWallet, AegisProver, AegisENS, QuantumOracle } from "@0xaegis/sdk"
 */

// Core wallet — key generation and ML-DSA signing
export { AegisWallet } from "./wallet";
export type { PQKeyPair, SignedOperation } from "./wallet";

// ZK prover — Groth16 proof generation and formatting
export { AegisProver, PoseidonHasher } from "./prover";
export type { ProofInput, ProofOutput } from "./prover";

// ENS — agent identity, discovery, oracle feed, and PQ handshake
export { AegisENS } from "./ens";

// Oracle — quantum threat monitoring and autonomous ECDSA deprecation
export { QuantumOracle } from "./oracle";
export type { ThreatLevel, ThreatFactor } from "./oracle";

// Config — ENS constants exported for consumers who need them
export { ENS_CONFIG } from "../../config/ens.config";
