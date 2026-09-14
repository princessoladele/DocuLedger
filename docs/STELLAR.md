# Stellar / Soroban integration

## What gets anchored, and why

DocuLedger anchors a **SHA-256 fingerprint of canonicalized extracted
data** — never the raw document, never PII by itself, and never anything
before it's either auto-validated or human-reviewed. The fingerprint is
computed by `fingerprintOf({ documentId, fields })` in
[packages/shared/src/fingerprint.ts](../packages/shared/src/fingerprint.ts),
which sorts object keys recursively before hashing so the same logical
data always produces the same hash regardless of serialization order.

This gives a genuine product property: anyone who has (or is given) the
extracted field data for a document can recompute this hash locally and
compare it against the immutable on-chain record. If they match, the data
is provably unaltered since the moment it was anchored — a tamper-evident
audit trail for compliance/legal/financial records, without ever putting
sensitive content on a public ledger.

## The contract

[contracts/soroban-attestation](../contracts/soroban-attestation) is a
small Soroban contract with one meaningful piece of state: a map from
`hash (32 bytes) → { org_id, submitter, timestamp }`. Its `anchor()`
function is **idempotent** — if a hash is already anchored, calling
`anchor()` again returns the existing record unchanged and doesn't even
require the caller's signature. That's what makes the mapping tamper-evident
rather than merely tamper-*detectable*-after-the-fact: nobody, including
the original submitter, can ever overwrite what a hash points to.

## AnchorService: mock vs. real

`packages/stellar` exposes one interface, `AnchorService`
(`anchor(fingerprint, orgId)`, `verify(fingerprint)`), and two
implementations, selected by the `STELLAR_MODE` env var via
`createAnchorServiceFromEnv()`:

| `STELLAR_MODE` | Implementation | Behavior |
|---|---|---|
| `mock` (default) | `MockAnchorService` | In-memory, deterministic, no network. Used automatically in local dev, CI, and tests so nothing here requires a funded Stellar account. |
| `soroban` | `SorobanAnchorService` | Signs and submits a real `anchor` invocation to the deployed contract via Soroban RPC, then polls `getTransaction` for confirmation. `verify()` does a free simulated (`simulateTransaction`) read-only call — no fee, no signature required — so verification never costs anything. |

Both the API (for `GET /stellar/verify/:documentId`) and the worker (for
anchoring after a document reaches `REVIEWED`) call the same factory, so
they're always configured consistently from one set of env vars.

## Anchoring flow, end to end

1. A document reaches `REVIEWED` (auto-validated, or manually approved).
2. `apps/worker`'s anchor processor fingerprints the final extracted data,
   creates a `PENDING` `AnchorRecord`, and calls `anchorService.anchor()`.
3. On success, the `AnchorRecord` is updated with the Stellar transaction
   hash, ledger sequence, and contract id; the document moves to
   `ANCHORED`.
4. Later, anyone with API access can call `GET /stellar/verify/:documentId`
   (`StellarService.verifyDocument`): it recomputes the fingerprint from
   the document's *current* extraction, compares it to what was anchored,
   and independently asks the chain (`anchorService.verify()`) whether
   that fingerprint is on record. Both checks must agree for `verified: true`.

## Deploying the real contract to Testnet

See [contracts/soroban-attestation/README.md](../contracts/soroban-attestation/README.md)
for the full build/deploy walkthrough (`stellar keys generate`,
`scripts/build.sh`, `scripts/deploy.sh`). Once deployed:

```bash
STELLAR_MODE=soroban
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_CONTRACT_ID=<printed by scripts/deploy.sh>
STELLAR_OPERATOR_SECRET=<the funded account's secret key>
STELLAR_NETWORK_LABEL=testnet
```

Set these in the worker's (and, for verification, the API's) environment
and restart both — no code changes needed to move from mock to live
Testnet anchoring.

This path has been exercised end-to-end against live Testnet during
development: the contract was deployed and initialized with `stellar
contract deploy`/`invoke`, then `SorobanAnchorService.anchor()` submitted a
real transaction (confirmed on-ledger with a real tx hash and ledger
sequence) and `verify()` read it back via a free simulated call — including
confirming the idempotency guarantee (a second `anchor()` call for the same
fingerprint short-circuits to the existing record rather than submitting a
new transaction). One thing that tripped this up initially and is worth
knowing: **pin `@stellar/stellar-sdk` to a recent major version** (17.x
as of this writing) — older majors (12.x) fail to decode current
Testnet/RPC responses (`Bad union switch: N` errors) even though the
transaction still lands on-chain, which is a confusing failure mode since
the anchor *appears* to fail while actually succeeding.

## Moving to Mainnet

Nothing in the application code is Testnet-specific — it's entirely
env-driven (`STELLAR_RPC_URL`, `STELLAR_NETWORK_PASSPHRASE`, a funded
operator account). Before doing so: audit the contract, fund the operator
account with real XLM for fees, and budget for one signed transaction per
document reaching `REVIEWED` (batching many fingerprints into a single
Merkle root anchored periodically, with the contract storing roots instead
of individual hashes, is the natural next optimization at high volume —
the `AnchorRecord.fingerprint` field and the contract's `hash` key are
already generic enough to hold either).
