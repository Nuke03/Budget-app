# Orientarsi (menu del + e fumetti) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il + apre un menu "Cosa vuoi fare?"; un giro di 5 fumetti alla prima apertura e un fumetto la prima volta in ogni schermata; "Obiettivi" diventa "Cassetti" in tutto il testo visibile.

**Architecture:** Il menu è un `FoglioInferiore` aperto dalla `NavBar`; le azioni riusano i flussi esistenti (evento `EVENTO_AGGIUNGI`, `/goals?nuovo=1`) più tre ingressi nuovi via indirizzo (`?versa=<id>`, `/impara/attesa?nuovo=1`, `/casa?azione=versamento`). Le voci che dipendono dai dati arrivano da una server action letta all'apertura, senza bloccare. I fumetti sono componenti client che si agganciano a elementi con l'attributo `data-fumetto`; "già visto" sta in `localStorage`, per utente e per versione.

**Tech Stack:** Next.js 16.3.3 (App Router), React 19, TypeScript, Tailwind 4, Supabase, Vitest + Testing Library (jsdom), lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-20-orientarsi-design.md`

## Global Constraints

- Prima di scrivere codice Next leggere `AGENTS.md` e la guida pertinente in `node_modules/next/dist/docs/` (server actions, `useRouter`, `searchParams`).
- Nessuna dipendenza nuova, nessuna migrazione, nessun cambio di URL o di nomi nel codice: cambia solo il testo visibile.
- Mondo "Il Libretto" (`DESIGN.md`): token esistenti (`bg-brand`, `text-brand-foreground`, `text-brand-dark`, `bg-brand-tint`, `bg-page`, `bg-surface`, `border-rule`, `text-ink-2`, `--radius-md`), niente ombre, niente gradienti, velo piatto 40% nero senza sfocatura, icone lucide 18–20px, bersagli ≥ 44px, azioni primarie ≥ 48px.
- Testi: una frase, niente "devi/dovresti", niente colpa, niente parole tecniche; ogni testo nuovo passa `assertNessunaParolaVietata` (`tests/helpers/paroleVietate.ts`).
- Movimento ridotto (`prefers-reduced-motion`): niente animazioni su menu e fumetti.
- Mai committare `.impeccable/hook.cache.json`. Si lavora su `master`, niente stash/reset/cambi di branch. Commit con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Modello per i subagenti: indicato in ogni task (haiku semplice, sonnet dati/testi delicati, opus solo revisione finale).

## Review Focus

1. Il menu si apre mentre la lettura dei dati è lenta o fallisce: "Registra una spesa" funziona subito; le due voci in fondo arrivano dopo o non arrivano, senza errori a schermo. (Task 6)
2. Il pezzo da indicare non c'è o non si vede (nessun cassetto, nessun conto, P.IVA non configurata, elemento fuori schermo): il fumetto non compare a (0,0) e aspetta. (Task 3)
3. `localStorage` bloccato (navigazione privata): i fumetti non ricompaiono a ogni apertura, al più una volta per sessione. (Task 1)
4. Due persone sullo stesso telefono: "già visto" di Fabio non spegne i fumetti di Miriam. (Task 1)
5. Un foglio si apre mentre un fumetto della prima volta è visibile (per esempio si tocca il +): il fumetto si nasconde senza segnarsi visto e ricompare quando il foglio si chiude. (Task 3)

---

### Task 1: Memoria "già visto" dei fumetti

Modello: haiku.

**Files:**
- Create: `src/lib/fumetti/visti.ts`
- Test: `tests/fumettiVisti.test.ts`

**Interfaces:**
- Produces:
  - `type FumettoId = 'giro' | 'storico' | 'casa' | 'casa-semplice' | 'cassetti' | 'conti' | 'attesa' | 'impara' | 'piva'`
  - `const VERSIONI_FUMETTI: Record<FumettoId, number>` (tutti `1`)
  - `eVisto(userId: string, id: FumettoId, versioni?: Record<FumettoId, number>): boolean`
  - `segnaVisto(userId: string, id: FumettoId, versioni?: Record<FumettoId, number>): void`
  - `azzeraFumetti(userId: string): void`
  - `segnaGiroInQuestaApertura(): void` e `giroInQuestaApertura(): boolean` (in `sessionStorage`, chiave `fumetti:giro-ora`; se non disponibile, variabile di modulo)

Chiave: `` `fumetti:${userId}:${id}:v${versione}` ``. Se `localStorage` lancia, un `Set` di modulo ricorda i visti per la sessione.

- [ ] **Step 1: Scrivi i test che falliscono**

```ts
it('un fumetto mai visto non è visto; dopo segnaVisto sì', () => {
  expect(eVisto('u1', 'storico')).toBe(false);
  segnaVisto('u1', 'storico');
  expect(eVisto('u1', 'storico')).toBe(true);
});
it('ogni utente ha i suoi visti', () => {
  segnaVisto('u1', 'giro');
  expect(eVisto('u2', 'giro')).toBe(false);
});
it('alzare la versione di un fumetto lo fa ripartire, gli altri no', () => {
  segnaVisto('u1', 'giro'); segnaVisto('u1', 'conti');
  const nuove = { ...VERSIONI_FUMETTI, conti: 2 };
  expect(eVisto('u1', 'conti', nuove)).toBe(false);
  expect(eVisto('u1', 'giro', nuove)).toBe(true);
});
it('azzeraFumetti toglie solo quelli di quell utente', () => {
  segnaVisto('u1', 'giro'); segnaVisto('u2', 'giro');
  azzeraFumetti('u1');
  expect(eVisto('u1', 'giro')).toBe(false);
  expect(eVisto('u2', 'giro')).toBe(true);
});
it('senza localStorage ricorda per la sessione', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloccato'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloccato'); });
  expect(eVisto('u1', 'impara')).toBe(false);
  segnaVisto('u1', 'impara');
  expect(eVisto('u1', 'impara')).toBe(true);
});
it('giroInQuestaApertura parte falso e diventa vero', () => {
  expect(giroInQuestaApertura()).toBe(false);
  segnaGiroInQuestaApertura();
  expect(giroInQuestaApertura()).toBe(true);
});
```
(`beforeEach`: `localStorage.clear()`, `sessionStorage.clear()`, `vi.restoreAllMocks()`; esporre una `_azzeraMemoriaPerTest()` per svuotare il `Set` di modulo.)

- [ ] **Step 2:** `npx vitest run tests/fumettiVisti.test.ts` → FAIL (modulo mancante).
- [ ] **Step 3:** Implementa `src/lib/fumetti/visti.ts` con le firme sopra. `azzeraFumetti` scorre le chiavi di `localStorage` che iniziano con `` `fumetti:${userId}:` `` e toglie anche quelle dal `Set`.
- [ ] **Step 4:** `npx vitest run tests/fumettiVisti.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(fumetti): memoria "già visto" per utente e versione`.

### Task 2: Ambiente dei fumetti (utente e "qualcosa è aperto")

Modello: haiku.

**Files:**
- Create: `src/lib/fumetti/ambiente.ts`
- Modify: `src/app/AvvisoAnnulla.tsx` (attributo `data-avviso-annulla` sul blocco visibile, quello con `{testo}`)
- Test: `tests/fumettiAmbiente.test.tsx`

**Interfaces:**
- Consumes: `leggiSessione(supabase)` da `src/lib/utenteOLogin.ts`, `createClient` da `src/lib/supabase/client`.
- Produces:
  - `useUtenteId(): string | null` (null finché non letto, senza sessione, o se `createClient`/`leggiSessione` lanciano: così i test delle pagine che non mockano Supabase restano verdi e i fumetti semplicemente non compaiono)
  - `qualcosaAperto(doc?: Document): boolean`: vero se nel documento c'è `[aria-modal="true"]` che non ha `data-fumetto-giro`, oppure `[data-avviso-annulla]`.
  - `useQualcosaAperto(): boolean`: lo stesso valore, aggiornato con un `MutationObserver` su `document.body` (`childList`, `subtree`, `attributes`).

- [ ] **Step 1: Test che falliscono:** `qualcosaAperto` è falso su un body vuoto; vero con `<div role="dialog" aria-modal="true">`; falso se quel div ha `data-fumetto-giro`; vero con `<div data-avviso-annulla>`. `useUtenteId` restituisce `'u1'` con `leggiSessione` mockato a `{ userId: 'u1', token: 't' }`. `useQualcosaAperto` passa da `false` a `true` dopo aver aggiunto un dialog al body (`await waitFor`). Rendere `AvvisoAnnulla` con un testo e verificare che `[data-avviso-annulla]` esista.
- [ ] **Step 2:** `npx vitest run tests/fumettiAmbiente.test.tsx` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npx vitest run tests/fumettiAmbiente.test.tsx tests/AvvisoAnnulla.test.tsx` → PASS.
- [ ] **Step 5: Commit** `feat(fumetti): utente corrente e controllo dei fogli aperti`.

