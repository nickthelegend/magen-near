# Magen art set v4 (matte editorial coins, Nov 14 2026)

Generated with ChatGPT's image model (chatgpt.com in Nick's Chrome, one fresh chat, one image per message, blob
downloads, no reference images uploaded). Direction picked by Nick from two references, M6 (a moody editorial
portrait with soft floating matte coins, colour-block cards and a clean phone mockup) and M3 (a light, clean app with a
magenta accent). Every image here is original. Replaces v2 (glossy coins with green neon, rejected) and v3 (the matte
titanium still-life, rejected as the wrong direction).

## Style line (appended to every prompt)
> Style: premium editorial fintech campaign, matte and solid. Soft-touch matte materials with a fine satin or
> powder-coated finish, no gloss, no specular hotspots, no mirror reflections, no chrome, no neon, no glow, not
> plastic, not toy-like, not cartoon. Strict palette: ink #111318, white, light grey #EEEEF0, magenta #E040C8, and
> soft lime #B8F08A only where asked. Soft cinematic directional studio light, gentle soft shadows, calm, confident
> and expensive. No text, no letters, no numbers, no symbols, no logos, no watermark.

Coin vocabulary (the one object that ties the set together): thick solid coins, each a completely blank plain disc
with a softly rounded edge, a thin raised rim and a flat recessed face, with no symbols or engraving. The app shows
the real chain logos as flat marks; the coins stay blank.

## Palette
| Role | Hex | Use |
|---|---|---|
| Ink | `#111318` | dark hero, dark cards, type on light |
| White | `#FFFFFF` | app surfaces |
| Light grey | `#EEEEF0` | page background, phone stage |
| Magenta | `#E040C8` | the accent: primary button, logo, one coin per scene |
| Soft lime | `#B8F08A` | rare: positive-change pills, one coin in the set |

Banned: gloss, chrome, neon, glow, green-on-black, wireframe graphics, toy or clay 3D, text, real people, logos.
Measured from the renders: magenta lands at about `#DE37B8`, lime at about `#BCE993`, ink at `#101117`.

## Files
| File | Size | Use |
|---|---|---|
| `hero/hero-landing.jpg` | 1536×1024 | Landing hero: invented man in profile on ink, 4 matte coins (2 magenta, 2 ink); headline goes on the dark left half |
| `hero/hero-portrait.jpg` | 1024×1536 | Portrait/mobile hero: invented woman in near profile on ink, 3 coins; headline in the bottom third |
| `stage/phone-stage.jpg` | 1536×1024 | Light-grey seamless stage with a soft centre shadow for the app screenshot; a magenta and an ink coin, lower left |
| `cards/card-magenta.jpg` | 1024² | Colour-block card: flat magenta, tone-on-tone coins cropped bottom right; text goes top left |
| `cards/card-ink.jpg` | 1024² | Colour-block card: flat ink, graphite, ink and one magenta coin bottom right |
| `coins/coin-magenta.png` | 800², transparent | Floating coin |
| `coins/coin-ink.png` | 800², transparent | Floating coin (graphite edge so it reads on dark) |
| `coins/coin-white.png` | 800², transparent | Floating coin |
| `coins/coin-lime.png` | 800², transparent | Floating coin, use rarely |
| `onboarding/onboard-quantum-lock.png` | 800², transparent | Quantum-safe lock: coin-body padlock, ink shackle, grey lattice tiles |
| `onboarding/onboard-one-seed.png` | 800², transparent | One seed → many chains: a magenta seed and five coins fanning out |
| `onboarding/onboard-private-send.png` | 800², transparent | Private send: a magenta coin sliding into a sealed ink sleeve |
| `onboarding/onboard-bridge.png` | 800², transparent | Bridge: an ink stack and a white stack joined by a magenta arch, a coin crossing |
| `logo/logo-{a,b,c}-on-white.png` | 1024² | Logo candidates, magenta on white |
| `logo/logo-{a,b,c}-on-ink.png` | 1024² | The same, white on ink |
| `logo/logo-{a,b,c}-mark.png` | 1024², transparent | Magenta mark alone |
| `logo/magen-logo.png` | 1024² | Chosen mark (a), magenta on white |
| `logo/magen-logo-512.png`, `-64`, `-32` | transparent | Chosen mark (a) alone in magenta; 32 is the favicon |
| `logo/magen-logo-180.png` | 180² | Chosen mark (a), white on ink, apple-touch icon |
| `contact-sheet.jpg` | 1572×1350 | Everything together, plus the 32 and 64 px logo test strip |

The untouched ChatGPT PNGs (about 20 MB) stay local in `raw/` and are not committed (`.gitignore`). The
quantum-lock and bridge illustrations are second takes: the first ones were chunkier and read as toys.

The logo PNGs were re-coloured from the generated art: the mark was cut out by its distance from white, then filled
with exact `#E040C8`, white or `#111318`, and re-centred with a 14% margin.

## Logo
| Candidate | Idea | At 32 px |
|---|---|---|
| **a (chosen)** | **solid shield with a bold M cut out as negative space** | **M and shield both read; strongest silhouette** |
| b | monoline shield whose top edge is the M | shield reads, M reads as a V; close to a known read-later app's mark |
| c | coin disc with an inner ring and an M | M reads, the shield is lost; ring fills in at 32 px |

## Wiring notes
Coins float 2–6 px at most and stop under `prefers-reduced-motion`. Give every image width/height or an aspect-ratio
box. The heroes are JPEG q86; transparent PNGs stay PNG. README credit: "Art generated with ChatGPT".
