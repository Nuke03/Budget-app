# Percorso di apprendimento personale: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 15 lezioni a regole, Primi passi, avviso sui fondi, lista d'attesa, "Ricomincia da zero" e indice "Impara", come da spec.

**Architecture:** I testi delle lezioni sono dati statici in `src/lib/percorso/`. Le regole (quando proporre, passi fatti, avviso) sono funzioni pure in `src/lib/calculations/percorso/` con test vitest, come `supporto/consiglio.ts`. La migrazione 0011 aggiunge 4 tabelle con RLS sulle proprie righe, 3 colonne e 2 funzioni SQL atomiche: il reset e le categorie iniziali. La Home e il foglio di aggiunta leggono e mostrano. L'avviso e la lezione dopo un salvataggio arrivano da una server action, chiamata dal foglio dopo il salvataggio con lo stesso schema del `PromptQuota` della P.IVA.

**Tech Stack:** Next.js 16.3.3 (App Router, server actions), React, TypeScript, Tailwind, Supabase (Postgres, RLS, rpc), vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-19-percorso-apprendimento-design.md`. Contenuti: `docs/research/2026-11-19-percorso-apprendimento.md`.

## Global Constraints

- Prima di scrivere codice Next leggere le guide in `node_modules/next/dist/docs/` (server actions, `revalidatePath`, pagine dinamiche `[param]` con `params` asincroni). Vedi `AGENTS.md`.
- Migrazioni già applicate (0001-0010) intoccabili. La 0011 è racchiusa fra `begin;` e `commit;` e ha in fondo, commentato, il rollback, come la 0010. La lancia Fabio a mano nel SQL editor di Supabase.
- Solo piani gratuiti. Nessun servizio nuovo, niente Google.
- Testi in italiano semplice, `it-IT`. Ogni testo nuovo passa `PAROLE_VIETATE` (`tests/helpers/paroleVietate.ts`).
- Niente quiz, punti, serie, badge, percentuali di completamento, lodi. Niente "dovresti", nessun giudizio sulle spese.
- Niente consigli d'investimento, fiscali o previdenziali personalizzati. Le lezioni 14 e 15 arrivano solo a "cos'è e dove informarsi".
- I dati segnati [Non verificato] nella ricerca non entrano nei testi come fatti.
- Stile del libretto (`DESIGN.md`), bersagli di almeno 44 px, modalità scura.
- Scritture con interfaccia aggiornata subito e scrittura in background. Nessun offline.
- Lo spazio personale non è mai visibile agli altri membri. Tutte le tabelle nuove hanno RLS `auth.uid() = user_id`.
- Soglie (scelte di Claude, in un solo file di costanti `src/lib/calculations/percorso/soglie.ts`):
  - `PICCOLA_SPESA = 5` (importo < 5 €), `PICCOLE_SPESE_MESE = 30`;
  - `SPESA_IMPREVISTO = 150`, `SPESA_IMPULSO = 40`, `ENTRATA_GRANDE = 300`;
  - `DISPONIBILE_BASSO = 50`, `GIORNI_SENZA_ENTRATA = 30`;
  - `GIORNI_PIU_TARDI = 14`, `GIORNI_RIPROPOSTA = 60`, `GIORNI_ANNUALE = 365`;
  - `GIORNI_ATTESA = 7`, `TRAGUARDO_IMPREVISTI = 200`, `QUOTA_IMPREVISTI = 20`.
- Commit con il messaggio che finisce con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Mai committare `.impeccable/hook.cache.json`. Niente stash, reset o cambi di branch.
- Modelli dei subagenti: sonnet per i task 1, 2, 5, 7, 8, 10 (soldi e dati); haiku per i task 3 (solo la verifica dei testi), 9 e 11; opus solo per la revisione finale.

## Review Focus

1. **Reset con la Casa attiva:** un conto personale usato da un versamento o da una spesa anticipata resta, archiviato, con saldo 0. Crediti, debiti e saldo del conto comune non cambiano. Test SQL nel task 1, più il test del mapper `archiviato` nel task 2.
2. **Mese stretto:** con il disponibile già sotto zero, una seconda spesa non fa scattare l'avviso, e non si propone più di una lezione al giorno. Test nei task 5 e 6.
3. **Spesa su un conto fuori dal disponibile** (conto tasse, conto comune): nessun avviso. Test nel task 5.
4. **Utente con dati e senza fondo imprevisti (Miriam):** i passi già soddisfatti risultano fatti. Con tutti i passi fatti la scheda non compare e il consiglio resta. Test nel task 4.
5. **Categorie esistenti senza ruolo:** il riconoscimento per nome trova "Auto" e "Assicurazione" come spesa certa, e "Bar e ristoranti" non lo è. Test nel task 6.

---

## Struttura dei file

| File | Responsabilità |
|---|---|
| `supabase/migrations/0011_percorso.sql` | colonne, tabelle, RLS, `ricomincia_da_zero()`, `crea_categorie_iniziali()` |
| `supabase/tests/ricomincia_da_zero.sql` | prova a mano: numeri della Casa uguali prima e dopo |
| `src/lib/percorso/tipi.ts` | tipi condivisi (`ArgomentoId`, `Lezione`, `PercorsoUtente`, `StatoLezione`, `PassoId`) |
| `src/lib/percorso/lezioni.ts` | i 15 testi |
| `src/lib/percorso/speseCerte.ts` | elenco precompilato delle spese certe personali |
| `src/lib/data/percorso.ts` | letture e scritture delle tabelle nuove |
| `src/lib/calculations/percorso/soglie.ts` | costanti qui sopra |
| `src/lib/calculations/percorso/passi.ts` | stato dei Primi passi |
| `src/lib/calculations/percorso/avviso.ts` | avviso sui fondi |
| `src/lib/calculations/percorso/regole.ts` | quando proporre una lezione |
| `src/lib/calculations/percorso/numeri.ts` | "Con i tuoi numeri" |
| `src/lib/loadPercorsoData.ts` | dati per pagine lezione e server action |
| `src/app/impara/…` | indice, lezione, primi passi, lista d'attesa, server action |
| `src/app/altro/RicominciaDaZero.tsx` | pulsante e conferma del reset |

---

### Task 1: Migrazione 0011

**Files:**
- Create: `supabase/migrations/0011_percorso.sql`
- Create: `supabase/tests/ricomincia_da_zero.sql`
- Test: `tests/migration0011.test.ts` (statico, come `tests/migration0010.test.ts`)

**Interfaces:**
- Produces (SQL):
  - `accounts.archiviato boolean not null default false`;
  - `categories.ruolo text check (ruolo in ('certa','svago'))`, che può essere null;
  - `budget_goals.ruolo text check (ruolo in ('imprevisti'))`, che può essere null, con un indice unico parziale: un solo obiettivo `imprevisti` aperto e personale per utente;
  - tabella `percorso_utente` (`user_id` pk default `auth.uid()`, `entrate_tipo text check in ('fisse','irregolari','piva')`, `entrata_attesa numeric`, `entrata_attesa_il date`, `reddito_base numeric`, `settimana_dal date`, `settimana_fatta_il date`, `spese_certe_nessuna boolean not null default false`, `obiettivo_piu_avanti boolean not null default false`, `nascosti boolean not null default false`, `ultima_proposta_il date`);
  - tabella `percorso_lezioni` (`user_id`, `lezione text`, `vista_il date`, `rimandata_al date`, `azione_il date`, `proposta_il date`, pk `(user_id, lezione)`);
  - tabella `percorso_avvisi` (`transaction_id uuid pk references transactions on delete cascade`, `user_id`, `risposta text check in ('imprevisto','normale','visto')`, `creato_il timestamptz default now()`);
  - tabella `lista_attesa` (`id`, `user_id`, `nome text not null`, `importo numeric not null check (importo > 0)`, `aggiunto_il date not null`, `rivedi_il date not null`, `stato text not null default 'in_attesa' check in ('in_attesa','voluto','non_piu')`);
  - `public.crea_categorie_iniziali() returns int`, security invoker. Non fa niente se l'utente ha già almeno una categoria personale (`household_id is null`, non archiviata). Altrimenti inserisce, con `tipo 'expense'`: Spesa, Bar e ristoranti, Trasporti, Auto (`ruolo 'certa'`), Casa, Salute, Abbonamenti (`'certa'`), Svago e acquisti (`'svago'`), Regali, Altro. Con `tipo 'income'`: Entrate. Restituisce quante ne ha create;
  - `public.ricomincia_da_zero() returns void`, security invoker, una sola transazione.

- [ ] **Step 1: Write the failing test** `tests/migration0011.test.ts`
  - `'è racchiusa tra begin; e commit;'`
  - `'crea le quattro tabelle con RLS sulle proprie righe'`: per `percorso_utente`, `percorso_lezioni`, `percorso_avvisi`, `lista_attesa` cerca `create table if not exists public.<t>`, `enable row level security` e una policy con `auth.uid() = user_id`.
  - `'aggiunge archiviato, ruolo delle categorie e ruolo degli obiettivi'`
  - `'ricomincia_da_zero non cancella mai righe con household_id'`: il corpo della funzione non contiene `delete from public.transfers` senza `household_id is null`, e ogni `delete from public.(transactions|accounts|categories|budget_goals)` è accompagnato da `household_id is null`.
  - `'ricomincia_da_zero archivia i conti usati dalla casa'`: il corpo contiene `archiviato = true`, `saldo_attuale = 0` e `conta_in_disponibile = false`.
  - `'ricomincia_da_zero chiama crea_categorie_iniziali alla fine'`
  - `'il rollback è in fondo e commentato'`

- [ ] **Step 2: Run** `npx vitest run tests/migration0011.test.ts`. Expected: FAIL, file mancante.

- [ ] **Step 3: Write `0011_percorso.sql`.** Ordine del corpo di `ricomincia_da_zero()`, per `v_me := auth.uid()`:
  1. `delete` da `percorso_avvisi`, `percorso_lezioni`, `percorso_utente`, `lista_attesa` dell'utente;
  2. `delete` da `piva_scadenze`, `piva_accantonamenti`, `piva_fatture`, `piva_settings` dell'utente;
  3. `delete from transfers where user_id = v_me and household_id is null`;
  4. `delete from transactions where user_id = v_me and household_id is null`;
  5. "referenziato dalla Casa" vuol dire che esiste una riga con `household_id is not null` che punta lì: `transactions.account_id` / `categoria_id` / `goal_id`, `transfers.da_account_id` / `a_account_id`, `household_plan_items.categoria_id` / `goal_id`, `balance_checks.account_id`;
  6. conti personali referenziati: `update ... set archiviato = true, conta_in_disponibile = false, saldo_attuale = 0`. Tutti gli altri conti personali: `delete`;
  7. obiettivi e categorie personali referenziati: obiettivi `stato = 'chiuso'`, categorie `archiviata = true`. Gli altri: `delete`;
  8. `perform public.crea_categorie_iniziali();`.

  Nessun `set null` su righe della Casa. In fondo il rollback commentato, che toglie tabelle, colonne e funzioni.

- [ ] **Step 4: Write `supabase/tests/ricomincia_da_zero.sql`** (da lanciare a mano, come `rls_casa.sql`). Crea due utenti in una casa con: un versamento dal conto personale di A, una spesa anticipata da A con il suo conto, una spesa sul conto comune. Salva in una tabella temporanea il risultato di `_casa_*` (crediti, debiti, arretrati) e i saldi dei conti della casa. Come A, lancia `ricomincia_da_zero()`. Poi `assert` sui numeri identici, sul conto di A archiviato con saldo 0, su nessuna riga personale di A rimasta oltre le archiviate, su nessuna riga di B toccata, e sulle categorie iniziali create (11). Tutto in `begin; … rollback;`.

- [ ] **Step 5: Run** `npx vitest run tests/migration0011.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit** `feat(percorso): migrazione 0011 con reset e categorie iniziali`.

