# Magen film v16 (iOS only): self-review

Final: `videos/magen-near/magen-near-film.mp4` (1920x1080, 30 fps, 5:27.1, -16.9 LUFS) and `-share.mp4` (1280x720,
9.9 MB). v15 is kept as `versions/v15-final.mp4` and `versions/v15-final-share.mp4`.

The picture comes from two kinds of live take, both recorded on Nov 14 between 16:53 and 17:13 UTC:
- the landing at http://localhost:5340, a Playwright CDP screencast at 1920x1080 (`sessL.mjs`)
- a fresh iPhone 17 Pro simulator ("Magen Film 17 Pro", iOS 26.5), recorded with `simctl io recordVideo` (`phone-rec.sh`).
  The app was installed on camera from the zip the landing take downloaded.

There are no captions, bands, chips or overlays. The phone screen is always shown whole: 478x1040 with rounded corners,
centred on the W2 magenta backdrop, and never zoomed or cropped. All cuts are hard cuts. The explorers open inside the
phone (Safari, dark themes), so there are no white flashes. Voice is Kokoro am_echo at 0.95. Every line was checked
with whisper small.en (`whisper-check.json`; the low scores are number and acronym spellings, such as "1.24 USDT" and
"MLDS65"). The bed is v15's drone.

## Scenes
| t | scene |
|---|---|
| 0:00 | Landing hero (Framer Motion), then "Download for iPhone": the panel opens and the real zip downloads (5.5 to 10 s) |
| 0:12.0 | "Add to Chrome": the extension panel, about 2.6 s |
| 0:14.6 | Simulator home screen: Magen installs and its L7 icon appears, then a tap opens it |
| 0:28 | Create: name `dana-magen`, then the 12 words (hidden, "Tap to reveal" is never tapped), then the backup check |
| 0:41 | Every chain plus the quantum-safe key (ML-DSA-65) |
| 0:49 | Create: approval sheet "Upgrade account in place", Approve tapped at about 1:01, then ready |
| 1:06 | NEAR Rocks: the create transaction (DeployContract, AddKey) |
| 1:11 | Home: 9.99 NEAR, "Two locks on" |
| 1:15 | Receive: NEAR QR, every chain, Bitcoin QR |
| 1:28 | Send 0.5 NEAR to magen-noam.testnet: sheet "Signed twice", Approve, then "NEAR verified both signatures" |
| 1:45 | NEAR Rocks: signer key `PQ ml-dsa-65`, logs `MAGEN_AUTHORIZED … dual_verified=true` |
| 1:56 | Swap 1 NEAR to USDT on Ref: four calls in one sheet, Approve, "Swapped. You got 1.2408 USDT", then NEAR Rocks with the 1.24082 USDT transfer |
| 2:18 | Bridge in: the wallet's own BTC deposit address, then the empty state, then the demo wallet magen-noam.testnet with two "Minted as nBTC" rows |
| 2:45 | NEAR Rocks: the nBTC mint (3ozwi6…), then Blockstream: the BTC deposit (81c32529…, 227 confirmations) |
| 2:59 | Zcash: magen-noam's ZEC deposit address and 0.002 nZEC |
| 3:09 | Bridge out 0.5 NEAR to the wallet's own Solana devnet address: sheet, Approve, relaying, "Arrived on Solana" |
| 3:33 | NEAR Rocks (the PQ signer key), then Solana Explorer devnet: Success, Finalized |
| 3:48 | Private send 0.1 NEAR: sheet, Approve, "Sent to a one-time account", NEAR Rocks |
| 4:06 | Guardians 2-of-3 ML-DSA-65: sheet, Approve, three guardians listed, NEAR Rocks |
| 4:33 | Q-Day switch: confirm, sheet, Approve, "Switched on", "PQ native", then NEAR Rocks: tx, then the account with "Access keys 2 · Quantum-safe" |
| 5:01 | Activity: every move listed, one row opened on NEAR Rocks |
| 5:12 | Lock: Magen locks behind Face ID and unlocks with a matching face |
| 5:20 | Closing card: L7 logo, tagline, one small honesty line |

