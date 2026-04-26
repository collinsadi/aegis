# Aegis CCIP-Read Gateway

Off-chain server that serves full ML-DSA-65 public keys for `*.0xaegis.eth` agents.

## Why this exists

ML-DSA-65 public keys are 1952 bytes. Storing them on-chain costs ~31,000 gas in storage
plus ~60,000 gas in calldata — every time they're verified. Instead, Aegis stores only the
32-byte `keccak256(pubKey)` on-chain, and serves the full key from this gateway on demand.
The on-chain `pubKeyWithProof()` callback verifies the hash before trusting the key.

This pattern is CCIP-Read (EIP-3668), the ENS standard for off-chain data resolution.

## Setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/ccip/:sender/:data.json` | CCIP-Read key lookup |
| POST | `/register` | Register an agent's public key |
| GET | `/keys` | List all registered keys |

## Register a key

```bash
curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{
    "node":         "0x<namehash of alice.0xaegis.eth>",
    "publicKeyHex": "0x<1952-byte ML-DSA public key>",
    "agentLabel":   "alice"
  }'
```

## Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

Set env vars in Railway dashboard: `PORT`, `SEPOLIA_RPC_URL`.
Update `ENS_CONFIG.CCIP_GATEWAY_URL` in `config/ens.config.ts` with the Railway URL.
