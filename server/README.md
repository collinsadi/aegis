# Aegis CCIP-Read Gateway

Off-chain server that serves full ML-DSA-65 public keys for `*.0xaegis.eth` agents.

## Why this exists

ML-DSA-65 public keys are 1952 bytes. Storing them on-chain costs ~31,000 gas in storage
plus ~60,000 gas in calldata — every time they're verified. Instead, Aegis stores only the
32-byte `keccak256(pubKey)` on-chain, and serves the full key from this gateway on demand.
The on-chain `pubKeyWithProof()` callback verifies the hash before trusting the key.

This pattern is CCIP-Read (EIP-3668), the ENS standard for off-chain data resolution.

## Security model

`POST /register` requires that `keccak256(submittedKey)` matches the `pubKeyHash` stored
on-chain in `AegisENSResolver` for the given ENS node. The chain is the authority — no
API keys or auth tokens are needed. A third party cannot overwrite your key because any
other key would fail the hash check.

## SDK integration

Use `AegisGateway` from `@0xaegis/sdk` instead of calling this API directly.
The gateway must be called **explicitly** after on-chain operations — it is never invoked
automatically.

```typescript
import { AegisENS, AegisGateway } from "@0xaegis/sdk";

const ens     = new AegisENS(provider, signer);
const gateway = new AegisGateway("https://your-gateway.com");

await ens.init();

// Registration: two explicit steps
await ens.registerAgent(label, accountAddress, wallet.publicKeyHash());
await gateway.registerKey(label, wallet.keyPair.publicKey, label);

// Key rotation: two explicit steps
await ens.rotateKey(label, newWallet.publicKeyHash());
await gateway.rotateKey(label, newWallet.keyPair.publicKey, label);
```

## Setup

```bash
cd server
npm install
cp .env.example .env
# Fill in: DATABASE_URL, SEPOLIA_RPC_URL, AEGIS_RESOLVER_ADDRESS
npm run db:migrate   # create the public_keys table
npm run dev
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check — includes registered key count |
| GET | `/ccip/:sender/:data.json` | CCIP-Read key lookup (called by ENS clients) |
| POST | `/register` | Publish an agent's full ML-DSA public key |
| GET | `/keys` | List all registered keys |

## Direct API usage

If you're not using the SDK:

```bash
curl -X POST https://your-gateway.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "node":         "0x<namehash of alice.0xaegis.eth>",
    "publicKeyHex": "0x<1952-byte ML-DSA public key hex>",
    "agentLabel":   "alice"
  }'
```

The node hash can be computed with `ethers.namehash("alice.0xaegis.eth")`.

## Deploy to VPS

```bash
cp .env.example .env
# Fill in all values
bash deploy.sh
```

`deploy.sh` builds the Docker image and starts the container. Prisma runs migrations
automatically on every container start. Point nginx at port 8080 using `nginx.conf`.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Server port (default 8080) |
| `SEPOLIA_RPC_URL` | Yes | Alchemy/Infura Sepolia RPC URL |
| `AEGIS_RESOLVER_ADDRESS` | Yes | Deployed AegisENSResolver contract address |
| `NODE_ENV` | No | Set to `production` to enable SSL on DB connection |
