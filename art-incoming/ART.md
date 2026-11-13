# Magen art set (UI overhaul, Nov 13 2026)

Generated with ChatGPT's image model (chatgpt.com, one fresh chat, one image per message, no reference images).
Restrained low-key product renders: a dark titanium wallet that gets a second lock, a lattice lock a quantum computer
can't pick. No face, no toy look, no chrome, no text.

## Palette
| Role | Hex |
|---|---|
| Deep ink (hero, balance surface, dark sections) | `#0b0e14` |
| Graphite (panels on dark) | `#1b212b` |
| Porcelain (light task surfaces) | `#f3f4f6` |
| Cobalt, the one accent (lattice glass, CTA, focus) | `#3366ff` |

The cobalt replaces the earlier citron `#d5fa73`. It is also recorded in `grokbot/BRANDS.md`.

## Style line (appended to every prompt)
> Restrained premium product render in an editorial still-life style: dark anodized titanium and smoked graphite metal
> with precise machined edges and fine brushed grain, deep ink #0b0e14 and graphite #1b212b tones, porcelain #f3f4f6
> only as soft highlights, exactly one cool accent of cobalt-blue #3366ff appearing as glass or enamel inlay, soft
> low-key studio light with a single cool rim light, subtle realistic reflections, calm, minimal and serious like a
> luxury hardware product photo; not toy-like, not cartoon, no glossy plastic, no chrome, no rainbow or iridescent
> sheen, no neon haze, no face, no people, no hands; no text, no letters, no numbers, no logos, no symbols.

## Files
| File | Size | Background | Intended use |
|---|---|---|---|
| `magen-hero.png` | 1536×1024 | deep ink | Landing hero: wallet clasped by a classical padlock and a cobalt lattice lock, objects in the right third, headline on the left |
| `magen-og.png` | 1536×1024 | deep ink | OG / social card: lattice lock resting on the wallet, right half; title goes on the left |
| `magen-icon.png` | 1024×1024 | transparent outside the tile | App icon / logo mark: titanium tile with a lattice shield (check it at 32 px; favicon) |
| `magen-lattice-lock.png` | 1024×1024 | transparent | Feature: "the second lock" (ML-DSA-65 signature) |
| `magen-classical-vs-lattice.png` | 1024×1024 | transparent | Feature: classical key (ed25519, sprung open) next to the lattice lock; "why two locks" / Q-Day explainer |
| `magen-crowbar.png` | 1024×1024 | transparent | Feature: attack rejected (forged half, replay, unauthorized migration); the pry bar bends, the lattice lock holds |
| `magen-shield-wallet.png` | 1024×1024 | transparent | Feature: your same NEAR account with the shield built in; create / unlock wallet screens |
| `magen-empty.png` | 1024×1024 | transparent | Empty state: no assets / nothing to show (empty titanium tray) |
| `magen-empty-activity.png` | 1024×1024 | transparent | Empty state: no activity yet (an unlit lattice lock at rest) |

Transparent objects are trimmed to their bounds and padded to a square with an even margin, then palette-compressed
with pngquant. Hero and OG are the untouched originals; convert them to WebP/JPEG (q 82–88) when wiring them in. On
the dark UI, give the objects a faint radial light so the titanium edge reads.

README credit: "Art generated with ChatGPT".
