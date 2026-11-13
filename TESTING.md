# Testing

SDK: `npm test` — 10 passing Node tests. Real noble ed25519 / ML-DSA-65 signatures; forged halves, altered intent/wallet, exact amount parsing, key-hash derivation, AES-GCM backup roundtrip and wrong password. No network mocks.

Contract build: `CARGO_TARGET_DIR="$PWD/target" cargo near build non-reproducible-wasm --manifest-path contracts/Cargo.toml --no-abi`. Rust 1.95, near-sdk 5.30.0-rc.1. WASM checksum in build log; shipped web/public/wallet.wasm matches deployed binary.

Live: deployments/attacks.json contains 10 executed transactions: one valid dual transfer, nine rejections (forged classical, forged quantum, missing quantum, modified message, wrong instance, expired message, unauthorized migration, self call, replay). Public RPC, actual test tokens; no fabricated receipts.

Sandbox: scripts/sandbox.ts uses near-workspaces JS 5 with pinned near-sandbox 2.14.0-rc.4 executable in .demo (download URL in setup history). Results pending in deployments/sandbox-tests.json. JS near-workspaces requires rpcAddr and port to agree; Node 26 cannot use its rm option for existing directories. Fresh homeDir and rm:false avoid that harness defect. SDK's signing domain is testnet even in this isolated test chain to exercise the exact deployed contract.

Web: `npm run build` typechecks and builds. Mechanical design detector: zero findings. Route matrix, overflow, runtime errors and screenshot paths are recorded in FLOW-QA.md and deployments/ui-qa.json after lock acquisition. Encrypted demo backup is local-only; no signing keys are served by the app.

Not audited. No recovery/guardian implementation. Dependency audit issues in near-workspaces' test-only transitive tree are not shipped to browser. Source and full receipts are available for independent review.
