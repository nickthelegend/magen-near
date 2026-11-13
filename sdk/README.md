# Magen SDK

TypeScript, no build step (import the `.ts` files). Shared by the web app, the Chrome extension and the phone app.
Network: NEAR testnet (`https://test.rpc.fastnear.com`, with fallbacks on rate limits). Keys never leave the caller.

## Core (`index.ts`, `upgrade.ts`)
- `generateKeys()`, `publicKeys(keys)`, `makeIntent(wallet, nonce, action)`, `signIntent(intent, keys)` → `{intent, ed_sig, pq_sig}`
- `execute(feeSigner, wallet, signed)` → `{hash, success, error, logs}` (calls the wallet contract's `execute`)
- `upgradeInPlace(account, seed, wasm, existingKeys)` — one tx: DeployContract + new + DeleteKey + AddKey(execute-only)
- `guardians.ts` (contract magen-2): `setGuardians(pubs, k)`, `makeRecovery(...)`, `guardianSign(...)`, `submitRecovery(...)`

## Phase 2 (`phase2.ts`)

| Export | Signature | Uses |
|---|---|---|
| `chainAddresses` | `(wallet: string) => Promise<{id, name, network, scheme, path, domain, key, address}[]>` | `v1.signer-prod.testnet` `derived_public_key` (view), predecessor = the Magen wallet |
| `signCrossChain` | `(fee: Signer, wallet: string, keys: Keys, req: {chain:'ethereum', tx: EthTx, from: string} \| {payload, path, domain}, opts?: {dropPq?}) => Promise<{hash, success, error, signature, raw?}>` | the wallet's `execute` → `Call v1.signer-prod.testnet.sign` (1 yocto) after ed25519 + ML-DSA-65 verify |
| `stealthSend` | `(fee: Signer, wallet: string, keys: Keys, recipientMetaKey: string, amountNear: string) => Promise<{hash, success, error, account, note}>` | the wallet's `execute` (send) to a one-time implicit account |
| `stealthScan` | `(keys: Keys, note: string) => Promise<{account, seed, balance: bigint \| null}>` | `view_account` |
| `stealthSweep` | `(oneTime: {account, seed}, to: string) => Promise<{hash, success}>` | DeleteAccount from the one-time account (classical ed25519 key) |
| `intentsQuote` | `(from: 'wNEAR'\|'ZEC'\|'SOL'\|'ETH'\|'BTC', to: same, amount: string, recipient: string) => Promise<{amountIn, amountOut, usdIn, usdOut, seconds, status}>` | 1Click mainnet API, `dry: true` only — **quote only, mainnet funding required** |
| `metaKey` | `(keys: Keys) => string` | the recipient's publishable `magen-meta:…` key |

```ts
import { chainAddresses, signCrossChain, stealthSend, stealthScan, stealthSweep, intentsQuote, metaKey } from '../../sdk/phase2.ts';
const addrs = await chainAddresses('magen-ana.testnet');
const r = await stealthSend(feeSigner, vault.wallet, vault.keys, 'magen-meta:…', '0.1'); // share r.note with the recipient
const q = await intentsQuote('wNEAR', 'ZEC', '10', 'root.near');                         // ZEC routes deliver into NEAR Intents
```

Honest limits: the MPC network and the other chains' signatures are classical; the gate (what may be signed) is
quantum-safe. Private send hides the link to the recipient's main account, not the sender, amount or time.
