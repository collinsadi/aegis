# Aegis

**Post-quantum cryptographic infrastructure for autonomous AI agents on Ethereum.**

Aegis gives AI agents wallets that cannot be broken by quantum computers — with ZK-compressed signatures that make on-chain verification cheap enough to use today.

---

## The problem

AI agents are becoming first-class economic actors on Ethereum. They hold funds, sign transactions, negotiate contracts, and execute onchain operations without human oversight. Every one of those agents uses ECDSA — a signature scheme built on the discrete logarithm problem over elliptic curves.

Shor's algorithm, running on a fault-tolerant quantum computer, solves the discrete logarithm problem in polynomial time. ECDSA does not survive it.

This is not speculative. The National Institute of Standards and Technology finalized three post-quantum cryptographic standards in 2024. Ethereum's core developers have published quantum migration roadmaps. The timeline is uncertain but the outcome is not: ECDSA will be deprecated. The only question is whether the infrastructure that depends on it gets rebuilt before or after the break.

For human wallets, the migration path is manual and well-understood — move funds to a new account, rotate keys. For AI agents, the situation is different. Agents are long-running, often unmonitored processes. Their private keys live in automated environments. They may be executing operations continuously across weeks or months. When a quantum computer breaks secp256k1, an agent cannot identify the threat, rotate its own keys, or pause its operations. It is simply compromised, silently, until someone notices.

Aegis solves this by making agents PQ-native from the ground up.

---

## Why this matters for autonomous AI

The next five years will see AI agents transition from tools that assist humans to entities that act on behalf of humans — managing funds, executing trades, fulfilling contracts, coordinating with other agents, and operating infrastructure. This shift is already underway. ElizaOS, AgentKit, and similar frameworks are shipping agents that hold real funds and execute real transactions today.

Three properties make AI agents uniquely exposed to the quantum threat:

**Long key lifetimes.** A human rotates their wallet keys when they feel like it. An agent rotates its keys when its software tells it to. Agents deployed today may be running the same keypair in five or ten years. Harvest-now-decrypt-later attacks — where an adversary records encrypted traffic today to decrypt once quantum hardware matures — apply directly to agent private keys and signed transaction histories.

**No human in the loop.** When a quantum computer breaks an ECDSA key, the private key is exposed. For a human, there is a moment of discovery and response. For an autonomous agent, the adversary can drain the wallet, impersonate the agent, and sign fraudulent operations indefinitely before anyone notices. The damage surface is proportional to how autonomous the agent is.

**Agent-to-agent trust.** As multi-agent systems grow — agents negotiating with other agents, agents delegating to subagents, agent networks coordinating on shared objectives — the trust model between agents becomes critical infrastructure. If that trust model is built on ECDSA, it is built on a foundation with a known expiry date. A post-quantum agent identity layer needs to be in place before agent-to-agent commerce becomes the norm, not after.

Aegis is that layer. It gives agents PQ keypairs at birth, compresses those signatures into cheap on-chain proofs, and delegates the threat-monitoring and key-rotation problem to an autonomous oracle that operates without human intervention.

---

## How it works

### Post-quantum signing

Aegis uses **ML-DSA (CRYSTALS-Dilithium)**, the NIST-standardized lattice-based signature scheme. ML-DSA is secure against both classical and quantum adversaries. Its security is based on the hardness of the Module Learning With Errors problem, which has no known quantum speedup.

The practical tradeoff is size. An ML-DSA signature is ~3309 bytes. An ECDSA signature is 65 bytes. Putting a raw ML-DSA signature in Ethereum calldata would cost approximately 52,000 gas in calldata alone, before any verification computation. This is the reason nobody has done it yet.

### ZK signature compression

Aegis resolves the gas problem with a Groth16 zero-knowledge circuit. The prover — running off-chain — takes the raw ML-DSA signature as a private input, computes a Poseidon hash commitment, and generates a proof that the commitment was derived from a valid signature under the agent's bound public key.