### Task 3: Il fumetto (componente) e il fumetto della prima volta

Modello: sonnet (posizionamento, accessibilità).

**Files:**
- Create: `src/app/fumetti/Fumetto.tsx`, `src/app/fumetti/FumettoPrimaVolta.tsx`
- Test: `tests/Fumetto.test.tsx`, `tests/FumettoPrimaVolta.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`eVisto`, `segnaVisto`, `giroInQuestaApertura`, `FumettoId`), Task 2 (`useUtenteId`, `useQualcosaAperto`).
- Produces:
  - `Fumetto(props: { ancora: string; testo: string; modale: boolean; passo?: { n: number; di: number }; etichettaAvanti?: string; onAvanti?: () => void; onSalta?: () => void; onChiudi?: () => void }): JSX.Element | null`
    - Trova `document.querySelector(`[data-fumetto="${ancora}"]`)`. Se l'elemento manca o il suo rettangolo è vuoto o fuori dalla finestra, restituisce `null`.
    - Il fumetto sta sotto il pezzo se il pezzo è nella metà alta, altrimenti sopra; ha una punta verso il pezzo; resta a 12px dai bordi e dentro le zone sicure; si ricalcola su `resize` e `scroll`.
    - `modale`: velo nero 40% su tutto tranne un buco attorno al pezzo (4 rettangoli o SVG con maschera, niente `box-shadow`), anello 2px Passbook Blue; `role="dialog" aria-modal="true" data-fumetto-giro`; il focus va su "Avanti"; Tab resta dentro; Esc chiama `onSalta`; alla chiusura il focus torna dov'era. Mostra `"{n} di {di}"`, il bottone primario con `etichettaAvanti ?? 'Avanti'` e l'azione di testo "Salta".
    - Non modale: niente velo, `role="dialog"` senza `aria-modal`, `aria-live="polite"`, il focus non si sposta; "Ho capito" (bottone primario piccolo) e una X (lucide `X`, `aria-label="Chiudi"`), entrambi chiamano `onChiudi`.
  - `FumettoPrimaVolta(props: { id: Exclude<FumettoId, 'giro'>; ancora: string; testo: string }): JSX.Element | null`
    - Si mostra solo se: utente noto, `!eVisto(utente, id)`, `!giroInQuestaApertura()`, `!useQualcosaAperto()`, e `Fumetto` trova il pezzo.
    - Se un foglio si apre mentre è visibile: si nasconde senza segnarsi visto e torna quando il foglio si chiude.
    - "Ho capito" e X: `segnaVisto(utente, id)` e si chiude.

- [ ] **Step 1: Test che falliscono** (mock di `getBoundingClientRect` sull'elemento ancora per un rettangolo visibile; mock di `useUtenteId` → `'u1'`):
  - `Fumetto` modale: mostra "2 di 5", "Avanti", "Salta"; Esc chiama `onSalta`; il focus è su "Avanti".
  - `Fumetto` senza ancora nel DOM → non rende niente.
  - `Fumetto` con un'ancora di rettangolo `0×0` → non rende niente.
  - `FumettoPrimaVolta` mai visto → si vede il testo; "Ho capito" → sparisce e `eVisto('u1','storico')` è vero.
  - Già visto → non si vede.
  - `giroInQuestaApertura()` vero → non si vede.
  - Con un `<div role="dialog" aria-modal="true">` nel body → non si vede; rimosso il div → si vede (`waitFor`), e non è stato segnato visto nel frattempo.
  - Il testo passa `assertNessunaParolaVietata`.
- [ ] **Step 2:** `npx vitest run tests/Fumetto.test.tsx tests/FumettoPrimaVolta.test.tsx` → FAIL.
- [ ] **Step 3:** Implementa i due componenti.
- [ ] **Step 4:** stessi test → PASS.
- [ ] **Step 5: Commit** `feat(fumetti): fumetto e fumetto della prima volta`.

### Task 4: Il giro della barra

Modello: sonnet.

**Files:**
- Create: `src/app/fumetti/GiroBarra.tsx`
- Modify: `src/app/HomeDashboard.tsx` (`data-fumetto="disponibile"` sul `<p data-testid="disponibile">`; monta `<GiroBarra haCasa={!!casa} />`), `src/app/NavBar.tsx` (`data-fumetto="nav-storico" | "nav-casa" | "nav-altro"` sui link, `data-fumetto="nav-piu"` sul +)
- Test: `tests/GiroBarra.test.tsx`

**Interfaces:**
- Consumes: Task 1, Task 2, `Fumetto` (Task 3).
- Produces: `GiroBarra(props: { haCasa: boolean }): JSX.Element | null`; `PASSI_GIRO(haCasa: boolean): { ancora: string; testo: string }[]`.

Testi esatti (dalla spec, già con "cassetti"):
1. `disponibile`: "Questo è quanto puoi spendere adesso. I soldi dei cassetti sono già tolti."
2. `nav-storico`: "In Storico trovi tutti i movimenti, giorno per giorno, e dove vanno i soldi."
3. `nav-piu`: "Con il + registri una spesa in pochi secondi. Dentro trovi anche le altre cose che puoi fare."
4. `nav-casa`: con casa "Casa è lo spazio che condividete: spese comuni, quota del mese e se siete in pari."; senza casa "Qui puoi creare una casa da condividere con chi vive con te."
5. `nav-altro`: "In Altro ci sono i cassetti, i conti, le lezioni di Impara e le impostazioni."

Comportamento: parte se utente noto, `!eVisto(u,'giro')` e `!qualcosaAperto()` al montaggio (se qualcosa è aperto, aspetta che si chiuda finché la Home resta montata). Alla partenza chiama `segnaGiroInQuestaApertura()`. "Avanti" va al passo dopo; all'ultimo passo l'etichetta è "Fatto". "Fatto", "Salta" ed Esc: `segnaVisto(u,'giro')` e chiusura.

- [ ] **Step 1: Test che falliscono:** sequenza dei 5 testi con "1 di 5"…"5 di 5" e "Fatto" all'ultimo; "Salta" al passo 2 chiude e segna visto; già visto non parte; con un dialog aperto non parte e parte quando si chiude; `haCasa=false` mostra il testo senza casa al passo 4; dopo la partenza `giroInQuestaApertura()` è vero; i testi passano `assertNessunaParolaVietata`. Aggiornare `tests/NavBar.test.tsx` per controllare i 4 attributi `data-fumetto`.
- [ ] **Step 2:** `npx vitest run tests/GiroBarra.test.tsx` → FAIL.
- [ ] **Step 3:** Implementa e monta.
- [ ] **Step 4:** `npx vitest run tests/GiroBarra.test.tsx tests/NavBar.test.tsx tests/HomeDashboard.test.tsx` → PASS.
- [ ] **Step 5: Commit** `feat(fumetti): il giro della barra nella Home`.

### Task 5: Le voci del menu che dipendono dai dati (server action)

Modello: sonnet (legge cassetti e conferme).

**Files:**
- Create: `src/app/menu/actions.ts` (`'use server'`)
- Test: `tests/menuActions.test.ts`

**Interfaces:**
- Consumes: `createClient` (`@/lib/supabase/server`), `utenteOLogin`, `getOpenGoals` (`@/lib/data/goals`), `getConfermePerObiettivi` (`@/lib/data/goalVersamenti`), `computeQuotaMensile` (`@/lib/calculations/accantonato`), `getMyHousehold` (`@/lib/data/households`).
- Produces:
  ```ts
  export interface CassettoARate { id: string; nome: string; quota: number; confermatoMese: number }
  export interface VociMenu { cassettiARate: CassettoARate[]; haCasa: boolean }
  export async function leggiVociMenu(): Promise<VociMenu>
  ```
  `cassettiARate`: obiettivi personali aperti con `modalita === 'dilazionato'` e `computeQuotaMensile(g, oggi)` non null e > 0 (un errore di calcolo su un obiettivo lo esclude); `quota` arrotondata ai centesimi; `confermatoMese` da `getConfermePerObiettivi(...)[id].mese` (se la lettura delle conferme fallisce: 0). `haCasa`: `getMyHousehold(supabase, user.id)` non null (se fallisce: false).

- [ ] **Step 1: Test che falliscono** (mock come in `tests/attesaActions.test.ts`): un bloccato e un dilazionato → solo il dilazionato; dilazionato senza scadenza (calcolo che lancia) → escluso; conferme che falliscono → `confermatoMese: 0`; casa presente → `haCasa: true`; `getMyHousehold` che lancia → `haCasa: false`; nessun obiettivo → `cassettiARate: []`.
- [ ] **Step 2:** `npx vitest run tests/menuActions.test.ts` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5: Commit** `feat(menu): voci del menu che dipendono dai dati`.

### Task 6: Il menu "Cosa vuoi fare?" e la NavBar

Modello: sonnet.

**Files:**
- Create: `src/app/menu/MenuAzioni.tsx`
- Modify: `src/app/NavBar.tsx` (il + apre il menu, `aria-label="Cosa vuoi fare?"`), `src/lib/eventoAggiungi.ts` (`DettaglioAggiungi.tipo?: 'income'`), `src/app/casa/CasaFab.tsx` (se `detail.tipo === 'income'` non segna gestito e non apre)
- Test: `tests/MenuAzioni.test.tsx`, `tests/NavBar.test.tsx`

**Interfaces:**
- Consumes: `leggiVociMenu`, `VociMenu` (Task 5), `FoglioInferiore`, `EVENTO_AGGIUNGI`, `DettaglioAggiungi`, `formatEuro`.
- Produces: `MenuAzioni(props: { aperto: boolean; onClose: () => void; inCasa: boolean }): JSX.Element | null`.

Voci, in quest'ordine (testi esatti):

| Voce | Riga sotto | Azione (prima chiude il menu) |
|---|---|---|
| "Registra una spesa" / con `inCasa` "Registra una spesa di casa" | — | dispatch `EVENTO_AGGIUNGI` con `{ gestito: false }`; se non gestito `router.push('/?aggiungi=1')` |
| "Entrata" | "Uno stipendio, un rimborso" | dispatch con `{ gestito: false, tipo: 'income' }`; se non gestito `router.push('/?aggiungi=entrata')` |
| "Metti da parte" | "Crea un cassetto per una cosa che arriva" | `router.push('/goals?nuovo=1')` |
| "Ci penso su" | "Lista d'attesa prima di comprare" | `router.push('/impara/attesa?nuovo=1')` |
| "Versa nel cassetto" (solo se `cassettiARate.length > 0`) | "Conferma la rata del mese"; se tutti hanno `confermatoMese > 0`: "Le rate di questo mese sono fatte" | 1 cassetto: `router.push(`/goals?versa=${id}`)`; più cassetti: nel foglio compare il passo "In quale cassetto?" con una riga per cassetto (nome a sinistra, `formatEuro(quota)` a destra, `.num`) e un "Indietro"; toccando una riga `router.push(`/goals?versa=${id}`)` |
| "Versa la quota della casa" (solo se `haCasa`) | "Quanto ti tocca questo mese" | `router.push('/casa?azione=versamento')` |

Aspetto: "Registra una spesa" è un bottone primario pieno alto 56px; le altre sono righe alte ≥ 56px con icona lucide 20px (`ArrowDownLeft`, `PiggyBank`, `Hourglass`, `CircleCheck`, `Building2`), nome semibold 16px, riga sotto 13px `text-ink-2`, `ChevronRight` a destra, filetti `border-rule`. `leggiVociMenu()` parte all'apertura e non si aspetta: finché non risponde (o se lancia) le ultime due voci non ci sono. Il risultato resta in memoria per le aperture successive nella stessa visita della pagina. `inCasa` = `pathname.startsWith('/casa')`.

- [ ] **Step 1: Test che falliscono:**
  - Toccando il + compare il foglio "Cosa vuoi fare?" con "Registra una spesa" mentre `leggiVociMenu` è ancora in attesa (promessa mai risolta).
  - "Registra una spesa" gestito dalla pagina → niente `push`; non gestito → `push('/?aggiungi=1')`.
  - "Entrata" invia l'evento con `tipo: 'income'`; non gestito → `push('/?aggiungi=entrata')`.
  - "Metti da parte" → `push('/goals?nuovo=1')`; "Ci penso su" → `push('/impara/attesa?nuovo=1')`.
  - Con un cassetto a rate → "Versa nel cassetto" → `push('/goals?versa=g1')`; con due → compare "In quale cassetto?" con i due nomi e le rate, la seconda riga → `push('/goals?versa=g2')`.
  - Tutti con `confermatoMese > 0` → riga "Le rate di questo mese sono fatte".
  - `haCasa: false` → niente "Versa la quota della casa"; `true` → `push('/casa?azione=versamento')`.
  - `leggiVociMenu` che lancia → nessun errore a schermo, solo le prime 4 voci.
  - Su `/casa` l'etichetta è "Registra una spesa di casa".
  - `CasaFab` non apre il foglio per un evento con `tipo: 'income'`.
  - Tutto il foglio passa `assertNessunaParolaVietata`.
  - In `tests/NavBar.test.tsx`: sostituire i test sul + (che oggi cercano "Aggiungi transazione" e si aspettano l'evento diretto) con: il + ha nome "Cosa vuoi fare?" e apre il menu.
- [ ] **Step 2:** `npx vitest run tests/MenuAzioni.test.tsx tests/NavBar.test.tsx` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npx vitest run tests/MenuAzioni.test.tsx tests/NavBar.test.tsx tests/CasaPage.test.tsx tests/VistaSemplice.test.tsx` → PASS.
- [ ] **Step 5: Commit** `feat(menu): il + apre "Cosa vuoi fare?"`.

