# Magen film v15: self-review

Final: `videos/magen-near/magen-near-film.mp4` (1920x1080, 30 fps, 5:22.9, about -16.8 LUFS) and `-share.mp4` (1280x720, 10.3 MB). v14 is kept as `versions/v14-final.mp4`.

All picture comes from live screen takes recorded on Nov 14: Playwright CDP screencast of the web app at 1600x900 CSS px (DPR 1.2), and `simctl io recordVideo` of the iPhone 17 Pro Simulator. There are no captions, bands, chips or overlays. The only drawn elements are the mouse cursor and the click ripple, which are part of the take. Voice is Kokoro am_echo at 0.95, and every line was checked with whisper small.en (`whisper-check.json`). The music bed is a new D-minor drone with a slow pulse, generated in `compose.py`.

## Scenes (final timeline)
| t | scene |
|---|---|
| 0:00 | Landing: the hero plays from a fresh load, then a slow scroll with reveals |
| 0:08 | Landing download section: the extension zip and the iOS Simulator zip are downloaded (real downloads) |
| 0:12.7 | chrome://extensions with the downloaded Magen extension loaded unpacked |
| 0:17.9 | Extension popup at its real 380 px size, then the live demo wallet |
| 0:27.1 | iPhone Simulator: tap Magen and the app opens |
| 0:34.6 | Create maya-safe.testnet: pick a name, reveal the 12 words (blurred), then every chain plus ML-DSA-65 |
| 0:56.8 | Password, then the approval sheet ("Upgrade account in place"), then Approve at about 1:09, then ready |
| 1:15.4 | NEAR Rocks: the creation tx |
| 1:22.4 | New wallet home (10 NEAR, chains), then All chains |
| 1:34 | Unlock magen-noam.testnet |
| 1:42 | Bridge in: Bitcoin deposit address and two rows "minted as nBTC on NEAR", then click |
| 1:49.7 | NEAR Rocks: the nBTC mint, then Blockstream: the BTC tx |
| 2:05 | Zcash tab (0.002 nZEC), then ZecBlock: the ZEC tx |
| 2:20 | Swap 0.5 NEAR to USDT on Ref: approval sheet, then Approve at 2:30.8, then success, then NEAR Rocks |
| 2:46 | Bridge out 0.3 NEAR to Solana: approval, then Approve at 2:57, then NEAR Rocks, then Solana Explorer (devnet) |
| 3:22 | Private send 0.2 NEAR: approval, then Approve at 3:32.7, then NEAR Rocks |
| 3:47 | Guardians on maya-safe: approval, then Approve at 3:58, then three guardians listed, then NEAR Rocks |
| 4:10.5 | Q-Day switch: approval, then Approve at 4:22, then "Switched on", then NEAR Rocks, then the account page with the quantum-safe tag |
| 4:43 | iPhone: send 0.05 NEAR, phone approval sheet with both signatures, then Approve at 4:54.7, then "NEAR verified both signatures", then the PQ-native key list |
| 5:08 | NEAR Rocks: the phone tx |
| 5:14 | Closing card with a single small honesty note |

## Rule check (1-fps contact sheets in cs/final, all viewed)
- Landing first, 12.7 s, then straight into install. No title card. Pass.
- No subtitles, caption bands, LIVE chips or overlays. Pass.
- The phone is always shown whole: full screen height on a plain backdrop, never zoomed or cropped. The popup is also shown whole. Pass.
- Explorer takes have one measured 1.3x top-centred zoom (crop 1477x831 at x=221). A still of every explorer insert was checked (`cs/explorers-final.jpg`) and no content is cut. Blockstream is unzoomed (1.0) because its layout is wider. No other zooms. Pass.
- Every transaction signed in the film appears on its approval sheet, Approve is clicked on camera, and the tx is then opened on an explorer. Pass for the 7 NEAR txs. The BTC and ZEC deposits were sent earlier from testnet wallets, which the narration and the closing card both say.
- Story order: landing, then download/install, then create (12 words, every chain, ML-DSA), then features. Pass.

## BLOCKED or left out
- Steal-the-key drill: setting it up creates new helper-funded accounts (funder, look-alikes, attacker), which this film was not approved to do. It is left out, not faked.
- Guardian recovery: only the setup is shown. Recovery needs guardian kits and a second device run that was not recorded.

## Honest score: 7.5 / 10
Flaws Nick would see:
1. The web takes are 1600x900 upscaled to 1080p, so they are slightly soft next to the native phone footage.
2. The film uses three wallets: the new maya-safe, the "used all day" magen-noam, and the phone's magen-noa. The narration bridges them, but a non-crypto judge may lose the thread.
3. The creation tx shows "Account authorization", a single classical signature. That is honest, because the upgrade is signed by the new account key, but it is the one approval that isn't "Signed twice".
4. In the phone app, the tab bar still covers the bottom of the Send button and the result card (the result is scrolled into view). The address typing is cut with a jump.
5. The extension is loaded with Chrome's load-extension flag (chrome://extensions shows it loaded unpacked) rather than through the Load unpacked file dialog, and the popup only shows the read-only demo wallet.
6. For about 3 s the phone home screen shows other apps' icons (Juno, Kumi, xorr).
7. NEAR Rocks is a light page, so every explorer cut is a bright flash between dark app scenes.
