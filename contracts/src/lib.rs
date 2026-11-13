use near_sdk::{env, near, AccountId, PanicOnDefault, Promise, PromiseResult, NearToken, Gas, PublicKey, CurveType};
use near_sdk::json_types::{Base64VecU8, U64, U128};
use near_sdk::serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
#[serde(crate="near_sdk::serde", deny_unknown_fields)]
pub struct Intent { pub network: String, pub wallet: AccountId, pub nonce: U64, pub expires: U64, pub action: Action }
#[derive(Serialize, Deserialize)]
#[serde(crate="near_sdk::serde", tag="kind", deny_unknown_fields)]
pub enum Action {
    #[serde(rename="send")] Send { receiver: AccountId, amount: U128 },
    #[serde(rename="call")] Call { receiver: AccountId, method: String, args: Base64VecU8, deposit: U128 },
    #[serde(rename="migrate")] Migrate,
}
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Wallet { ed: Vec<u8>, pq: Vec<u8>, nonce: u64, migrated: bool, migration_pending: bool }
#[near]
impl Wallet {
    #[init]
    #[private]
    pub fn new(ed: Base64VecU8, pq: Base64VecU8) -> Self {
        assert_eq!(ed.0.len(),32,"invalid classical key");
        assert_eq!(pq.0.len(),1952,"invalid quantum key");
        Self { ed: ed.0, pq: pq.0, nonce: 0, migrated: false, migration_pending: false }
    }
    pub fn status(&self) -> near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({"wallet":env::current_account_id(),"nonce":self.nonce.to_string(),"migrated":self.migrated,"migration_pending":self.migration_pending,"ed":Base64VecU8(self.ed.clone()),"pq":Base64VecU8(self.pq.clone()),"version":"magen-1"})
    }
    pub fn execute(&mut self, intent: String, ed_sig: Base64VecU8, pq_sig: Base64VecU8) -> Promise {
        assert!(intent.len()<=12000,"intent too large");
        let i: Intent = near_sdk::serde_json::from_str(&intent).expect("invalid intent");
        assert!(i.network=="testnet" && i.wallet==env::current_account_id(),"wrong wallet or network");
        assert_eq!(i.nonce.0,self.nonce,"replay: wrong nonce");
        let now=env::block_timestamp_ms();
        assert!(i.expires.0>=now && i.expires.0<=now+600_000,"intent expired or too far in future");
        let digest=env::sha256(format!("magen:v1:{}",intent).as_bytes());
        let ed: [u8;64]=ed_sig.0.try_into().expect("classical half missing");
        let pk: [u8;32]=self.ed.clone().try_into().unwrap();
        assert!(env::ed25519_verify(&ed,&digest,&pk),"classical half invalid");
        let pq: [u8;3309]=pq_sig.0.try_into().expect("quantum half missing");
        let qpk: [u8;1952]=self.pq.clone().try_into().unwrap();
        assert!(env::ml_dsa_verify(&pq,&digest,&qpk),"quantum half missing or invalid");
        assert!(!self.migration_pending,"migration pending");
        self.nonce=self.nonce.checked_add(1).expect("nonce overflow");
        let is_migration=matches!(i.action,Action::Migrate);
        let operation=match i.action {
            Action::Send { receiver, amount } => { self.check_target(&receiver,amount.0); Promise::new(receiver).transfer(NearToken::from_yoctonear(amount.0)) },
            Action::Call { receiver, method, args, deposit } => {
                self.check_target(&receiver,deposit.0);
                assert!(!method.is_empty() && method.len()<=128,"invalid method");
                Promise::new(receiver).function_call(method,args.0,NearToken::from_yoctonear(deposit.0),Gas::from_tgas(35))
            },
            Action::Migrate => {
                assert!(!self.migrated,"already migrated"); self.migration_pending=true;
                let key=PublicKey::from_parts(CurveType::MLDSA65,self.pq.clone()).expect("invalid native key");
                Promise::new(env::current_account_id()).add_full_access_key(key)
            }
        };
        env::log_str(&format!("MAGEN_AUTHORIZED nonce={} dual_verified=true",i.nonce.0));
        operation.then(Promise::new(env::current_account_id()).function_call("settle",near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({"migration":is_migration,"nonce":i.nonce})).unwrap(),NearToken::from_yoctonear(0),Gas::from_tgas(8)))
    }
    #[private]
    pub fn settle(&mut self, migration: bool, nonce: U64) -> bool {
        let success=matches!(env::promise_result(0),PromiseResult::Successful(_));
        if migration { self.migration_pending=false; if success {self.migrated=true;} }
        env::log_str(&format!("MAGEN_SETTLED nonce={} success={} migration={}",nonce.0,success,migration));
        success
    }
}
impl Wallet {
    fn check_target(&self, receiver: &AccountId, amount: u128) {
        assert_ne!(receiver,&env::current_account_id(),"self calls forbidden");
        assert!(amount<=env::account_balance().as_yoctonear().saturating_sub(500_000_000_000_000_000_000_000),"keep 0.5 NEAR for storage");
    }
}