### Task 7: Entrata dal menu nella Home

Modello: haiku.

**Files:**
- Modify: `src/app/HomeDashboard.tsx`
- Test: `tests/HomeDashboard.test.tsx`

**Interfaces:**
- Consumes: `DettaglioAggiungi.tipo` (Task 6); le prop esistenti `modoIniziale` e `iniziale` di `AddTransactionSheet`.

Lo stato `aggiuntaIniziale: { tipo: 'income'; categoriaId: null } | null` si imposta quando l'evento ha `tipo: 'income'` o l'indirizzo ha `aggiungi=entrata`, e torna `null` alla chiusura del foglio. Con `aggiuntaIniziale` il foglio riceve `modoIniziale="personale"` e `iniziale={aggiuntaIniziale}`; senza, tutto come oggi (`modoIniziale` non passato). Il foglio va ricreato quando cambia `aggiuntaIniziale` (`key`), così il tipo iniziale vale anche se il foglio era già stato aperto.

- [ ] **Step 1: Test che falliscono:** l'evento con `tipo: 'income'` apre il foglio con il riepilogo su "Entrata"; `?aggiungi=entrata` al caricamento fa lo stesso e chiama `router.replace('/')`; un evento senza tipo apre su "Spesa"; dopo un'entrata, chiudere e riaprire con un evento senza tipo torna su "Spesa".
- [ ] **Step 2:** `npx vitest run tests/HomeDashboard.test.tsx` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npx vitest run tests/HomeDashboard.test.tsx tests/AddTransactionSheet.test.tsx` → PASS.
- [ ] **Step 5: Commit** `feat(menu): "Entrata" apre il foglio già su Entrata`.

### Task 8: Gli ingressi da indirizzo (cassetto, lista d'attesa, quota della casa)

Modello: haiku.

**Files:**
- Modify: `src/app/goals/page.tsx`, `src/app/goals/ObiettiviVista.tsx`, `src/app/goals/GoalsList.tsx`, `src/app/goals/HoMessoDaParte.tsx`, `src/app/impara/attesa/ListaAttesa.tsx`, `src/app/casa/CasaHome.tsx`, `src/app/casa/VistaSemplice.tsx`
- Create: `src/app/casa/ApriDaIndirizzo.tsx`
- Test: `tests/GoalsPage.test.tsx`, `tests/HoMessoDaParte.test.tsx`, `tests/ListaAttesa.test.tsx`, `tests/CasaHome.test.tsx`, `tests/VistaSemplice.test.tsx`

**Interfaces:**
- Produces:
  - `HoMessoDaParte` prop nuova `apertoIniziale?: boolean` (apre la conferma al montaggio, con lo stesso importo iniziale di `apri()`).
  - `GoalsList` e `ObiettiviVista` prop nuova `versaId?: string | null`: il cassetto con quell'id riceve `apertoIniziale`.
  - `goals/page.tsx`: legge `?versa=<id>` (valido solo se rispetta `/^[0-9a-fA-F-]{8,64}$/`); dopo il caricamento scorre a `#goal-<id>` e passa `versaId`. Un id che non è fra i cassetti a rate aperti non fa niente.
  - `ListaAttesa`: con `?nuovo=1` mette il focus sul campo `#attesa-nome` al montaggio.
  - `ApriDaIndirizzo(): null`: dentro `CasaAzioni`; al montaggio, se l'indirizzo ha `azione=versamento`, chiama `useCasaAzioni().apri({ tipo: 'versamento' })` e `router.replace('/casa')`. Montato in `CasaHome` e `VistaSemplice` come figlio di `CasaAzioni`.

