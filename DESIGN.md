---
name: Magen
description: A premium personal NEAR wallet with one shield and one clear action.
colors:
  primary: "#d5fa73"
  ink: "#202729"
  ceramic: "#f8faf6"
  surface: "#ffffff"
  protection: "#edf2e5"
  secondary-text: "#677061"
  navigation-text: "#606a60"
  navigation-active: "#e8eedf"
  navigation-hover: "#eef2e9"
  divider: "#e1e6dd"
  row-divider: "#edf0e9"
  input-surface: "#fcfdfb"
  input-border: "#dbe2d3"
  olive: "#647b32"
  dark-action: "#374033"
  dark-action-text: "#f2f6ee"
  dark-secondary: "#c6cfc2"
  proof-surface: "#f0f4e9"
  error-surface: "#f9e9e3"
  error-text: "#783a2c"
  success-surface: "#e8f2d8"
  receipt-surface: "#f1eee7"
typography:
  display:
    fontFamily: "Commissioner, Arial, sans-serif"
    fontSize: "57px"
    fontWeight: 450
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Commissioner, Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Commissioner, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 550
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Commissioner, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Commissioner, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 500
rounded:
  code: "8px"
  field: "9px"
  control: "10px"
  feedback: "12px"
  panel: "16px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "30px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 19px"
  button-light:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 19px"
  button-dark:
    backgroundColor: "{colors.dark-action}"
    textColor: "{colors.dark-action-text}"
    rounded: "{rounded.control}"
    padding: "12px 19px"
  field:
    backgroundColor: "{colors.input-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
  balance-panel:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "27px 30px 19px"
  navigation-active:
    backgroundColor: "{colors.navigation-active}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
---

# Design System: Magen

## Overview

**Creative North Star: "One shield."**

Magen is a premium personal wallet in Operate mode: balances, transfers, account protection, and evidence lead the interface. The committed identity pairs one dark balance surface with ceramic surroundings, white task panels, and a citron action accent. Commissioner gives the product a consistent, restrained voice.

This document records the built React interface, refreshed from `web/src/main.tsx`, `web/src/style.css`, and final desktop/mobile captures. Values describe implementation rather than the previous approximate direction. Product and security claims remain in PRODUCT.md; this system describes their visual presentation.

**Key Characteristics:**

- One dark balance surface and light task surfaces.
- One citron accent, with muted olive for status and focus.
- Familiar sidebar navigation that becomes a mobile bottom bar.
- Flat, gently rounded panels with direct actions and readable supporting evidence.

## Colors

Citron provides action emphasis against ink, ceramic, and desaturated green neutrals. Frontmatter values are normative extracted tokens; the implementation currently uses literal CSS colors rather than custom properties.

### Primary

- **Citron** (`primary`): primary actions and selected text. Send is the emphasized action in the dark balance surface.

### Neutral

- **Ink** (`ink`): principal text and balance surface.
- **Ceramic** (`ceramic`): workspace and desktop sidebar background.
- **White** (`surface`): header, task panels, and the Receive action on the balance surface.
- **Protection wash** (`protection`): readiness and Q-Day panels.
- **Secondary text** (`secondary-text`): supporting copy, placeholders, field suffixes, receipt metadata, and footer. The final contrast correction uses this consistently on light surfaces.
- **Navigation neutrals** (`navigation-text`, `navigation-active`, `navigation-hover`): default labels, active background, and hover background.
- **Dividers** (`divider`, `row-divider`): shell boundaries and quiet row separation.
- **Field neutrals** (`input-surface`, `input-border`): lightly tinted input fill and a fine boundary.
- **Dark action neutrals** (`dark-action`, `dark-action-text`, `dark-secondary`): secondary actions and supporting type inside the dark balance surface.
- **Proof wash** (`proof-surface`): code and direct RPC evidence.

Olive is a semantic indicator for verified status, score fill, and checkboxes. Error, success, and pending receipt surfaces are semantic feedback, not additional brand accents. Rejected activity icons use a muted warm tint, with status also written in text.

**The One Accent Rule.** Keep citron as the action accent; express other states through the established muted semantic colors and explicit labels.

**The Legible Support Rule.** Preserve at least 4.5:1 contrast for small supporting text and placeholders. The secondary-text token passes on white, ceramic, fields, and the protection wash; do not restore the lighter values replaced by F1.

## Typography

**Display and body font:** self-hosted variable Commissioner (`/commissioner.ttf`, weight range 100–900), with Arial and sans-serif fallback. Icons come from Lucide; the shield identity is a flat SVG. Code and RPC payloads retain the browser monospace face for actual data.

The hierarchy uses moderate weight changes, close headline tracking, and tabular numerals for balances, amounts, asset totals, and readiness. There is no global 65–75ch text measure in the current code; reading width comes from task columns and panels.

- **Balance display:** frontmatter display role; mobile reduces it to 49px. The fractional balance is tinted; the unit is 16px on desktop and 14px on mobile.
- **Page headline:** frontmatter headline role; mobile reduces it to 28px with a 290px maximum width.
- **Section title:** frontmatter title role, with panel titles at 17px desktop and 16px mobile. Readiness and explanatory task headings have their own larger scales.
- **Body:** frontmatter body role. Page introductions are 14px desktop and 12px mobile; explanatory task copy is 14px with 1.8 line height.
- **Labels:** frontmatter label role. Primary buttons are 14px/550. Metadata and fine print are 11–12px, with some mobile metadata/navigation at 10px. This documents the existing compact scale rather than prescribing it for longer prose.

Keep headings in sentence case. Use negative tracking only for prominent headings and numerals; the observed floor is −0.04em in the wordmark.

## Layout