- [ ] **Step 7: Fermarsi e chiedere a Fabio** di lanciare la 0011 e poi `supabase/tests/ricomincia_da_zero.sql` nel SQL editor. I task 2-11 si possono scrivere prima, ma non si pubblica su master finché la 0011 non è applicata: le letture nuove romperebbero la Home.

---

### Task 2: Tipi e accesso ai dati

**Files:**
- Create: `src/lib/percorso/tipi.ts`, `src/lib/data/percorso.ts`
- Modify: `src/lib/types.ts` (Account `archiviato: boolean`; Category `ruolo: 'certa' | 'svago' | null`; BudgetGoal `ruolo?: 'imprevisti' | null`), `src/lib/data/accounts.ts`, `src/lib/data/categories.ts`, `src/lib/data/goals.ts`
- Test: `tests/data/percorso.test.ts`, more cases in `tests/data/accounts.test.ts`, `categories.test.ts`, `goals.test.ts` (with `tests/helpers/fakeSupabase.ts`)

**Interfaces:**
- Produces in `tipi.ts`:
```ts
export type ArgomentoId =
  | 'dove-vanno' | 'piano' | 'spese-certe' | 'imprevisti' | 'prima-da-parte'
  | 'impulso' | 'bisogni-desideri' | 'reddito-irregolare' | 'debiti-rate' | 'truffe'
  | 'coppia' | 'assicurazioni' | 'inflazione' | 'risparmio-investimento' | 'pensione';
export type Fase = 'adesso' | 'appena-entrano' | 'dopo';
export type PassoId = 'conti' | 'entrate' | 'piva' | 'settimana' | 'spese-certe' | 'imprevisti' | 'obiettivo';
export interface PercorsoUtente {
  entrateTipo: 'fisse' | 'irregolari' | 'piva' | null;
  entrataAttesa: number | null; entrataAttesaIl: string | null; redditoBase: number | null;
  settimanaDal: string | null; settimanaFattaIl: string | null;
  speseCerteNessuna: boolean; obiettivoPiuAvanti: boolean; nascosti: boolean;
  ultimaPropostaIl: string | null;
}
export interface StatoLezione { vistaIl: string | null; rimandataAl: string | null; azioneIl: string | null; propostaIl: string | null }
export type StatiLezioni = Partial<Record<ArgomentoId, StatoLezione>>;
export interface VoceAttesa { id: string; nome: string; importo: number; aggiuntoIl: string; rivediIl: string; stato: 'in_attesa' | 'voluto' | 'non_piu' }
```
- Produces in `data/percorso.ts`. Tutte le funzioni prendono `(supabase: SupabaseClient, …)`:
  - `leggiPercorso(): Promise<{ utente: PercorsoUtente | null; lezioni: StatiLezioni }>`: due letture in parallelo;
  - `salvaPercorso(campi: Partial<PercorsoUtente>): Promise<void>`: upsert su `user_id`;
  - `segnaLezione(id: ArgomentoId, campi: Partial<StatoLezione>): Promise<void>`: upsert;
  - `segnaProposta(id: ArgomentoId, oggi: string): Promise<void>`: `proposta_il` sulla lezione e `ultima_proposta_il` sull'utente;
  - `rispostaAvviso(transactionId: string, risposta: 'imprevisto' | 'normale' | 'visto'): Promise<void>`;
  - `avvisoGiaDato(transactionId: string): Promise<boolean>`;
  - `leggiListaAttesa(): Promise<VoceAttesa[]>`, `aggiungiAttesa(nome, importo, oggi): Promise<VoceAttesa>` (`rivediIl` = oggi + `GIORNI_ATTESA`), `decidiAttesa(id, stato: 'voluto' | 'non_piu'): Promise<void>`;
  - `collegaAObiettivo(transactionId: string, goalId: string): Promise<void>`: aggiorna solo `goal_id`;
  - `ricominciaDaZero(): Promise<void>`: rpc `ricomincia_da_zero`;
  - `creaCategorieIniziali(): Promise<number>`: rpc.
