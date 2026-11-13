# Testing

SDK: `npm test` — 10 passing Node tests. Real noble ed25519 / ML-DSA-65 signatures; forged halves, altered intent/wallet, exact amount parsing, key-hash derivation, AES-GCM backup roundtrip and wrong password. No network mocks.

Contract build: `CARGO_TARGET_DIR="$PWD/target" cargo near build non-reproducible-wasm --manifest-path contracts/Cargo.toml --no-abi`. Rust 1.95, near-sdk 5.30.0-rc.1. WASM checksum in build log; shipped web/public/wallet.wasm matches deployed binary.

Live: deployments/attacks.json contains 10 executed transactions: one valid dual transfer, nine rejections (forged classical, forged quantum, missing quantum, modified message, wrong instance, expired message, unauthorized migration, self call, replay). Public RPC, actual test tokens; no fabricated receipts.

Sandbox: scripts/sandbox.ts uses near-workspaces JS 5 with pinned near-sandbox 2.14.0-rc.4 executable in .demo (download URL in setup history). Results pending in deployments/sandbox-tests.json. JS near-workspaces requires rpcAddr and port to agree; Node 26 cannot use its rm option for existing directories. Fresh homeDir and rm:false avoid that harness defect. SDK's signing domain is testnet even in this isolated test chain to exercise the exact deployed contract.

Web: `npm run build` typechecks and builds. Mechanical design detector: zero findings. Route matrix, overflow, runtime errors and screenshot paths are recorded in FLOW-QA.md and deployments/ui-qa.json after lock acquisition. Encrypted demo backup is local-only; no signing keys are served by the app.

Not audited. No recovery/guardian implementation. Dependency audit issues in near-workspaces' test-only transitive tree are not shipped to browser. Source and full receipts are available for independent review.

Confirmed sandbox result: **13/13 cases passed** (deployments/sandbox-tests.json): valid dual send, forged Ed, forged PQ, missing PQ, modified message, wrong wallet, expired intent, non-owner migration, replay, self-call block, private callback block, native migration, migration settlement status.

Desktop/mobile route capture: **18/18 pass, zero horizontal overflow, zero browser runtime errors** at 1440 and 375. Independent UI reviewer requested darker secondary text; applied before final confirmation capture.

Read-only final receipt audit: **19/19 known transaction receipts verified FINAL**, including browser send, rejection, migration and native-signature transfer (deployments/verified-live.json). Public demo account remains keyless; film account has exactly one ML-DSA hash full-access key. Setup recovery script is provided for interruptions but is not counted as a tested flow.

Additional non-writing browser regression: backup acknowledgement does not pre-authorize PQ-only migration (deployments/consent-qa.json). No test transaction sent. Final route matrix after proof UI also passes18/18.

Latest expanded matrix: **20/20 viewport-route checks** after adding About and public source download. The source ZIP's34-file SHA256 manifest is verified against its payload and excludes private material. Read-only receipt action display provides DeployContract / FunctionCall(new) / DeleteKey proof without repeating setup.
