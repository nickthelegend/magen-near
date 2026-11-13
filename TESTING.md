# Testing

No mocks: every chain test sends real transactions, to a local NEAR node (neard 2.14.0-rc.4 sandbox, protocol 88) or to NEAR testnet.

| Suite | Command | Count | What it covers |
|---|---|---|---|
| SDK unit tests | `npm test` | **10 / 10** | real ed25519 + ML-DSA-65 signatures; forged classical half, forged quantum half, edited recipient, wrong wallet; native key handle format; exact 24-decimal amounts; encrypted backup round-trip and wrong password |
| Contract on local NEAR node | `npm run test:sandbox` (`scripts/sandbox.ts`) | **13 / 13** | valid dual send; forged ed25519; forged ML-DSA; missing quantum half; wrong message; wrong wallet; expired intent; migration by non-owner; nonce replay; self-call blocked; private callback; native migration; migration settles |
| Upgrade + drill on local NEAR node | `npm run test:sandbox` (`scripts/sandbox-upgrade.ts`) | **16 / 16** | precheck accepts / refuses wrong key / refuses second upgrade; one-tx in-place upgrade leaves exactly one execute-only key; old key can't transfer natively; dual-signed send via the execute-only key; attacker recovers both weak keys from public data; plain account drained; same attack on Magen refused ("quantum half missing"); self-made ML-DSA key refused; Magen keeps its funds; Q-Day switch adds the native `ml-dsa-65-hash` key; readiness scan scores 100 / 15; recovery-phrase derivation and rejection |
| Guardians (contract magen-2) on local NEAR node | `npm run test:sandbox` (`scripts/sandbox-guardians.ts`) | **14 / 14** | upgrade with magen-2; recovery refused without guardians; guardians can't be set with the classical key alone; owner sets 2-of-3 (dual-signed); one guardian alone refused; same guardian twice refused; non-guardian signature refused; signature over different new keys refused; expired recovery refused; valid 2-of-3 rotates both locks, removes the old key and adds the new execute-only key; funds untouched; replayed recovery refused; old device can no longer act; new device spends |
| **Total automated** | | **53 / 53** | the magen-1 suites (29) also pass unchanged on magen-2 |

Results: [`deployments/sandbox-tests.json`](deployments/sandbox-tests.json), [`deployments/sandbox-upgrade-tests.json`](deployments/sandbox-upgrade-tests.json).

## Live on NEAR testnet

| Run | Evidence | Outcome |
|---|---|---|
| 10 attack / payment transactions (first wallet) | [`deployments/attacks.json`](deployments/attacks.json), re-verified FINAL over RPC on Nov 13 | 1 accepted, 9 refused with the contract's reason |
| Scripted drill | [`deployments/drill-live.json`](deployments/drill-live.json) | plain drained; Magen refused; Magen still 4.00 NEAR |
| Film drill (in the web app, browser workers) | README table | plain drained; Magen refused |
| Extension end-to-end (Playwright Chromium, `--load-extension`) | [`deployments/extension-e2e.json`](deployments/extension-e2e.json), `scripts/ext-e2e.mjs` | popup upgraded an account in place; demo dApp tipped through `window.magen`; both signatures verified |
| Phone (Release build, iOS Simulator) | [`deployments/surfaces-live.json`](deployments/surfaces-live.json) | upgrade, dual-signed send, Q-Day switch, classical key removed by the ML-DSA-65 key |
| Guardians (magen-2) | [`deployments/guardians-live.json`](deployments/guardians-live.json), `scripts/live-guardians.ts` | 2-of-3 set, recovery by two guardians, old device refused, new device spends |

## UI

`node scripts/shots.mjs <name>` captures every route at 1440 and 375 with overflow and runtime-error checks (screens in `orchestration/shots/magen/`). Latest pass: 0 horizontal overflow, 0 runtime errors. See FLOW-QA.md.

## Build checks

- `npx tsc -p web --noEmit` and `npm run build` (web), `npm run build` in `packages/extension`, `npx tsc --noEmit` in `packages/mobile`.
- Rebuilding the contract from source gives the on-chain code hashes: magen-1 `BfybLd2PncEnEM3twymN35YYA8q5RheNq1DRSXwpp1p3` (accounts upgraded Nov 13 and the phone app's embedded build) and magen-2 `84P7CKENx6FNQDWktEfr1KiSDfGFo4Bq9cZgM41zj7yV` (guardians; web and extension upgrades from Nov 14).

Not audited.