- `getAccounts(supabase, PERSONALE)` esclude `archiviato = true`. Con scope casa non cambia nulla.
- `createGoal` accetta `ruolo?: 'imprevisti' | null` e `GOAL_COLUMNS` legge `ruolo`. `updateCategory` accetta `ruolo?: 'certa' | 'svago' | null`.

- [ ] **Step 1: Failing tests.** In `tests/data/percorso.test.ts`:
  - `'leggiPercorso senza righe dà utente null e lezioni vuote'`
  - `'salvaPercorso fa upsert su user_id con i nomi colonna snake_case'`
  - `'aggiungiAttesa mette rivedi_il a oggi + 7'` (`'2026-11-19'` diventa `'2026-11-26'`)
  - `'collegaAObiettivo aggiorna solo goal_id'`

  In `accounts.test.ts`: `'getAccounts personale esclude gli archiviati'`. Negli altri due: il mapper di `ruolo`.
- [ ] **Step 2: Run** `npx vitest run tests/data`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`. Expected: tutto PASS (i fixture esistenti con `Account` e `Category` prendono `archiviato: false` e `ruolo: null`).
- [ ] **Step 5: Commit** `feat(percorso): tipi e dati del percorso`.

---

### Task 3: I 15 testi delle lezioni e l'elenco delle spese certe

**Files:**
- Create: `src/lib/percorso/lezioni.ts`, `src/lib/percorso/speseCerte.ts`
- Test: `tests/percorso/lezioni.test.ts`

**Interfaces:**
- Produces:
```ts
export interface Lezione {
  id: ArgomentoId; numero: number; titolo: string; fase: Fase;
  inBreve: string;          // 2-3 frasi
  esempio: string;          // usato quando "Con i tuoi numeri" non ha dati; cifre dichiarate come esempio
  prova: { etichetta: string; href: string } | null;  // null per 10, 13, 14, 15
  link: { etichetta: string; url: string }[];         // massimo 2
}
export const LEZIONI: Lezione[];                      // 15, ordine della ricerca, numero 1..15
export function lezione(id: ArgomentoId): Lezione;
export interface SpesaCerta { chiave: string; nome: string; importoAnnuo: number; frequenzaMesi: number; riga: string }
export const SPESE_CERTE_PERSONALI: SpesaCerta[];
```
- Fasi, dal triage della ricerca: `adesso` per 1, 2, 3, 9, 10; `appena-entrano` per 4, 5, 6, 8; `dopo` per le altre.
- `prova.href` punta a flussi esistenti o del task 8: `/impara/primi-passi/spese-certe`, `/impara/primi-passi/imprevisti`, `/impara/attesa`, `/goals`, `/history`, `/piva`, `/casa/quota`, `/casa` (check-in). Per la lezione 2: `/?dettaglio=disponibile` se la Home apre già il "Come si calcola?" da un parametro, altrimenti `/`.
- `SPESE_CERTE_PERSONALI`, cifre di esempio modificabili dalla ricerca (argomento 3):
  - assicurazione auto 480 €/12 mesi;
  - bollo 150 €/12;
  - tagliando e revisione 250 €/12;
  - gomme 400 €/24;
  - abbonamenti annuali 60 €/12;
  - regali 300 €/12.

- [ ] **Step 1: Failing tests.**
  - `'ci sono 15 lezioni con numero 1..15 e id unici'`
  - `'ogni lezione sta sotto le 150 parole'` (titolo + inBreve + esempio + etichetta della prova)
  - `'nessuna parola vietata'`
  - `'nessuna lezione dice dovresti o devi'` (regex `/\b(dovresti|devi)\b/i`)
  - `'i link sono al massimo 2 e solo su host ufficiali'`, cioè `bancaditalia.it`, `economiapertutti.bancaditalia.it`, `consob.it`, `ivass.it`, `inps.it`, `comitatoeducazionefinanziaria.gov.it`, `arbitrobancariofinanziario.it`
  - `'le lezioni 14 e 15 non hanno prova e non nominano prodotti'` (regex su `ETF|fondo pensione [A-Z]|azion`)
  - `'le fasi seguono il triage'`
- [ ] **Step 2: Run** `npx vitest run tests/percorso/lezioni.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the texts** in `lezioni.ts` from the sections of the research, in your own words, in plain Italian. Rules:
  - cifre degli studi solo se servono;
  - nessun dato [Non verificato] come fatto (per esempio niente "dal 4% al 30%" sul BNPL, niente data della CCD2);
  - la lezione 4 contiene il test delle tre domande (imprevedibile, necessario, nessun altro modo);
  - la lezione 1 dice che gli spiccioli si guardano e non si colpevolizzano, accanto alle voci grandi.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Mark the links for Fabio.** Scrivere in `docs/ROADMAP.md`, sezione "Da controllare per Fabio", l'elenco degli URL usati, da aprire a mano prima della pubblicazione.
