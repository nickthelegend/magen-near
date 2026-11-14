# Magen · מגן

**A quantum-safe multichain wallet for iPhone, Chrome and the web: every move needs a classical and a post-quantum signature, checked on NEAR.**

> **Judges and screening agents:** start at [JUDGES.md](JUDGES.md). `node scripts/judge-verify.mjs` re-checks all 12 on-chain proofs (NEAR testnet + Ethereum Sepolia) with no install and no keys.

- Bitcoin, Ethereum, Solana and NEAR all sign with ECDSA or EdDSA keys. Shor's algorithm on a large quantum computer recovers a private key from its public key.
- Any account that has ever signed has already published its public key, so it can be harvested now and cracked later.
- NIST standardised ML-DSA in FIPS 204 (Aug 2024). Magen puts an ML-DSA-65 lock on your NEAR account and releases every other chain's signature (NEAR Chain Signatures) only after both locks pass on chain.

### Proof (NEAR testnet, Ethereum Sepolia, Solana devnet)

| What | Transaction |
|---|---|
| Dual-signed `execute` (ed25519 + ML-DSA-65 verified by the wallet contract) | [8zE68i…](https://testnet.near.rocks/tx/8zE68ivr8yqCAxMZdH7jfWfCAPmzLUzSrn7DSz95AhoU) |
| 2-of-3 ML-DSA-65 guardians set | [4WnbGu…](https://testnet.near.rocks/tx/4WnbGuP8Ae7wji3qAj836zGFj2XAxJb4rMmeNQoxo6rp) |
| Q-Day switch: native ML-DSA-65 full-access key | [BAWh3d…](https://testnet.near.rocks/tx/BAWh3doDhZsfYMT7uzrnLS8i59rwLMKdA1TTNE7XZbTF) |
| Chain Signatures send on Sepolia, gated by both locks | NEAR [Efwjsz…](https://testnet.near.rocks/tx/Efwjsz3s1SQfYarn3Mkym8XQxRxNkvifa5cSDFJdHZ6M) → Etherscan [0xd8cee1…](https://sepolia.etherscan.io/tx/0xd8cee16543ec97decb4370d601d3d7e01d0e74dbc11b1132139ec2980a1092c0) |
| Same request without the ML-DSA half: **refused on NEAR** | [3QXq3W…](https://testnet.near.rocks/tx/3QXq3Wegps8W2mKb13PoxcjoAMwA2vHzgrdE5UzCW2y8) ("quantum half missing") |
| Bitcoin testnet deposit minted as nBTC by Omni | [3ozwi6…](https://testnet.near.rocks/tx/3ozwi6xYKwSXFWDhbQbANDNWg1YH2rt9XzGSLqbrrj66) |
| Swap NEAR → USDT on Ref (4 calls, one dual-signed approval) | [244z9R…](https://testnet.near.rocks/tx/244z9RSELiRdQmhvDmV7sxBS3vMw6zNGE8xavcfGQTVi) |
| Bridge out NEAR → Solana devnet via Omni | [7zHBYK…](https://testnet.near.rocks/tx/7zHBYKkdvHn5umWv3eAVZgiww3FN7NSRmoqaCx7U66at) |

Records: [`deployments/sepolia-mpc-live.json`](deployments/sepolia-mpc-live.json), [`deployments/film-v15-live.json`](deployments/film-v15-live.json).

> **What is quantum-safe and what isn't.** Quantum-safe: the NEAR wallet contract's ML-DSA-65 check on every action, the guardians, and the native ML-DSA-65 key after the Q-Day switch. Still classical: NEAR's Chain Signatures MPC network, the signatures Bitcoin, Ethereum and Solana themselves verify, and the Omni bridge relayers. Magen guarantees nothing leaves NEAR, and no other-chain signature is requested, without your quantum-safe signature.

**Tests:** `npm test` 28 pass, 0 fail, 1 skipped · sandbox (near-sandbox, real contract): 13 + 19 upgrade + 14 guardian tests. **Film:** `videos/magen-near/magen-near-film.mp4` (iPhone app, every action live). NEAR testnet preview, not audited.

---

**Keep your NEAR account. Add a second lock a quantum computer can't pick.**

Magen upgrades an account you already have, in place, so every payment needs **two signatures**: your existing ed25519 key and a new post-quantum **ML-DSA-65** key. The wallet contract checks both on chain with NEAR's own host functions, `env::ed25519_verify` and `env::ml_dsa_verify`. When classical keys stop being safe, the **Q-Day switch** adds the ML-DSA-65 key to the same account as a native NEAR access key.

It ships on three surfaces that share one SDK:

| Surface | What it does | Where |
|---|---|---|
| **Chrome extension** (MV3) | Popup wallet (balance, send, receive, activity, keys, Q-Day switch, drill). dApps connect through `window.magen`; every request opens an approval window that says **"Signed twice: classical + quantum-safe"**. | `packages/extension`, [zip](web/public/downloads/magen-extension.zip) |
| **iPhone app** (Expo, Release build) | Upgrade in place, dual-signed send, a centre **Scan** button (camera, scan from photo, paste) that reads NEAR accounts and `magen://pay` requests, a lattice QR for receiving, activity, Q-Day switch. Keys live in the iOS keychain; ML-DSA-65 signs on the phone. | `packages/mobile`, [iOS Simulator build](web/public/downloads/Magen-NEAR-iOS-Simulator.zip) (SHA-256 `a30cffbca37a6f212bc1b99dec94c02da542a4a8d582aa4ff5cee6a67c3e49a2`) |
| **Web** | The front door: a read-only **quantum readiness scan** of any NEAR account, the **"steal the key, still get nothing" drill**, and the full wallet. | `web/` |

All three also have **Every chain** (ETH/BTC/SOL/Cosmos addresses from NEAR Chain Signatures that the MPC signs for only after both signatures verify on NEAR; the other chains and the MPC stay classical), **Private send** (one-time receiving accounts) and **Swap & bridge** (live NEAR Intents quotes; quote only, mainnet funding required). See [BLOCKED.md](BLOCKED.md) for what is quote-only or local-chain only.

NEAR testnet preview. Not audited.

## Why NEAR, why now

- A quantum computer recovers a private key from its public key. On NEAR every account's keys are public (`view_access_key_list`), and a 64-character implicit account *is* its public key. Keys can be harvested today and forged later.
- On NEAR an account is not its key. A named account can change its lock without moving funds, so Magen upgrades in place. Other "quantum-safe wallets" are new chains, ~1.8M-gas EVM add-ons, or fresh vaults you must move into (NEAR Mobile 4.1 vaults can't convert existing accounts).
- NEAR's native ML-DSA-65 keys (NEP-645, protocol 85+) are one scheme per key. Magen enforces **both** schemes at once, the hybrid posture EU agencies recommend during the transition. Mainnet and testnet both run protocol 88 (checked Nov 13 2026), so `ml_dsa_verify` (87+) is live on both.

## How the upgrade works

One atomic transaction, signed by the account's own key:

1. `DeployContract` — the Magen wallet contract (`contracts/src/lib.rs`).
2. `new(ed25519, ml_dsa_65)` — your current key becomes lock 1; a new ML-DSA-65 key made on your device becomes lock 2.
3. `DeleteKey` — every full-access key goes.
4. `AddKey` — your old key comes back as a **function-call key that may only call `execute`**: it can ask, never authorise.

**Guardians (magen-2):** the owner can name up to five ML-DSA-65 guardian keys with a k-of-n threshold (dual-signed). If the device is lost, `recover()` takes k valid guardian signatures over a nonce- and expiry-bound request, swaps both locks to keys made on the new device, removes the old key and installs the new execute-only key. Guardians can never spend.

Every spend is an intent `{network, wallet, nonce, expires, action}`; both keys sign `sha256("magen:v1:" + intent)`. The contract rejects a wrong or missing half, a replay (nonce), an expired or edited intent, the wrong wallet, and calls to itself. `migrate` (the Q-Day switch, also dual-signed) adds the ML-DSA-65 key as a native full-access key; NEAR then lists it as `ml-dsa-65-hash:…` and [NEAR Rocks](https://testnet.near.rocks) marks the account **Quantum-safe**.

## The drill: steal the key, still get nothing

A clearly labelled **simulated key compromise**. Two look-alike accounts get classical keys from a deliberately tiny space (2^18 = 262,144 seeds), so a laptop can play the quantum computer. The attacker reads each public key from the chain, brute-forces the private key in browser workers (≈5 s), then:

- the **plain** account is drained with the recovered key (`DeleteAccount` to the attacker);
- the **Magen** account, upgraded in place, receives a valid classical signature from the same kind of stolen key and **refuses on chain: "quantum half missing"**.

Real ed25519 keys come from 2^256 seeds; the drill never claims a real quantum attack.

## Live on NEAR testnet

| What | Account / tx | Result |
|---|---|---|
| Drill (film run): plain account drained | [2UiFv27…](https://testnet.near.rocks/tx/2UiFv27dFmzVp8MzeNChhm6TKMGqxpFVm8NhHGhLGFH8) | drained by the recovered key |
| Drill (film run): same attack on Magen | [E7ikQaX…](https://testnet.near.rocks/tx/E7ikQaX5yqGJEyA3gcZJkkWPtvtgkNwm7rmjebprKso) | refused: quantum half missing |
| Drill (scripted run): drain / refusal | [5WoMf2P…](https://testnet.near.rocks/tx/5WoMf2PPejywKTzt8bqbz7gEHoj9B2iUK9XbNLR1quvS) / [DaXHZWK…](https://testnet.near.rocks/tx/DaXHZWKeXUGy2iyy3ZJdxme4TGmkDjQ1nMXZyGiQyYxs) | drained / refused |
| Extension: in-place upgrade of `magen-leo.testnet` | [9C476mF…](https://testnet.near.rocks/tx/9C476mFyCnZtLJqx8tNw9QSRyX5uuSCc2z5yEaxFyyeL) | Deploy + new + DeleteKey + AddKey(execute) |
| Extension: dApp tip via `window.magen`, signed twice | [BpGJ8H3…](https://testnet.near.rocks/tx/BpGJ8H33LWKiewXqkJHeF9xjVnownshJp1xq55qYitbh) | both signatures verified |
| Phone: in-place upgrade of `magen-maya.testnet` | [4xgu9Bw…](https://testnet.near.rocks/tx/4xgu9Bw4546vCYs3szXq3sfrxyTiXMNjUcSESB6Cgq6p) | upgraded on the iOS Simulator app |
| Phone: scanned a `magen://pay` QR from a photo, paid 0.01 NEAR to `magen-leo.testnet`, signed twice | [GEQRaWi…](https://testnet.near.rocks/tx/GEQRaWidgnawQ9f7TZkg1Aw8SpvhByDQPL8J6tUaFHMG) | both signatures verified |
| Phone (final build): `magen-noa.testnet` upgraded with an ML-DSA-65 fee key (zero classical keys), sends signed twice, asks the MPC with one signature and is refused, flips the Q-Day switch | [7PmQQyh…](https://testnet.near.rocks/tx/7PmQQyh1KpG49tqWxukXhrGvmdf8VKspnMPm3gqpn394) / [DWvR668…](https://testnet.near.rocks/tx/DWvR6685erXddoD6F6kg4w1rrmKdxNJ3SQ9TbFUay28w) / [4HAYbtm…](https://testnet.near.rocks/tx/4HAYbtmEZSW7NSFDKHCDRoeYUgb9Hoj19w2DtWotcEQ4) | [account](https://testnet.near.rocks/account/magen-noa.testnet): 2 keys, both ML-DSA-65 |
| Quantum-gated Chain Signatures (`magen-ana.testnet` → `v1.signer-prod.testnet`) | refused without ML-DSA [Bmqyf7y…](https://testnet.near.rocks/tx/Bmqyf7yxRueeM7jiaDTAoaAtxYfgADCb9Tq2Wu5XW1GX) / dual-signed [DJHfYfa…](https://testnet.near.rocks/tx/DJHfYfayEgeQrQVS9GgSjSsJqYsr3sdG829ZJWLuj1L3) | ECDSA signature broadcast as a 0.05 ETH transfer on local Anvil ([chains-live.json](deployments/chains-live.json)) |
| Private send to a one-time account | [8qnSy8u…](https://testnet.near.rocks/tx/8qnSy8uAV17d4mJvEHVeErCDde6mnzo382BEJz1ZuWNE) → recipient spends [6sCQAxJ…](https://testnet.near.rocks/tx/6sCQAxJ89tiDroyxoUgD9uTZfVqY8LkqxvomLAQr9FW8) | link to the recipient's main account hidden; amount and time public |
| Phone: send 0.25 NEAR, signed twice on the device | [4m9usua…](https://testnet.near.rocks/tx/4m9usuaJ4uggvEcmyAuYh8NfTusV3XPQfKGnRfUf7kS6) | both signatures verified |
| Phone: Q-Day switch, then classical key removed by the ML-DSA-65 key alone | [28Hidbr…](https://testnet.near.rocks/tx/28HidbrhKeqQ1UwCwVvdPgTPrEKRLxS8QoorK4LMoyyu) → [Gt78Zw1…](https://testnet.near.rocks/tx/Gt78Zw1DFf21xMWCY3BfkwvEKZbmGt8BTQ9ExSASKURD) | [account](https://testnet.near.rocks/account/magen-maya.testnet): 1 key, Quantum-safe |
| Guardians (magen-2): `magen-ana.testnet` sets 2-of-3 ML-DSA-65 guardians, loses its device, two guardians rotate both locks, new device spends | [3C65TEu…](https://testnet.near.rocks/tx/3C65TEuFyepW73Cpq7QUbkBA3m8P8K8oxFrXXhjLeDXj) → [3Hzh5f9…](https://testnet.near.rocks/tx/3Hzh5f9MzmvT2pkdCwf2zkzLddeMtzPxrTsYGAPRqBFN) → [1TKFy7g…](https://testnet.near.rocks/tx/1TKFy7gesuvYudcNL2cFhMpiNk6Yk4PqtLJ5DRs3WFF) | old keys removed, funds untouched |
| First wallet (`shield.magen-mwf26bd5.testnet`): deploy + lock | [sJhhvMH…](https://testnet.near.rocks/tx/sJhhvMHoE1BF7DWCrVfJmDgnK5iYxU9pc6wzqLSDBdQ) | zero access keys |
| Dual-signed transfer / forged quantum half / replay | [GF8RDJD…](https://testnet.near.rocks/tx/GF8RDJDRET3PTYrvayvcPHQyZqFaWby4xLrUfE91r1LS) / [9kq5W4u…](https://testnet.near.rocks/tx/9kq5W4uBpJy24eK5hpjRiq7VCpggRK4oBGA5QrbqHg6d) / [EnvaSeF…](https://testnet.near.rocks/tx/EnvaSeFb9TLUZvZc2bvf1c8Dwz61TXNDnFzs6UNF2k6A) | accepted / refused / refused |
| Q-Day switch → native ML-DSA-65 key → native-signed transfer | [9kaxHA4…](https://testnet.near.rocks/tx/9kaxHA4bTSXnXkLeDL7aE6UZBAQcm5hF3QRcXHQE2xsr) → [8EGTshv…](https://testnet.near.rocks/tx/8EGTshvxxVGKrXgcTftXjWZ4sGVKr8ukDBwnNtiQgu8F) | [account](https://testnet.near.rocks/account/shield.magen-film-mwf2kq5t.testnet) shows "Quantum-safe" |

Pay requests: `magen://pay?to=<account>&amount=<NEAR>&memo=<text>` (also `https://magen-near.vercel.app/#/pay?…`). `magen://send`, `magen://receive` and `magen://scan` open those phone screens.

Wallet contract code hashes (rebuilt from source with the pinned toolchain): magen-1 `BfybLd2PncEnEM3twymN35YYA8q5RheNq1DRSXwpp1p3`, magen-2 with guardians `84P7CKENx6FNQDWktEfr1KiSDfGFo4Bq9cZgM41zj7yV`. Full records in [`deployments/`](deployments) (surfaces: [`surfaces-live.json`](deployments/surfaces-live.json)). Film: [`videos/magen-near/magen-near-film.mp4`](videos/magen-near/magen-near-film.mp4). Test counts in [TESTING.md](TESTING.md).

## Build and run

Node 22+, Rust 1.95 (pinned in `rust-toolchain.toml`), cargo-near 0.22.0.

```sh
npm install
npm test                       # SDK unit tests
npm run test:sandbox           # contract on a local neard 2.14 sandbox (binary in .tools/)
(cd contracts && CARGO_TARGET_DIR=../target/cargo cargo near build non-reproducible-wasm --no-abi --out-dir ../target/near)
npm run dev                    # web on http://127.0.0.1:5340 (demo dApp at /dapp/index.html)
(cd packages/extension && npm run build)    # dist/ → chrome://extensions → Load unpacked
(cd packages/mobile && npm install && npm run build:ios-sim)   # Release .app for Apple-silicon simulators
(cd packages/mobile && npm test)                               # scan parser + QR render-and-decode round trip
```

`window.magen` for dApps:

```js
const { accountId } = await window.magen.connect();
const r = await window.magen.signAndSendTransaction({ receiverId: 'bob.testnet',
  actions: [{ type: 'Transfer', params: { deposit: '100000000000000000000000' } }] });
// r = { transactionHash, success, error }
```

It follows wallet-selector's action shape (one `Transfer` or `FunctionCall` per request). A full wallet-selector module is future work.

## Limits, plainly

- Both keys live on one device (encrypted with your password in the extension/web, in the keychain on iOS). Magen defends against **broken cryptography**, not a stolen unlocked device.
- The execute-only key pays fees; a thief holding only it can burn at most its 1 NEAR fee allowance, never move funds.
- After the Q-Day switch the ML-DSA-65 key alone controls the account at the protocol level (by design).
- **Chain Signatures and validator keys stay classical** on NEAR today; Magen does not make BTC/ETH addresses or consensus quantum-safe.
- In-place upgrade refuses accounts that already run a contract or hold non-ed25519 keys. Testnet only; no audit. Guardian recovery is scripted (`scripts/live-guardians.ts`); the in-app flow sets guardians and shows them, an in-app recovery screen is next. The phone app still embeds magen-1 (no guardians).
- The testnet faucet was rate-limiting during the build, so demo accounts were created through the `testnet` registrar contract or as sub-accounts, paid by our own testnet account.

## Prior work

An October 2026 prototype (near-hybrid-pq-wallet) explored dual-signature verification; Magen is a new codebase written Nov 13-14 for NEAR HACKATHON. No October source was copied; dated commits start at scaffold 7997402.

MIT. Copyright (c) 2026 Nivesh Gajengi.

## Camera-approved signing pass (Nov 14)

The current 1:49 film shows landing, six real approvals, and each matching successful NearValidate receipt. Kokoro am_echo at 0.95; original cinematic low drone, no subtitles or overlay captions. Native Q-Day key state is shown in the app from a live RPC query.

| Action | FINAL testnet receipt |
|---|---|
| upgrade | [HhN3eukjg93jBh5m76cvfun9jqckMpEiJ6cxXtJxB5yu](https://nearvalidate.org/txns/HhN3eukjg93jBh5m76cvfun9jqckMpEiJ6cxXtJxB5yu?network=testnet) |
| send | [EU7LbUWuhTvMVQtpRhE7sJhzvoeycfMjsYPxfuXx8YDR](https://nearvalidate.org/txns/EU7LbUWuhTvMVQtpRhE7sJhzvoeycfMjsYPxfuXx8YDR?network=testnet) |
| chains | [HCRgmBJPDsBM4FpqBfZtHVuzgY8B1UA7gLxBagwUJu24](https://nearvalidate.org/txns/HCRgmBJPDsBM4FpqBfZtHVuzgY8B1UA7gLxBagwUJu24?network=testnet) |
| private | [5eBxXQfPPU9JnxL3A4XaRyMfrK4n7kcYJwC3yqyoCoBJ](https://nearvalidate.org/txns/5eBxXQfPPU9JnxL3A4XaRyMfrK4n7kcYJwC3yqyoCoBJ?network=testnet) |
| recovery | [ELx4bGLxYniea436swpjoGMrrMVBCFWVaUFtzysV8AGB](https://nearvalidate.org/txns/ELx4bGLxYniea436swpjoGMrrMVBCFWVaUFtzysV8AGB?network=testnet) |
| qday | [5kG5kKiG9U59J1Ezw7pVm8AwyWSz8xeAA6AcnY4vfHaX](https://nearvalidate.org/txns/5kG5kKiG9U59J1Ezw7pVm8AwyWSz8xeAA6AcnY4vfHaX?network=testnet) |

New upgraded account: `magen-sign-mwfqr4m8.testnet`; other actions: `magen-ana.testnet`. Recovery payer: `magen-fee-mwfrh6b8.testnet`. The disposable upgrade capture lost its temporary encrypted backup; it must not receive additional funds. Upgrades and recovery now download the encrypted replacement backup before approval/broadcast. Cross-chain footage proves an MPC signature request only. Private send leaves sender, amount and timing public. Q-Day adds a native full-access PQ key and changes the control model.