## Transactions shown (all checked on chain after the shoot)
NEAR testnet (all signed by dana-magen.testnet; the gas key is `ml-dsa-65:L62NUyaQ…`):
- create: `JB7YQi…NcDT` (single "Account authorization" signature by the new account's ed25519 key, as the sheet says)
- send 0.5 NEAR: `FMziG5bctayiMo1yGCtGq8SdTttLYs1DprK2mfQF5RPX`
- swap 1 NEAR to 1.24082 USDT: `Fyxw2x5ckWuvA86LXiqyMpWyeaDEpFSEE9po4AN8Tjf3`
- bridge out 0.5 NEAR: `2D3sF1wbfX1ztx2sPYdTxqRW5Xho6bGo4ioEV6WHvZBy` → Solana devnet
  `3bXD827o5bavd3FSTKSrARGva1t7Q7cGir591VJaAHyRkhdpQ2AERazSjPvgygnL4wsnor3U3h7zS1gwPbaVhf3S` (finalized)
- private send 0.1 NEAR: `AqegXwLw21ZJrpB4gvccpcrNd9MdfiRz1wj11KU9dGt9`
- guardians: `gMnTQYQ6Ztc9LkznDgRd6xJeZm91GZC88Ho9MzSavA3`
- Q-Day switch: `8jW8eJSkFD8xMHvoxipx4yb8SyZwmDCWUnVQmj2GR74P`

Earlier real deposits, shown read-only on the demo wallet magen-noam.testnet: the nBTC mint
`3ozwi6xYKwSXFWDhbQbANDNWg1YH2rt9XzGSLqbrrj66` from BTC tx `81c3252954955553a2c81d10db5336a6bf651fafb9b82640da0388882d3bd095`,
and the 0.002 nZEC balance.

## Rule check (1-fps contact sheets `cs/final-*.jpg`, all viewed)
- Landing first and done by 14.6 s; the extension panel shows for about 2.6 s; everything after is the iPhone. Pass.
- No subtitles, caption bands, chips or overlays. Pass.
- The whole phone screen is shown, never zoomed or cropped. Pass.
- Every transaction appears on its approval sheet, Approve is tapped on camera (the sheet closes into the pending
  banner), and the transaction is then shown on an explorer. Pass for all 7 NEAR transactions plus the Solana delivery.
- Every feature is shown: create, every chain, receive, send, swap, bridge in (BTC and ZEC), bridge out, private send,
  guardians, Q-Day, activity, lock. Restore is not shown (it needs words typed on camera).
- Seed OCR: 654 frames (one every 0.5 s) through macOS Vision; the highest count of numbered BIP-39 words in any frame is
  5. The only frames with 4 or 5 are the swap and bridge-out approval sheets, whose numbered call lists ("1. wrap.testnet")
  are false positives (eyeballed). None reach 6. The 12 words are never readable; the words step only shows "Tap to reveal".

## Flaws, honestly
1. Taps are not drawn (simctl recordings carry no touch marks), so "Approve tapped" reads as the sheet closing into
   "Signing twice…". No ripple was added, because that would be an overlay.
2. The film skips some waits with hard cuts: address typing in Send, the Ref swap's few seconds, and the bridge relay
   (about 25 s cut). The "Arrived on Solana" shot comes from just after the explorer visit, so it is shown out of order by
   about 30 s.
3. Order differs from the recording order: private send was recorded before the swap, so the balances on screen
   don't always decrease in sequence.
4. The create transaction carries one classical signature ("Account authorization"); every later one is signed twice.
5. The Q-Day transaction page shows for only about 1.4 s before the account page.
6. The lock scene shows the Face ID prompt over "Magen is locked", so the title is half covered.
7. The landing take only shows the hero and the two panels. It doesn't scroll the rest of the page (kept to 15 s).

Score: 8 / 10.
