# Aegis — Technical Architecture

---

## Cryptographic Stack

| Layer | Primitive | Standard | Size |
|-------|-----------|----------|------|
| Key generation | ML-DSA-65 (CRYSTALS-Dilithium) | NIST FIPS 204 | 1952-byte pubkey, 4032-byte secret key |
| Signing | ML-DSA-65 | NIST FIPS 204 | 3309-byte signature |
| ZK compression | Groth16 over BN254 | EIP-197 | 256-byte proof |
| On-chain commitment | Poseidon hash | Circom-native | 32-byte field element |
| ENS key pointer | keccak256 | EVM-native | 32-byte pubKeyHash |
| Off-chain storage | 0G Storage (Merkle-addressed) | 0G protocol | Merkle root as content address |

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      @0xaegis/sdk                        │
│                                                          │
│  AegisWallet        AegisProver       QuantumOracle      │
│  ML-DSA keygen      Groth16 prove     Threat monitoring  │
│  ML-DSA sign/verify Poseidon commit   ECDSA deprecation  │
│                                                          │
│  AegisENS           AegisGateway      ZeroGQuantumOracle │
│  Deploy agent       Register pubkey   0G Compute scoring │
│  ENS text records   CCIP-Read upload                     │
└──────────────────────────┬──────────────────────────────┘
                           │ ethers.js
           ┌───────────────┼────────────────┐
           ▼               ▼                ▼
  ┌──────────────┐ ┌─────────────┐ ┌──────────────────┐
  │  Sepolia     │ │  CCIP-Read  │ │  0G Testnet      │
  │  Contracts   │ │  Gateway    │ │                  │
  │              │ │  :8080      │ │  Storage nodes   │
  │ AegisFactory │ │             │ │  Compute API     │
  │ AegisENS     │ │ ZeroGKey    │ │                  │
  │ Resolver     │ │ Store       │ │                  │
  │ AegisAccount │ │ (or Prisma) │ │                  │
  │ Groth16      │ │             │ │                  │
  │ Verifier     │ └─────────────┘ └──────────────────┘
  └──────────────┘
```

---

## ZK Circuit

The circuit (`circuits/sig_commitment.circom`) does one thing: prove that a valid ML-DSA signature exists for a given message without revealing the signature on-chain.

**Inputs (private):**
- `signature[3309]` — ML-DSA signature bytes
- `message[32]` — operation payload hash

**Public outputs:**
- `commitment` — Poseidon hash of `(signature, message)`, binds the proof to the specific operation
- `pubKeyHash` — keccak256 of the public key (must match the on-chain value)

**On-chain verifier (`Groth16Verifier.sol`):**
```
verifyProof(pA, pB, pC, [commitment, pubKeyHash])
```

The pairing check costs ~200k gas. The raw ML-DSA signature (3309 bytes) never appears on-chain — the proof is the only artifact.

---

## CCIP-Read Flow (EIP-3668)

```
1. Client calls AegisENSResolver.pubKey(node)
   └─→ Contract reverts with OffchainLookup(gatewayURL, calldata)

2. Client (ethers.js) catches the revert
   └─→ Calls GET https://gateway.0xaegis.eth/ccip/{sender}/{data}.json

3. Gateway decodes the ABI-encoded node hash from calldata
   └─→ Calls activeKeyStore.get(node) → { publicKey: Buffer<1952> }

   If ENABLE_ZERO_G=true:
     └─→ ZeroGKeyStore checks rootIndex[node] → rootHash
           └─→ indexer.downloadToBlob(rootHash) → Blob
                 └─→ Buffer.from(await blob.arrayBuffer())

4. Gateway ABI-encodes the key bytes and returns { data: "0x..." }

5. Client passes the response back to AegisENSResolver.pubKeyWithProof()
   └─→ Contract checks: keccak256(returnedKey) == stored pubKeyHash  ✓
   └─→ Returns the verified 1952-byte key to the caller
