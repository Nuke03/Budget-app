# Rimetti a rate e Sposta tra i tuoi conti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rientri (rate fatte a se stessi) verso un conto risparmio, un cassetto personale o un cassetto di Casa, e "Sposta tra i tuoi conti" come movimento vero.

**Architecture:** Due tabelle nuove (migrazione 0013): `rientri` e `spostamenti`, con RLS e due funzioni SQL atomiche (`sposta_soldi`, `annulla_spostamento`). Un modulo di calcolo puro (`src/lib/calculations/rientri.ts`) dà il maturato e il "da spostare"; il riservato dei cassetti e il disponibile lo usano in un solo punto condiviso. L'interfaccia aggiunge due voci al menu del +, due fogli, le righe sulle card, la domanda dopo la spesa e il promemoria "Sposta" nella Home.

**Tech Stack:** Next.js 16.3.3, React 19, TypeScript, Supabase Postgres (RLS, plpgsql), date-fns, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-20-autorata-sposta-design.md` (parte da `docs/superpowers/specs/2026-11-20-orientarsi-design.md`).

**Prerequisito:** il piano `docs/superpowers/plans/2026-11-20-orientarsi.md` è già eseguito (esistono `src/app/menu/MenuAzioni.tsx`, `src/app/menu/actions.ts` con `leggiVociMenu`, e i testi dicono "cassetto").

## Global Constraints

- Prima di scrivere codice Next leggere `AGENTS.md` e la guida pertinente in `node_modules/next/dist/docs/`.
- Le migrazioni 0001–0012 non si toccano. La 0013 è racchiusa fra `begin;` e `commit;`, si lancia a mano nel SQL editor; nessun test la esegue su Postgres in CI.
- Importi: fra 0 escluso e 1 miliardo escluso, arrotondati ai centesimi (`arrotonda2`). Mesi di un rientro: solo `2, 3, 4, 6, 12`. Date `yyyy-MM-dd`, giorno e mese di Roma (`oggiRomaISO`, `meseRomaISO`).
- Conti ammessi come destinazione di un rientro: personali, non archiviati, `contaInDisponibile === false`, diversi dal conto tasse della P.IVA guidata.
- Lo spazio personale resta invisibile agli altri membri: rientri e spostamenti personali mai in Casa.
- Testi: senza "devi/dovresti", senza colpa; mai le parole "autorata", "debito", "rimborso", né "sei indietro"; ogni testo nuovo passa `assertNessunaParolaVietata`. Cifre con `formatEuro`/`euroInFrase`, date nelle frasi per esteso (`formatDataLunga`, mesi con `nomeMese`).
- Mondo "Il Libretto": fogli `FoglioInferiore`, scelte brevi con `SceltePill`, cifre serif tabulari (`.num`), nessun colore nuovo.
- Nessuna dipendenza nuova. Mai committare `.impeccable/hook.cache.json`. Si lavora su `master`. Commit con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Modello dei subagenti: indicato in ogni task (sonnet per soldi e dati, haiku per il resto, opus solo revisione finale).

## Review Focus

1. Lo stesso euro contato due volte nel disponibile: dopo uno "Sposta" verso il conto del rientro, il saldo di partenza cala di X e il "da spostare" cala di X, il disponibile scende una volta sola. (Task 1, Task 6)
2. Un rientro creato l'ultimo giorno del mese, e un rientro a cavallo di un cambio d'anno (novembre → gennaio): il conteggio dei mesi di Roma è giusto e l'ultima rata chiude esattamente sull'importo. (Task 1)
3. Doppio tocco su "Sposta" o su "Rimetti a rate": niente due righe. (Task 7, Task 8)
4. Rientro verso un cassetto chiuso o eliminato: il calcolo lo ignora, la Home non si rompe. (Task 1, Task 6)
5. Lettura dei rientri o degli spostamenti che fallisce: la Home si apre con i numeri di prima (senza rientri), come già fa per i versamenti. (Task 6)

---

### Task 1: Calcolo puro dei rientri

Modello: sonnet.

**Files:**
- Create: `src/lib/calculations/rientri.ts`
- Test: `tests/calculations/rientri.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type MesiRientro = 2 | 3 | 4 | 6 | 12;
  export const MESI_RIENTRO: MesiRientro[] = [2, 3, 4, 6, 12];
  export type StatoRientro = 'aperto' | 'fermato' | 'chiuso'; // chiuso = "Lascia stare"
  export interface Rientro {
    id: string; userId: string; householdId: string | null;
    goalId: string | null; accountId: string | null; // esattamente uno dei due
    importo: number; mesi: MesiRientro;
    creatoIl: string; // 'yyyy-MM-dd' Roma
    stato: StatoRientro; fermatoIl: string | null; // 'yyyy-MM-dd'
  }
  export interface Spostamento { id: string; daAccountId: string | null; aAccountId: string | null; importo: number; data: string; createdAt: string } // null: conto eliminato dopo
  export function rataRientro(r: Pick<Rientro, 'importo' | 'mesi'>): number
  export function maturatoRientro(r: Rientro, oggi: string): number
  export function ultimoMeseRientro(r: Pick<Rientro, 'creatoIl' | 'mesi'>): string // 'yyyy-MM'
  export function maturatoPerCassetto(rientri: Rientro[], goalId: string, oggi: string): number
  export interface SituazioneRientroConto { rientro: Rientro; maturato: number; spostato: number; daSpostare: number; finito: boolean }
  export function situazioneRientriConti(rientri: Rientro[], spostamenti: Spostamento[], contiChePesano: Set<string>, oggi: string): SituazioneRientroConto[]
  export function totaleDaSpostare(s: SituazioneRientroConto[]): number
  ```

Regole (dalla spec):
- `rataRientro = arrotonda2(importo / mesi)`.
- Mese k = mesi di calendario fra il mese di `creatoIl` e il mese di riferimento, più 1. Riferimento: `oggi`, oppure `fermatoIl` se lo stato non è `aperto`. `maturatoRientro = k <= 0 ? 0 : k >= mesi ? importo : min(importo, arrotonda2(rata * k))`.
- `maturatoPerCassetto`: somma di `maturatoRientro` dei rientri con quel `goalId`, stato `aperto` o `fermato` (non `chiuso`).
- `situazioneRientriConti`: solo rientri con `accountId`. Spostamenti validi per un conto C: `aAccountId === C`, `daAccountId !== null && contiChePesano.has(daAccountId)`. Ordine: spostamenti per `data` poi `createdAt`; ciascuno va al rientro più vecchio (per `creatoIl`, poi `id`) non `chiuso`, verso C, con `creatoIl <= data` e capacità residua `importo − spostato > 0`; il resto, se avanza, al successivo; quello che avanza ancora non va a nessuno. `daSpostare = stato === 'chiuso' ? 0 : max(0, arrotonda2(maturato − spostato))`. `finito = spostato >= importo`.

- [ ] **Step 1: Test che falliscono** (valori esatti):
  - `rataRientro({ importo: 300, mesi: 3 })` → 100; `rataRientro({ importo: 100, mesi: 3 })` → 33.33.
  - Rientro 100 € in 3 mesi creato `2026-11-30`: maturato a `2026-11-30` = 33.33; a `2026-12-01` = 66.66; a `2027-01-15` = 100; a `2027-05-01` = 100.
  - Rientro 300/3 creato `2026-11-20`, `fermato` con `fermatoIl: '2026-12-10'`: maturato a `2027-03-01` = 200.
  - `maturatoPerCassetto` ignora i `chiuso` e i rientri verso altri cassetti o verso conti.
  - Conto: rientro 300/3 creato `2026-11-20` verso `risp`; spostamento 100 da `corr` (che pesa) il `2026-11-25` → a `2026-11-28`: maturato 100, spostato 100, daSpostare 0; a `2026-12-05`: daSpostare 100.
  - Spostamento da un conto che non pesa, o verso un altro conto, o con data prima di `creatoIl`: non conta.
  - Due rientri sullo stesso conto (A creato prima, 100; B dopo, 200): spostamento 150 → A spostato 100 (finito), B spostato 50.
  - Spostato oltre il dovuto: 250 su un rientro 300/3 al primo mese → daSpostare 0; al terzo mese → 50.
  - `chiuso` → daSpostare 0 e non riceve spostamenti.
- [ ] **Step 2:** `npx vitest run tests/calculations/rientri.test.ts` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5: Commit** `feat(rientri): calcolo del maturato e del da spostare`.

### Task 2: Il riservato dei cassetti con i rientri

Modello: sonnet.

**Files:**
- Modify: `src/lib/calculations/types.ts` (`GoalForCalc.rientroMaturato?: number`), `src/lib/calculations/accantonato.ts`, `src/lib/calculations/casa/disponibileCasa.ts`, `src/lib/calculations/casa/fondi.ts`, `src/lib/calculations/casa/spiegazioni.ts`
- Test: `tests/calculations/accantonato*.test.ts` (quelli esistenti più casi nuovi), `tests/calculations/casa/*`

**Interfaces:**
- Consumes: niente da Task 1 (il valore arriva già sommato nel campo `rientroMaturato`).
- Produces:
  - `computeAccantonatoConVersamenti(goal, today, specoCollegato, versatoNellaFinestra, rientroMaturato = 0): number` con la regola nuova:
    - senza conferme (`versatoNellaFinestra === null`) o non dilazionato: `max(0, min(teorico, teorico − speso + rientroMaturato))`;
    - con conferme: `max(0, min(teorico, versato − speso))` (il rientro non entra).
  - `accantonatoObiettivo(goal, today)` passa `goal.rientroMaturato ?? 0`.
  - I calcoli della Casa (`disponibileCasa.ts` riga del riservato, `obiettiviCasaConSpiegazione`, `spiegaDaParte`) passano per `accantonatoObiettivo` (o per una funzione che applica la stessa regola) invece di `computeAccantonatoFinora`, così i rientri di casa contano.
  - `spiegaDaParte` aggiunge una riga "Rientro" con `+formatEuro(rientroMaturato)` quando è > 0.

- [ ] **Step 1: Test che falliscono:**
  - Bloccato 1000, speso 300, rientro 0 → 700; rientro 100 → 800; rientro 500 → 1000 (tetto).
  - Dilazionato a tempo, teorico 300, speso 300, rientro 100 → 100.
  - Con conferme: teorico 150, versato 200, speso 50 → 150 (prima era 100: aggiornare il test esistente che fissa il vecchio valore, se c'è); teorico 150, versato 100, speso 0 → 100 (uguale a prima); versato 100, speso 150 → 0.
  - Con conferme il rientro non cambia il numero.
  - Casa: un cassetto di casa con `rientroMaturato: 100` aumenta il riservato della casa di 100 (fino al tetto) e la spiegazione mostra la riga "Rientro".
- [ ] **Step 2:** `npx vitest run tests/calculations` → FAIL sui casi nuovi.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npx vitest run` (tutta la suite: questo calcolo è ovunque) → PASS.
- [ ] **Step 5: Commit** `feat(rientri): il cassetto risale con i rientri, il versato conta i soldi veri`.

### Task 3: Il disponibile con il "da spostare"

Modello: sonnet.

**Files:**
- Modify: `src/lib/calculations/disponibile.ts`, `src/app/home/DettaglioDisponibile.tsx` (o dove sono le righe di "Come si calcola?" del disponibile)
- Test: `tests/calculations/disponibile*.test.ts`, `tests/DettaglioDisponibileVersamenti.test.tsx`

**Interfaces:**
- Produces: `computeDisponibileLibero(accounts, goals, today, riservaVersamento = 0, riservaDebiti = 0, riservaPiva = 0, riservaRientri = 0): number` che sottrae anche `riservaRientri`. "Come si calcola?" mostra la riga "Da spostare sui conti risparmio" con la cifra quando è > 0.

- [ ] **Step 1: Test che falliscono:** con `riservaRientri = 100` il disponibile scende di 100; con 0 è identico a prima; la riga compare solo se > 0.
- [ ] **Step 2:** `npx vitest run tests/calculations tests/DettaglioDisponibileVersamenti.test.tsx` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5: Commit** `feat(rientri): il disponibile toglie quello da spostare`.

### Task 4: Migrazione 0013

Modello: sonnet.

**Files:**
- Create: `supabase/migrations/0013_rientri_spostamenti.sql`, `supabase/tests/rientri_spostamenti.sql`
- Test: `tests/migration0013.test.ts` (statico, come `tests/migration0012.test.ts`)

Contenuto (nomi decisi qui):
- `public.rientri`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users`, `household_id uuid null references households`, `goal_id uuid null references budget_goals on delete cascade`, `account_id uuid null references accounts on delete cascade`, `importo numeric(12,2) not null check (importo > 0 and importo < 1000000000)`, `mesi int not null check (mesi in (2,3,4,6,12))`, `creato_il date not null`, `stato text not null default 'aperto' check (stato in ('aperto','fermato','chiuso'))`, `fermato_il date null`, `created_at timestamptz default now()`; `check ((goal_id is null) <> (account_id is null))`; `check (household_id is null or account_id is null)`; `check ((stato = 'aperto') = (fermato_il is null))`.
- `public.spostamenti`: `id`, `user_id` (default `auth.uid()`), `da_account_id uuid null references accounts on delete set null`, `a_account_id uuid null references accounts on delete set null` (come `piva_accantonamenti`: eliminare un conto non è bloccato dagli spostamenti), `importo numeric(12,2)` con lo stesso check, `data date not null`, `created_at`; `check (da_account_id <> a_account_id)`.
- RLS su `rientri`:
  - personali (`household_id is null`): `using/with check (user_id = auth.uid())`; nel `with check` il cassetto deve essere personale di chi scrive, oppure il conto deve essere di chi scrive, personale, non archiviato, `conta_in_disponibile = false`;
  - di casa: `using/with check (is_household_member(household_id))`; nel `with check` il cassetto deve appartenere a quella casa.
- RLS su `spostamenti`: `user_id = auth.uid()` in `using` e `with check`.
- Indici: `rientri(user_id)`, `rientri(household_id)`, `spostamenti(user_id, data)`.
- `public.sposta_soldi(p_da uuid, p_a uuid, p_importo numeric, p_data date) returns uuid`, `security invoker`, come `accantona_tasse`: valida importo e data (`p_data <= _casa_oggi()`), blocca i due conti in ordine di id `for update`, richiede due conti personali (`household_id is null`) visibili a chi scrive, aggiorna i due saldi, inserisce la riga, ritorna l'id.
- `public.annulla_spostamento(p_id uuid) returns int`: come `annulla_accantonamento` (cancella e rimette i saldi dei conti che ci sono ancora; 0 se non c'era).
- `revoke`/`grant execute` delle due funzioni nuove: solo `authenticated`.
- `ricomincia_da_zero()`: `create or replace` con il corpo della 0011 più la cancellazione di `rientri` personali e `spostamenti` di chi lo chiama, prima dei conti (per le chiavi esterne).
- Le tre difese della ROADMAP:
  - `piva_quote_scartate_proprie`: `with check` che aggiunge `exists (select 1 from transactions t where t.id = transaction_id and t.user_id = auth.uid())`;
  - `revoke execute on function public.adjust_account_balance(uuid, numeric) from authenticated` (nessuna funzione SQL e nessun codice dell'app la chiama: verificato con `grep`);
  - `goal_versamenti`: aggiungere un indice `goal_versamenti(goal_id, data)` per le letture per data (la lettura in `goalVersamenti.ts` si cambia nel Task 6).

- [ ] **Step 1: Test statico che fallisce** (`tests/migration0013.test.ts`): `begin;`/`commit;`; le due tabelle con tutti i `check` sopra (stringhe esatte dei mesi e dell'esclusività goal/conto); RLS abilitata su tutte e due; `sposta_soldi` e `annulla_spostamento` sono `security invoker` con `for update` in ordine di id; `ricomincia_da_zero` cancella `rientri` e `spostamenti` prima di `accounts`; le tre difese presenti; nessuna `drop table`.
- [ ] **Step 2:** `npx vitest run tests/migration0013.test.ts` → FAIL.
- [ ] **Step 3:** Scrivi la migrazione e il test SQL `supabase/tests/rientri_spostamenti.sql` (stesso stile di `supabase/tests/movimenti_atomici.sql`: due utenti, uno sposta, saldi giusti; uno non vede le righe dell'altro; un rientro verso un conto che conta nel disponibile è rifiutato; annulla rimette i saldi; ricomincia da zero cancella).
- [ ] **Step 4:** `npx vitest run tests/migration0013.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(db): migrazione 0013, rientri e spostamenti`.

### Task 5: Lettura e scrittura di rientri e spostamenti

Modello: sonnet.

**Files:**
- Create: `src/lib/data/rientri.ts`, `src/lib/data/spostamenti.ts`
- Test: `tests/data/rientri.test.ts`, `tests/data/spostamenti.test.ts`

**Interfaces:**
- Consumes: tipi del Task 1; tabelle e funzioni del Task 4; `Scope`/`PERSONALE`/`casa()` di `src/lib/data/scope.ts`.
- Produces:
  - `getRientri(supabase, scope?: Scope): Promise<Rientro[]>` (personali per default; con `casa(id)` quelli della casa)
  - `creaRientro(supabase, input: { goalId: string | null; accountId: string | null; importo: number; mesi: MesiRientro; creatoIl: string }, scope?: Scope): Promise<string>`: valida importo, mesi ed esclusività prima di scrivere.
  - `fermaRientro(supabase, id: string, oggi: string): Promise<void>` (stato `fermato`, `fermato_il = oggi`)
  - `chiudiRientro(supabase, id: string, oggi: string): Promise<void>` (stato `chiuso`, `fermato_il = oggi`)
  - `eliminaRientro(supabase, id: string): Promise<void>`
  - `getSpostamenti(supabase, da?: string): Promise<Spostamento[]>`
  - `sposta(supabase, input: { daAccountId: string; aAccountId: string; importo: number; data: string }): Promise<string>`: valida (importo, data non nel futuro, da ≠ a) e chiama `sposta_soldi`.
  - `annullaSpostamento(supabase, id: string): Promise<number>`

- [ ] **Step 1: Test che falliscono** (client finto come negli altri test di `tests/data`): mappatura delle colonne; `creaRientro` rifiuta mesi 5, importo 0, entrambi o nessuno fra goal e conto; `sposta` rifiuta da = a e data futura e manda i parametri giusti all'rpc; gli errori del database si rilanciano.
- [ ] **Step 2:** `npx vitest run tests/data/rientri.test.ts tests/data/spostamenti.test.ts` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5: Commit** `feat(rientri): lettura e scrittura di rientri e spostamenti`.

### Task 6: I rientri nei numeri di Home, Casa, Cassetti, percorso

Modello: sonnet.

**Files:**
- Modify: `src/lib/loadHomeData.ts`, `src/lib/loadPercorsoData.ts`, `src/lib/loadCasaData.ts`, `src/app/goals/page.tsx`, `src/app/accounts/page.tsx` (o `ContiVista`), `src/lib/data/goalVersamenti.ts`, `src/lib/calculations/supporto/home.ts`
- Test: `tests/loadHomeData.test.ts`, `tests/loadHomeDataVersamenti.test.ts`, `tests/loadPercorsoData.test.ts`, `tests/loadCasaData.test.ts`, `tests/GoalsPage.test.tsx`, test di `prossimaCosa`

**Interfaces:**
- Consumes: Task 1, 2, 3, 5.
- Produces:
  - `loadHomeData`: legge `getRientri` e `getSpostamenti(inizio)` (dove `inizio` = il `creatoIl` più vecchio fra i rientri verso conti, o niente se non ce ne sono) in parallelo alle altre letture, ciascuno con `.catch(() => [])`. Ogni goal riceve `rientroMaturato = maturatoPerCassetto(...)`. `riservaRientri = totaleDaSpostare(situazioneRientriConti(rientri, spostamenti, contiChePesano, oggi))` dove `contiChePesano` sono i conti con `contaInDisponibile` dopo l'esclusione del conto tasse. Il risultato espone `rientriConti: SituazioneRientroConto[]` per la Home.
  - `prossimaCosa`: input nuovo `sposta?: { testo: string; href: string }`, tipo nuovo `'sposta'`; viene subito prima di `versamento`. Testo: `` `Sposta ${euroInFrase(daSpostare)} sul ${nomeConto}.` `` per il rientro più vecchio con `daSpostare > 0`; href `/?sposta=<rientroId>`.
  - Lo stesso calcolo in `loadPercorsoData` (il percorso usa disponibile e riservati) e nell'avviso sui fondi (il "disponibile dopo" include `riservaRientri`).
  - `loadCasaData`: legge `getRientri(supabase, casa(householdId))`, `.catch(() => [])`; i cassetti di casa ricevono `rientroMaturato`.
  - Pagina Cassetti e Conti: ricevono rientri e situazione per mostrare le righe (Task 8).
  - `getConfermePerObiettivi`: due letture invece di una: quali obiettivi hanno almeno una conferma (solo `goal_id`, una riga per obiettivo, `limit` per obiettivo o `distinct`), e le righe con `data >= ` il primo inizio finestra. Il risultato non cambia (stessi test di prima verdi).

- [ ] **Step 1: Test che falliscono:** Home con un rientro verso il conto risparmio (300/3, primo mese, niente spostato) → disponibile 100 più basso e `prossimo` = "Sposta 100 € sul Risparmio."; con uno spostamento da 100 dal conto corrente → disponibile come senza rientro (il saldo corrente è già sceso di 100 nei dati di prova) e nessun "Sposta"; con un rientro verso un cassetto bloccato speso → riservato del cassetto più alto; lettura dei rientri che lancia → numeri identici a senza rientri; Casa con un rientro su un cassetto di casa → riservato di casa più alto; `getConfermePerObiettivi` restituisce gli stessi valori dei test esistenti.
- [ ] **Step 2:** `npx vitest run tests/loadHomeData.test.ts tests/loadHomeDataVersamenti.test.ts tests/loadPercorsoData.test.ts tests/loadCasaData.test.ts` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npx vitest run` → tutto PASS.
- [ ] **Step 5: Commit** `feat(rientri): i rientri nei numeri di Home, Casa e percorso`.

### Task 7: "Sposta tra i tuoi conti" e lo Storico

Modello: sonnet.

**Files:**
- Create: `src/app/sposta/SpostaFoglio.tsx`
- Modify: `src/app/menu/MenuAzioni.tsx`, `src/app/menu/actions.ts` (`VociMenu.contiPersonali: number`), `src/app/HomeDashboard.tsx` (apre il foglio da `?sposta=<rientroId>` già compilato e dalla voce del menu con `?sposta=1`), `src/app/history/page.tsx`, `src/app/history/StoricoVista.tsx`, `src/lib/calculations/supporto/home.ts` (gli spostamenti non entrano in andamento e categorie: verificare)
- Test: `tests/SpostaFoglio.test.tsx`, `tests/MenuAzioni.test.tsx`, `tests/HistoryPageSaldi.test.tsx`

**Interfaces:**
- Consumes: `sposta`, `annullaSpostamento`, `getSpostamenti` (Task 5); `contoDaCuiSpostare` (`src/app/piva/PromptQuota.tsx`).
- Produces: `SpostaFoglio(props: { conti: Account[]; iniziale?: { daAccountId?: string; aAccountId?: string; importo?: number }; onFatto: () => void; onClose: () => void })`.

Foglio "Sposta tra i tuoi conti": "Da" e "A" come pillole dei conti personali non archiviati ("A" non mostra il conto scelto in "Da"), importo in serif grande, data (oggi, non futura), bottone "Sposta". Un solo invio alla volta (blocco del doppio tocco come `useMettiDaParte`). Errore: "Non sono riuscito a spostarli. Riprova tra poco." Dalla Home con `?sposta=<rientroId>`: da = `contoDaCuiSpostare(null, conti, contoTasseId)`, a = conto del rientro, importo = `daSpostare`.

Menu: voce "Sposta tra i tuoi conti", riga "Da un conto all'altro, i saldi si aggiornano", solo se `contiPersonali >= 2`; apre `/?sposta=1` (o il foglio nella Home se ci si è già).

Storico: ogni spostamento è una riga del giorno con descrizione "Spostato da {da} a {a}", cifra senza segno in inchiostro tenue, niente pallino di categoria; non entra nel totale del giorno né in "Per categoria". Elimina (cestino) con `useEliminaConAnnulla`: testo "Spostamento eliminato.", `esegui` = `annullaSpostamento`.

- [ ] **Step 1: Test che falliscono:** il foglio invia `sposta` con i valori giusti; doppio tocco → una chiamata; "A" esclude il conto di "Da"; data futura non accettata; precompilazione da rientro; il menu mostra la voce solo con due conti; lo Storico mostra la riga e non la somma nel totale del giorno; eliminare chiama `annullaSpostamento` dopo l'annulla di 5 secondi; tutto passa `assertNessunaParolaVietata`.
- [ ] **Step 2:** `npx vitest run tests/SpostaFoglio.test.tsx tests/MenuAzioni.test.tsx tests/HistoryPageSaldi.test.tsx` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5: Commit** `feat(sposta): sposta tra i tuoi conti, con la riga nello Storico`.

### Task 8: "Rimetti a rate" e le righe sulle card

Modello: sonnet.

**Files:**
- Create: `src/app/rientri/RimettiARateFoglio.tsx`, `src/app/rientri/RigaRientro.tsx`, `src/lib/calculations/rientriTesti.ts`
- Modify: `src/app/menu/MenuAzioni.tsx`, `src/app/HomeDashboard.tsx` (apre il foglio da `?rimetti=1` o `?rimetti=<goalId>`), `src/app/goals/GoalsList.tsx`, `src/app/casa/da-parte/DaParte.tsx`, `src/app/accounts/AccountRow.tsx`
- Test: `tests/RimettiARateFoglio.test.tsx`, `tests/RigaRientro.test.tsx`, `tests/calculations/rientriTesti.test.ts`, test esistenti di `GoalsList`, `DaParte`, `AccountRow`

**Interfaces:**
- Consumes: Task 1, Task 5.
- Produces:
  - `fraseRata(importo: number, mesi: MesiRientro, creatoIl: string): string` → per esempio `"100 € al mese, da novembre a gennaio."`; con l'anno quando quello finale è diverso dal corrente: `"… da novembre 2026 a gennaio 2027."`.
  - `fraseRientro(r: Rientro): string` → `"Rientro: 100 € al mese fino a gennaio"`.
  - `RimettiARateFoglio(props: { destinazioni: { tipo: 'conto' | 'cassetto' | 'cassetto-casa'; id: string; nome: string; householdId?: string; spesoDaRientrare?: number }[]; scelta?: string; onFatto: () => void; onClose: () => void; notaCasa?: string })`.
  - `RigaRientro(props: { rientro: Rientro; situazione?: SituazioneRientroConto; onFerma: () => Promise<void>; onLasciaStare?: () => Promise<void> })`.

Foglio, un passo alla volta: "Dove li rimetti?" (pillole o righe: conti risparmio, cassetti, cassetti di casa con l'etichetta "Casa"); "Quanto?" (per un cassetto parte da `spesoDaRientrare` se > 0); "In quanti mesi?" (`SceltePill` con 2, 3, 4, 6, 12, parte da 3) con `fraseRata` sotto; bottone "Rimetti a rate"; per un cassetto di casa la nota "Lo vedrà anche …". Senza destinazioni: "Non c'è ancora un conto risparmio o un cassetto." con il link "Metti da parte" (`/goals?nuovo=1`). Creazione: `creaRientro`, poi `useEliminaConAnnulla` permette di annullare entro 5 secondi ("Rientro creato.", `ripristina` = `eliminaRientro`). Un solo invio alla volta.

Menu: voce "Rimetti a rate", riga "Riporta un po' al mese soldi presi dai risparmi", sempre presente, apre `/?rimetti=1`.

"Versa nel cassetto" su un cassetto con conferme e rientri aperti: la cifra proposta da `HoMessoDaParte` è la quota del cassetto più `rataRientro` di ogni rientro aperto verso quel cassetto il cui mese corrente è fra il primo e l'ultimo (prop `quota` già sommata da chi la passa, in `GoalsList`).

Card: sotto il riservato del cassetto (Cassetti e Da parte della Casa) e sotto il saldo del conto, una `RigaRientro` per ogni rientro aperto o fermato non finito: `fraseRientro`, per i conti anche "Da spostare: … €"; "Ferma" (azione di testo, 44px) per gli aperti; "Lascia stare" per i rientri verso conti con `daSpostare > 0`. Un cassetto con speso collegato > 0 e nessun rientro aperto mostra il link "Rimetti a rate" (`/?rimetti=<goalId>`).

- [ ] **Step 1: Test che falliscono:** `fraseRata(300, 3, '2026-11-20')` → `"100 € al mese, da novembre 2026 a gennaio 2027."`; `fraseRata(100, 2, '2027-03-01')` (anno corrente 2027 nei test con orologio finto) → `"50 € al mese, da marzo ad aprile."` (attenzione a "a/ad" davanti a vocale); il foglio crea il rientro con i valori scelti; doppio tocco → una sola creazione; senza destinazioni mostra il link; le card mostrano la riga e chiamano `fermaRientro`/`chiudiRientro`; un cassetto con conferme e un rientro 300/3 aperto propone in "Ho messo da parte" la sua quota + 100; tutto passa `assertNessunaParolaVietata` e non contiene "autorata", "debito", "rimborso".
- [ ] **Step 2:** `npx vitest run tests/RimettiARateFoglio.test.tsx tests/RigaRientro.test.tsx tests/calculations/rientriTesti.test.ts` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** stessi test più `tests/GoalsList.test.tsx tests/DaParte.test.tsx tests/AccountRow.test.tsx` → PASS.
- [ ] **Step 5: Commit** `feat(rientri): rimetti a rate, e il rientro sulle card`.

### Task 9: La domanda dopo una spesa dal conto risparmio

Modello: haiku.

**Files:**
- Create: `src/app/rientri/DomandaRientroFoglio.tsx`
- Modify: `src/app/add/AddTransactionSheet.tsx`
- Test: `tests/DomandaRientroFoglio.test.tsx`, `tests/AddTransactionSheet.test.tsx`

**Interfaces:**
- Consumes: `creaRientro` (Task 5), `fraseRata` (Task 8), `SceltePill`.
- Produces: `DomandaRientroFoglio(props: { importo: number; conto: { id: string; nome: string }; oggi: string; onChiudi: () => void })`.

Condizione: spesa personale salvata (`modo === 'personale'`, `tipo === 'expense'`) da un conto che esiste fra i conti personali, ha `contaInDisponibile === false` e non è `piva?.contoTasseId`. Testi: titolo "Vuoi rimetterli un po' al mese?", frase `` `Hai preso ${euroInFrase(importo)} dal ${conto.nome}. Puoi riportarli lì un po' alla volta.` ``, pillole mesi con `fraseRata` sotto, "Sì, rimettili" (crea il rientro verso quel conto per l'importo, `creatoIl` = oggi) e "No, va bene così". Errore: "Non sono riuscito a salvarlo. Riprova tra poco." Precedenza: quota P.IVA, poi questa domanda, poi `dopo` (avviso o lezione), uno alla volta come oggi.

- [ ] **Step 1: Test che falliscono:** spesa dal conto risparmio → compare la domanda; "Sì" chiama `creaRientro` con `{ accountId, importo, mesi: 3 }`; spesa da un conto che conta, dal conto tasse, o in Casa → niente domanda; con un incasso P.IVA la quota viene prima; dopo la domanda, l'avviso o la lezione si vedono ancora; testi senza parole vietate.
- [ ] **Step 2:** `npx vitest run tests/DomandaRientroFoglio.test.tsx tests/AddTransactionSheet.test.tsx` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5: Commit** `feat(rientri): dopo una spesa dal risparmio, la domanda sul rientro`.

### Task 10: Documentazione, controllo, revisione

Modello: haiku per docs e comandi; opus per la revisione finale.

**Files:**
- Modify: `PRODUCT.md` (Positioning: il disponibile toglie anche le rate dei rientri da spostare; Operating Context: Sposta e Rimetti a rate), `DESIGN.md` (foglio "Rimetti a rate", "Sposta", riga rientro sulle card, riga "Spostato" nello Storico), `docs/ROADMAP.md` (la 0013 da lanciare a mano; la checklist del test: concerto dal risparmio → "Sì, rimettili" → Home "Sposta" → "Fatto, li ho spostati" → saldi; rientro su un cassetto; rientro su un cassetto di casa visto da Miriam; eliminare uno spostamento nello Storico; le tre difese tolte dall'elenco "futura 0013")

- [ ] **Step 1:** Aggiorna i documenti.
- [ ] **Step 2:** `npm run lint` → nessun errore; `npx vitest run` → tutti PASS; `npm run build` → riuscita.
- [ ] **Step 3:** Detector impeccable `detect --json --changed` → nessuna violazione nuova.
- [ ] **Step 4:** Prova nel browser a 375px (con la 0013 lanciata su Supabase da Fabio prima di questo passo: chiedere conferma): il percorso del concerto dalla checklist, con screenshot dei saldi dopo ogni passo.
- [ ] **Step 5: Commit** `docs: rientri e spostamenti` (senza `.impeccable/hook.cache.json`), `git push`.
- [ ] **Step 6:** Revisione finale opus su spec, piano e diff, con attenzione ai soldi contati due volte e alla RLS.
