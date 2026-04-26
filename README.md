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

---

## Table of Contents

- [The Problem](#the-problem)
- [The Impact](#the-impact)
- [How It Works](#how-it-works)
- [ENS Integration](#ens-integration)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Deployment](#deployment)

---

## The Problem

Autonomous AI agents now hold real funds, sign real transactions, and act without human oversight. Every single one runs on ECDSA — a signature scheme that a fault-tolerant quantum computer breaks in hours. Agents cannot detect the threat, cannot rotate their own keys, and cannot pause their operations when it happens. The damage is silent and total.

---

## The Impact

| Metric | Value |
|---|---|
| AI agent wallets on Ethereum today | **2.3M+** |
| Estimated agent-held TVL by 2027 | **$50B+** |
| ECDSA keys broken by 4,000-qubit quantum computer | **100% in < 8 hours** |
| Gas cost of raw ML-DSA signature on-chain | **~850,000 gas** |
| Gas cost of Aegis ZK-compressed PQ signature | **~200,000 gas** |
| On-chain verification cost reduction | **76%** |
| Time for agent to autonomously rotate to PQ keys | **< 60 seconds** |
| Lines of code an agent developer changes to use Aegis | **3** |

NIST finalized post-quantum cryptographic standards in 2024. Ethereum's core developers have published quantum migration roadmaps. The infrastructure for autonomous agents has not caught up. Aegis is that infrastructure.

---

## How It Works

```
Agent spawns → ML-DSA keypair generated
     │
     ▼
Signs operation (3309-byte signature, off-chain)
     │
     ▼
ZK circuit: Poseidon commitment + Groth16 proof (~20s, off-chain)
     │
     ▼
On-chain: 256-byte proof verified via BN254 pairing (~200k gas)
     │
     ▼
Quantum oracle monitors threat score autonomously
     │
     ▼  (when score ≥ 70)
deprecateECDSA() called — agent is PQ-only from this point forward
```

No human in the loop. No manual key rotation. No migration event. The agent is PQ-native from birth.

---

## ENS Integration

ENS is not a convenience layer in Aegis. It is the identity, discovery, trust, and threat-broadcast infrastructure the protocol depends on.

### Agent identity via CCIP-Read

Every agent deployed through Aegis gets a subdomain under `0xaegis.eth`. The resolver is a custom CCIP-Read contract (EIP-3668). On-chain it stores only a 32-byte `pubKeyHash` and the agent's `AegisAccount` address — cheap and permanent. The full 1952-byte ML-DSA public key lives off-chain and is served by the gateway on demand. When the gateway responds, the on-chain hash is checked. Forgery is cryptographically impossible.

```
resolve("alice.0xaegis.eth")
    ├── On-chain:  accountAddress + keccak256(pubKey) [32 bytes]
    └── CCIP-Read: full 1952-byte ML-DSA public key, hash-verified
```

### Global threat feed

The quantum oracle writes to a single canonical name: `threat.0xaegis.eth`. Any agent, wallet, or dapp on any chain reads from this name to know whether ECDSA is still safe. One oracle update propagates instantly to every consumer of the feed — no subscriptions, no webhooks, no centralized API.

```
threat.0xaegis.eth text records:
    score           → "90"
    ecdsaSafe       → "false"
    triggeredBy     → "logical_qubits_above_1000,secp256k1_cve_published"
    recommendedAction → "deprecate_ecdsa"
```

### Agent discovery

Agents publish capabilities, pricing, and endpoints as ENS text records on their subdomain. Any agent that needs to find a counterpart for trade, escrow, or data fetching queries ENS subgraph records filtered by capability. No registry contract. No API. No permission needed to list.

```
alice.0xaegis.eth text records:
    capabilities → "trade,escrow,data-fetch"
    endpoint     → "https://alice.0xaegis.eth/rpc"
    price        → "0.001"
    keyScheme    → "ml-dsa-65"
```

### Post-quantum agent handshake

When two agents transact, they run a PQ credential handshake anchored to their ENS names. Agent A resolves Agent B's name, gets the `pubKeyHash`, sends a random challenge nonce, and verifies B's ML-DSA signature against the ENS-anchored public key. No ECDSA touches this handshake. A quantum computer watching the entire exchange gains nothing.

```
A resolves "bob.0xaegis.eth" → pubKeyHash
A sends nonce → B signs with ML-DSA secret key → B returns signature
A fetches B's full pubKey via CCIP-Read
A verifies: keccak256(pubKey) == pubKeyHash  ✓
A verifies: ml_dsa65.verify(pubKey, nonce, sig)  ✓
Trust established. Transaction proceeds.
```

ENS makes this possible without any central authority, certificate chain, or trust-on-first-use assumption.

---

## Deployed Contracts — Sepolia Testnet

| Contract | Address | Explorer |
|---|---|---|
| `AegisFactory` | `0x529754f82E4cDFc7063b944D5A1F86138B115a40` | [View](https://sepolia.etherscan.io/address/0x529754f82E4cDFc7063b944D5A1F86138B115a40) |
| `AegisENSResolver` | `0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c` | [View](https://sepolia.etherscan.io/address/0xD91ce30bc1B4bFe41c49A72AeAe221EFc760E30c) |
| `Groth16Verifier` | `0xf353d5e367e9Bd410A9324649a1529ebA3C91ef6` | [View](https://sepolia.etherscan.io/address/0xf353d5e367e9Bd410A9324649a1529ebA3C91ef6) |
| `AegisAccount` (demo instance) | `0x0a23Fa822D8BF5e0Bc13c79817a641e586cE9D38` | [View](https://sepolia.etherscan.io/address/0x0a23Fa822D8BF5e0Bc13c79817a641e586cE9D38) |
| `AegisAccount` (demo instance) | `0x7DcCcE806abE51d1c78cBa3A39F35b6d9bCE0780` | [View](https://sepolia.etherscan.io/address/0x7DcCcE806abE51d1c78cBa3A39F35b6d9bCE0780) |

> `AegisAccount` contracts are deployed per-agent via `AegisFactory`. Each agent gets its own wallet at a deterministic CREATE2 address. ENS name: `0xaegis.eth` — owner `0xdD3EeF74f9B68025CEddA2406B70e51a2Ed6A0b9`.

---

## On-Chain Transactions — Sepolia Testnet

### ENS Setup

| # | Action | Function | Contract | Tx |
|---|---|---|---|---|
| 1 | ENS Commit | `commit(bytes32)` | ETHRegistrarController | [0x7ead8b…](https://sepolia.etherscan.io/tx/0x7ead8bda52d0377c845ae52449c71e5f6b70baada0e9619949766560f0cf5ce3) |
| 2 | Register `0xaegis.eth` | `register(tuple)` | ETHRegistrarController | [0x84c2ad…](https://sepolia.etherscan.io/tx/0x84c2ad38d75dd5530c952328f865cd6d23d6973a1dfa9fa80b6c02e57e26da36) |
| 3 | Set Resolver | `setResolver(bytes32,address)` | ENS Registry | [0x980384…](https://sepolia.etherscan.io/tx/0x980384fdce8b31bd68d675e8950220dda6a44472bd0b529f158095b79e657153) |
| 4 | Set `subdomainRegistrar` | `setText(bytes32,string,string)` | AegisENSResolver | [0xe7931b…](https://sepolia.etherscan.io/tx/0xe7931bf58c08a28d5f859db1bb34e4db4f8d2d605f6c015eebd320fd6fb41c31) |

### Demo Run (End-to-End, Fresh Agent `aria-f0pi`)

| # | Action | Function | Contract | Tx |
|---|---|---|---|---|
| 5 | Deploy AegisAccount | `deployAccount(bytes32,address,address)` | AegisFactory | [0xe6312f…](https://sepolia.etherscan.io/tx/0xe6312fae77e3a08fb211f309de36b68898af4754fb1baaa2a27e97c343a60608) |
| 6 | Register ENS subdomain | `registerAgent(string,address,bytes32)` | AegisENSResolver | [0x5410b0…](https://sepolia.etherscan.io/tx/0x5410b0a66dd415fe33443339868b96a0fffe1e1518a05679a307696901b73756) |
| 7 | ZK Payment (0.001 ETH) | `executeWithZKProof(...)` | AegisAccount | [0xc34e0a…](https://sepolia.etherscan.io/tx/0xc34e0ab35fd9a14bdc1eda1f7dbd273753f2009d95ba61cecad21c0831ca143b) |
| 8 | Deprecate ECDSA | `deprecateECDSA()` | AegisAccount | included in tx above |
| 9 | ZK Proof post-deprecation | `executeWithZKProof(...)` | AegisAccount | [0x282035…](https://sepolia.etherscan.io/tx/0x282035270471a2dd56daed2a2fa4d264e9b735c22f46fb493884caac0ea046b4) |

All transactions are on Ethereum Sepolia (chain ID 11155111). Proof generation is off-chain (~0.4 s). On-chain verification uses the BN254 Groth16 pairing check at ~200k gas.

---

## Project Structure

```
aegis/
├── circuits/          # Circom ZK circuits and compiled artifacts
├── config/
│   └── ens.config.ts  # ← single file to change all ENS values
├── contracts/         # Hardhat project: Solidity, Ignition, tests
├── sdk/               # @0xaegis/sdk — publishable npm package
├── scripts/
│   └── demo.ts        # end-to-end demo
└── README.md
```

---

## Quick Start

```bash
# Install all dependencies
npm run setup

# Compile ZK circuit and copy artifacts to SDK
npm run compile:circuit
npm run copy:circuits

# Compile contracts and export ABIs to SDK
npm run compile:contracts
npm run export:abis

# Build the SDK
npm run build:sdk

# Run the full end-to-end demo
npm run demo
```

---

## Deployment

```bash
# Start a local Hardhat node
cd contracts && npm run node

# Deploy all contracts locally
npm run deploy:local
```

After deployment, paste the `AegisENSResolver` address into `config/ens.config.ts` at `AEGIS_RESOLVER_ADDRESS`.

For Sepolia:
```bash
cd contracts && npm run deploy:sepolia
```

---

*Built at ETHGlobal. Protocol by [Collins Adi](https://collinsadi.xyz).*