The desktop shell has a fixed 218px sidebar. The workspace offsets by the same width. Its white header is 88px tall with 48px horizontal padding. Main content is centered in a maximum 1330px border-box container, including 48px side padding, and uses 38px top/45px bottom padding. The footer follows the content.

The overview uses a 1.62:1 balance/readiness grid and a separate 1:1.1 assets/activity grid, both with 24px gaps. Task pages use a maximum 950px grid with 1.2:1 columns and a 60px gap. The form leads; supporting explanation follows. Receive and unlock are centered single panels with respective maximum widths of 600px and 510px. Protection uses a 1.2:1 grid and a full-width access-key evidence panel below.

At widths up to 1100px, main/header side padding falls to 25px, overview proportions become 1.4:1 with 16px gaps, task gaps become 30px, and protection stacks into one column. At widths of at least 1600px, main top padding increases to 50px.

At widths up to 760px, the sidebar becomes a fixed 68px bottom navigation bar. Wordmark, account switcher, and sidebar footer disappear. The workspace uses full width with 68px bottom clearance; its header becomes 70px tall. Main padding becomes 28px 18px 30px. Overview, lower, and task grids stack with 18px gaps. Forms fill the column; field text is at least 16px. The receipt-check row stacks vertically. Preserve the separate form and explanatory regions rather than shrinking the desktop columns.

Spacing is intentionally tighter within rows and form groups than between panels. Panel padding is usually 24px, forms use 30px desktop, and mobile panels/forms use 20–22px horizontal padding. These are observed values, not a single rigid spacing scale.

## Elevation & Depth

Panels are flat. Depth comes from the contrast between ceramic, white, protection wash, and the dark balance surface, with fine borders on fields and shell boundaries. Content panels have no resting box shadow. The copied-status toast is the sole shadowed floating element, using `0 8px 24px #20272922`.

**The Flat Surface Rule.** Preserve tonal separation for content surfaces; reserve the existing shadow for transient floating feedback.

## Shapes

Containers use the panel radius from the frontmatter. Controls use the control radius, fields use the slightly tighter field radius, and feedback banners use the feedback radius. Code blocks use the code radius. Status tags are pills; avatars, token marks, transaction icons, and the receive symbol use circles. Field strokes are 1px. There are no gradients, glass surfaces, decorative imagery, or invented charts in the committed world.

## Components

### Buttons and links

Primary, white, and dark button variants share a 46px minimum height, 12px vertical padding, medium weight, and inline Lucide icons. Full-width buttons finish forms. Text and subtle buttons use a 44px minimum height; refresh is a 44px square icon button. The header account avatar is 34px. Contextual inline notice links are underlined with a 3px underline offset and use smaller hit areas in the existing implementation.

Buttons and links transition background and transform over 160ms ease-out. Enabled button hover applies `brightness(.97)`; active buttons move down 1px. Disabled controls use 0.5 opacity and a not-allowed cursor. Keyboard focus uses a 3px olive outline (`#677c2f`) with 4px offset. Reduced motion disables animation and transitions.

### Panels and balance surface

White task panels are flat rounded containers. The balance surface carries the numeric hierarchy, copyable address, protection pill, and three direct actions: citron Send, white Receive, and muted dark Contract call. The adjacent readiness panel is a checklist summary, not an invented performance chart. The score track is a quiet 5px bar.

### Fields and consent

Fields use the extracted field fill, border, and radius, a 50px minimum height, and clear labels above. Placeholder/help/suffix text uses secondary text. Amounts have a larger 29px input treatment with a right-aligned NEAR suffix. JSON arguments use a resizable textarea. Checkboxes are native 18px squares with olive accent and wrap their labels alongside. Backup acknowledgement and migration consent are separate controls and separate state.

### Navigation

Desktop links are 48px high with icons on the left and 8px vertical gaps. Active links use a pale tonal fill and ink text; hover uses the navigation hover fill. Mobile links arrange a 20px icon above a compact label in four equally distributed destinations, with a 57px minimum link height and a rounded active background.

### Activity and evidence

Receipt rows use circular status icons, a title plus status/hash line, optional amount, and an external-link icon. Text and icons communicate status together. Rows have fine dividers rather than separate cards. The existing-transaction check is a labeled hash field and Verify receipt button within the activity panel; its desktop row becomes a mobile column.

Direct RPC evidence uses a native disclosure with a 44px minimum summary height. Expanded evidence includes source/account text and a wrapping 12px monospace payload on proof wash, reduced to 11px on mobile. Long addresses, keys, and receipt messages wrap rather than force horizontal overflow.

### Feedback and browser surfaces

Loading appears in a notice banner with a rotating refresh icon. Errors, confirmed results, and pending/rejected receipts have separate tinted banners with explicit copy and receipt links. Empty lists use centered secondary text. Copy feedback uses a dark toast, moved above mobile navigation. Selection uses citron and ink; caret and scrollbar use muted green tones. Keep protected contract-action copy visually distinct from native full-access control descriptions; the visual vocabulary must not erase that state distinction.

## Do's and Don'ts

### Do

- **Do** keep one dark balance surface with light tasks and citron for the primary action.
- **Do** use Commissioner, Lucide icons, and the existing shield identity.
- **Do** preserve the sidebar-to-bottom-bar responsive structure and full-width mobile forms.
- **Do** use explicit status text, receipt links, wrapping evidence, and separate consent controls.
- **Do** keep supporting text legible and retain visible keyboard focus and reduced-motion behavior.

### Don't

- **Don't** add gradients, glass, decorative artwork, or invented charts.
- **Don't** add shadows to resting content panels.
- **Don't** replace secondary-text with the low-contrast colors removed by F1.
- **Don't** present demo viewing as signing authority or treat native full access as the same state as two-signature contract actions.
- **Don't** turn task-local copy or one screen's arrangement into a global visual rule.