- [ ] **Step 6: Commit** `feat(percorso): testi delle 15 lezioni`.

---

### Task 4: Stato dei Primi passi

**Files:**
- Create: `src/lib/calculations/percorso/soglie.ts`, `src/lib/calculations/percorso/passi.ts`
- Test: `tests/calculations/percorso/passi.test.ts`

**Interfaces:**
- Consumes: `PercorsoUtente`, `PassoId` (task 2), `Account`, `BudgetGoal`.
- Produces:
```ts
export interface StatoPasso { id: PassoId; fatto: boolean }
export interface PrimiPassi { passi: StatoPasso[]; fatti: number; totale: number; prossimo: PassoId | null; visibile: boolean }
export function statoPrimiPassi(input: {
  conti: Account[]; goals: BudgetGoal[]; percorso: PercorsoUtente | null; pivaGuidata: boolean; oggi: string;
}): PrimiPassi
export function settimanaFinita(percorso: PercorsoUtente | null, oggi: string): boolean  // oggi >= settimanaDal + 7
```
- Regole (`goals` = obiettivi personali aperti):
  - `conti`: almeno un conto non archiviato;
  - `entrate`: `entrateTipo !== null`;
  - `piva`: presente solo se `entrateTipo === 'piva'`, fatto se `pivaGuidata`;
  - `settimana`: `settimanaFattaIl !== null`;
  - `spese-certe`: esiste un obiettivo dilazionato ricorrente con `ruolo` null, oppure `speseCerteNessuna`;
  - `imprevisti`: esiste un obiettivo con `ruolo === 'imprevisti'`;
  - `obiettivo`: esiste un obiettivo non ricorrente con `ruolo` null, oppure `obiettivoPiuAvanti`.
- Ordine: `conti`, `entrate`, `piva`, `settimana`, `spese-certe`, `imprevisti`, `obiettivo`. `prossimo` è il primo non fatto. `visibile = !nascosti && fatti < totale`.

- [ ] **Step 1: Failing tests.**
  - `'utente nuovo: 0 di 6, prossimo conti, visibile'`
  - `'con entrate piva i passi diventano 7 e piva segue entrate'`
  - `'Miriam: conti, obiettivi e piva guidata già presenti risultano fatti'`
  - `'tutti fatti: visibile false'` (Review Focus 4)
  - `'nascosti: visibile false anche con passi aperti'`
  - `'un obiettivo imprevisti non conta come primo obiettivo'`
  - `'settimanaFinita: dal 2026-11-12 è finita il 2026-11-19, non il 2026-11-18'`
- [ ] **Step 2: Run** `npx vitest run tests/calculations/percorso/passi.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(percorso): stato dei primi passi`.

---

### Task 5: Avviso sui fondi (calcolo)

**Files:**
- Create: `src/lib/calculations/percorso/avviso.ts`
- Modify: `src/lib/loadHomeData.ts`: aggiungere a `HomeData` i campi `disponibileReale: number` e `riservati: { obiettivi: number; casa: number; debiti: number; tasse: number }`, con gli stessi numeri passati oggi a `computeDisponibileLibero`.
- Test: `tests/calculations/percorso/avviso.test.ts`, one more case in `tests/loadHomeData.test.ts`

**Interfaces:**
- Produces:
```ts
export type SoldiToccati = 'obiettivi' | 'casa' | 'debiti' | 'tasse';
export interface AvvisoFondi {
  buco: number;                     // quanto il disponibile è sotto zero dopo la spesa, ≤ importo
  toccati: SoldiToccati[];          // nell'ordine di consumo
  fondoImprevisti: { goalId: string; accantonato: number } | null;  // solo se 'obiettivi' è toccato e accantonato > 0
}
export function valutaAvvisoFondi(input: {
  importo: number; contaInDisponibile: boolean; disponibileDopo: number;
  riservati: { obiettivi: number; casa: number; debiti: number; tasse: number };
  fondoImprevisti: { goalId: string; accantonato: number } | null;
}): AvvisoFondi | null
```
- Regola:
  - `null` se `!contaInDisponibile`, se `disponibileDopo >= 0`, o se `disponibileDopo + importo < 0` (era già sotto zero);
  - `buco = arrotonda2(-disponibileDopo)`;
  - il buco si consuma nell'ordine obiettivi, casa, debiti, tasse, fermandosi a ciascun riservato;
  - finché il disponibile non torna a zero o più, ogni spesa trova il disponibile già sotto zero, quindi non serve uno stato "sotto zero" salvato.

  Decisione del piano: la spec citava quello stato, ma questo test lo rende superfluo.

  Il "Sì" collega l'intera spesa al fondo. `computeAccantonatoFinora` non scende sotto zero, quindi il fondo cede al massimo quanto ha messo da parte. Come da spec.