- [ ] **Step 1: Test che falliscono:** `HoMessoDaParte apertoIniziale` mostra subito i campi "Importo" e "Data"; `/goals?versa=g1` apre la conferma solo sul cassetto g1; `?versa=non-valido!` e un id sconosciuto non aprono niente; `ListaAttesa` con `?nuovo=1` ha il focus su "Cosa"; `/casa?azione=versamento` apre il foglio del versamento sia in `CasaHome` sia in `VistaSemplice`, e chiama `router.replace('/casa')`.
- [ ] **Step 2:** `npx vitest run tests/GoalsPage.test.tsx tests/HoMessoDaParte.test.tsx tests/ListaAttesa.test.tsx tests/CasaHome.test.tsx tests/VistaSemplice.test.tsx` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5: Commit** `feat(menu): ingressi per versare nel cassetto, lista d'attesa e quota della casa`.

### Task 9: I fumetti della prima volta nelle schermate, "Rivedi il giro"

Modello: haiku.

**Files:**
- Modify: `src/app/history/StoricoVista.tsx` (o dove è montato `PeriodoFilter`), `src/app/casa/CasaHome.tsx`, `src/app/casa/VistaSemplice.tsx`, `src/app/goals/ObiettiviVista.tsx`, `src/app/accounts/ContiVista.tsx`, `src/app/impara/attesa/ListaAttesa.tsx`, `src/app/impara/ElencoImpara.tsx`, `src/app/piva/PivaHub.tsx`, `src/app/altro/page.tsx`, `src/app/altro/RicominciaDaZero.tsx`
- Create: `src/app/altro/RivediGiro.tsx`
- Test: i test esistenti di quelle viste, più `tests/RivediGiro.test.tsx`, `tests/RicominciaDaZero.test.tsx`

