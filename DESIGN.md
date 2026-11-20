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
  da-fare-card:
    backgroundColor: "{colors.cover-blue-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
    height: "48px"
  explain-panel:
    backgroundColor: "{colors.cover-blue-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px"
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
    size: "72px"
---

# Design System: Budget — Il Libretto

## Overview

**Creative North Star: "Il Libretto"**

The money is a savings passbook. A narrow blue cover band sits on top, white pages lie on a pale blue-grey ground, and everything that is a movement is a ruled line with its number in a column. The mood is calm and reliable: ink on paper, nothing glowing, nothing shouting. The headline figure is set in a serif and earns its place by being the total of the lines below it.

Density is low and glanceable, built for one thumb on an iPhone installed as a PWA: one column, about 28rem wide, cards on a quiet ground, hairlines instead of fills. Colour is flat. The system gets its identity from three things only: the passbook-blue cover, the serif figures against a plain grotesk, and a single red stamp.

This document describes the whole app as built: Home, the quick-add sheet, "In pari", the "Altro" notification block, the "Cosa vuoi fare?" menu behind the + button, the Casa section (home, simple view, Dettagli, monthly check-in, quota wizard, Da parte, Movimenti, Impostazioni, Inizia), Storico, Cassetti, Conti, Categorie, P.IVA, the undo notice, the confirm sheet, the first-run tour and first-time bubbles (Fumetti) and the app icon. The older tabbed add form still carries older styling; see Known drift.

**Key Characteristics:**
- Blue cover band, white pages, hairline rules (1px hairline), a 2px blue rule under the ledger header.
- Serif for figures and headings, grotesk for everything else, tabular lining numerals in every amount.
- Flat colour. Depth comes from borders and tonal steps, not shadows.
- One reserved red, the stamp, for "registrato" only.
- Light and dark themes share one token set; dark follows the system setting.
- Delete is undone, not interrogated: the item hides at once and an undo notice waits 5 seconds; only heavy or irreversible actions ask first.

## Colors

A navy-and-paper palette with a single red used for one job.

