# Magen · מגן

Your NEAR account, safe from quantum computers. A fresh hybrid post-quantum wallet built November 13–14 for NEAR HACKATHON 2026.

**[Open the live wallet](https://magen-near.vercel.app)** · [Download the source](https://magen-near.vercel.app/magen-source.zip) · NEAR testnet · unaudited preview

Every send and contract call requires **ed25519 AND ML-DSA-65 signatures**, verified on chain by `env::ed25519_verify` and `env::ml_dsa_verify`. Both sign a SHA-256 digest of the same expiring intent, bound to network, wallet, nonce and action. The deploy key is deleted atomically with initialization. No access key can bypass this contract in hybrid mode.

The **Q-Day switch** adds the owner's ML-DSA-65 public key as a native full-access key. The account stays the same, but control changes to **PQ-only**: that key can act independently, move funds, and change the contract. This is an explicit migration out of strict two-key control, not an extra signature requirement. NEAR exposes the stored key as `ml-dsa-65-hash:` with the domain-separated SHA3-256 handle. Magen checks that handle against the browser-generated key.

## Try it

The app opens the live demonstration account read-only. Inspect balances, access keys and explorer receipts without installing anything. To sign, choose **Create an account** (the public testnet helper must be available) or unlock your encrypted backup. Keys are generated in the browser with noble cryptography. Independent 32-byte seeds are encrypted using PBKDF2-SHA256 (310,000 iterations) and AES-256-GCM. Password and backup are both required. There is no recovery service; use test funds only.

Create downloads the backup before deploying. The parent account pays gas and creates a child wallet. Its classical gas key cannot authorize the child's spending. A relayer submits dual-signed intents; contract authorization does not trust the relayer. Local receipt activity is not a complete indexer history. No USD price or fabricated chart is shown.

## Live deployment

| Account | Role | Evidence |
|---|---|---|
| [shield.magen-mwf26bd5.testnet](https://testnet.nearblocks.io/address/shield.magen-mwf26bd5.testnet#keys) | Public hybrid wallet, zero access keys | [Deploy + initialize + delete key](https://testnet.nearblocks.io/txns/sJhhvMHoE1BF7DWCrVfJmDgnK5iYxU9pc6wzqLSDBdQ) |
| [magen-mwf26bd5.testnet](https://testnet.nearblocks.io/address/magen-mwf26bd5.testnet) | Testnet gas sponsor / recipient | [Wallet creation](https://testnet.nearblocks.io/txns/2aDuH7sK8BAeL1croLpETF4185oygFVVYaosRqm46PiD) |

[Browser proof](deployments/browser-film.json) · [Final receipt audit](deployments/verified-live.json) · [Deployment record](deployments/testnet.json) · [Live attack receipts](deployments/attacks.json) · [Testing](TESTING.md) · [Flow QA](FLOW-QA.md)

| On-chain check | Result | Receipt |
|---|---|---|
| Dual-signed transfer | Accepted | [GF8RDJD…](https://testnet.nearblocks.io/txns/GF8RDJDRET3PTYrvayvcPHQyZqFaWby4xLrUfE91r1LS) |
| Forged quantum half | Rejected | [9kq5W4…](https://testnet.nearblocks.io/txns/9kq5W4uBpJy24eK5hpjRiq7VCpggRK4oBGA5QrbqHg6d) |
| Forged classical half | Rejected | [FUx6zP…](https://testnet.nearblocks.io/txns/FUx6zP2sDZMeStnetexsTxLXS3EXQnVqyq3MwH9w6SJ2) |
| Replay | Rejected | [EnvaSeF…](https://testnet.nearblocks.io/txns/EnvaSeFb9TLUZvZc2bvf1c8Dwz61TXNDnFzs6UNF2k6A) |
| Unauthorized migration | Rejected | [9eanmYa…](https://testnet.nearblocks.io/txns/9eanmYauW8zVWKqpaZ9ezkogoXfZXf4McfV7dMLVFpMA) |

RPC checks on Nov 13: **testnet and mainnet both protocol 88**. The host function requires protocol 87+. Magen deliberately refuses mainnet intents; this release uses testnet only. [NEAR SDK host implementation](https://github.com/near/near-sdk-rs/blob/master/near-sdk/src/environment/env.rs), [NEP-645 native PQ access keys](https://github.com/near/NEPs/blob/master/neps/nep-0645.md). The host function is a later protocol addition than the original NEP's scope.

Browser-created film account: [shield.magen-film-mwf2kq5t.testnet](https://testnet.nearblocks.io/address/shield.magen-film-mwf2kq5t.testnet#keys), now native PQ-only full access. [Migration](https://testnet.nearblocks.io/txns/9kaxHA4bTSXnXkLeDL7aE6UZBAQcm5hF3QRcXHQE2xsr) · [Native-signed transfer](https://testnet.nearblocks.io/txns/8EGTshvxxVGKrXgcTftXjWZ4sGVKr8ukDBwnNtiQgu8F).

Browser setup receipts: [create](https://testnet.nearblocks.io/txns/8Aorejg3kgYnJ4LrzsLVe4ZsLcus1K7gL9DcT5d4NPzz) · [deploy + initialize + delete key](https://testnet.nearblocks.io/txns/EmXr8VNe86Pk9Ceys5wQ3ic4teGQZH2bdHbV8JfPSBsY).

A dual-signed cross-contract call to the film wallet status method also succeeded: [receipt](https://testnet.nearblocks.io/txns/DomrPPW1kJRP3r2kcdYfxspvW7h2rsprryFijHyakAQA).

## Build

Node 22+, Rust 1.95 (pinned), cargo-near 0.22.0.

```sh
npm install
npm test
CARGO_TARGET_DIR="$PWD/target" cargo near build non-reproducible-wasm --manifest-path contracts/Cargo.toml --no-abi
npm run dev  # http://127.0.0.1:5391
npm run build
```

Packages: `contracts/` Rust wallet, `sdk/` signing/serialization/encrypted backup helpers, `web/` Vite React app, `scripts/` reproducible deployment and QA tools, `deployments/` public receipts. Private demo material stays in gitignored `.demo/`. Never run live deployment or film scripts without inspecting their saved state first; transactions must not be repeated after a timeout.

The SDK's minimal Borsh encoder supports the exact action variants used here. It is not a general NEAR SDK. Signed intents verify the encoded JSON bytes, not a reserialized object. On receiving-contract failure, the nonce stays consumed and `settle` returns false; UI checks receipt failures and that return value. Self-calls are prohibited; settlement is private. Keep 0.5 NEAR for storage.

## Limits

No independent security audit. Browser XSS/device compromise can expose both signing keys. No guardians or recovery. A classical relay key remains for gas only in hybrid mode. NEAR validator and consensus signing are outside scope; Magen does not make the whole blockchain quantum-safe. Native full-access migration can bypass the contract. Test helper availability and explorer support are external dependencies.

## Prior work

An October 2026 prototype (near-hybrid-pq-wallet) explored dual-signature verification; Magen is a new codebase written Nov 13-14 for NEAR HACKATHON.

No October source files or code were copied. Only its README was read for toolchain context. Dated commits begin with scaffold 7997402 and fresh implementation 5d0516b.

MIT. Copyright (c) 2026 Nivesh Gajengi.