What hits the chain is not the signature. It is a Groth16 proof: three elliptic curve points, approximately 256 bytes, verified with a single pairing check at roughly 200,000 gas — comparable to what developers pay for ECDSA signature verification today.

The on-chain verifier never sees the raw PQ signature. It sees the proof. The signature stays off-chain. The commitment anchors it.

### Hybrid transition

Aegis accounts support both ECDSA and PQ signatures during the migration period. A flag on each account tracks which modes are active. The quantum oracle can flip that flag — deprecating ECDSA and making the account PQ-only — without any manual intervention from the agent operator.

### The quantum oracle

The oracle is an autonomous agent that monitors quantum computing threat indicators: logical qubit milestones, NIST PQC adoption timelines, secp256k1 vulnerability disclosures, and signals from Ethereum core development. It maintains a weighted threat score. When that score crosses a configurable threshold, it calls `deprecateECDSA()` on registered agent accounts.

No human needs to watch the news and decide when to act. The oracle acts when the evidence says to act.

---

## Architecture

```
Agent spawn
    │
    ▼
AegisWallet (TypeScript SDK)
    ├── Generates ML-DSA keypair (seed → publicKey + secretKey)
    ├── Stores publicKeyHash on-chain at deployment
    └── Signs operations with secretKey
    │
    ▼
AegisProver (TypeScript SDK)
    ├── Splits raw signature into field elements (Poseidon-safe)
    ├── Computes Poseidon commitment off-chain
    └── Generates Groth16 proof via snarkjs + WASM circuit
    │
    ▼
AegisAccount (Solidity, EVM)
    ├── executeWithZKProof() — verifies Groth16 proof, executes operation
    ├── executeWithECDSA()  — hybrid fallback, active until deprecated
    └── deprecateECDSA()    — callable only by registered oracle address
    │
    ▼
Groth16Verifier (Solidity, generated by snarkjs)
    └── verifyProof() — BN254 pairing check, ~200k gas

QuantumOracle (TypeScript)
    ├── Tracks weighted threat factors
    ├── Computes rolling threat score
    └── Calls deprecateECDSA() when score ≥ threshold
```

---

## Competitive landscape

There is no direct competitor building post-quantum wallets for AI agents. The space around Aegis looks like this:

### Agent wallet infrastructure

**Safe, Biconomy, ZeroDev, Alchemy Account Kit** — These are the dominant ERC-4337 smart account providers. They solve key management, gas abstraction, and session keys for human and agent wallets. None of them use post-quantum cryptography. Their validator modules are ECDSA-only. They are building excellent infrastructure on a vulnerable foundation.

**Turnkey, Privy, Lit Protocol** — These handle agent key management: secure key generation, storage, and signing in TEEs or MPC setups. They make ECDSA safer operationally. They do not change the underlying cryptographic assumption. A quantum computer breaks their outputs regardless of how safely those outputs were generated.

### Post-quantum Ethereum research

**EIP-7212** — Adds precompile support for the secp256r1 curve, used in passkeys and hardware enclaves. This is not post-quantum. secp256r1 is broken by Shor's algorithm just as secp256k1 is. It is an improved classical signature scheme, not a quantum-resistant one.

**Vitalik's quantum migration proposals** — Ethereum's co-founder has written extensively about PQ migration paths, including account abstraction as the mechanism for users to migrate their EOAs to PQ-backed accounts. This validates the direction but is a research direction, not a product.

**NIST PQC standards (ML-DSA, Falcon, SPHINCS+)** — These are the cryptographic primitives. Aegis implements one of them (ML-DSA). There is no Ethereum project currently shipping NIST PQC standards in production agent infrastructure.

### ZK signature infrastructure

**zkEmail, zkTLS, Reclaim Protocol** — These projects use ZK proofs to verify signatures from external systems (email providers, TLS handshakes) on-chain. The technique — prove a signature is valid inside a circuit, post only the proof — is structurally similar to what Aegis does for PQ signatures. The application is entirely different. None of them address PQ cryptography.

### The gap