### Primary
- **Passbook Blue** (#14306b): the cover band, the primary button, the + button, selected chips, the active tab, selection highlight, focus ring, the "Questo mese" bar. Also the PWA theme colour. In dark it becomes a lighter periwinkle (#6b8fe0) with dark text (#0c1424) so it stays legible as a fill.
- **Passbook Blue Deep** (#0e2350): text colour for quiet actions ("Come si calcola?", "Perché?", "Tutti i movimenti", the bold "Prossimo:" lead-in). In dark it flips to a pale blue (#9fb6e6).
- **Cover Tint** (#e4eaf5): quiet buttons, the "Prossimo" card, empty bar tracks, the segmented control background. Dark: #1a2a4d (brand tint) and #1a2640 (muted surface).

### Secondary
- **Stamp Red** (#c8102e): the round "REGISTRATO" stamp (72px, 10px text) and the stamp ring of the app icon, nothing else. The icon use is sanctioned as a brand mark (hard-coded in `iconaApp.tsx`, since the icon renders outside the theme). In dark the in-app stamp lifts to #ff7a8c.

### Neutral
- **Ground** (#eef2f8): the page background behind the cards. Dark: #0c1424.
- **Page White** (#ffffff): card and sheet surface, and the headline "page" under the cover. Dark: #131d33.
- **Ink** (#14213d): body text and figures. Dark: #e8edf6.
- **Soft Ink** (#4d5a73): secondary text, column heads, the comparison bar for "usual". Also exposed as `--muted` with the same value. Dark: #a3b0c6.
- **Hairline** (#e3e8f1): card borders and row rules. Dark: #24314d.

### Alert
- **Alert Red** (#dc2626) with **Alert Tint** (#fdecec; dark #2a1414): form errors and the outlined "Elimina" button of the confirm sheet (1px alert-red border, alert-red text, page-white fill). Kept distinct from the stamp on purpose.

### Category palette
Eight flat hues for user categories, used as chip borders and selected chip fills: coral (#f97362), amber (#f5a524), emerald (#0f9d6b), teal (#14b8a6), sky (#3b9ae1), violet (#8452f5), pink (#e1177b), slate (#64748b). A selected chip picks dark or white text by contrast against its fill. They colour categories and nothing else: chip borders and fills, the 10px category dot in ledger rows, and the flat bars of the Storico "Per categoria" card.

### Named Rules
**The One Red Rule.** Stamp red marks a movement as registered, plus the stamp ring on the app icon, and has no other use. Errors use alert red; emphasis uses blue or weight.

**The Flat Colour Rule.** No gradients, no glow, no coloured balance card. A fill is one solid token.

**The Darker Paper Rule.** Dark mode darkens the paper (navy ground, navy page) and lightens the blue; it never switches to black with neon.

## Typography

**Display / Heading Font:** Source Serif 4 (weights 600, 700; Georgia, Times New Roman fallback)
**Body Font:** Work Sans (weights 400, 500, 600; system-ui fallback)

**Character:** A printed-bank serif for what is counted and a plain, even grotesk for what is read. The serif carries trust; the grotesk stays out of the way.

### Hierarchy
- **Figure** (serif 700, 56px, line-height 1): the "Disponibile libero" amount. Cents drop to 28px in the same face.
- **Figure, secondary** (serif 700, 40px, line-height 1): the single big number of a Casa check-in step, and of a P.IVA card (the tax-account balance "vaso", the monthly pay, the quota prompt). Cents drop to 22px. "12.345,67 €" fits one line at 375px.
- **Figure, entry** (serif 700, 3.75rem): the amount typed in the quick-add sheet; the euro sign beside it is serif 600, 1.875rem, soft ink.
- **Title** (serif 600, 22px, tracking 0.02em): the cover band heading, "Il mio libretto".
- **Section** (serif 600, 1.125rem): block headings such as "Promemoria", "Da fare", "Soldi della casa", "La nostra quota".
- **Body** (Work Sans 400, 15px): sentences, ledger rows; buttons use 15px to 16px semibold.
- **Body small** (Work Sans 400, 13px): captions, ledger dates, the cover side label, bar labels, Storico day headings (600, soft ink).
- **Label** (Work Sans, 11px, 0.1em tracking, uppercase): the ledger column heads only (Data, Movimento, Importo, Nel mese).
- **Tab** (Work Sans 500, 12px; 700 when active): bottom bar labels.

### Named Rules
**The Tabular Rule.** Every amount, date and running total carries the `.num` class (tabular, lining numerals) so columns align. A number in a column without it is a bug.

**The Long Date Rule.** A date read inside a sentence (a goal deadline, "16 aprile 2027") is written out with `formatDataLunga`; the numeric dd/mm/yyyy form stays in columns and ledgers.

**The Serif For Counted Things Rule.** Serif is for figures and headings. Prose, buttons, chips and labels are always Work Sans.

## Layout

One centred column. Home uses `max-w-md` (28rem) with 12px side padding and a 14px gap between cards; the add sheet and forms use 20px side padding. The cover band spans the full width and respects the iOS safe-area inset at the top; the bottom bar respects it at the bottom, and content reserves 7rem above it. The headline "page" attaches to the cover: square top, rounded bottom (1rem), no top border, so cover and page read as one object.

A row of pills that can outgrow the width (the Storico period row) is a single line that scrolls sideways with snap and no visible scrollbar. It bleeds to the screen edge (-12px) and keeps 12px start padding, so the first pill sits on the page margin.

The ledger is a four-column grid: date 2.75rem, movement flexible, amount 4.5rem, month-to-date 4.5rem, 8px column gap, 16px side padding. Rows are at least 48px tall. Spacing follows Tailwind's 4px scale; the steps in use are 8, 12, 14, 16 and 20, plus 40px above the cover title.

Touch targets are 44px minimum (chips, quiet links, tabs) and 48px for primary actions and fields.

## Elevation & Depth

Flat by default. Cards are separated from the ground by a 1px hairline border and the white-on-blue-grey step; `--shadow-card` is defined as `none`. Two soft shadows exist as tokens: `--shadow-hero` (0 4px 16px -4px rgb(15 23 42 / 0.08), used only on the app icon logo of the login screens) and `--shadow-fab` (0 4px 16px -4px rgb(15 23 42 / 0.2), used on the quick-add save button). The + button is lifted by geometry, not shadow: it rises 20px above the bar and wears a 4px ring in the bar's own surface colour, as if punched through the page. The bottom sheet and the undo notice are flat too: the sheet is cut off by a 1px top rule over a flat 40% black scrim (no blur), the notice is a solid ink block.

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
Fully rounded, 2px border, 44px minimum height, semibold 14px. In Casa forms a short choice (who pays, how to split, when) is a radio pill group (`SceltePill`): same pill at semibold 15px, `role="radiogroup"` with a roving tab stop and arrow keys; one pill is always the selected one. Unselected: page white with hairline border. Selected: Passbook Blue fill and border with white text. Category chips use their own hue as border (unselected) or fill (selected).

### Inputs
1rem radius, 1px hairline border, page white, 48px minimum height. Amount fields use serif tabular numerals. Focus shows a 2px Passbook Blue outline with 2px offset (global `:focus-visible`) or a blue border on text fields.

### Comparison bars
Two 8px full-round bars on one scale: "Questo mese" in Passbook Blue, "Di solito a quest'ora" in soft ink, tracks in Cover Tint, the figure printed beside each. They are decorative; the sentence above carries the numbers.

### Casa: Da fare card
One card, one thing at a time, under the headline page. Cover Tint fill, hairline border, 1rem radius, 16px padding, with a serif "Da fare" section heading above it. A row that opens a sheet or a page is a 48px full-width button or link, sentence left and a trailing mark; the accantonamento variant lists its lines with hairline dividers and ends in one primary "Fatto" button.

### Casa: home and simple view
The Casa home reuses the headline page (56px serif "Disponibile di casa", cents at 28px) and the ledger, with columns Data, Spesa, Chi, Importo. Chi is 13px soft ink; each spesa carries a 10px category dot (`PallinoCategoria`, aria-hidden, a blank slot when uncoloured so rows align). Entry points are full-width bordered link rows ("Dettagli"), 48px, semibold Passbook Blue Deep. The simple view for a member who does not manage the house drops the cards: one serif figure (their quota, 56px), plain sentences between hairline rules, and a single 56px primary action ("Aggiungi una spesa di casa").

### Casa: Dettagli, check-in, wizard
Dettagli is a stack of white section cards (hairline border, 1rem radius, 16px padding, 12px gap), each opened by a serif 1.125rem heading; text links inside are 44px, semibold 15px Passbook Blue Deep. The monthly check-in and the quota wizard go one question per step, the figure in serif, the choice as radio pills.

### Come si calcola? (explain panel)
A visible text action ("Come si calcola?", semibold 14px Passbook Blue Deep, 44px tall) toggles (`aria-expanded`) a Cover Tint panel with hairline border, 1rem radius and 12px padding: the formula in sentences, then ingredient rows with the label in soft ink left and a tabular semibold value right.

### Storico: day-grouped ledger
Movements are grouped by day inside one white card. Each day opens with a head row: 13px semibold soft ink date (the year is added only when it is not the current one), the day total right in tabular semibold, hairline below. Rows are 48px: category dot, truncating description, signed amount (income semibold Passbook Blue Deep), then 44px round ghost icon buttons for edit and delete (lucide Pencil and Trash2, 18px). Above the card sit the scrolling period pills and the "Per categoria" card: serif section heading, then one row per category with name left, amount and percent right, and an 8px full-round bar in the category hue on a Cover Tint track, scaled to the largest category. The bars are CSS and aria-hidden; the figures carry the data.

A transfer between two of the user's own accounts ("Spostato da Corrente a Risparmio") is a row of its day, without a sign, in the same card: it is neither an expense nor income and sits outside the day total and the category figures. Its delete button is labelled "Elimina spostamento" and goes through the undo notice like any other row.

### Cassetti and accounts
Cassetti and Conti are stacks of white hairline cards (1rem radius, 16px padding). An account card has the name left and the balance in serif 20px semibold right with a 44px ghost pencil; an optional 8px Passbook Blue progress bar on a Cover Tint track with a tabular "saldo / saldo da raggiungere" line below. The balance is never an open field: a quiet Cover Tint button "Aggiorna il saldo" (44px, semibold Passbook Blue Deep) reveals the input and a small "Salva" primary on tap. Goal deadlines are read in long dates.

A rientro (a self-instalment, see "Rimetti a rate") sits under the card it belongs to, inside the same card: a hairline rule above, 13px soft ink text, the sentence "Rientro: 100,00 € al mese fino a gennaio" in tabular figures. On an account card it adds "Da spostare: 200,00 €" in the same style. The actions are text actions (44px, semibold 15px Passbook Blue Deep): "Ferma", and "Lascia stare" when something is still to move. A cassetto with money spent from it and no open rientro shows a "Rimetti a rate" text action that opens the sheet with that cassetto already chosen.

### Rimetti a rate and Sposta sheets
Both are bottom sheets in the same frame as the confirm sheet, one question per step, the amount in serif 40px tabular figures, choices as radio pills (`SceltePill`), one 48px primary at the foot.

- **Rimetti a rate.** Step one, "Dove li rimetti?", lists the personal accounts outside the disponibile (not the tax account), the personal cassetti and the Casa cassetti (labelled "· Casa"). Step two, "Quanto?", is pre-filled for a cassetto with what was spent from it and not yet put back; empty for an account. Step three, "In quanti mesi?", offers 2, 3, 4, 6 and 12 months and states the instalment in a sentence ("100,00 € al mese, da novembre a gennaio."), months written in full. The primary is "Rimetti a rate"; a Casa cassetto shows "Lo vedrà anche Miriam." under it. With no destination the sheet says so and offers a "Metti da parte" link. Errors use the alert red line with a calm sentence.
- **Sposta tra i tuoi conti.** "Da" and "A" are radio pills over the personal accounts, "A" skips the account chosen in "Da", and a sole remaining account is chosen by itself. Then the amount (serif 40px), the date (native date input, no future dates, with a line "La data non può essere futura." when it is) and the primary "Sposta". Opened from the Home line it arrives with the accounts and the amount already set.
- **The question after a spend.** A bottom sheet titled "Vuoi rimetterli un po' al mese?" with one sentence naming the amount and the account, the months as pills and the instalment sentence; then the primary "Sì, rimettili" and a neutral "No, va bene così". It appears once, after a personal expense taken from an account outside the disponibile, and never over another sheet.

### Percorso: Primi passi and lesson card
`PrimiPassiCard` takes the tip's place in the Home while the starting steps are open: surface card, hairline border, serif "Primi passi" heading with "2 di 6" right in soft ink, one 32px row per step (lucide Check in Passbook Blue Deep when done, an empty hairline circle when not, done titles in soft ink), then one 48px primary link to the next step and a quiet "Li vedo più tardi" text button (44px target). `SchedaLezione` is a reading page, not a card: serif title, "In breve" paragraph, a hairline "Con i tuoi numeri" (or "Per esempio") panel on Cover Tint, a primary action and an outlined "Più tardi", sources as underlined 44px links at the bottom. `DaSapere` is one 44px row under the tip in the Home: muted surface, hairline border, 1rem radius, a semibold Passbook Blue Deep "Da sapere:" followed by the lesson title and a trailing chevron; it links to the lesson.

### Percorso: sheets and wait list
`AvvisoFondiFoglio` and `LezioneFoglio` are bottom sheets (same frame as the confirm sheet) shown after a save: a serif title that says what happened without blame, one or two 15px sentences, then buttons. When the fund can help, the question "È un imprevisto vero?" leads with a filled button and a neutral one; otherwise the sheet only informs, with a link to the lesson and "Chiudi". `ListaAttesa` is a form card (Cosa, Quanto, "Aggiungi") over a hairline list; each row has name and amount, the "Ci ripensi il ..." date in soft ink, and once the date has come two buttons, "Lo voglio ancora" (primary) and "Non più" (outlined). `RicominciaDaZero` is a full-width neutral button at the foot of Altro that opens a bottom sheet: what it deletes, what stays, the no-backup warning in semibold, a typed-word field and a primary "Cancella tutto e ricomincia" that stays disabled until the word matches.

### Undo notice
A solid ink block (foreground fill, background-colour text, 1rem radius) floating 5.5rem above the bottom bar inside a persistent polite live region, 12px side inset. Sentence left (15px), "Annulla" as semibold underlined text (44px target), a 44px close X (lucide). It appears after a delete and waits 5 seconds before the delete is committed; on failure the item returns and the notice says so for 6 seconds. Flat, no shadow.

### Confirm sheet
For heavy or irreversible actions only. A bottom sheet with a serif title, one sentence saying what will happen, an optional "Non avvisarmi più" checkbox (44px row, hairline above, brand accent; omitted when the action cannot be undone), and two equal 44px buttons: "Lascia stare" as the filled Passbook Blue primary (the safe choice leads) and "Elimina" outlined in alert red on page white.

### App icon
A Passbook Blue square carrying a white portrait booklet (3:4, about 58% of the side, corner radius 10% of its width) with a Passbook Blue spine band at 22% opacity down the left edge, two short ruled lines at 40% opacity, and a stamp-red ring tilted -10 degrees at the lower right. The 192 and 512 sizes keep a 10% margin; the maskable 512 keeps 20% so system masks do not cut the mark. The manifest theme colour is Passbook Blue and its background is Ground.

### Navigation
A bottom bar, white, 1px hairline on top, safe-area padded. Four tabs (Home, Storico, Casa, Altro) with 20px icons and 12px labels; active is Passbook Blue, bold, heavier stroke, with `aria-current`. The + button sits as a central slot between Storico and Casa, raised 20px. Its accessible name is "Cosa vuoi fare?". It opens the action menu, not the expense sheet: see Bottom sheet.

### Bottom sheet
Sheets rise from the bottom (0.32s ease-out), 1.5rem top radius, white, 1px hairline on top, a 40px grabber at 10% black, a serif 1.125rem semibold heading with a round X, 75vh scrolling body, a flat 40% black scrim that closes on tap. The sheet is a modal dialog: focus moves to its first control, Tab is trapped inside, Escape closes, focus returns to the opener. The quick-add sheet leads with the amount in large serif and asks for nothing else first.

The + opens the "Cosa vuoi fare?" menu, a bottom sheet in the same frame. Its body is the primary action first, then rows in the register style:
- **Registra una spesa** (in Casa: "Registra una spesa di casa"): a full-width Passbook Blue primary, 56px tall, 1rem radius, semibold 16px. Always first.
- Rows, each at least 56px, separated by hairlines, with a 20px lucide icon, a semibold 16px name, a 13px soft-ink line beneath, and an 18px trailing chevron. Hover uses Cover Tint. In order: **Entrata** (opens the expense sheet already on income), **Metti da parte** (opens the new-cassetto form), **Ci penso su** (opens the wait list with "Cosa" focused), **Rimetti a rate** (opens the instalment sheet; "Riporta un po' al mese soldi presi dai risparmi"), **Sposta tra i tuoi conti** (only with at least two personal accounts; "Da un conto all'altro, i saldi si aggiornano"), **Versa nel cassetto** (only when a personal cassetto pays in by instalments), **Versa la quota della casa** (only inside a Casa).
- The two rows that depend on data are last, so they do not move the rows above them when they appear. The menu opens without waiting for data.
- "Versa nel cassetto" with more than one cassetto first shows a second sheet, "In quale cassetto?", with one row per cassetto (its monthly instalment in tabular figures on the right) and a 48px "Indietro" text button. With one cassetto it goes straight to that cassetto's confirmation. The row stays after a confirmation, when the month is done ("Le rate di questo mese sono fatte").
- "Indietro" returns to the first step. Closing the sheet always reopens it at the first step.

### Fumetti
Speech bubbles that explain the app where it is used, in plain Italian, once per person. Two kinds, never shown together.

- **Il giro** (first run, Home only): the screen dims with a flat 40% black scrim, no blur. The explained piece stays lit inside a 2px Passbook Blue ring (4px air around it, 10px corner radius). The bubble is white, 1px hairline, 1rem radius, 16px padding, max 300px wide and 12px from the screen edges. Its text is 14px; "1 di 5" is 12px soft ink above it. Buttons: "Salta" as a 44px underlined text action, "Avanti" as a 48px Passbook Blue primary (semibold 14px). The last step says "Fatto". A 10px rotated square on the hairline points at the piece. Steps, in the bar's order: the available figure, Storico, the +, Casa (or the offer to create a house when there is none), Altro.
- **Il fumetto della prima volta** (one per screen): no scrim, no lock, the screen stays usable. Same bubble, with a 44px round close X and one "Ho capito" button (44px primary). It points at the main piece of: Storico (the period row, PeriodoFilter), Casa for managers (the "Da fare" card), Casa simple view (the quota figure), Cassetti (the first cassetto, or "Nuovo cassetto"), Conti (the first account), Lista d'attesa (the "Cosa" field), Impara (the first lesson), P.IVA (the tax jar figure). Home and Altro have none: the tour covers them.

Rules:
- One bubble at a time. Never over an open sheet, a confirmation or the undo notice: it waits for them to close, or for the next visit.
- A first-time bubble never appears in the same opening as the tour.
- A bubble never covers the "Primi passi" card. If its piece is not on screen, it waits for the next visit.
- Seen state lives in the browser, one key per user and per bubble, with a version constant. A release does not reset it. If the browser cannot store it, bubbles show at most once per session.
- "Rivedi il giro" in Altro restarts the tour and every first-time bubble. "Ricomincia da zero" restarts them too.
- Dialogs: the tour is modal (focus starts on "Avanti", Tab stays inside, Escape counts as "Salta", focus returns). The first-time bubble is non-modal and is announced once with a polite live region.
- Reduced motion: the bubbles have no animation of their own, and the global `prefers-reduced-motion` rule in `globals.css` covers the sheets. Targets at least 44px. The bubble never leaves the screen at 375px, and respects the safe areas.

## Do's and Don'ts

### Do:
- **Do** put every amount, date and running total in a `.num` column with tabular lining numerals.
- **Do** keep the stamp red (#c8102e) for "registrato" confirmations only.
- **Do** build surfaces from a 1px hairline border, a white page and 1rem radius before reaching for a shadow.
- **Do** keep done obligations visible and struck through until month end.
- **Do** keep touch targets at 44px or more and primary actions at 48px.
- **Do** give each Casa screen one headline figure or status sentence, one action, and details behind a link.
- **Do** attach "Come si calcola?" to computed Casa figures and show ingredients as tabular rows.
- **Do** use radio pills (single selection, arrow keys) for short choices in Casa flows.
- **Do** make delete reversible with the undo notice; keep the confirm sheet for heavy or irreversible actions, with the safe choice ("Lascia stare") as the filled button.
- **Do** write dates inside sentences in long form (`formatDataLunga`).
- **Do** draw bars as flat CSS blocks on a Cover Tint track, in the category hue or Passbook Blue.
- **Do** use lucide icons (18 to 20px) for actions and forward marks, never typed glyphs.
- **Do** respect safe-area insets at the top (cover band) and bottom (tab bar) and honour reduced motion.

### Don't:
- **Don't** use a coloured balance card over a feed of icon tiles; this system refuses that category default.
- **Don't** compute or display a backward running balance: balances are edited by hand, so the ledger shows the month-to-date total ("Nel mese").
- **Don't** use gradients, glow shadows or a second reserved accent next to the stamp.
- **Don't** set prose, buttons or labels in the serif, or figures in the grotesk.
- **Don't** use stamp red for errors; errors use alert red. Its one non-stamp use is the icon mark.
- **Don't** put shadows or blur on sheets, scrims or notices.
- **Don't** leave a balance as an always-open field; edit on tap.

## Known drift (not canonical)

Recorded so future work does not inherit these as rules:
- Type-ramp advisories remain on large cent figures: the 28px cents beside the 56px figure and the 40px check-in figure sit off a strict ramp. The 40px serif amount fields of "Rimetti a rate" and "Sposta" (and the 40px figures of the P.IVA quota sheets) follow the same 40px step; the detector flags them as advisories. The P.IVA headline (serif 3rem) is also off the ramp. Recorded as built, not as a ramp to extend.
- The older tabbed variant inside `AddTransactionForm` still uses `text-muted`, `shadow-[var(--shadow-card)]` (resolves to none) and a sans `text-5xl` amount instead of the serif entry figure.
- The stamp's 10px text is just below the 11px label floor used elsewhere; it is a decorative mark, not a reading size.
- Type sizes mix px and rem in the source; the values above record what the build uses.
