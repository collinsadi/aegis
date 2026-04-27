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

// Gateway — publish and rotate ML-DSA public keys on the CCIP-Read gateway
export { AegisGateway } from "./gateway";
export type { GatewayRegistrationResult } from "./gateway";

// Oracle — quantum threat monitoring and autonomous ECDSA deprecation
export { QuantumOracle } from "./oracle";
export type { ThreatLevel, ThreatFactor } from "./oracle";

// 0G-powered oracle extension — AI threat scoring via 0G Compute (TEE-verified)
export { ZeroGQuantumOracle } from "./zerogOracle";

// Config — ENS constants exported for consumers who need them
export { ENS_CONFIG } from "../../config/ens.config";
