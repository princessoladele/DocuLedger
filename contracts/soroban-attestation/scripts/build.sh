#!/usr/bin/env bash
# Builds the attestation contract to a WASM binary.
# Requires: rustup with the wasm32v1-none target, and the `stellar` CLI
# (https://developer.stellar.org/docs/tools/developer-tools/cli/install-cli).
set -euo pipefail
cd "$(dirname "$0")/.."

rustup target add wasm32v1-none >/dev/null 2>&1 || true
stellar contract build

echo "WASM built at target/wasm32v1-none/release/doculedger_attestation.wasm"