**Interfaces:**
- Consumes: `FumettoPrimaVolta` (Task 3), `azzeraFumetti` (Task 1), `useUtenteId` (Task 2).

Ancore e testi esatti:

| Vista | `data-fumetto` su | id | Testo |
|---|---|---|---|
| Storico | il contenitore di `PeriodoFilter` | `storico` | "Scegli il periodo. Sotto vedi quanto è andato in ogni categoria." |
| CasaHome | la card "Da fare" | `casa` | "Qui c'è una cosa da fare alla volta. Quando è fatta, compare la prossima." |
| VistaSemplice | la cifra della quota | `casa-semplice` | "Questa è la tua quota del mese: quanto versare nel conto di casa." |
| Cassetti | il primo cassetto della lista, o il bottone "Nuovo cassetto" se la lista è vuota | `cassetti` | "Un cassetto tiene da parte i soldi per una cosa che arriva. L'app li toglie dal disponibile un po' alla volta." |
| Conti | il primo conto | `conti` | "Qui scrivi il saldo dei tuoi conti come lo vedi in banca. L'app non si collega alla banca." |
| Lista d'attesa | il campo "Cosa" | `attesa` | "Scrivi qui una cosa che vuoi comprare. Fra qualche giorno l'app ti chiede se la vuoi ancora." |
| Impara | la prima lezione dell'elenco | `impara` | "Lezioni da un minuto, con i tuoi numeri. Non c'è un ordine da seguire." |
| P.IVA | la cifra del vaso delle tasse | `piva` | "Qui vedi quanto c'è da parte per le tasse e le prossime scadenze." |

