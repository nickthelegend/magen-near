//! Magen wallet contract (magen-2).
//! Every spend needs two signatures over the same intent: ed25519 and ML-DSA-65, both verified on chain
//! with NEAR host functions. Optional guardians (ML-DSA-65 keys, k-of-n) can rotate both locks if the
//! owner loses their device. The Q-Day switch adds the ML-DSA-65 key as a native access key.
use near_sdk::json_types::{Base64VecU8, U64, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, Allowance, CurveType, Gas, NearToken, PanicOnDefault, Promise, PromiseResult, PublicKey};

const ED_LEN: usize = 32;
const PQ_LEN: usize = 1952;
const PQ_SIG_LEN: usize = 3309;
const MAX_GUARDIANS: usize = 5;
/// Fee allowance for the execute-only key that recovery installs (1 NEAR).
const FEE_ALLOWANCE: u128 = 1_000_000_000_000_000_000_000_000;

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde", deny_unknown_fields)]
pub struct Intent { pub network: String, pub wallet: AccountId, pub nonce: U64, pub expires: U64, pub action: Action }

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde", tag = "kind", deny_unknown_fields)]
pub enum Action {
    #[serde(rename = "send")] Send { receiver: AccountId, amount: U128 },
    #[serde(rename = "call")] Call { receiver: AccountId, method: String, args: Base64VecU8, deposit: U128 },
    #[serde(rename = "migrate")] Migrate,
    #[serde(rename = "guardians")] Guardians { keys: Vec<Base64VecU8>, threshold: u8 },
}

/// Guardians sign this to rotate both locks.
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde", deny_unknown_fields)]
pub struct Recovery { pub network: String, pub wallet: AccountId, pub nonce: U64, pub expires: U64, pub new_ed: Base64VecU8, pub new_pq: Base64VecU8 }

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct GuardianSig { pub index: u8, pub sig: Base64VecU8 }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Wallet {
    ed: Vec<u8>, pq: Vec<u8>, nonce: u64, migrated: bool, migration_pending: bool,
    guardians: Vec<Vec<u8>>, threshold: u8, recovery_nonce: u64,
}

fn check_window(expires: u64) {
    let now = env::block_timestamp_ms();
    assert!(expires >= now && expires <= now + 600_000, "intent expired or too far in future");
}

#[near]
impl Wallet {
    #[init]
    #[private]
    pub fn new(ed: Base64VecU8, pq: Base64VecU8) -> Self {
        assert_eq!(ed.0.len(), ED_LEN, "invalid classical key");
        assert_eq!(pq.0.len(), PQ_LEN, "invalid quantum key");
        Self { ed: ed.0, pq: pq.0, nonce: 0, migrated: false, migration_pending: false, guardians: vec![], threshold: 0, recovery_nonce: 0 }
    }

