# Magen build report

Started fresh from scaffold 7997402 on 2026-11-13. Only the October prototype README was read; no source files or code copied. User explicitly requested autonomous progress with no questions.

Decisions: testnet only; guardians deferred; no 3D art; native Q-Day migration is explicitly PQ-only full access and bypasses dual-signature control. No claim that consensus or the entire network is quantum-safe. Browser vault will encrypt secret seeds with a password. Mainnet and testnet both report protocol 88 on Nov 13; previous mainnet-lag assumption no longer applies.

No deployment or film completed yet. Subsequent steps append evidence here.

Contract compiled with Rust 1.95.0, cargo-near 0.22.0 and near-sdk 5.30.0-rc.1; 167,326-byte WASM. Live wallet: shield.magen-mwf26bd5.testnet, deploy-and-lock sJhhvMHoE1BF7DWCrVfJmDgnK5iYxU9pc6wzqLSDBdQ. Immediate finality reads initially returned stale keys; the later finalized query confirmed zero. SDK uses optimistic views for consistent reads immediately following executed receipts. Helper initially returned before account finalization; resumed by reading existing account, never recreated it.

Ten live attack/payment cases recorded in deployments/attacks.json: nine rejected attempts and one valid dual-signed transfer. Browser QA waits for the required shared Chrome lock; no competing browser launched. Rainbow leader capture aborted navigation; other leaders captured. Impeccable mechanical detector returned no findings.

Browser film v1 successfully sent 1 NEAR, submitted a rejected forged PQ half, created shield.magen-film-mwf2kq5t.testnet entirely in-browser, and migrated it to a native ML-DSA-65 full-access key. NearBlocks presented Cloudflare verification. We did not bypass it. The film will say this honestly and show the direct RPC access-key response in the app instead of claiming an explorer render. Native proof capture resumes from the saved encrypted backup; send/create/migration will not be repeated. Leaving the app for the explorer correctly clears in-memory keys; re-unlock is required on return.

Independent UI reviewer found one grouped issue: secondary-text contrast. Darkened existing secondary colors in a single batch; composition unchanged. Onboarding backup now also retains the disposable deploy seed in encrypted form for manual interrupted-setup recovery; it is deleted from chain during successful setup. No plaintext secret is served or committed.

Film v1 rendered at 2:35.71, 1920×1080 H264/AAC plus 720p share. Independent strict judge scored 7/10: small evidence, static framing, migration labels, forged-vs-missing wording. V2 uses tighter crops of the same live transactions, read-only expanded RPC proof (account, block, FullAccess permission and ML-DSA handle), corrected authority language and existing-receipt verification. No new payment or migration was sent. The public readiness number is explicitly a checklist, not a security rating; the closing film crop focuses the actual balance.

Finalized receipt verification checked16 known txs. Two browser setup hashes were not captured by the initial recorder; a read-only block scan hit FastNear RPC rate limits, stopped, and is trying official testnet RPC. They must not be invented. Explorer-page capture remains BLOCKED by external verification; native key/transfer are proved independently over RPC.

Cross-contract functionality additionally proven live: DomrPPW1kJRP3r2kcdYfxspvW7h2rsprryFijHyakAQA (dual-signed call to film wallet status). Final read-only receipt audit now17/17 FINAL; native proof's actual transaction key type recorded as ml-dsa-65. Official rpc.testnet.near.org fallback reports endpoint deprecated; stopped the browser-creation block scan. Exact setup tx hashes remain unrecorded, while account state, migration and native spend are final and recorded. No success invented to fill the gap.