L'attributo `data-fumetto` vale l'id della riga. Se l'elemento da indicare non c'è (per esempio la Casa senza card "Da fare", o la P.IVA non configurata), non si mette l'ancora: il fumetto aspetta.

`RivediGiro`: sezione come `RiattivaAvvisi` (filetto sopra, titolo serif "Il giro dell'app", frase "Rivedi i fumetti che spiegano dove sono le cose.", azione di testo "Rivedi il giro" alta 44px). Al tocco: `azzeraFumetti(utente)` e `router.push('/')`. Montata in Altro fra `RiattivaAvvisi` e `RicominciaDaZero`. `RicominciaDaZero`: dopo il successo chiama `azzeraFumetti(utente)` prima di `router.replace('/impara/primi-passi')`.

- [ ] **Step 1: Test che falliscono:** per ogni vista, renderla e verificare che esista `[data-fumetto="<id>"]` sull'elemento indicato (e che manchi quando l'elemento manca, per Cassetti con lista vuota invece c'è sul bottone); `RivediGiro` chiama `azzeraFumetti('u1')` e `push('/')`; `RicominciaDaZero` dopo il successo chiama `azzeraFumetti('u1')`. Ogni vista passa ancora `assertNessunaParolaVietata` dove già lo fa.
- [ ] **Step 2:** `npx vitest run` sui test toccati → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** stessi test → PASS.
- [ ] **Step 5: Commit** `feat(fumetti): un fumetto la prima volta in ogni schermata e "Rivedi il giro"`.