- [ ] **Step 1: Failing tests.**
  - `'da 30 € a -20 €: buco 20, tocca obiettivi'`
  - `'già sotto zero prima: nessun avviso'` (Review Focus 2)
  - `'conto fuori dal disponibile: nessun avviso'` (Review Focus 3)
  - `'buco più grande degli obiettivi: tocca obiettivi poi casa'`
  - `'nessun obiettivo riservato: toccati solo tasse, fondoImprevisti null'`
  - `'fondo imprevisti con accantonato 0: fondoImprevisti null'`
  - `'arrotonda a centesimi'`

  In `loadHomeData.test.ts`: `'riservati sommati più disponibileReale ricostruiscono il saldo dei conti nel disponibile'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(percorso): calcolo dell'avviso sui fondi`.

---

### Task 6: Quando proporre una lezione e "Con i tuoi numeri"

**Files:**
- Create: `src/lib/calculations/percorso/regole.ts`, `src/lib/calculations/percorso/numeri.ts`
- Modify: `src/lib/calculations/supporto/consiglio.ts`: `Consiglio` prende `lezione: ArgomentoId`, e ogni voce di `FRASI_IN_LINEA` porta la sua (TARI `spese-certe`, 50/30/20 `bisogni-desideri`, quota `coppia`, comune `coppia`); `senza_dettaglio` e `categoria_sopra` vanno a `dove-vanno`, `obiettivo_corto` a `spese-certe`.
- Test: `tests/calculations/percorso/regole.test.ts`, `tests/calculations/percorso/numeri.test.ts`, existing `tests/calculations/supporto/consiglio.test.ts`

**Interfaces:**
- Produces in `regole.ts`:
```ts
export interface DatiRegole {
  oggi: string;
  transazioni: Transaction[];           // personali, ultimi 3 mesi
  categorie: Category[];
  goals: (BudgetGoal & { accantonato: number })[];
  lezioni: StatiLezioni;
  percorso: PercorsoUtente | null;
  disponibileReale: number;
  ultimaEntrataIl: string | null;
  primiPassiVisibili: boolean;
}
export function ruoloCategoria(c: Category): 'certa' | 'svago' | null
export function eRata(t: Transaction, categorie: Category[]): boolean
export function meseStretto(d: DatiRegole): boolean
export function puoProporre(id: ArgomentoId, d: DatiRegole, giorniMinimi?: number): boolean
export function lezioneDopoSalvataggio(t: Transaction, d: DatiRegole): ArgomentoId | null
export function lezioneDelGiorno(d: DatiRegole): ArgomentoId | null
```
- `ruoloCategoria`: prima `c.ruolo`; se null, nome normalizzato (minuscolo, senza accenti).
  - `certa` se contiene `auto`, `assicura`, `bollo`, `tari`, `abbonament`, `tagliando`, `revisione`;
  - `svago` se contiene `svago`, `acquist`, `shopping`, `vestit`, `hobby`, `regal`;
  - altrimenti null.
- `eRata`: descrizione o nome della categoria contiene `rata`, `rate `, `klarna`, `scalapay`, `paypal in 3`, `finanziament`.
- `meseStretto`: `disponibileReale < 0`, oppure nessuna entrata da `GIORNI_SENZA_ENTRATA` giorni (`ultimaEntrataIl` null conta come stretto).
- `puoProporre`: vale se tutte queste condizioni sono vere:
  - `ultimaPropostaIl !== oggi`;
  - `rimandataAl` null o ≤ oggi;
  - `vistaIl` null o di almeno `giorniMinimi` giorni fa (default `GIORNI_RIPROPOSTA`);
  - se `meseStretto`, la fase della lezione non è `dopo`.
- `lezioneDopoSalvataggio`, solo su righe personali. Si prende il primo candidato che passa `puoProporre`, in questo ordine:
  1. spesa con `eRata`: `debiti-rate`;
  2. spesa > `SPESA_IMPREVISTO` senza `goalId`: `imprevisti`;
  3. spesa in una categoria `certa` senza un obiettivo aperto con la stessa `categoriaId`: `spese-certe`;
  4. spesa > `SPESA_IMPULSO` in una categoria `svago`, se `impulso` non è stata proposta nel mese corrente: `impulso`;
  5. entrata > `ENTRATA_GRANDE`: `prima-da-parte`;
  6. prima entrata del mese, oppure `disponibileReale < DISPONIBILE_BASSO`: `piano`;
  7. spesa con importo < `PICCOLA_SPESA` e piccole spese del mese > `PICCOLE_SPESE_MESE`: `dove-vanno`.

  Decisione del piano: la regola 5 della spec ("quota del mese non coperta") non ha senso qui. Gli obiettivi dilazionati maturano da soli col tempo, quindi la lezione `prima-da-parte` scatta su ogni entrata grande. La sua prova porta al fondo imprevisti se manca, altrimenti a `/goals`.
- `lezioneDelGiorno`: `null` se `primiPassiVisibili`. Altrimenti il primo candidato che passa:
  1. `piano` se `disponibileReale < DISPONIBILE_BASSO`;
  2. `imprevisti` se nessun obiettivo `imprevisti`;
  3. `reddito-irregolare` se `entrateTipo` è `irregolari` o `piva` e negli ultimi 2 mesi completi le entrate differiscono di almeno il 30%;
  4. `risparmio-investimento` se il fondo imprevisti ha `accantonato >= importoTarget`;
  5. `truffe` e poi `pensione` con `giorniMinimi = GIORNI_ANNUALE`;
  6. `inflazione` se la transazione più vecchia ha almeno 365 giorni, con `GIORNI_ANNUALE`.
