#!/usr/bin/env bash
# deploy.sh — Deploy Aegis CCIP-Read gateway to a VPS
# Usage: ./deploy.sh
# Run from: /opt/aegis/server on your VPS (or wherever you cloned the repo)
set -euo pipefail

echo "==> [Aegis Deploy] Starting..."

# ── 1. Pull latest code ───────────────────────────────────────────────────────
git -C "$(git rev-parse --show-toplevel)" pull --ff-only
echo "    Code updated."

# ── 2. Check .env exists ──────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example → .env and fill in values."
  exit 1
fi

# Load env for validation
set -a && source .env && set +a

: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}"
: "${AEGIS_RESOLVER_ADDRESS:?Set AEGIS_RESOLVER_ADDRESS in .env}"
: "${SEPOLIA_RPC_URL:?Set SEPOLIA_RPC_URL in .env}"

# ── 3. Build and start ────────────────────────────────────────────────────────
docker compose build --no-cache gateway
docker compose up -d

echo ""
echo "==> [Aegis Deploy] Done."
echo "    Gateway: http://localhost:8080/health"
echo "    Logs:    docker compose logs -f gateway"