    pub fn status(&self) -> near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({
            "wallet": env::current_account_id(), "nonce": self.nonce.to_string(), "migrated": self.migrated,
            "migration_pending": self.migration_pending, "ed": Base64VecU8(self.ed.clone()), "pq": Base64VecU8(self.pq.clone()),
            "guardians": self.guardians.iter().map(|g| Base64VecU8(g.clone())).collect::<Vec<_>>(),
            "threshold": self.threshold, "recovery_nonce": self.recovery_nonce.to_string(), "version": "magen-2"
        })
    }

    pub fn execute(&mut self, intent: String, ed_sig: Base64VecU8, pq_sig: Base64VecU8) -> Promise {
        assert!(intent.len() <= 24_000, "intent too large");
        let i: Intent = near_sdk::serde_json::from_str(&intent).expect("invalid intent");
        assert!(i.network == "testnet" && i.wallet == env::current_account_id(), "wrong wallet or network");
        assert_eq!(i.nonce.0, self.nonce, "replay: wrong nonce");
        check_window(i.expires.0);
        let digest = env::sha256(format!("magen:v1:{}", intent).as_bytes());
        let ed: [u8; 64] = ed_sig.0.try_into().expect("classical half missing");
        let pk: [u8; ED_LEN] = self.ed.clone().try_into().unwrap();
        assert!(env::ed25519_verify(&ed, &digest, &pk), "classical half invalid");
        let pq: [u8; PQ_SIG_LEN] = pq_sig.0.try_into().expect("quantum half missing");
        let qpk: [u8; PQ_LEN] = self.pq.clone().try_into().unwrap();
        assert!(env::ml_dsa_verify(&pq, &digest, &qpk), "quantum half missing or invalid");
        assert!(!self.migration_pending, "migration pending");
        self.nonce = self.nonce.checked_add(1).expect("nonce overflow");
        let is_migration = matches!(i.action, Action::Migrate);
        let operation = match i.action {
            Action::Send { receiver, amount } => { self.check_target(&receiver, amount.0); Promise::new(receiver).transfer(NearToken::from_yoctonear(amount.0)) }
            Action::Call { receiver, method, args, deposit } => {
                self.check_target(&receiver, deposit.0);
                assert!(!method.is_empty() && method.len() <= 128, "invalid method");
                Promise::new(receiver).function_call(method, args.0, NearToken::from_yoctonear(deposit.0), Gas::from_tgas(35))
            }
            Action::Migrate => {
                assert!(!self.migrated, "already migrated");
                self.migration_pending = true;
                let key = PublicKey::from_parts(CurveType::MLDSA65, self.pq.clone()).expect("invalid native key");
                Promise::new(env::current_account_id()).add_full_access_key(key)
            }
            Action::Guardians { keys, threshold } => {
                assert!(keys.len() <= MAX_GUARDIANS, "at most 5 guardians");
                assert!(keys.iter().all(|k| k.0.len() == PQ_LEN), "guardian keys must be ML-DSA-65 public keys");
                assert!(if keys.is_empty() { threshold == 0 } else { threshold >= 1 && (threshold as usize) <= keys.len() }, "invalid threshold");
                for (a, ka) in keys.iter().enumerate() { for kb in keys.iter().skip(a + 1) { assert!(ka.0 != kb.0, "duplicate guardian"); } }
                self.guardians = keys.into_iter().map(|k| k.0).collect();
                self.threshold = threshold;
                env::log_str(&format!("MAGEN_GUARDIANS count={} threshold={}", self.guardians.len(), self.threshold));
                return Promise::new(env::current_account_id()).function_call("settle", near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({"migration": false, "nonce": i.nonce})).unwrap(), NearToken::from_yoctonear(0), Gas::from_tgas(8));
            }
        };
        env::log_str(&format!("MAGEN_AUTHORIZED nonce={} dual_verified=true", i.nonce.0));
        operation.then(Promise::new(env::current_account_id()).function_call(
            "settle",
            near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({"migration": is_migration, "nonce": i.nonce})).unwrap(),
            NearToken::from_yoctonear(0), Gas::from_tgas(8)))
    }

    /// k-of-n guardians rotate both locks to keys the owner made on a new device. The old classical key
    /// (which doubled as the execute-only fee key) and any native ML-DSA key of the old lock are removed,
    /// and the new classical key becomes the execute-only fee key.
    pub fn recover(&mut self, request: String, signatures: Vec<GuardianSig>) -> Promise {
        assert!(self.threshold > 0, "no guardians set");
        assert!(request.len() <= 12_000, "request too large");
        let r: Recovery = near_sdk::serde_json::from_str(&request).expect("invalid recovery request");
        assert!(r.network == "testnet" && r.wallet == env::current_account_id(), "wrong wallet or network");
        assert_eq!(r.nonce.0, self.recovery_nonce, "replay: wrong recovery nonce");
        check_window(r.expires.0);
        assert_eq!(r.new_ed.0.len(), ED_LEN, "invalid classical key");
        assert_eq!(r.new_pq.0.len(), PQ_LEN, "invalid quantum key");
        let digest = env::sha256(format!("magen:recover:v1:{}", request).as_bytes());
        let mut seen = [false; MAX_GUARDIANS];
        let mut valid = 0u8;
        for s in signatures.iter() {
            let idx = s.index as usize;
            assert!(idx < self.guardians.len(), "unknown guardian");
            assert!(!seen[idx], "duplicate guardian signature");
            seen[idx] = true;
            let sig: [u8; PQ_SIG_LEN] = s.sig.0.clone().try_into().expect("guardian signature malformed");
            let gpk: [u8; PQ_LEN] = self.guardians[idx].clone().try_into().unwrap();
            assert!(env::ml_dsa_verify(&sig, &digest, &gpk), "guardian signature invalid");
            valid += 1;
        }
        assert!(valid >= self.threshold, "not enough guardian signatures");
        let me = env::current_account_id();
        let old_ed = PublicKey::from_parts(CurveType::ED25519, self.ed.clone()).unwrap();
        let old_pq = PublicKey::from_parts(CurveType::MLDSA65, self.pq.clone()).unwrap();
        self.ed = r.new_ed.0.clone();
        self.pq = r.new_pq.0;
        self.recovery_nonce += 1;
        let had_native_key = self.migrated;
        self.migrated = false;
        env::log_str(&format!("MAGEN_RECOVERED by={} of={}", valid, self.guardians.len()));
        let new_ed = PublicKey::from_parts(CurveType::ED25519, r.new_ed.0).unwrap();
        // Separate receipts, so a key that is already gone can never undo the rotation.
        Promise::new(me.clone()).delete_key(old_ed);
        if had_native_key { Promise::new(me.clone()).delete_key(old_pq); }
        Promise::new(me.clone()).add_access_key_allowance(new_ed, Allowance::limited(NearToken::from_yoctonear(FEE_ALLOWANCE)).unwrap(), me, "execute")
    }

    #[private]
    pub fn settle(&mut self, migration: bool, nonce: U64) -> bool {
        let success = match env::promise_results_count() { 0 => true, _ => matches!(env::promise_result(0), PromiseResult::Successful(_)) };
        if migration { self.migration_pending = false; if success { self.migrated = true; } }
        env::log_str(&format!("MAGEN_SETTLED nonce={} success={} migration={}", nonce.0, success, migration));
        success
    }
}

impl Wallet {
    fn check_target(&self, receiver: &AccountId, amount: u128) {
        assert_ne!(receiver, &env::current_account_id(), "self calls forbidden");
        assert!(amount <= env::account_balance().as_yoctonear().saturating_sub(500_000_000_000_000_000_000_000), "keep 0.5 NEAR for storage");
    }
}