```

---

## AegisAccount Contract

Each agent has its own `AegisAccount` contract deployed via `AegisFactory` (CREATE2). It has two execution modes:

**ECDSA mode** (default, enabled at deploy):
```solidity
executeWithECDSA(bytes sig, bytes32 msgHash, address to, uint256 value, bytes data)
```
Standard ECDSA verification. Remains until the oracle calls `deprecateECDSA()`.

**ZK mode** (always available):
```solidity
executeWithZKProof(uint[2] pA, uint[2][2] pB, uint[2] pC, uint commitment, address to, uint256 value, bytes data)
```
Groth16 proof verification against the stored `pubKeyHash`. Quantum-resistant. Gas: ~200k.

**State transitions:**
```
[deployed]
    ↓ ecdsaActive = true
    ↓ both modes work
    ↓
QuantumOracle calls deprecateECDSA()
    ↓ ecdsaActive = false  (irreversible)
    ↓ only ZK mode works
    ↓
agent remains operational, ECDSA permanently disabled
```

---

## Key Rotation

Key rotation does not require a new contract. The agent generates a new ML-DSA keypair, calls `AegisENSResolver.rotateKey(node, newPubKeyHash)`, and re-registers the full key with the CCIP-Read gateway. The new `pubKeyHash` is stored on-chain; the next CCIP-Read resolution returns the new key. Old signatures using the previous key become invalid immediately.

---

## 0G Storage Integration Details

`ZeroGKeyStore` uses `@0gfoundation/0g-ts-sdk` v1.2.x. The upload path:

```typescript
const memFile = new MemData(publicKey);  // 1952 bytes wrapped as in-memory file
const [result, err] = await indexer.upload(
  memFile,
  INTEGRATIONS.ZERO_G.STORAGE_RPC,  // 0G EVM RPC for tx submission
  signer,                             // funded wallet pays storage fee
  { expectedReplica: 1 }             // min 1 storage node must confirm
);
// result.rootHash = Merkle root of the file (content address)
// result.txHash   = 0G chain transaction hash
// result.txSeq    = sequential index in the Flow contract
```

The download path uses `indexer.downloadToBlob(rootHash)` which fetches from any 0G node that holds the file, verified by Merkle proof.

Storage fee per upload: ~246 gwei (0G testnet). At 1952 bytes per key, this is negligible.

---

## Repository Structure

```
aegis/
├── circuits/               # Circom ZK circuits
│   ├── aegis.circom        # Main PQ signature commitment circuit
│   └── artifacts/          # Compiled .wasm + .zkey
├── config/
│   └── ens.config.ts       # Single source of truth for ENS values + INTEGRATIONS
├── contracts/              # Hardhat project
│   ├── contracts/
│   │   ├── AegisAccount.sol
│   │   ├── AegisFactory.sol
│   │   ├── AegisENSResolver.sol
│   │   └── Groth16Verifier.sol
│   └── ignition/           # Hardhat Ignition deployment modules
├── sdk/                    # @0xaegis/sdk (npm publishable)
│   └── src/
│       ├── wallet.ts       # ML-DSA keygen + signing
│       ├── prover.ts       # Groth16 proof generation
│       ├── ens.ts          # ENS identity and discovery
│       ├── gateway.ts      # CCIP-Read key registration
│       ├── oracle.ts       # QuantumOracle (hardcoded weights)
│       └── zerogOracle.ts  # ZeroGQuantumOracle (0G Compute scoring)
├── server/                 # CCIP-Read gateway (Express + Prisma)
│   └── src/
│       ├── routes/ccip.ts          # EIP-3668 endpoint
│       └── services/
│           ├── keyStore.ts         # Prisma key store
│           ├── zerogKeyStore.ts    # 0G Storage key store
│           └── keyStoreFactory.ts  # Returns active implementation
├── demo/
│   └── index.ts            # 8-step interactive end-to-end demo
├── docs/                   # Extended documentation
│   ├── 0g.md               # 0G integration + transaction log
│   ├── ens.md              # ENS integration deep dive
│   ├── contracts.md        # Deployed contracts + all on-chain txs
│   └── technical.md        # This file
└── website/                # React landing page
```