No project sits at the intersection of: post-quantum cryptography + ZK signature compression + AI agent wallet infrastructure. Aegis occupies that intersection. The adjacent projects validate that each component is technically sound and that there is demand for each individually. The combination has not been built.

---

## Stack

| Layer | Technology |
|---|---|
| PQ signature scheme | ML-DSA (CRYSTALS-Dilithium) via `@noble/post-quantum` |
| ZK circuit | Circom 2.1.6 with Poseidon hash from `circomlib` |
| Proof system | Groth16 via `snarkjs` |
| Smart contracts | Solidity 0.8.24 via Hardhat |
| Chain interaction | ethers v6 |
| Trusted setup | Hermez Powers of Tau (14th degree) |

---

## Getting started

### Prerequisites

- Node.js 20+
- `circom` CLI installed globally (`npm install -g circom`)
- Git

### Install

```bash
git clone https://github.com/collinsadi/aegis
cd aegis
npm install
```

### Compile the ZK circuit

This step compiles the Circom circuit, runs the Groth16 trusted setup, and generates the on-chain Solidity verifier. Run it once after cloning.

```bash
# Compile the circuit to R1CS and WASM
circom circuits/sig_commitment.circom --r1cs --wasm --sym -o circuits/

# Download Powers of Tau file
curl -L https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau -o ptau/pot14.ptau

# Run Groth16 trusted setup
npx snarkjs groth16 setup circuits/sig_commitment.r1cs ptau/pot14.ptau circuits/sig_commitment_0000.zkey
npx snarkjs zkey contribute circuits/sig_commitment_0000.zkey circuits/sig_commitment_final.zkey --name="Aegis Dev" -v
npx snarkjs zkey export verificationkey circuits/sig_commitment_final.zkey circuits/verification_key.json

# Generate the Solidity verifier
npx snarkjs zkey export solidityverifier circuits/sig_commitment_final.zkey contracts/verifier/Groth16Verifier.sol
```

### Compile contracts

```bash
npm run compile:contracts
```

### Run the demo

```bash
npm run demo
```

The demo will:
1. Deploy the Groth16 verifier and an AegisAccount on a local Hardhat node
2. Generate an ML-DSA keypair for an agent named `agent-alice`
3. Sign a test operation and generate a Groth16 proof (~20–60 seconds)
4. Verify the proof on-chain and execute the operation
5. Activate the quantum oracle, trigger `deprecateECDSA()`, and confirm ECDSA is rejected

### Run tests

```bash
npx hardhat test
```

---

## Honest limitations

**The ZK circuit is a commitment proof, not a full lattice verifier.** The circuit proves knowledge of a PQ signature that hashes to a known commitment. It does not verify the algebraic structure of the ML-DSA signature inside the circuit. Full in-circuit lattice verification would require hundreds of thousands of R1CS constraints and produce proving times measured in minutes — currently impractical for interactive use. The commitment approach is the correct production architecture for now; it binds an on-chain operation to a specific off-chain PQ signature and makes forging that binding computationally infeasible. Full in-circuit verification is the long-term upgrade path.

**The trusted setup is a dev setup.** The Powers of Tau file used here is the Hermez ceremony, which is appropriate for production use. The phase 2 contribution in the setup instructions is a single-contributor dev setup. A production deployment requires a multi-party ceremony for the phase 2 zkey.

**The oracle uses mock threat factors.** In this MVP the oracle's threat factors are toggled manually. A production oracle would read from on-chain data feeds, cryptographic standards bodies' APIs, and quantum computing progress benchmarks.

---

## Roadmap

- [ ] Full ML-DSA signature verification inside the Groth16 circuit
- [ ] ERC-4337 EntryPoint integration with PQ-native `validateUserOp`
- [ ] Multi-party trusted setup ceremony for the production zkey
- [ ] Oracle with live data feeds (NIST, arXiv, quantum hardware benchmarks)
- [ ] Agent-to-agent PQ credential handshake protocol
- [ ] Falcon-512 support once a stable JS implementation ships
- [ ] EIP draft: standard interface for PQ-validated smart accounts

---

## License

MIT

---

## Built at ETHGlobal