### Task 10: "Cassetti" al posto di "Obiettivi" nei testi delle pagine (`src/app`)

Modello: sonnet (accordi in italiano).

**Files:**
- Modify (testi visibili con "obiettiv", da `grep`): `src/app/goals/page.tsx`, `src/app/goals/GoalsList.tsx`, `src/app/goals/ObiettiviVista.tsx`, `src/app/goals/HoMessoDaParte.tsx`, `src/app/goals/CreateGoalForm.tsx`, `src/app/add/AddTransactionForm.tsx`, `src/app/add/AddTransactionSheet.tsx`, `src/app/add/AvvisoFondiFoglio.tsx`, `src/app/impara/dopoSalvataggio.ts` (solo testi mostrati), `src/app/impara/primi-passi/[passo]/page.tsx`, `src/app/impara/primi-passi/PassoImprevisti.tsx`, `src/app/home/DettaglioDisponibile.tsx`, `src/app/casa/quota/PassoCuscinetto.tsx`, `src/app/casa/controllo/CheckinMensile.tsx`, `src/app/accounts/AccountRow.tsx`, `src/app/altro/page.tsx` (voce "Cassetti"), `src/app/anteprima/*`
- Test: i test che cercano quei testi

Regole di sostituzione (solo stringhe e JSX visibili; commenti, identificatori, URL, messaggi `throw new Error` interni restano):
- obiettivo → cassetto, obiettivi → cassetti, con maiuscola dove c'era.
- l'obiettivo → il cassetto; un obiettivo → un cassetto; dell'/all'/nell'/sull'/dall'obiettivo → del/al/nel/sul/dal cassetto; gli/degli/agli/negli/sugli/dagli obiettivi → i/dei/ai/nei/sui/dai cassetti; quest'obiettivo → questo cassetto.
- Rileggere ogni frase dopo la sostituzione: deve suonare naturale (per esempio "raggiungere l'obiettivo" → "riempire il cassetto").
- `Target` in Altro diventa l'icona lucide `Archive` o `PiggyBank` per "Cassetti" (scelta del costruttore, coerente con il menu).

