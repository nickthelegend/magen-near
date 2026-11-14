# Magen iPhone app: first-time-user walkthrough (Nov 14, 2026)

How it was tested: Release build of `packages/mobile`, installed on the two booted simulators (iPhone 17 and
iPhone 17 Pro, iOS 26.5). I walked each task tap by tap with simctl screenshots, as someone who doesn't know crypto.
Every transaction is real NEAR testnet, approved in the app's own approval sheet. Test wallet: `magen-phone-14.testnet`,
created and funded (10 test NEAR) by the app's own create flow. Screenshots:
`grokbot/orchestration/shots/magen/walk-phone/` (`sheet.jpg` = all after-fix shots; `before-fix/` = the four shots
that showed bugs fixed later). The 12 words never appear in any shot (they stay masked; `03-words-hidden.png`).

"Before" is the phone app at `a7d8988` plus the uncommitted edits it started from. "After" is `HEAD` (the final
build, zip sha256 `a3c763e3…027b`).

## Pass/fail per task

| # | Task | Before | After | Test tx (NEAR testnet, open on testnet.near.rocks/tx/…) |
|---|------|--------|-------|-----------------------------------------------|
| 1 | Create a wallet: name, then 12 words (hidden), then backup check, then every chain + quantum key, then account on chain, then home | FAIL: random key, no 12 words, no backup step, no chain list | PASS | `81bmwJsG3dj8DQscwBsTFsyExsyMNS12564HnFjDjnKp` (DeployContract + new + DeleteKey + AddKey; account made by the testnet helper just before) |
| 2 | Restore with 12 words | FAIL: no restore (only "paste a private key") | PARTIAL: screen built (name + hidden words + word count + paste); it checks the words against the contract's two public keys, same as web. Not walked to the end: that needs a phrase I could type, and I never display one | none (no transaction) |
| 3 | Receive: NEAR + every chain, copy + QR | FAIL: one NEAR QR only | PASS: NEAR + Bitcoin, Ethereum, Base, Arbitrum, Avalanche, Solana, Cosmos, Zcash, Litecoin, Dogecoin from the words (older wallets: NEAR's MPC addresses), each with QR and Copy | none (no transaction) |
| 4 | Send NEAR, then done, then activity | FAIL: "Sign twice and send" under the tab bar; error banner pushed it further down | PASS: sticky button above the bar; reject → "Transaction rejected. Nothing was broadcast." with the button still visible; done banner links to NEAR Rocks; shows in Activity | `CMiaaq45angaovjWqzF2FUpDCi5REN13eBKvV9Hxwggt` (0.5 NEAR), `8kUkQhYvMHY26oGXp6jYmRU9cdetdyBPqeRKNQ4Yqq3T` (0.2 NEAR, after a reject) |
| 5 | Swap NEAR → USDT on Ref | FAIL: quote only ("mainnet funding required") | PASS: 1 NEAR → 1.2408 USDT, pool #1084, four calls under one dual-signed approval | `8Mr1TuhP3QtJmiaMKNHbwcwPPEt3WcMF4UUDxgJkm3aZ`, `2Q9CMLppRoc7Xm5EHPTs5YMd4dwbBF7LgijHGkEoaMrn` |
| 6 | Bridge in: BTC + ZEC deposit address, status through to minted | FAIL: missing | PASS: BTC and ZEC addresses derived on chain by the connectors (the bridge API agrees), QR + copy, minimum / confirmations / fee, nBTC/nZEC balance. A new wallet shows an empty state with a link to the demo; `magen-noam.testnet` shows 4,000 and 117,485 sats "Minted as nBTC on NEAR" (0.00121085 nBTC), each linking to the mint tx | read-only; no deposit sent from this wallet (needs Bitcoin testnet coins) |
| 7 | Bridge out to Solana (Omni) | FAIL: missing | PASS: 0.5 NEAR to the wallet's own Solana devnet address `8Z2SAZ…re1PBK`, live fee 0.0031 wNEAR, pending, then "Arrived on Solana" with NEAR + Solana links | NEAR `8pG8uYd4FxE4fENAscWG7TYEnB5kSxy1bkGXYcBXGYuN` → Solana `3yvfH4cy…gyyy8`; NEAR `7WLBvPABV2HaihS6BGDqs4ja3twapre15p2AfyNJ2BXB` → Solana `5DQB5j3n…MPzm` (Omni status Settled) |
| 8 | Private send + receive privately | FAIL: send button inside the card; jargon ("meta-key") with no explanation; results as small text links | PASS: "Recipient's private code" explained; sticky Sign button; done banner + Copy the note; receive: Open the note → "0.1 NEAR is waiting" → Move it to an account | send `79bi2NscxQKqS5BoRJ6B9YJnXjET2QHUF9hGxiPjdDY3` (dual-signed); sweep `gGdY7H1dGjnpCrZ3kjJsQBRPDkjnn96KwkrZBn7dzEx` (one-time key, single ed25519 by design) |
| 9 | Guardians setup | FAIL: missing | PASS: 2-of-3 ML-DSA-65 guardians, dual-signed; kits stay in the keychain, with Share kit for each | `88BEEe5qETXkf193uNEp6D4esXoy1L7NsQfRhHjxgxFv` (the earlier `AFgWAZ5W…kq4F3` also succeeded on chain; see bug 1) |
| 10 | Q-Day switch | PARTIAL: only a small toggle; "Q-Day" not explained | PASS: plain explanation + "Turn on the Q-Day switch" button, confirm, approval sheet, "Switched on"; header becomes "PQ native"; NEAR lists an ML-DSA-65 full-access key | `EeJJP1GN1mdUWwPFjh9xLzU1oqCWHC34i7nGZMWKRymz` |
| 11 | Activity with NEAR Rocks links | FAIL: empty while NearBlocks returns HTTP 429 (all session) | PASS: lists the app's own transactions (kept on the phone) merged with NearBlocks when it answers, amounts labelled NEAR; each row opens testnet.near.rocks (checked: the guardians tx opened on NEAR Rocks, `Signer Key PQ ml-dsa-65`) | n/a |
| 12 | Lock | FAIL: missing | PASS: lock button in the header and on Security; Face ID on open and after a minute away; failed match shows "Still locked. Tap Unlock to try again."; a phone with no Face ID or passcode says so plainly and offers "Open anyway" | n/a |

All NEAR wallet actions above (send, swaps, bridge-outs, private send, guardians, Q-Day) were signed twice: the
approval sheet shows "Signed twice · classical + quantum-safe", the contract logs `MAGEN_AUTHORIZED … dual_verified=true`,
and gas was paid by the account's ML-DSA-65 execute-only key (`Signer Key: ml-dsa-65`). Two transactions can't be
dual-signed: creation (the new account's own ed25519 key installs the contract; sheet says "Account authorization")
and the private sweep (signed by the one-time account's own key).

## Walkthrough rules, after the fixes

- **One obvious next step and a way back:** every screen has one primary button in the sticky area and a "Back" or "Home"
  link (onboarding steps show "Step n of 4").
- **Plain words:** ed25519 / ML-DSA-65 always sit next to "today's key" / "quantum-safe". Q-Day, meta-key ("private
  code") and Omni are explained where they appear.
- **Pending, then done or failed, with a link:** create, send, swap, bridge out, private send, guardians and Q-Day all show
  a pending banner, then a done or failed banner with a NEAR Rocks link (bridge out also links the Solana tx).
- **Empty, loading and error states:** loading spinners with words ("Asking the Bitcoin connector on NEAR…"),
  empty deposits ("Nothing has arrived yet." + how to fund), and plain errors ("Enter an amount above zero.",
  "Transaction rejected. Nothing was broadcast."). On HTTP 429, quotes, deposit addresses, MPC addresses and
  history retry quietly with "The testnet server is busy. Retrying by itself…".
- **The tab bar never covers a primary button:** `src/Screen.tsx` pins the action above the bar and the raised Scan
  button and measures itself (banners included), so the scroll padding always matches. Checked on Home (Send/Receive),
  Send (first open, after "Enter an amount above zero", after a reject, after done), Swap, Bridge in and out, Private
  send, Receive. Onboarding has no tab bar; its button sits in a footer.
- **You end up somewhere sensible:** create → "… is ready" → Open my wallet → Home; send → "See it in Activity";
  swap → "Swap again"; bridge → "Send more to Solana".
- **No fake numbers, units labelled:** balances, quotes, fees, deposits and pool depth are live reads; amounts show
  NEAR / USDT / wNEAR / sats / nBTC; the swap shows "(estimated)" and the minimum received.

## Bugs found and fixed during the walk

1. Guardians showed "Guardians were not set" although the transaction succeeded. The kits were saved under a
   SecureStore key containing ":" (not allowed), and the throw came after the transaction. Fixed: a valid key, kits saved
   before sending (rolled back only if the chain refuses), and a "Replace with 3 new guardians" path when the kits
   aren't on the phone. Before: `before-fix/28-guardians-set.png`.
2. Opening an explorer link locked the app and dropped the screen state. Fixed: the lock now covers the wallet as an
   overlay (state kept) and only locks after 60 s away.
3. Bridge out stayed "pending" after delivery, because Omni now reports `Settled`. Fixed: it counts as arrived once
   there's a destination tx or `Settled` / `Finalised` / `Claimed`.
4. Private send: the result note and buttons ended up under the bar. Before: `before-fix/25-private-sent.png`,
   `26-private-open.png`. Fixed: sticky actions and banners.
5. Typing ".2" gave "Enter a positive NEAR amount"; amounts now read it as 0.2.
6. Create success screen: the explorer link said "View transaction" with no destination. It now says "View on NEAR
   Rocks".

## What's left

- Restore was not walked end to end (see row 2). If the film shows it, type the words off camera.
- No Bitcoin or Zcash deposit was sent from the new wallet (no testnet BTC or ZEC on hand). Minted deposits are shown on
  `magen-noam.testnet` (read only). Zcash deposit status isn't tracked per transaction, only the nZEC balance.
- NearBlocks rate-limited the whole session (HTTP 429), so Activity showed only the app's own records. Account history
  from before this phone, such as the create-time "Account created" by the helper, comes back when NearBlocks
  answers.
- The guardian recovery flow (guardians rotating the locks to a new phone) is not on the phone. Setup is.
- Face ID was tested with the simulator's enrolled-face match and no-match.
