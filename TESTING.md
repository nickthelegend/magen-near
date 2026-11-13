# Testing

No mocks: every chain test sends real transactions, to a local NEAR node (neard 2.14.0-rc.4 sandbox, protocol 88) or to NEAR testnet.

| Suite | Command | Count | What it covers |
|---|---|---|---|
| SDK unit tests | `npm test` | **10 / 10** | real ed25519 + ML-DSA-65 signatures; forged classical half, forged quantum half, edited recipient, wrong wallet; native key handle format; exact 24-decimal amounts; encrypted backup round-trip and wrong password |
| Contract on local NEAR node | `npm run test:sandbox` (`scripts/sandbox.ts`) | **13 / 13** | valid dual send; forged ed25519; forged ML-DSA; missing quantum half; wrong message; wrong wallet; expired intent; migration by non-owner; nonce replay; self-call blocked; private callback; native migration; migration settles |
| Upgrade + drill on local NEAR node | `npm run test:sandbox` (`scripts/sandbox-upgrade.ts`) | **16 / 16** | precheck accepts / refuses wrong key / refuses second upgrade; one-tx in-place upgrade leaves exactly one execute-only key; old key can't transfer natively; dual-signed send via the execute-only key; attacker recovers both weak keys from public data; plain account drained; same attack on Magen refused ("quantum half missing"); self-made ML-DSA key refused; Magen keeps its funds; Q-Day switch adds the native `ml-dsa-65-hash` key; readiness scan scores 100 / 15; recovery-phrase derivation and rejection |
| **Total automated** | | **39 / 39** | |

Results: [`deployments/sandbox-tests.json`](deployments/sandbox-tests.json), [`deployments/sandbox-upgrade-tests.json`](deployments/sandbox-upgrade-tests.json).

## Live on NEAR testnet

| Run | Evidence | Outcome |
|---|---|---|
| 10 attack / payment transactions (first wallet) | [`deployments/attacks.json`](deployments/attacks.json), re-verified FINAL over RPC on Nov 13 | 1 accepted, 9 refused with the contract's reason |
| Scripted drill | [`deployments/drill-live.json`](deployments/drill-live.json) | plain drained; Magen refused; Magen still 4.00 NEAR |
| Film drill (in the web app, browser workers) | README table | plain drained; Magen refused |
| Extension end-to-end (Playwright Chromium, `--load-extension`) | [`deployments/extension-e2e.json`](deployments/extension-e2e.json), `scripts/ext-e2e.mjs` | popup upgraded an account in place; demo dApp tipped through `window.magen`; both signatures verified |
| Phone (Release build, iOS Simulator) | README table | in-place upgrade with keys made on the device |

## UI

`node scripts/shots.mjs <name>` captures every route at 1440 and 375 with overflow and runtime-error checks (screens in `orchestration/shots/magen/`). Latest pass: 0 horizontal overflow, 0 runtime errors. See FLOW-QA.md.

## Build checks

- `npx tsc -p web --noEmit` and `npm run build` (web), `npm run build` in `packages/extension`, `npx tsc --noEmit` in `packages/mobile`.
- Rebuilding the contract from source gives sha256 `9e90edc7…64efb0`, base58 code hash `BfybLd2PncEnEM3twymN35YYA8q5RheNq1DRSXwpp1p3`, equal to the on-chain code of every Magen account.

Not audited.
