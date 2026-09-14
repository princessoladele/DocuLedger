#!/usr/bin/env bash
# Deploys the built attestation contract to Stellar Testnet and initializes it.
#
# Usage:
#   ./scripts/deploy.sh <source-identity-name>
#
# `<source-identity-name>` must already exist in `stellar keys` (see
# `stellar keys generate` / `stellar keys fund`) and be funded on testnet.
#
# On success, prints the deployed CONTRACT_ID — copy it into your API/worker
# .env as STELLAR_CONTRACT_ID.
set -euo pipefail
cd "$(dirname "$0")/.."

SOURCE="${1:?usage: deploy.sh <source-identity-name>}"
NETWORK="testnet"

WASM_PATH="target/wasm32v1-none/release/doculedger_attestation.wasm"
if [ ! -f "$WASM_PATH" ]; then
  echo "WASM not found at $WASM_PATH — run scripts/build.sh first" >&2
  exit 1
fi

echo "Deploying to $NETWORK using identity '$SOURCE'..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source "$SOURCE" \
  --network "$NETWORK")

echo "Deployed contract: $CONTRACT_ID"

echo "Initializing admin..."
ADMIN_ADDRESS=$(stellar keys address "$SOURCE")
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- initialize --admin "$ADMIN_ADDRESS"

echo ""
echo "Done. Set the following in your .env:"
echo "  STELLAR_CONTRACT_ID=$CONTRACT_ID"
