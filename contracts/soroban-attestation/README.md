# doculedger-attestation (Soroban contract)

Anchors document fingerprints (`sha256` of canonicalized extracted data —
never raw documents or PII) on Stellar so that anyone holding the same data
can recompute its hash and verify it against an immutable on-chain record.

## Data model

```rust
struct AttestationRecord {
    org_id: String,     // the DocuLedger organization that anchored it
    submitter: Address, // the Stellar account that authorized the anchor
    timestamp: u64,      // ledger close time, set by the contract itself
}
```

Storage: `hash (BytesN<32>) -> AttestationRecord`, persistent, idempotent —
`anchor()` is a no-op (returns the existing record, does not require auth,
does not touch storage) if the hash already exists. This is the whole
tamper-evidence property: nobody can ever overwrite what a hash points to.

## Functions

- `initialize(admin: Address)` — one-time setup; reserved for future
  governance features (e.g. a revocation list). Not required for anchoring.
- `anchor(hash, org_id, submitter) -> AttestationRecord` — requires
  `submitter`'s signature. Idempotent.
- `get_record(hash) -> Option<AttestationRecord>` — free, read-only lookup.

## Building & testing locally

Requires Rust + the Soroban toolchain:

```bash
rustup target add wasm32v1-none
curl -sSfL https://raw.githubusercontent.com/stellar/stellar-cli/main/install.sh | sh
# or: cargo install --locked stellar-cli

cargo test          # runs contracts/soroban-attestation/src/test.rs
./scripts/build.sh   # produces target/wasm32v1-none/release/doculedger_attestation.wasm
```

## Deploying to Testnet

```bash
stellar keys generate doculedger-operator --network testnet
stellar keys fund doculedger-operator --network testnet

./scripts/build.sh
./scripts/deploy.sh doculedger-operator
```

Copy the printed `CONTRACT_ID` into `STELLAR_CONTRACT_ID` in your `.env`,
and the operator's secret key (`stellar keys show doculedger-operator`)
into `STELLAR_OPERATOR_SECRET`. The worker (`apps/worker`) uses these via
`@doculedger/stellar`'s `SorobanAnchorService` to submit `anchor` calls as
documents complete processing.

## Why Soroban instead of just a plain transaction memo

A `manage_data` entry or memo hash would prove *a* fingerprint existed at
*some* transaction, but verification would mean scanning an account's
transaction history for a match. The contract turns that into a single
cheap read (`get_record`), lets each record carry structured metadata (org,
submitter, timestamp) that a memo can't, and gives us a clean place to add
governance/revocation semantics later without changing the anchoring
client.