- [ ] **Step 1:** Aggiorna i test che controllano i testi rinominati (prima i test, che falliscono).
- [ ] **Step 2:** `npx vitest run` sui test toccati → FAIL.
- [ ] **Step 3:** Rinomina i testi.
- [ ] **Step 4:** `grep -rn -i "obiettiv" src/app --include=*.tsx --include=*.ts` mostra solo commenti, identificatori, import, URL e `throw new Error`; `npx vitest run` sui test toccati → PASS.
- [ ] **Step 5: Commit** `feat(testi): "Obiettivi" diventa "Cassetti" nelle pagine`.

### Task 11: "Cassetti" nei testi costruiti in `src/lib`

Modello: sonnet.

**Files:**
- Modify (testi visibili): `src/lib/calculations/percorso/avviso.ts`, `src/lib/calculations/casa/disponibileCasa.ts`, `src/lib/percorso/lezioni.ts`, `src/lib/percorso/tipi.ts`, `src/lib/percorso/passiTesti.ts`, `src/lib/loadHomeData.ts`, `src/lib/data/percorso.ts`, `src/lib/data/checkins.ts`, `src/lib/calculations/supporto/home.ts`, `src/lib/calculations/supporto/consiglio.ts`, `src/lib/calculations/casa/calendario.ts`, `src/lib/calculations/accantonato.ts`, `src/lib/data/householdPlans.ts`, `src/lib/calculations/percorso/passi.ts`, `src/lib/calculations/percorso/numeri.ts`, `src/lib/calculations/disponibile.ts`, e i testi delle notifiche se contengono "obiettiv"
- Test: i test in `tests/calculations/**`, `tests/percorso/**` e gli altri che cercano quei testi

Stesse regole del Task 10. Se un messaggio d'errore scritto dal database (per esempio "obiettivo non valido") può arrivare sullo schermo così com'è, il punto che lo mostra lo sostituisce con un testo suo (per esempio "Non sono riuscito a salvare. Riprova."), senza toccare il database.

- [ ] **Step 1:** Aggiorna i test (falliscono).
- [ ] **Step 2:** `npx vitest run tests/calculations tests/percorso` → FAIL.
- [ ] **Step 3:** Rinomina.
- [ ] **Step 4:** `grep -rn -i "obiettiv" src/lib` mostra solo commenti, identificatori, nomi di colonne o chiavi JSON e `throw new Error` interni; `npx vitest run` → PASS (tutta la suite).
- [ ] **Step 5: Commit** `feat(testi): "Cassetti" nei consigli, nelle lezioni e nei promemoria`.

### Task 12: Documentazione, controllo e revisione

Modello: haiku per docs e comandi; opus per la revisione finale di tutto il ramo.

**Files:**
- Modify: `DESIGN.md` (sezioni "Navigation", "Bottom sheet": il menu "Cosa vuoi fare?"; nuova sezione "Fumetti": giro con velo e anello, fumetto della prima volta, regole; "Goals and accounts" → "Cassetti"), `PRODUCT.md` (Operating Context: il + apre il menu; "Obiettivi" → "Cassetti" dove si parla del prodotto), `docs/ROADMAP.md` (checklist del test: menu, giro, fumetti, Rivedi il giro)

- [ ] **Step 1:** Aggiorna i tre documenti.
- [ ] **Step 2:** `npm run lint` → nessun errore; `npx vitest run` → tutti PASS; `npm run build` → build riuscita.
- [ ] **Step 3:** Detector: `"<skill-impeccable>/scripts/impeccable" detect --json --changed` → nessuna violazione nuova (correggere quelle che compaiono).
- [ ] **Step 4:** Prova nel browser a 375px (dev server da `.claude/launch.json`): + → menu; spesa in 3 tocchi; giro di 5 passi; fumetto in Storico; "Rivedi il giro". Screenshot.
- [ ] **Step 5: Commit** `docs: menu del +, fumetti e cassetti` (senza `.impeccable/hook.cache.json`), poi `git push`.
- [ ] **Step 6:** Revisione finale del ramo con un revisore opus su spec + piano + diff.
