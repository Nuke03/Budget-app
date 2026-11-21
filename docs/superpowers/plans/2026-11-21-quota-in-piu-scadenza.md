# Un po' di più per la scadenza (P13) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dopo un incasso, la domanda della quota propone anche il pezzo che manca per la prossima scadenza F24 non coperta, diviso sugli incassi attesi.

**Architecture:** Una funzione pura in `src/lib/calculations/pivaScadenze.ts` calcola il pezzo in più; `PromptQuota` lo mostra dentro la cifra; Home (foglio dell'aggiunta) e pagina P.IVA passano i dati che hanno già.

**Tech Stack:** Next.js 16.3.3, React 19, TypeScript, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-21-quota-in-piu-scadenza-design.md`

## Global Constraints

- Leggere `AGENTS.md` prima di scrivere codice Next.
- Nessuna migrazione, nessuna dipendenza nuova. La percentuale delle impostazioni non cambia; il riservato del disponibile resta la quota base.
- Importi arrotondati all'euro come `computeQuotaIncasso`. Date nelle frasi per esteso (`formatDataLunga`).
- Testi senza "devi", senza colpa; passano `assertNessunaParolaVietata`.
- Mai committare `.impeccable/hook.cache.json`. Master. Commit con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Scadenza senza cifra, pagata, nascosta o passata: ignorata. (Task 1)
2. Incasso piccolo (la quota base supera già metà dell'incasso): niente pezzo in più, mai negativo. (Task 1)
3. Due scadenze vicine: la prima coperta, la seconda no → si copre la seconda, con il totale cumulativo. (Task 1)
4. Dati della scadenza mancanti (lettura fallita): la domanda resta quella di oggi. (Task 3)
5. Dalla pagina P.IVA, la quota dell'incasso aperto non va contata due volte (è già fra le quote in sospeso). (Task 3)

---

### Task 1: Il calcolo del pezzo in più (sonnet)

**Files:** Modify `src/lib/calculations/pivaScadenze.ts`; Test `tests/calculations/pivaScadenzeInPiu.test.ts`.

**Interfaces — Produces:**
```ts
export interface DatiScadenzaVaso {
  scadenze: PivaScadenza[];
  saldoVaso: number;
  // Quote proposte e non ancora spostate, ESCLUSA quella dell'incasso di cui si parla.
  inSospeso: number;
  incassiMensili: number[]; // da finestraIncassi
}
export function pezzoInPiuScadenza(
  i: DatiScadenzaVaso & { importo: number; quotaBase: number; oggi: string }
): { importo: number; scadenza: PivaScadenza } | null
```
Regole (dalla spec): scadenze valide = non pagate, non nascoste, con `importo != null`, `data >= oggi`, in ordine di data. Disponibile per le scadenze = `saldoVaso + inSospeso + quotaBase`. La scadenza da coprire è la prima il cui totale cumulativo supera il disponibile; `mancano = cumulativo − disponibile`. Mesi = mesi di calendario dal mese di `oggi` a quello della scadenza, compresi (minimo 1). Media = media di `incassiMensili` (0 se vuoto). Pezzo = media > 0 ? `Math.round(importo × mancano / (media × mesi))` : `mancano`; poi `min(pezzo, mancano, Math.round(importo / 2) − quotaBase)`. Se il risultato è ≤ 0 → `null`. Arrotondare `mancano` ai centesimi prima dell'uso.

- [ ] **Step 1: Test che falliscono** (oggi `2026-11-21`; scadenza `2027-01-16`):
  - importo scadenza 1000, saldoVaso 450, inSospeso 0, quotaBase 250, incasso 1000, media [1000, 1000, 1000] → `{ importo: 100, scadenza }` (mancano 300, 3 mesi).
  - mancano 3000 con 1 mese e media 1000 su incasso 1000, quotaBase 250 → 250 (tetto: metà incasso − quota).
  - `incassiMensili: []`, mancano 300, incasso 1000, quotaBase 250 → 250 (tutto fino al tetto); mancano 100 → 100.
  - vaso sufficiente → `null`; quotaBase 600 su incasso 1000 → `null`.
  - scadenze pagata, nascosta, senza cifra o con data passata → ignorate.
  - due scadenze (dic 500 coperta, gen 1000): totale cumulativo 1500 contro il disponibile, la scadenza restituita è quella di gennaio.
- [ ] **Step 2:** `npx vitest run tests/calculations/pivaScadenzeInPiu.test.ts` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5: Commit** `feat(piva): il pezzo in più per la scadenza`.

### Task 2: La domanda della quota con il pezzo in più (haiku)

**Files:** Modify `src/app/piva/PromptQuota.tsx`; Test `tests/PromptQuota.test.tsx`.

**Interfaces — Consumes:** `PercheScadenza` (`src/app/piva/PerchePiva.tsx`). **Produces:** prop nuova `inPiu?: { importo: number; data: string } | null` su `PromptQuota`.

Con `inPiu`: la cifra grande è `quota + inPiu.importo`; il campo modificabile parte da quella somma; sotto la riga di oggi compare `` `${euroInFrase(quota)} di quota e ${euroInFrase(inPiu.importo)} per la scadenza del ${formatDataLunga(inPiu.data)}.` `` seguita da `PercheScadenza`. Senza `inPiu`: identica a oggi.

- [ ] **Step 1: Test che falliscono:** con `quota 300`, `inPiu { importo: 150, data: '2027-06-30' }` → si vede "450 €", la frase "300 € di quota e 150 € per la scadenza del 30 giugno 2027." e il link del perché; "Fatto, li ho spostati" chiama `onFatto(450)`; senza `inPiu` i test di oggi restano verdi; testi senza parole vietate.
- [ ] **Step 2:** `npx vitest run tests/PromptQuota.test.tsx` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5: Commit** `feat(piva): la quota propone anche il pezzo per la scadenza`.

### Task 3: I dati arrivano dalla Home e dalla pagina P.IVA (sonnet)

**Files:** Modify `src/lib/loadHomeData.ts` (e `src/lib/pivaHome.ts` se il tipo `PivaHome` sta lì), `src/app/HomeDashboard.tsx`, `src/app/add/AddTransactionSheet.tsx`, `src/app/piva/PivaHub.tsx`, `docs/ROADMAP.md`; Test `tests/AddTransactionSheet.test.tsx`, `tests/PivaHub.test.tsx`, `tests/loadHomeData*.test.ts`.

**Interfaces — Consumes:** `pezzoInPiuScadenza`, `DatiScadenzaVaso` (Task 1); `PromptQuota.inPiu` (Task 2).
- `PivaHome` riceve `scadenzaVaso?: DatiScadenzaVaso | null` (scadenze già lette dalla Home, saldo del conto tasse, `totaleInSospeso(inSospeso)`, `finestraIncassi(...).incassiMensili`). Se una di queste letture manca o fallisce: `null`.
- La prop `piva` di `AddTransactionSheet` riceve `scadenzaVaso?: DatiScadenzaVaso | null`; in `handleSubmit`, quando propone la quota di un incasso, calcola `pezzoInPiuScadenza({ ...scadenzaVaso, importo, quotaBase, oggi })` e lo mette nello stato della quota; `PromptQuota` lo riceve come `inPiu` (`{ importo, data: scadenza.data }`).
- `PivaHub`: per la quota di un incasso aperto, `inSospeso` = totale in sospeso **meno** la quota di quell'incasso (Review Focus 5); stesso calcolo, stessa prop.
- `docs/ROADMAP.md`: P13 segnata come fatta il 21 novembre 2026.

- [ ] **Step 1: Test che falliscono:** dal foglio dell'aggiunta, un incasso nella categoria del fatturato con `scadenzaVaso` che lascia un buco → la domanda mostra la frase del pezzo in più; con `scadenzaVaso: null` → domanda di oggi; da `PivaHub`, la quota di un incasso già in sospeso non è contata due volte (con il vaso che basta solo grazie a quell'esclusione, nessun pezzo in più); `loadHomeData` riempie `scadenzaVaso` e lo mette a `null` se le scadenze non si leggono.
- [ ] **Step 2:** `npx vitest run tests/AddTransactionSheet.test.tsx tests/PivaHub.test.tsx` → FAIL.
- [ ] **Step 3:** Implementa e aggiorna la ROADMAP.
- [ ] **Step 4:** `npx vitest run` → tutto PASS; `npx tsc --noEmit`; `npm run build`.
- [ ] **Step 5: Commit** `feat(piva): il pezzo in più per la scadenza dalla Home e dalla P.IVA`, poi revisione finale e `git push`.
