```
 ██████╗ ██╗  ██╗ █████╗ ███████╗ ██████╗ ██╗███████╗    ███████╗██████╗ ██╗  ██╗
██╔═████╗╚██╗██╔╝██╔══██╗██╔════╝██╔════╝ ██║██╔════╝    ██╔════╝██╔══██╗██║ ██╔╝
██║██╔██║ ╚███╔╝ ███████║█████╗  ██║  ███╗██║███████╗    ███████╗██║  ██║█████╔╝
████╔╝██║ ██╔██╗ ██╔══██║██╔══╝  ██║   ██║██║╚════██║    ╚════██║██║  ██║██╔═██╗
╚██████╔╝██╔╝ ██╗██║  ██║███████╗╚██████╔╝██║███████║    ███████║██████╔╝██║  ██╗
 ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝    ╚══════╝╚═════╝ ╚═╝  ╚═╝
@0xaegis/sdk
```

Post-quantum agent wallet SDK for Ethereum. ML-DSA signing, Groth16 ZK proof generation, ENS agent identity and discovery.

[![npm](https://img.shields.io/badge/npm-%400xaegis%2Fsdk-red)](https://npmjs.com/package/@0xaegis/sdk)
[![PQ](https://img.shields.io/badge/crypto-ML--DSA%20(NIST%20PQC)-green)]()
[![ZK](https://img.shields.io/badge/proofs-Groth16%2FBN254-blue)]()

---

## Install

```bash
npm install @0xaegis/sdk ethers
```

---

## What's inside

| Export | Description |
|---|---|
| `AegisWallet` | Generates ML-DSA keypairs, signs operations |
| `AegisProver` | Builds Poseidon commitments, generates Groth16 proofs |
| `AegisENS` | ENS registration, resolution, handshake, oracle feed |
| `QuantumOracle` | Threat scoring, autonomous `deprecateECDSA()` |
| `ENS_CONFIG` | All ENS constants (domain names, text record keys) |

---

## Quickstart

```typescript
import { AegisWallet, AegisProver, AegisENS, QuantumOracle } from "@0xaegis/sdk";
import { ethers } from "ethers";

// 1. Spawn an agent wallet
const agent = new AegisWallet("my-agent");
console.log(agent.keyPair.publicKeyHex);   // 1952-byte ML-DSA public key
console.log(agent.publicKeyHash());         // keccak256 of the public key — store this on-chain

// 2. Sign an operation
const message = new TextEncoder().encode("transfer:0xABC...:1000000000000000000:nonce:0");
const signed = agent.sign(message);
console.log(signed.signature.length);       // 3309 bytes

// 3. Generate a ZK proof (compresses the 3309-byte signature for on-chain use)
const prover = await AegisProver.create();
const proof = await prover.prove(signed.signature, message, agent.publicKeyHash());
// proof.commitment  — 32-byte Poseidon commitment
// proof.publicSignals — [commitment, pubKeyHash] as decimal strings

// 4. Format for Solidity verifier
const { pA, pB, pC, pubSignals } = AegisProver.formatProofForSolidity(
  proof.proof,
  proof.publicSignals
);
// Pass pA, pB, pC, commitment to AegisAccount.executeWithZKProof()

// 5. ENS — register and resolve agent identity
const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const ens = new AegisENS(provider, signer);
await ens.init();

await ens.registerAgent("my-agent", "0xYourAegisAccountAddress", agent.publicKeyHash());
await ens.publishProfile("my-agent", {
  capabilities: "trade,escrow",
  endpoint: "https://my-agent.example.com/rpc",
  price: "0.001",
  model: "gpt-4o",
  uptime: "99.5",
});

// 6. Resolve another agent
const record = await ens.resolveAgent("alice");
console.log(record.accountAddress);   // alice's AegisAccount
console.log(record.pubKeyHash);       // alice's PQ key hash, on-chain

// 7. PQ handshake
const { nonce, pubKeyHash, accountAddress } = await ens.initiateHandshake("alice");
// send nonce to alice off-chain, receive aliceSignature + aliceFullPubKey back
// const trusted = await ens.verifyHandshake(nonce, aliceSignature, aliceFullPubKey, pubKeyHash);

// 8. Oracle
const oracle = new QuantumOracle();
oracle.activateFactor("secp256k1_cve_published");
oracle.activateFactor("logical_qubits_above_1000");
console.log(oracle.getThreatScore());   // 60
console.log(oracle.shouldDeprecate());  // false (threshold: 70)

oracle.activateFactor("nist_pqc_fully_deployed");
console.log(oracle.getThreatScore());   // 90
console.log(oracle.shouldDeprecate());  // true
```

---

## AegisWallet

```typescript
const wallet = new AegisWallet(agentId: string)
wallet.keyPair.publicKey        // Uint8Array, 1952 bytes
wallet.keyPair.secretKey        // Uint8Array, 4032 bytes
wallet.keyPair.publicKeyHex     // "0x..." hex string
wallet.sign(message: Uint8Array): SignedOperation
wallet.verify(message: Uint8Array, signature: Uint8Array): boolean
wallet.publicKeyHash(): string  // keccak256 hex, use this on-chain
```

---

## AegisProver

```typescript
const prover = await AegisProver.create()
await prover.prove(signature, message, pubKeyHashHex): ProofOutput
AegisProver.formatProofForSolidity(proof, publicSignals): { pA, pB, pC, pubSignals }
```

Proof generation takes 20–60 seconds on first run (WASM witness generation).

---

## AegisENS

All write methods require a Signer. All read methods work with a Provider only.

```typescript
const ens = new AegisENS(provider, signer?)
await ens.init()                                      // required before write ops
await ens.registerAgent(label, accountAddr, pkHash)   // register alice.0xaegis.eth
await ens.rotateKey(label, newPubKeyHash)              // key rotation
await ens.resolveAgent(label)                          // → { accountAddress, pubKeyHash }
await ens.getAgentProfile(label)                       // → all text records
await ens.publishProfile(label, profile)               // publish capabilities
await ens.publishThreatStatus(score, safe, factors)   // oracle writes threat feed
await ens.readThreatStatus()                           // read threat.0xaegis.eth
await ens.initiateHandshake(counterpartLabel)          // PQ handshake step 1
await ens.verifyHandshake(nonce, sig, pubKey, hash)    // PQ handshake step 2

AegisENS.namehash(name)    // ethers.namehash wrapper
AegisENS.agentName(label)  // "alice" → "alice.0xaegis.eth"
```

---

## QuantumOracle

```typescript
const oracle = new QuantumOracle()
oracle.activateFactor(name: string)           // trigger a threat factor
oracle.getThreatScore(): number               // 0–100
oracle.shouldDeprecate(): boolean             // score >= 70
oracle.getReport(): string                    // human-readable summary
await oracle.deprecateOnChain(addr, signer, abi)  // calls deprecateECDSA()
```

Available threat factors: `nist_pqc_fully_deployed` (30), `logical_qubits_above_1000` (25), `secp256k1_cve_published` (35), `eth_core_dev_warning` (10).

---

## Circuit artifacts

The `circuits/` folder bundled with this package contains:
- `sig_commitment.wasm` — compiled Circom circuit
- `sig_commitment_final.zkey` — Groth16 proving key
- `verification_key.json` — verification key

These are self-contained. The SDK does not reach outside its own package for circuit files.

---

## ENS config

All ENS domain names and text record keys are exported from `ENS_CONFIG`:

```typescript
import { ENS_CONFIG } from "@0xaegis/sdk";

ENS_CONFIG.PARENT_DOMAIN         // "0xaegis.eth"
ENS_CONFIG.THREAT_FEED_DOMAIN    // "threat.0xaegis.eth"
ENS_CONFIG.TEXT_RECORD_KEYS      // { CAPABILITIES, ENDPOINT, PRICE, ... }
ENS_CONFIG.THREAT_RECORD_KEYS    // { SCORE, ECDSA_SAFE, LAST_UPDATED, ... }
```

---

## License

MIT
