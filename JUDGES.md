# Judge guide: Magen (NEAR HACKATHON 2026)

For human judges and for the Claude Code / Codex screening pass (HACKATHON.md Q-017). Every claim below has a command or a link that checks it.

## In one paragraph

**Product:** Magen is a multichain wallet (iPhone app, Chrome extension, web) for NEAR testnet.
**Problem:** Bitcoin, Ethereum, Solana and NEAR accounts are protected by ECDSA/EdDSA keys. A large quantum computer running Shor's algorithm recovers a private key from its public key, and any account that has ever signed has already published that public key.
**What Magen does:** It upgrades an existing NEAR account in place so that every action needs two signatures: the user's ed25519 key and an ML-DSA-65 post-quantum key (NIST FIPS 204). The account's own wallet contract checks both on chain, and only then sends NEAR, calls Ref Finance or Omni Bridge, or asks NEAR Chain Signatures to sign for Bitcoin, Ethereum or Solana.
**Tracks:** `security` (primary) and `open`.

## Verify in one command (no install, no keys)

```sh
node scripts/judge-verify.mjs
```

The script needs Node 18+ and nothing else. It checks every proof against public data, not against our own files:
- the FastNEAR transaction API and the NEAR testnet RPC;
- an Ethereum Sepolia public RPC;
- the contract source.

Expected output: `13/13 checks passed.` It exits 0 only if all 13 pass. What it checks:

| # | Check | Source of truth |
|---|---|---|
| 1 | The contract calls `env::ed25519_verify` and `env::ml_dsa_verify` | `contracts/src/lib.rs` (`execute`, lines ~80–92) |
| 2 | Dual-signed `execute` sent NEAR | NEAR testnet tx `8zE68i…` |
| 3 | 2-of-3 ML-DSA-65 guardians set | NEAR testnet tx `4WnbGu…` |
| 4 | Q-Day switch added a native ML-DSA-65 full-access key | NEAR testnet tx `BAWh3d…` |
| 5 | Chain Signatures (`v1.signer-prod.testnet`) returned a signature, requested by the wallet contract only after both locks verified | NEAR testnet tx `Efwjsz…` |
| 6 | The same request without the ML-DSA half was **refused on chain** ("quantum half missing") | NEAR testnet tx `3QXq3W…` |
| 7 | Bitcoin testnet deposit minted as nBTC by Omni Bridge | NEAR testnet tx `3ozwi6…` |
| 8 | Ref Finance swap (4 calls, one dual-signed approval) | NEAR testnet tx `244z9R…` |
| 9 | Omni Bridge NEAR → Solana devnet | NEAR testnet tx `7zHBYK…` |
| 10 | The MPC signature was broadcast on Ethereum Sepolia from the NEAR-derived address | Sepolia tx `0xd8cee1…` |
| 11 | Omni Bridge NEAR → Base Sepolia finalised; wNEAR held by the wallet's Chain Signatures EVM address | Base Sepolia tx `0x3aee1f…`, `balanceOf` |
| 12 | `maya-safe.testnet` lists native `ml-dsa-65-hash:` access keys | `view_access_key_list` |
| 13 | The wallet contract is live (`magen-3`, ML-DSA lock, 3 guardians, threshold 2) | `status()` view |

## Do X → see Y

1. **Run `npm install && npm test`.** You see 28 pass, 0 fail, 1 skipped (SDK: intents, dual signing, HD derivation, multichain encoding).
2. **Run `npm run test:sandbox`.** It deploys the real contract on a local `neard` 2.14 sandbox and runs 13 contract tests, 19 upgrade tests and 14 guardian tests. These cover: a wrong or missing signature half is rejected, replays and expired intents are rejected, calls to self are rejected, the guardian threshold is enforced, and guardians can't spend.
3. **Run `npm run dev` and open http://127.0.0.1:5340.**
   - The landing explains the quantum risk to every chain.
   - Enter any NEAR testnet account for a read-only **quantum readiness scan**.
   - The **drill** brute-forces a deliberately tiny classical key: it drains a plain account, and the same attack on a Magen account is refused on chain.
4. **iPhone app:** unzip `web/public/downloads/Magen-NEAR-iOS-Simulator.zip` and run `xcrun simctl install booted Magen.app`.
   - Create a wallet: you see two locks (ed25519 + ML-DSA-65).
   - Send, Swap (Ref), Bridge (Omni) and Send on Ethereum each open an approval sheet showing "Signed twice: classical + quantum-safe".
   - Each result links to the explorer for both the sender and the receiver.
5. **Watch the film** (iPhone only, every action live on testnet): `videos/magen-near/magen-near-film.mp4`.

## How Magen uses NEAR (specific, not "powered by")

| NEAR feature | How Magen uses it | Where |
|---|---|---|
| `env::ml_dsa_verify` host function (protocol 87+) | Verifies the post-quantum half of every action on chain | `contracts/src/lib.rs` |
| `env::ed25519_verify` | Verifies the classical half | same |
| Accounts that are not their keys + atomic `DeployContract / DeleteKey / AddKey` | Upgrades an existing named account in place. The old key becomes a function-call key that can only call `execute` | `sdk/`, README "How the upgrade works" |
| Native ML-DSA-65 access keys (NEP-645) | The Q-Day switch makes the post-quantum key a protocol-level full-access key | check 4 and check 11 |
| NEAR Chain Signatures (`v1.signer-prod.testnet`) | Bitcoin, Ethereum, Solana and Cosmos addresses. The MPC is only asked to sign after both locks verify | `sdk/chains.ts`, checks 5, 6 and 10 |
| Omni Bridge | Bitcoin and Zcash testnet in (nBTC/nZEC); NEAR out to Solana and EVM testnets | `sdk/omni.ts`, checks 7 and 9 |
| Ref Finance | NEAR ⇄ USDT swaps sent as one dual-signed batch intent | check 8 |
| NEAR Intents 1Click | Live mainnet quotes only (HACKATHON.md Q-007: no testnet) | `sdk/intents.ts` |

## What is quantum-safe and what isn't (read this before scoring)

- **Quantum-safe:** the wallet contract's ML-DSA-65 check on every action, guardian recovery, and the native ML-DSA-65 key after the Q-Day switch.
- **Still classical:** NEAR's Chain Signatures MPC network, the signatures Bitcoin, Ethereum and Solana themselves verify, Omni Bridge relayers, and NEAR validator keys.
- **What Magen guarantees:** nothing leaves the NEAR account, and no other-chain signature is requested, without the user's post-quantum signature.
- **Also note:** testnet only, and not audited. NEAR Intents is quote-only because it is mainnet-only. Remaining gaps are in [BLOCKED.md](BLOCKED.md).

## Repository map

- `contracts/src/lib.rs`: the wallet contract (dual verification, guardians, recovery, migration).
- `sdk/`: shared TypeScript SDK (intents, signing, Chain Signatures, Omni, Ref, Intents quotes).
- `packages/mobile`: the iPhone app (Expo, Release build).
- `packages/extension`: the Chrome MV3 extension with `window.magen`.
- `web/`: landing, readiness scan, drill and web wallet.
- `scripts/`: live testnet runs that wrote `deployments/*.json`, plus `judge-verify.mjs`.
- `deployments/`: raw records of every live run.

## Rules compliance

- Built during the window: new codebase, dated commits from the scaffold `7997402` (README "Prior work").
- Public repo and MIT licence (`LICENSE`).
- Demo post on X with the film.
- One lead, at most 2 projects, with the other project named in the README (Q-015).
