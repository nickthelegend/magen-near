# Magen build report

Started fresh from scaffold 7997402 on 2026-11-13. Only the October prototype README was read; no source files or code copied. User explicitly requested autonomous progress with no questions.

Decisions: testnet only; guardians deferred; no 3D art; native Q-Day migration is explicitly PQ-only full access and bypasses dual-signature control. No claim that consensus or the entire network is quantum-safe. Browser vault will encrypt secret seeds with a password. Mainnet and testnet both report protocol 88 on Nov 13; previous mainnet-lag assumption no longer applies.

No deployment or film completed yet. Subsequent steps append evidence here.

Contract compiled with Rust 1.95.0, cargo-near 0.22.0 and near-sdk 5.30.0-rc.1; 167,326-byte WASM. Live wallet: shield.magen-mwf26bd5.testnet, deploy-and-lock sJhhvMHoE1BF7DWCrVfJmDgnK5iYxU9pc6wzqLSDBdQ. Immediate finality reads initially returned stale keys; the later finalized query confirmed zero. SDK uses optimistic views for consistent reads immediately following executed receipts. Helper initially returned before account finalization; resumed by reading existing account, never recreated it.

Ten live attack/payment cases recorded in deployments/attacks.json: nine rejected attempts and one valid dual-signed transfer. Browser QA waits for the required shared Chrome lock; no competing browser launched. Rainbow leader capture aborted navigation; other leaders captured. Impeccable mechanical detector returned no findings.