- Produces in `numeri.ts`:
```ts
export function piccoleSpese(t: Transaction[], mese: string): { numero: number; totale: number }
export function divisioneMese(t: Transaction[], categorie: Category[], goals: (BudgetGoal & { accantonato: number })[], mese: string): { certe: number; altre: number; daParte: number }
export function numeriLezione(id: ArgomentoId, d: DatiRegole): string | null  // frase pronta, o null → si usa lezione.esempio
```
  `numeriLezione` ha una frase per `dove-vanno`, `bisogni-desideri`, `imprevisti` (quanto c'è nel fondo, o "non c'è ancora"), `spese-certe` (quanti fondi aperti e quota mensile totale) e `piano` (il disponibile). Le altre danno `null`.

- [ ] **Step 1: Failing tests.**
  - `ruoloCategoria`: `'Auto e Assicurazione sono certe, Bar e ristoranti no, il ruolo salvato vince sul nome'` (Review Focus 5)
  - `eRata`: `'Klarna e "rata telefono" sono rate, "pirata" no'` (attenzione ai confini di parola)
  - `meseStretto`: `'disponibile -1 è stretto; ultima entrata 31 giorni fa è stretto; 29 no'`
  - `puoProporre`: `'una al giorno'`, `'più tardi blocca per 14 giorni'`, `'vista 59 giorni fa no, 60 sì'`, `'in mese stretto le lezioni dopo no'`
  - `lezioneDopoSalvataggio`: un caso per ogni regola e `'rata da 200 € vince su imprevisti'`
  - `lezioneDelGiorno`: `'null con primi passi visibili'`, `'truffe torna dopo 365 giorni'`
  - `numeri`: `'piccole spese: 3 caffè da 1,20 e una spesa da 5 → numero 3, totale 3,60'` (5 non è < 5), `'divisioneMese somma le certe per ruolo'`
  - `consiglio.test.ts`: `'ogni consiglio ha una lezione'`, `'le frasi in linea portano alla lezione del loro tema'`
- [ ] **Step 2: Run** `npx vitest run tests/calculations`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(percorso): regole delle lezioni e numeri personali`.

---

### Task 7: Pagine "Impara" (indice e lezione) e "Perché?"

**Files:**
- Create: `src/lib/loadPercorsoData.ts`, `src/app/impara/page.tsx` (indice), `src/app/impara/[argomento]/page.tsx`, `src/app/impara/SchedaLezione.tsx` (client: rendering più "Più tardi" e "Fatto"), `src/app/impara/actions.ts`
- Modify: `src/app/home/ConsiglioCard.tsx` (sotto la spiegazione breve, un link "Leggi la lezione" a `/impara/${consiglio.lezione}`), `src/app/altro/page.tsx` (voce "Impara" con icona `GraduationCap`, prima di Obiettivi)
- Test: `tests/ImparaPage.test.tsx`, `tests/SchedaLezione.test.tsx`, update `tests/AltroPage.test.tsx`, `tests/HomeDashboard.test.tsx`

**Interfaces:**
- Produces:
```ts
// loadPercorsoData.ts
export async function loadPercorsoData(supabase: SupabaseClient, today?: Date): Promise<DatiRegole & { primiPassi: PrimiPassi }>
// actions.ts ('use server')
export async function apriLezione(id: ArgomentoId): Promise<void>      // vista_il = oggi
export async function rimandaLezione(id: ArgomentoId): Promise<void>   // rimandata_al = oggi + 14
export async function lezioneFatta(id: ArgomentoId): Promise<void>     // azione_il = oggi
```
- `loadPercorsoData` riusa `loadHomeData` (per `disponibileReale` e i goal con accantonato) più `leggiPercorso` e `getPivaSettings`, in parallelo.
- La pagina lezione mostra: titolo; "In breve"; "Con i tuoi numeri" (`numeriLezione` oppure `esempio`, con l'etichetta "Per esempio" quando è l'esempio); il pulsante "Prova" (se c'è); "Più tardi"; i link sotto "Per saperne di più". All'apertura chiama `apriLezione`. Toccare "Prova" chiama `lezioneFatta` prima di navigare.
- L'indice mostra i 15 titoli in ordine. Quelli con `vistaIl` hanno un segno discreto ("letta"), senza percentuali. In cima c'è il link "Primi passi" se nascosti o non finiti, e il link "Lista d'attesa".
- Un `argomento` sconosciuto restituisce `notFound()`.

- [ ] **Step 1: Failing tests.**
  - `'l indice mostra 15 lezioni in ordine e segna le lette'`
  - `'l indice non mostra percentuali'` (nessun `%` nel testo renderizzato)
  - `'la lezione senza numeri mostra Per esempio'`
  - `'Più tardi chiama rimandaLezione'`
  - `'argomento sconosciuto: notFound'`
  - Altro: `'ha la voce Impara'`
  - ConsiglioCard: `'aperto il Perché, c è il link alla lezione del consiglio'`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** nello stile di `DESIGN.md` (libretto, `CoverHeader`).
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(percorso): indice, pagina lezione e Perché del consiglio`.

---

### Task 8: Primi passi (scheda in Home e schermate dei passi)

**Files:**
- Create: `src/app/home/PrimiPassiCard.tsx`, `src/app/impara/primi-passi/page.tsx` (elenco), `src/app/impara/primi-passi/[passo]/page.tsx` più componenti client per `entrate`, `settimana`, `spese-certe`, `imprevisti`
- Modify: `src/lib/loadHomeData.ts`: aggiungere `primiPassi: PrimiPassi` e `lezioneDelGiorno: ArgomentoId | null`. Leggere `leggiPercorso` in parallelo; se `getCategories` è vuoto chiamare `creaCategorieIniziali` e rileggere, una sola volta. `src/app/HomeDashboard.tsx`: con `primiPassi.visibile` la scheda prende il posto di `ConsiglioCard`; altrimenti, se `lezioneDelGiorno` non è null, sotto il consiglio una riga "Da sapere: <titolo>" che porta alla lezione (`segnaProposta` alla prima visualizzazione del giorno, da una server action).
- Test: `tests/PrimiPassiCard.test.tsx`, `tests/PrimiPassiPassi.test.tsx`, update `tests/HomeDashboard.test.tsx`, `tests/loadHomeData.test.ts`

**Interfaces:**
- Consumes: `statoPrimiPassi`, `settimanaFinita` (task 4); `salvaPercorso`, `creaCategorieIniziali` (task 2); `createGoal` (`src/lib/data/goals.ts`); `SPESE_CERTE_PERSONALI` (task 3); `lezione()`.
- Every step page: one minute of explanation (from the related lesson: `conti`/`entrate` → `piano` and `reddito-irregolare`, `settimana` → `dove-vanno`, `spese-certe` → `spese-certe`, `imprevisti` → `imprevisti`, `obiettivo` → `piano`), then one action:
  - `conti`: link a `/accounts`;
  - `entrate`: tre scelte (fisse, irregolari, P.IVA), un importo facoltativo, una data facoltativa con la casella "Non so ancora la data", e per gli irregolari un "reddito base" facoltativo. Si salva con `salvaPercorso`. Se non c'è `settimanaDal`, la imposta a oggi;
  - `piva`: link alla guida P.IVA esistente;
  - `settimana`: prima del 7° giorno dice "Segna le spese, il resto lo guardiamo il <data>". Dal 7° giorno mostra il riepilogo (totale, 3 categorie più grandi, `piccoleSpese`) e mette `settimanaFattaIl`. Con zero spese il testo è neutro, "Ripartiamo da oggi", e `settimanaDal` torna a oggi;
  - `spese-certe`: l'elenco `SPESE_CERTE_PERSONALI` con caselle, importo e mese della prossima scadenza modificabili. "Crea i fondi" chiama `createGoal` con `modalita 'dilazionato'`, `ricorrente true`, `frequenzaMesi`, `scadenza`, `accantonaDa: oggi`. C'è anche "Non ne ho" (`speseCerteNessuna`);
  - `imprevisti`: traguardo `TRAGUARDO_IMPREVISTI` e quota `QUOTA_IMPREVISTI`, modificabili, più il test delle tre domande. Crea un obiettivo `dilazionato`, non ricorrente, `ruolo 'imprevisti'`, `scadenza = oggi + ceil(traguardo / quota) mesi`, `accantonaDa: oggi`;
  - dopo "Crea i fondi" di `spese-certe`, se fra le voci create c'è l'assicurazione auto, in fondo compare il link alla lezione `assicurazioni` (con `segnaProposta`);
  - `obiettivo`: link a `/goals` con il modulo aperto, più "Più avanti" (`obiettivoPiuAvanti`).
- La scheda mostra "N di M" senza percentuali, i passi con lo stato e "Li vedo più tardi", che imposta `nascosti`.

- [ ] **Step 1: Failing tests.**
  - card: `'mostra 2 di 6 e il prossimo passo'`, `'Li vedo più tardi salva nascosti'`
  - Home: `'con primi passi visibili non c è il consiglio'`, `'senza primi passi e con lezione del giorno c è Da sapere'`
  - passi:
    - `'imprevisti crea un dilazionato con ruolo imprevisti, scadenza a 10 mesi con 200 e 20'`
    - `'spese certe crea un fondo per voce spuntata'`
    - `'settimana senza spese dice Ripartiamo da oggi e non contiene parole vietate'`
    - `'entrate: Non so ancora la data salva entrataAttesaIl null'`
  - loader: `'senza categorie chiama crea_categorie_iniziali una volta'`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(percorso): primi passi`.

---

### Task 9: Lista d'attesa

**Files:**
- Create: `src/app/impara/attesa/page.tsx`, `src/app/impara/attesa/ListaAttesa.tsx`
- Modify: `src/lib/calculations/supporto/home.ts` (`Prossimo.tipo` prende `'attesa'`), `src/lib/loadHomeData.ts` (la voce in attesa con `rivediIl <= oggi` e la data più vecchia diventa `prossimo` se non ce n'è già uno più urgente; la P.IVA e la Casa vengono prima), `src/app/altro/page.tsx` (voce "Lista d'attesa")
- Test: `tests/ListaAttesa.test.tsx`, one more case in `tests/calculations/supporto/home.test.ts`

**Interfaces:**
- Consumes: `leggiListaAttesa`, `aggiungiAttesa`, `decidiAttesa` (task 2).
- La pagina ha un modulo con nome e cifra, più l'elenco delle voci in attesa con la data "ci ripensi il <data>". Sulle voci scadute ci sono "Lo voglio ancora" (apre l'aggiunta della spesa con importo e descrizione già scritti, se il foglio lo permette; altrimenti `/goals`) e "Non più". Nessun totale "risparmiato".

- [ ] **Step 1: Failing tests.**
  - `'aggiunge una voce con ripensamento fra 7 giorni'`
  - `'una voce scaduta mostra le due scelte'`
  - `'non mostra totali risparmiati'`
  - `'prossimo attesa compare solo senza promemoria più urgenti'`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(percorso): lista d'attesa`.

---

### Task 10: Dopo il salvataggio (avviso e lezione) e "Ricomincia da zero"

**Files:**
- Create: `src/app/impara/dopoSalvataggio.ts` (`'use server'`), `src/app/add/AvvisoFondiFoglio.tsx`, `src/app/add/LezioneFoglio.tsx`, `src/app/altro/RicominciaDaZero.tsx`
- Modify: `src/app/add/AddTransactionSheet.tsx`: dopo `registraMovimento`, solo con `modo === 'personale'`, chiama `valutaDopoSalvataggio(id)` e salva il risultato in uno stato che sopravvive alla chiusura, come `quotaDaSpostare`. La quota P.IVA ha la precedenza; se c'è, si mostra dopo. `src/app/altro/page.tsx`: `<RicominciaDaZero />` in fondo.
- Test: `tests/AvvisoFondiFoglio.test.tsx`, `tests/RicominciaDaZero.test.tsx`, `tests/dopoSalvataggio.test.ts`, update `tests/AddTransactionSheet.test.tsx`

**Interfaces:**
- Consumes: `valutaAvvisoFondi` (task 5), `lezioneDopoSalvataggio`, `puoProporre` (task 6), `loadPercorsoData` (task 7), `avvisoGiaDato`, `rispostaAvviso`, `collegaAObiettivo`, `segnaProposta`, `ricominciaDaZero` (task 2).
- Produces:
```ts
export type DopoSalvataggio =
  | { tipo: 'avviso'; avviso: AvvisoFondi; transactionId: string; lezione: ArgomentoId }
  | { tipo: 'lezione'; lezione: ArgomentoId }
  | null;
export async function valutaDopoSalvataggio(transactionId: string): Promise<DopoSalvataggio>
export async function rispondiAvviso(transactionId: string, risposta: 'imprevisto' | 'normale', goalId?: string): Promise<void>
```
- `valutaDopoSalvataggio`:
  1. legge la transazione e `loadPercorsoData`;
  2. considera solo le spese personali con data ≤ oggi;
  3. se `avvisoGiaDato` è vero, salta l'avviso;
  4. `contaInDisponibile` è quello del conto della spesa. Una spesa senza conto (contanti) conta come fuori dal disponibile;
  5. il fondo imprevisti è l'obiettivo con `ruolo 'imprevisti'`, con il suo `accantonato`;
  6. se c'è un avviso: `rispostaAvviso(id, 'visto')`, poi restituisce `tipo 'avviso'` con la lezione `imprevisti` se manca il fondo, altrimenti `prima-da-parte`;
  7. altrimenti `lezioneDopoSalvataggio`; se c'è, chiama `segnaProposta` e restituisce `tipo 'lezione'`;
  8. ogni errore restituisce `null`: il salvataggio vale comunque.
- Testi esatti di `AvvisoFondiFoglio`:
  - titolo: `Questa spesa usa {buco} € che avevi messo da parte.` quando `toccati[0] === 'obiettivi'`. Con `casa`, `debiti` o `tasse` per primi: `Questa spesa usa {buco} € che servono per {la quota della casa | restituire quello che devi in casa | le tasse}.`;
  - con `fondoImprevisti`: domanda `È un imprevisto vero?` e pulsanti `Sì, prendili dal fondo imprevisti` e `No, è una spesa normale`. Sì: `collegaAObiettivo`, poi `Il fondo ha fatto il suo lavoro.` No: `Va bene. La prossima entrata copre prima questi {buco} €.`;
  - senza fondo, o con solo casa, debiti o tasse: solo la frase informativa più `La prossima entrata copre prima questi {buco} €.`, con il link alla lezione e "Chiudi";
  - per ogni lezione proposta, il link apre `LezioneFoglio` (titolo, "In breve", "Apri la lezione", "Più tardi").
- `RicominciaDaZero`:
  - pulsante "Ricomincia da zero" in Altro;
  - il foglio di conferma dice cosa cancella e cosa resta, come da spec, e aggiunge: `Il piano gratuito non ha copie di sicurezza: dopo la conferma questi dati non si recuperano.`;
  - se `casa.stato` ha un credito o un debito aperto per l'utente, prima lo dice;
  - c'è un campo in cui scrivere `RICOMINCIA`: il pulsante resta disattivato finché il testo, senza spazi ai lati e in maiuscolo, non è uguale;
  - non usa la preferenza "Non avvisarmi più";
  - al successo chiama `ricominciaDaZero()`, poi `router.replace('/impara/primi-passi')`. In caso di errore mostra il messaggio e non tocca niente.

- [ ] **Step 1: Failing tests.**
  - `dopoSalvataggio`:
    - `'spesa casa: null'`
    - `'spesa con data futura: null'`
    - `'avviso già dato: niente avviso, eventuale lezione'`
    - `'errore di lettura: null'`
    - `'spesa in contanti: nessun avviso'`
  - Avviso:
    - `'con fondo mostra le due scelte e Sì collega la spesa al fondo'`
    - `'con solo tasse toccate niente Sì e la frase dice le tasse'`
    - `'nessuna parola vietata in tutte le varianti'`
  - Sheet:
    - `'dopo un salvataggio personale chiama valutaDopoSalvataggio, dopo uno di casa no'`
    - `'la quota P.IVA viene prima dell avviso'`
  - Reset:
    - `'il pulsante resta disattivato finché non si scrive RICOMINCIA'`
    - `'accetta ricomincia minuscolo con spazi'`
    - `'mostra l avviso sui backup'`
    - `'con debito aperto lo dice prima'`
    - `'al successo va ai primi passi, all errore resta e mostra il messaggio'`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(percorso): avviso sui fondi, lezione dopo il salvataggio, ricomincia da zero`.

---

### Task 11: Categorie con ruolo, collegamenti, anteprime e documenti

**Files:**
- Modify:
  - `src/app/categories/…`: nella modifica di una categoria di spesa personale, una scelta "Tipo" con `Normale`, `Spesa certa`, `Svago e acquisti` che salva `ruolo`. `updateCategory` accetta `ruolo`;
  - `src/app/casa/CheckinMensile.tsx`: un link "Perché?" alla lezione `coppia`;
  - `src/app/anteprima/page.tsx`: viste `impara`, `lezione`, `primi-passi`, `passo-imprevisti`, `avviso-fondi`, `attesa`, `ricomincia`;
  - `DESIGN.md`: i componenti nuovi;
  - `docs/ROADMAP.md`: stato del pezzo 3, cose da controllare per Fabio (0011, test SQL, link, soglie);
  - `PRODUCT.md`: principio 7 e la frase "Room is reserved…", da aggiornare a "il percorso esiste".
- Test: update `tests/CategoriesPage.test.tsx`, `tests/AnteprimaPage.test.tsx`

- [ ] **Step 1: Failing tests.**
  - `'una categoria di spesa ha la scelta Tipo e salva ruolo'`
  - `'una categoria di entrata non ha la scelta Tipo'`
  - `'anteprima: ogni vista nuova si apre senza errori'`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run` e `npm run build`. Expected: PASS e build ok.
- [ ] **Step 5: Verify in browser** con la configurazione `dev-webpack` di `.claude/launch.json`. Aprire ogni vista nuova di `/anteprima`, in chiaro e in scuro, a 375 px. Nella console non devono esserci errori.
- [ ] **Step 6: Commit** `feat(percorso): ruolo delle categorie, anteprime e documenti`.

---

## Dopo l'ultimo task

1. Revisione finale dell'intero ramo con opus, come le altre volte, più la revisione finale di impeccable.
2. Push su master solo dopo che Fabio ha lanciato la 0011. Fino ad allora i commit restano in locale.
3. Prova dal vivo per Fabio:
   - "Ricomincia da zero" sul suo account, poi i Primi passi;
   - una spesa che porta il disponibile sotto zero;
   - una spesa da 160 € (lezione sul fondo imprevisti).

   Prima del reset, controllare nella Casa crediti e saldo del conto comune, e ricontrollarli dopo.
