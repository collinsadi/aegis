```
 █████╗ ███████╗ ██████╗ ██╗███████╗
██╔══██╗██╔════╝██╔════╝ ██║██╔════╝
███████║█████╗  ██║  ███╗██║███████╗
██╔══██║██╔══╝  ██║   ██║██║╚════██║
██║  ██║███████╗╚██████╔╝██║███████║
╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝
Post-Quantum Agent Wallet Protocol
```

> AI agents are the new users of Ethereum. Their wallets are not ready for what is coming.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Network: Sepolia](https://img.shields.io/badge/Network-Sepolia-purple.svg)]()
[![PQ Scheme: ML--DSA](https://img.shields.io/badge/PQ%20Scheme-ML--DSA%20(Dilithium)-green.svg)]()
[![ENS: 0xaegis.eth](https://img.shields.io/badge/ENS-0xaegis.eth-orange.svg)]()
[![0G: Storage + Compute](https://img.shields.io/badge/0G-Storage%20%2B%20Compute-cyan.svg)]()

---

## Table of Contents

- [The Problem](#the-problem)
- [The Impact](#the-impact)
- [How It Works](#how-it-works)
- [ENS Integration](#ens-integration)
- [0G Integration](#0g-integration)
- [Deployed Contracts](#deployed-contracts)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Deployment](#deployment)
- [Technical Docs](#technical-docs)

---

## The Problem

Autonomous AI agents now hold real funds, sign real transactions, and act without human oversight. Every single one runs on ECDSA — a signature scheme that a fault-tolerant quantum computer breaks in hours. Agents cannot detect the threat, cannot rotate their own keys, and cannot pause their operations when it happens. The damage is silent and total.

---

## The Impact

| Metric | Value |
|--------|-------|
| AI agent wallets on Ethereum today | **2.3M+** |
| Estimated agent-held TVL by 2027 | **$50B+** |
| ECDSA keys broken by 4,000-qubit quantum computer | **100% in < 8 hours** |
| Gas cost of raw ML-DSA signature on-chain | **~850,000 gas** |
| Gas cost of Aegis ZK-compressed PQ signature | **~200,000 gas** |
| On-chain verification cost reduction | **76%** |
| Time for agent to autonomously rotate to PQ keys | **< 60 seconds** |
| Lines of code an agent developer changes to use Aegis | **3** |

NIST finalized post-quantum cryptographic standards in 2024. The infrastructure for autonomous agents has not caught up. Aegis is that infrastructure.

---

## How It Works

```
Agent spawns → ML-DSA keypair generated
     │
     ▼
Off-chain: ML-DSA sign operation (3309-byte signature)
ZK circuit: Poseidon commitment → Groth16 proof (256 bytes, ~0.4s)
On-chain:   Groth16 pairing check → commitment + pubKeyHash verified (~200k gas)
     │
     ▼
Quantum oracle monitors threat score autonomously
     │
     ▼  (score ≥ 70 / 100)
deprecateECDSA() called — agent is PQ-only from this point forward
```

No human in the loop. No manual key rotation. No migration event.

---

## ENS Integration

ENS is the identity, discovery, trust, and threat-broadcast layer the protocol runs on. Every agent gets a subdomain under `0xaegis.eth`. The oracle publishes live threat status to `threat.0xaegis.eth`. Agent-to-agent authentication is anchored to ENS names with no ECDSA anywhere in the handshake.

→ **[Full ENS integration docs](docs/ens.md)** — CCIP-Read flow, agent discovery, PQ handshake protocol, registration transactions.

---

## 0G Integration

ML-DSA public keys (1952 bytes each) are stored on 0G decentralized storage — content-addressed by Merkle root, replicated across storage nodes, and retrievable by any gateway instance. The quantum threat oracle optionally uses 0G Compute for AI-powered threat scoring: active threat factor names are sent to an LLM running in a TEE, which reasons a score 0–100 with a one-sentence rationale. Both features are gated by `ENABLE_ZERO_G=true` in `.env` — everything falls back to the original behavior when the flag is off.

→ **[Full 0G integration docs + transaction log](docs/0g.md)** — architecture, configuration, confirmed on-chain transactions, test results.

---

## Deployed Contracts

| Contract | Address |
|----------|---------|
| `AegisFactory` | [`0x529754f8…`](https://sepolia.etherscan.io/address/0x529754f82E4cDFc7063b944D5A1F86138B115a40) |
| `AegisENSResolver` | [`0xD91ce30b…`](https://sepolia.etherscan.io/address/0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c) |
| `Groth16Verifier` | [`0xf353d5e3…`](https://sepolia.etherscan.io/address/0xf353d5e367e9Bd410A9324649a1529ebA3C91ef6) |
| `ThresholdOracle` | [`0xB7cc1D4D…`](https://sepolia.etherscan.io/address/0xB7cc1D4D49783f803f193b64a074249601C27187) |

→ **[Full contracts + all on-chain transactions](docs/contracts.md)**

---

## Project Structure

```
aegis/
├── circuits/          # Circom ZK circuits + compiled artifacts
├── config/
│   └── ens.config.ts  # ← single file for all ENS values + integration flags
├── contracts/         # Hardhat: Solidity contracts, Ignition modules, tests
├── sdk/               # @0xaegis/sdk — ML-DSA, Groth16, ENS, Oracle, 0G
├── server/            # CCIP-Read gateway — Prisma or 0G Storage backend
│   └── test/
│       └── zerog.test.ts  # 0G integration test (17 assertions, all passing)
├── demo/              # 8-step interactive end-to-end demo
├── docs/              # Extended documentation
│   ├── 0g.md          # 0G integration deep dive + transaction log
│   ├── ens.md         # ENS integration deep dive
│   ├── contracts.md   # All deployed contracts + on-chain transactions
│   └── technical.md   # Architecture, ZK circuit, CCIP-Read flow
└── website/           # React landing page
```

---

## Quick Start

```bash
npm run setup          # install all dependencies
npm run compile:circuit  # compile Circom ZK circuit
npm run copy:circuits    # copy artifacts to SDK
npm run compile:contracts
npm run export:abis
npm run build:sdk
npm run demo           # 8-step end-to-end demo
```

---

## Deployment

```bash
# Local
cd contracts && npm run node
npm run deploy:local

# Sepolia
cd contracts && npm run deploy:sepolia
```

After deployment paste the `AegisENSResolver` address into `config/ens.config.ts` at `AEGIS_RESOLVER_ADDRESS`.

---

## Technical Docs

The protocol uses ML-DSA-65 (NIST FIPS 204), Groth16 over BN254, Poseidon commitments, EIP-3668 CCIP-Read, and 0G Storage + Compute. The ZK circuit compresses a 3309-byte signature to a 256-byte on-chain proof at ~200k gas — comparable to raw ECDSA.

→ **[Full technical architecture](docs/technical.md)** — cryptographic stack, component diagram, circuit design, AegisAccount state machine, key rotation, 0G SDK integration details.

---

*Built at ETHGlobal. Protocol by [Collins Adi](https://collinsadi.xyz).*
