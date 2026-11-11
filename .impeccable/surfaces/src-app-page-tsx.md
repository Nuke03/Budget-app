---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/add/AddTransactionSheet.tsx","src/app/HomeDashboard.tsx"]
---

Scope: Home (`src/app/page.tsx`, `HomeDashboard.tsx`) and the quick-add sheet (`src/app/add/`); visitor mode Operate, iPhone, installed PWA. First surface of the replacement visual world; the rest of the app inherits its tokens.

Audience/job: Fabio and his partner, quick glances during the day; log an expense in one tap plus the amount, read "how much can I spend", see the one next thing. Constraints: PRODUCT.md, spec `docs/superpowers/specs/2026-11-11-app-di-supporto-design.md`, tone chosen by Fabio "calmo e affidabile", blue. Fabio picked "Il Libretto" over the rolled "Il Tabellone" (11 Nov 2026).

## Direction contract

THESIS: Your money as a savings passbook: every movement is a line with the running balance beside it, so the headline number is earned line by line. Refuses the category default of a coloured balance card over a feed of icon tiles.

OWN-WORLD: Passbook blue cover (#14306b) as a narrow header band, white pages on a pale blue-grey ground (#eef2f8), thin hairline rules, a serif for the headline figures and a plain grotesk for everything else, tabular lining numerals in every amount column, one red stamp (#c8102e) reserved for "registrato" confirmations only. Flat colour, no gradients, no glow shadows.

STORY: The visitor reads the disponibile and its per-day margin first, sees the last movements with their running balance, sees the one next thing, taps + and enters only the amount; the new line lands in the passbook with the stamp and the balance updates.

FIRST VIEWPORT: Blue cover band with "Il mio libretto" and the month; white page with "Disponibile libero" label and the figure in large serif; per-day margin line; ledger card with columns Data / Movimento / Importo / Saldo (4 latest rows); "Prossimo" card with the next obligation; + button bottom-right above a 4-tab bar (Home, Storico, Casa, Altro). Signature move: after saving an expense the new row slides into the ledger and a round red "REGISTRATO" stamp presses onto it while the saldo column updates.

FORM: Il Libretto (libretto di risparmio postale), position 1 on my ordered list (IMPECCABLE'S PICK card), seed:078ae3448a5360c2. Kept raises from declined challengers: one reserved colour (the stamp red) for one job only; flat colour; amounts always in tabular columns; done obligations stay visible, struck through, until month end.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Unresolved: Casa, history, goals and P.IVA screens inherit tokens now and get their own passes in plan B; app icon redone in this world.
