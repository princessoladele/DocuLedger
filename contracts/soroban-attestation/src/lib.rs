//! DocuLedger attestation contract.
//!
//! Stores a mapping from `sha256(canonicalized extracted document data)` to
//! an immutable record of which organization anchored it and when. Nothing
//! about the document's content ever reaches this contract — only the
//! 32-byte fingerprint computed off-chain (see
//! `packages/shared/src/fingerprint.ts`).
//!
//! The core tamper-evidence property comes from `anchor` being idempotent:
//! once a hash is anchored, it can never be overwritten by anyone
//! (including the original submitter), so a later attempt to "re-anchor" a
//! modified document with the same logical id will simply fail to match the
//! original fingerprint, and a caller trying to verify the ORIGINAL data can
//! always recompute its hash and compare it against this immutable record.
#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AttestationRecord {
    pub org_id: String,
    pub submitter: Address,
    pub timestamp: u64,
}

#[contracttype]
enum DataKey {
    Record(BytesN<32>),
    Admin,
}

/// Ledgers to extend an attestation's TTL by on write (~ a year at 5s/ledger).
const RECORD_TTL_LEDGERS: u32 = 6_312_000;
const RECORD_TTL_THRESHOLD: u32 = 100_000;

#[contract]
pub struct AttestationContract;

#[contractimpl]
impl AttestationContract {
    /// One-time initializer recording a contract admin. Anchoring itself
    /// never requires the admin; this is a governance hook reserved for
    /// future features (e.g. an on-chain revocation/dispute list).
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("attestation contract already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Anchors a document fingerprint. Requires the submitting account's
    /// signature (`submitter.require_auth()`), proving the organization's
    /// registered Stellar account authorized this specific anchor.
    ///
    /// Idempotent: if `hash` is already anchored, the existing record is
    /// returned as-is and no auth check or state write happens — this is
    /// what makes the mapping tamper-evident rather than merely
    /// tamper-detectable-after-the-fact.
    pub fn anchor(env: Env, hash: BytesN<32>, org_id: String, submitter: Address) -> AttestationRecord {
        let key = DataKey::Record(hash.clone());

        if let Some(existing) = env.storage().persistent().get::<DataKey, AttestationRecord>(&key) {
            return existing;
        }

        submitter.require_auth();

        let record = AttestationRecord {
            org_id,
            submitter,
            timestamp: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&key, &record);
        env.storage()
            .persistent()
            .extend_ttl(&key, RECORD_TTL_THRESHOLD, RECORD_TTL_LEDGERS);

        // `Events::publish` is deprecated in favor of the `#[contractevent]`
        // macro (soroban-sdk 22+), but the topic/data-tuple form used here
        // remains fully supported and decodes identically off-chain; keeping
        // it avoids coupling this contract's public event shape to a macro
        // that's still evolving.
        #[allow(deprecated)]
        env.events()
            .publish((symbol_short!("anchored"),), (hash, record.clone()));

        record
    }

    /// Read-only lookup, used to verify a fingerprint recomputed off-chain
    /// against what's immutably recorded on-chain.
    pub fn get_record(env: Env, hash: BytesN<32>) -> Option<AttestationRecord> {
        env.storage().persistent().get(&DataKey::Record(hash))
    }

    pub fn admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }
}

#[cfg(test)]
mod test;
