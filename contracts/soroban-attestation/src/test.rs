use crate::{AttestationContract, AttestationContractClient};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

fn make_hash(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

#[test]
fn anchors_a_new_fingerprint() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AttestationContract, ());
    let client = AttestationContractClient::new(&env, &contract_id);

    let submitter = Address::generate(&env);
    let hash = make_hash(&env, 1);
    let org_id = String::from_str(&env, "org-123");

    let record = client.anchor(&hash, &org_id, &submitter);

    assert_eq!(record.org_id, org_id);
    assert_eq!(record.submitter, submitter);
    assert_eq!(record.timestamp, env.ledger().timestamp());
}

#[test]
fn get_record_returns_none_for_unanchored_hash() {
    let env = Env::default();
    let contract_id = env.register(AttestationContract, ());
    let client = AttestationContractClient::new(&env, &contract_id);

    let hash = make_hash(&env, 2);
    assert_eq!(client.get_record(&hash), None);
}

#[test]
fn get_record_returns_the_anchored_record() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract, ());
    let client = AttestationContractClient::new(&env, &contract_id);

    let submitter = Address::generate(&env);
    let hash = make_hash(&env, 3);
    let org_id = String::from_str(&env, "org-456");
    client.anchor(&hash, &org_id, &submitter);

    let fetched = client.get_record(&hash).unwrap();
    assert_eq!(fetched.org_id, org_id);
}

#[test]
fn anchor_is_idempotent_and_does_not_overwrite() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract, ());
    let client = AttestationContractClient::new(&env, &contract_id);

    let submitter_a = Address::generate(&env);
    let submitter_b = Address::generate(&env);
    let hash = make_hash(&env, 4);

    let org_a = String::from_str(&env, "org-a");
    let org_b = String::from_str(&env, "org-b");

    let first = client.anchor(&hash, &org_a, &submitter_a);
    // Second call with a different org/submitter must NOT overwrite the record.
    let second = client.anchor(&hash, &org_b, &submitter_b);

    assert_eq!(first, second);
    assert_eq!(second.org_id, org_a);
    assert_eq!(second.submitter, submitter_a);
}

#[test]
fn distinct_hashes_get_distinct_records() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract, ());
    let client = AttestationContractClient::new(&env, &contract_id);

    let submitter = Address::generate(&env);
    let org_id = String::from_str(&env, "org-789");

    let hash1 = make_hash(&env, 5);
    let hash2 = make_hash(&env, 6);

    client.anchor(&hash1, &org_id, &submitter);
    client.anchor(&hash2, &org_id, &submitter);

    assert!(client.get_record(&hash1).is_some());
    assert!(client.get_record(&hash2).is_some());
}

#[test]
fn initialize_sets_admin_once() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract, ());
    let client = AttestationContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    assert_eq!(client.admin(), Some(admin));
}

#[test]
#[should_panic(expected = "already initialized")]
fn initialize_twice_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract, ());
    let client = AttestationContractClient::new(&env, &contract_id);

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    client.initialize(&admin1);
    client.initialize(&admin2);
}
