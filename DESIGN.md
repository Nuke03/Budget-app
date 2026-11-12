---
name: Budget — Il Libretto
description: A household money app drawn as a savings passbook — blue cover, white ruled pages, serif figures, one red stamp.
colors:
  cover-blue: "#14306b"
  cover-blue-deep: "#0e2350"
  cover-blue-tint: "#e4eaf5"
  ground: "#eef2f8"
  page: "#ffffff"
  ink: "#14213d"
  ink-soft: "#4d5a73"
  hairline: "#e3e8f1"
  stamp-red: "#c8102e"
  alert-red: "#dc2626"
  alert-tint: "#fdecec"
  cat-coral: "#f97362"
  cat-amber: "#f5a524"
  cat-emerald: "#0f9d6b"
  cat-teal: "#14b8a6"
  cat-sky: "#3b9ae1"
  cat-violet: "#8452f5"
  cat-pink: "#e1177b"
  cat-slate: "#64748b"
typography:
  figure:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum, lnum"
  figure-entry:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "3.75rem"
    fontWeight: 700
    fontFeature: "tnum, lnum"
  title:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "0.02em"
  section:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "1.125rem"
    fontWeight: 600
  body:
    fontFamily: "Work Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  body-small:
    fontFamily: "Work Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: "Work Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.1em"
  tab:
    fontFamily: "Work Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  sm: "0.65rem"
  md: "1rem"
  lg: "1.5rem"
  full: "9999px"
spacing:
  gap-tight: "8px"
  gap-card: "14px"
  inset-page: "12px"
  inset-card: "16px"
  inset-sheet: "20px"
components:
  cover-band:
    backgroundColor: "{colors.cover-blue}"
    textColor: "{colors.page}"
    typography: "{typography.title}"
    padding: "40px 20px 16px"
  page-card:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  note-card:
    backgroundColor: "{colors.cover-blue-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  ledger-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: "48px"
    padding: "12px 16px"
  ledger-head:
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
    padding: "10px 16px"
  button-primary:
    backgroundColor: "{colors.cover-blue}"
    textColor: "{colors.page}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "14px 16px"
  button-quiet:
    backgroundColor: "{colors.cover-blue-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
  chip:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "44px"
    padding: "8px 16px"
  chip-selected:
    backgroundColor: "{colors.cover-blue}"
    textColor: "{colors.page}"
  input-field:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 12px"
  add-button:
    backgroundColor: "{colors.cover-blue}"
    textColor: "{colors.page}"
    rounded: "{rounded.full}"
    size: "56px"
  stamp:
    textColor: "{colors.stamp-red}"
    rounded: "{rounded.full}"
    size: "64px"
---

# Design System: Budget — Il Libretto

## Overview

**Creative North Star: "Il Libretto"**

The money is a savings passbook. A narrow blue cover band sits on top, white pages lie on a pale blue-grey ground, and everything that is a movement is a ruled line with its number in a column. The mood is calm and reliable: ink on paper, nothing glowing, nothing shouting. The headline figure is set in a serif and earns its place by being the total of the lines below it.

Density is low and glanceable, built for one thumb on an iPhone installed as a PWA: one column, about 28rem wide, cards on a quiet ground, hairlines instead of fills. Colour is flat. The system gets its identity from three things only: the passbook-blue cover, the serif figures against a plain grotesk, and a single red stamp.

This document describes the Home, the quick-add sheet, the "In pari" screen and the "Altro" notification block as built. The rest of the app (Casa, history, goals, accounts, P.IVA) inherits the tokens but has not been rebuilt in this world yet; see Known drift.

**Key Characteristics:**
- Blue cover band, white pages, hairline rules (1px hairline), a 2px blue rule under the ledger header.
- Serif for figures and headings, grotesk for everything else, tabular lining numerals in every amount.
- Flat colour. Depth comes from borders and tonal steps, not shadows.
- One reserved red, the stamp, for "registrato" only.
- Light and dark themes share one token set; dark follows the system setting.

## Colors

A navy-and-paper palette with a single red used for one job.

### Primary
- **Passbook Blue** (#14306b): the cover band, the primary button, the + button, selected chips, the active tab, selection highlight, focus ring, the "Questo mese" bar. Also the PWA theme colour. In dark it becomes a lighter periwinkle (#6b8fe0) with dark text (#0c1424) so it stays legible as a fill.
- **Passbook Blue Deep** (#0e2350): text colour for quiet actions ("Come si calcola?", "Perché?", "Tutti i movimenti", the bold "Prossimo:" lead-in). In dark it flips to a pale blue (#9fb6e6).
- **Cover Tint** (#e4eaf5): quiet buttons, the "Prossimo" card, empty bar tracks, the segmented control background. Dark: #1a2a4d (brand tint) and #1a2640 (muted surface).

### Secondary
- **Stamp Red** (#c8102e): the round "REGISTRATO" stamp, nothing else. In dark it lifts to #ff7a8c.

### Neutral
- **Ground** (#eef2f8): the page background behind the cards. Dark: #0c1424.
- **Page White** (#ffffff): card and sheet surface, and the headline "page" under the cover. Dark: #131d33.
- **Ink** (#14213d): body text and figures. Dark: #e8edf6.
- **Soft Ink** (#4d5a73): secondary text, column heads, the comparison bar for "usual". Also exposed as `--muted` with the same value. Dark: #a3b0c6.
- **Hairline** (#e3e8f1): card borders and row rules. Dark: #24314d.

### Alert
- **Alert Red** (#dc2626) with **Alert Tint** (#fdecec; dark #2a1414): form errors only. Kept distinct from the stamp on purpose.

### Category palette
Eight flat hues for user categories, used as chip borders and selected chip fills: coral (#f97362), amber (#f5a524), emerald (#0f9d6b), teal (#14b8a6), sky (#3b9ae1), violet (#8452f5), pink (#e1177b), slate (#64748b). A selected chip picks dark or white text by contrast against its fill. They colour categories and nothing else.

### Named Rules
**The One Red Rule.** Stamp red marks a movement as registered and has no other use. Errors use alert red; emphasis uses blue or weight.

**The Flat Colour Rule.** No gradients, no glow, no coloured balance card. A fill is one solid token.

**The Darker Paper Rule.** Dark mode darkens the paper (navy ground, navy page) and lightens the blue; it never switches to black with neon.

## Typography

**Display / Heading Font:** Source Serif 4 (weights 600, 700; Georgia, Times New Roman fallback)
**Body Font:** Work Sans (weights 400, 500, 600; system-ui fallback)

**Character:** A printed-bank serif for what is counted and a plain, even grotesk for what is read. The serif carries trust; the grotesk stays out of the way.

### Hierarchy
- **Figure** (serif 700, 56px, line-height 1): the "Disponibile libero" amount. Cents drop to 28px in the same face.
- **Figure, entry** (serif 700, 3.75rem): the amount typed in the quick-add sheet; the euro sign beside it is serif 600, 1.875rem, soft ink.
- **Title** (serif 600, 22px, tracking 0.02em): the cover band heading, "Il mio libretto".
- **Section** (serif 600, 1.125rem): block headings such as "Promemoria".
- **Body** (Work Sans 400, 15px): sentences, ledger rows; buttons use 15px to 16px semibold.
- **Body small** (Work Sans 400, 13px): captions, ledger dates, the cover side label, bar labels.
- **Label** (Work Sans, 11px, 0.1em tracking, uppercase): the ledger column heads only (Data, Movimento, Importo, Nel mese).
- **Tab** (Work Sans 500, 12px; 700 when active): bottom bar labels.

### Named Rules
**The Tabular Rule.** Every amount, date and running total carries the `.num` class (tabular, lining numerals) so columns align. A number in a column without it is a bug.

**The Serif For Counted Things Rule.** Serif is for figures and headings. Prose, buttons, chips and labels are always Work Sans.

## Layout

One centred column. Home uses `max-w-md` (28rem) with 12px side padding and a 14px gap between cards; the add sheet and forms use 20px side padding. The cover band spans the full width and respects the iOS safe-area inset at the top; the bottom bar respects it at the bottom, and content reserves 7rem above it. The headline "page" attaches to the cover: square top, rounded bottom (1rem), no top border, so cover and page read as one object.

The ledger is a four-column grid: date 2.75rem, movement flexible, amount 4.5rem, month-to-date 4.5rem, 8px column gap, 16px side padding. Rows are at least 48px tall. Spacing follows Tailwind's 4px scale; the steps in use are 8, 12, 14, 16 and 20, plus 40px above the cover title.

Touch targets are 44px minimum (chips, quiet links, tabs) and 48px for primary actions and fields.

## Elevation & Depth

Flat by default. Cards are separated from the ground by a 1px hairline border and the white-on-blue-grey step; `--shadow-card` is defined as `none`. Two soft shadows exist as tokens: `--shadow-hero` (0 4px 16px -4px rgb(15 23 42 / 0.08), defined but not used by the built surfaces) and `--shadow-fab` (0 4px 16px -4px rgb(15 23 42 / 0.2), used on the quick-add save button). The + button is lifted by geometry, not shadow: it rises 20px above the bar and wears a 4px ring in the bar's own surface colour, as if punched through the page.

### Named Rules
**The Hairline Depth Rule.** Hierarchy comes from borders, tone and spacing. A shadow is allowed only on a control that must read as pressable above content, and stays soft and low-opacity.

## Shapes

Soft and rounded. Cards, fields and primary buttons use 1rem (`--radius-md`); small tap targets such as text actions use 0.65rem (`--radius-sm`); the bottom sheet's top corners use 1.5rem (`--radius-lg`). Chips, bars, the segmented control, the + button and the stamp are full rounds. The stamp is a circle with a 3px red ring, tilted -10 degrees, as a rubber stamp would land.

## Components

### Cover band
Full-width Passbook Blue strip, white text. Serif title left, small month label right, baseline aligned. 40px above the title so it clears the status bar in the installed app.

### Cards
White panel, 1px hairline border, 1rem radius, 16px padding, no shadow. The "Prossimo" card swaps to Cover Tint fill with the same border and carries a single tappable line. Quiet text actions inside cards are semibold Passbook Blue Deep, 44px tall.

### Ledger (the Registro)
The signature component. A card holding an 11px uppercase column header with a 2px Passbook Blue rule beneath, then rows divided by hairlines. Date is 13px soft ink, movement is 15px and truncates, amount is right-aligned with a true minus or plus sign, and the running "Nel mese" total is semibold. A footer link, "Tutti i movimenti", closes the card. Estimated rows carry a small "stima" note.

### The stamp
After an entry is saved, the new row slides down 8px into place (0.22s) and the red round "REGISTRATO" stamp with the day presses onto it (scale 1.15 to 1, rotated -10 degrees, 0.26s after a 0.22s delay), sits at 0.9 opacity, then fades after 2.5s. With reduced motion it appears still and vanishes on the same timer. It is decorative (aria-hidden); a polite live region announces the new disponibile.

### Buttons
- **Primary:** Passbook Blue fill, white text, 1rem radius, 48px minimum height, semibold 16px. Disabled drops to 40% opacity. Every button shrinks to 0.96 scale and darkens 6% while pressed.
- **Quiet:** Cover Tint fill, ink text, 44px minimum, semibold 14px.
- **Text action:** no fill, Passbook Blue Deep, semibold, sometimes underlined with a 2px hairline-coloured underline.
- **Add (+):** 56px round, Passbook Blue, white plus (stroke 2.5), the middle slot of the bottom bar.

### Chips
Fully rounded, 2px border, 44px minimum height, semibold 14px. Unselected: page white with hairline border. Selected: Passbook Blue fill and border with white text. Category chips use their own hue as border (unselected) or fill (selected).

### Inputs
1rem radius, 1px hairline border, page white, 48px minimum height. Amount fields use serif tabular numerals. Focus shows a 2px Passbook Blue outline with 2px offset (global `:focus-visible`) or a blue border on text fields.

### Comparison bars
Two 8px full-round bars on one scale: "Questo mese" in Passbook Blue, "Di solito a quest'ora" in soft ink, tracks in Cover Tint, the figure printed beside each. They are decorative; the sentence above carries the numbers.

### Navigation
A bottom bar, white, 1px hairline on top, safe-area padded. Four tabs (Home, Storico, Casa, Altro) with 20px icons and 12px labels; active is Passbook Blue, bold, heavier stroke, with `aria-current`. The + button sits as a central slot between Storico and Casa, raised 20px.

### Bottom sheet
Sheets rise from the bottom (0.32s ease-out), 1.5rem top radius, white, grabber bar, 75vh scrolling body, dimmed backdrop. The quick-add sheet leads with the amount in large serif and asks for nothing else first.

## Do's and Don'ts

### Do:
- **Do** put every amount, date and running total in a `.num` column with tabular lining numerals.
- **Do** keep the stamp red (#c8102e) for "registrato" confirmations only.
- **Do** build surfaces from a 1px hairline border, a white page and 1rem radius before reaching for a shadow.
- **Do** keep done obligations visible and struck through until month end.
- **Do** keep touch targets at 44px or more and primary actions at 48px.
- **Do** respect safe-area insets at the top (cover band) and bottom (tab bar) and honour reduced motion.

### Don't:
- **Don't** use a coloured balance card over a feed of icon tiles; this system refuses that category default.
- **Don't** compute or display a backward running balance: balances are edited by hand, so the ledger shows the month-to-date total ("Nel mese").
- **Don't** use gradients, glow shadows or a second reserved accent next to the stamp.
- **Don't** set prose, buttons or labels in the serif, or figures in the grotesk.
- **Don't** use stamp red for errors; errors use alert red.

## Known drift (not canonical)

Recorded so future work does not inherit these as rules:
- Casa, Storico, goals, accounts and P.IVA screens inherit the tokens but have not been rebuilt in this world (plan B). Do not read their layouts as the system.
- `SchedaNotifiche` (Home) and `altro/Notifiche.tsx` still reference `--shadow-card` (it resolves to none); `SchedaNotifiche` also omits the hairline border the other cards carry.
- `FoglioInferiore` uses `shadow-2xl`, a `backdrop-blur-sm` scrim and a `bg-black/10` grabber; the older tabbed variant inside `AddTransactionForm` still uses `text-muted`, `shadow-[var(--shadow-card)]` and a sans 5xl amount instead of the serif entry figure.
- The stamp's 9px text is below the 11px label floor used elsewhere; it is a decorative mark, not a reading size.
- Type sizes mix px and rem in the source; the values above record what the build uses.
