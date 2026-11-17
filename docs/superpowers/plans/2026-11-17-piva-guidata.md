# P.IVA guidata: piano di implementazione

> **Per chi esegue con agenti:** sotto-skill obbligatoria: superpowers:subagent-driven-development (consigliata) oppure superpowers:executing-plans. I passi usano le caselle (`- [ ]`) per tenere il conto.

**Obiettivo:** trasformare la pagina P.IVA in una guida per Miriam, forfettaria iscritta all'ENPAP. Comprende:
- la quota da mettere da parte a ogni incasso, con il conto tasse come vaso;
- le scadenze;
- le fatture in attesa;
- uno stipendio fisso con il cuscinetto.

**Architettura:**
- La migrazione 0010 aggiunge tre tabelle P.IVA (`piva_fatture`, `piva_accantonamenti`, `piva_scadenze`), colonne nuove a `piva_settings` e `promemoria_utente`, e RPC atomiche in `security invoker`.
- I calcoli sono funzioni pure in `src/lib/calculations/` (`piva.ts`, `pivaScadenze.ts`, `pivaFatture.ts`, `stipendio.ts`).
- La pagina `/piva` diventa un hub.
- La Home riceve un blocco `piva` da `loadHomeData`. Tutto è personale: niente `household_id`.

**Tecnologie:** Next.js 16.3.3, React 19, Tailwind 4, Supabase (Postgres con RLS), vitest e Testing Library, date-fns, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-17-piva-guidata-design.md`. Leggila prima di ogni task: questo piano argomenta a partire da lì.

## Vincoli globali

- Prima di scrivere codice Next, leggi la guida pertinente in `node_modules/next/dist/docs/` (AGENTS.md).
- **Migrazione 0010:**
  - nuova, `supabase/migrations/0010_piva_guidata.sql`;
  - racchiusa tra `begin;` e `commit;`, idempotente (`if not exists`, `create or replace`);
  - rollback commentato in fondo;
  - Fabio la lancia a mano. Le migrazioni 0001-0009 non si toccano.
- Le RPC sono `security invoker set search_path = public`. Rifiutano conti e categorie con `household_id is not null` ("conto non valido", "categoria non valida").
- RLS sulle tabelle nuove: `user_id = (select auth.uid())`, sia `using` sia `with check`, come in 0009.
- **Preset ENPAP:** coefficiente 78, soggettivo 10, integrativo 2, minimale soggettivo 856. Non sono ufficiali: la nota dice di confermarli con il commercialista o nell'area riservata ENPAP.
- **Chiavi delle scadenze:** `f24_giugno` (30/06), `f24_novembre` (30/11), `cassa_acconto` (01/03), `cassa_saldo` (01/10). Le date sono valori di partenza modificabili, non regole.
- **Nessuna stima per singola scadenza.** Il vaso si confronta con il totale dell'anno.
- **Soglie:** fatture vecchie oltre 60 giorni; scadenza nel "Da fare" 15 giorni prima; notifica 7 giorni prima; revisione dello stipendio ogni 3 mesi se scarta di più del 10%.
- **Testi:**
  - italiano semplice, nessun gergo; un termine tecnico (acconto, saldo, coefficiente) si spiega la prima volta che compare;
  - nessuna colpa ("alziamo la percentuale");
  - la frase "è una stima, la conferma è del commercialista" compare solo nel hub e nei "Perché?".
- **Aspetto "Il Libretto"** (DESIGN.md):
  - `CoverHeader`, `FoglioInferiore`, `SceltePill`, `AvvisoAnnulla`;
  - le cifre usano `.num`, e i numeri grandi il serif;
  - righe con `border-rule`, niente ombre.
- Le eliminazioni passano da `useEliminaConAnnulla` (5 s).
- Chi non ha la P.IVA attiva non vede nessuna differenza: stessa Home, stesso modulo di aggiunta, nessuna lettura in più oltre a `piva_settings`.
- **Modelli dei subagenti:** sonnet per i task 1, 2, 3, 5, 6, 8 e 9 (soldi e dati); haiku per il task 11 (documentazione); opus solo per la revisione finale. Ogni prompt chiede di seguire `/caveman:caveman`.
- **Commit:** un commit per task su master, con push. Mai `.impeccable/hook.cache.json`.

## Punti da verificare in revisione

1. **Doppio tocco o nuovo tentativo** su "Pagata", "Fatto, li ho spostati" o "Pagata" di una scadenza: mai due entrate o due spostamenti di saldo. L'RPC blocca la riga e alza "già incassata" o "già pagata", e il client tratta quell'errore come riuscito. Test: task 1 (statico) e task 2.
2. **Eliminare un'entrata collegata a una fattura** la riporta "in attesa", e il saldo torna indietro una volta sola. Eliminare l'uscita di una scadenza la riapre. Test: task 1 (trigger) e task 8.
3. **Il conto tasse eliminato, o finito nella casa:** l'hub torna all'impostazione guidata al passo del conto, e le RPC rifiutano i conti della casa. Test: task 4 e task 1.
4. **Impostazioni vecchie** (`guidata_dal` vuoto) o incassi precedenti all'attivazione: niente valanga di quote "da spostare" per incassi vecchi. Test: task 3.
5. **Stipendio senza storico** e senza "mese magro": niente proposta `NaN` o 0, si fa la domanda. Con la P.IVA spenta la Home resta identica. Test: task 9 e task 10.

---

## Pezzo 1: base dati

### Task 1: migrazione 0010

**File:**
- Crea: `supabase/migrations/0010_piva_guidata.sql`
- Test: `tests/migration0010.test.ts` (statico, sullo stile di `tests/migration0009.test.ts`)

**Interfacce prodotte (SQL):**
- **`piva_settings`, colonne nuove:**
  - `conto_tasse_id uuid references accounts(id) on delete set null`;
  - `preset text check (preset in ('enpap','altro'))`;
  - `guidata_dal date`;
  - `stipendio_mensile numeric check (stipendio_mensile > 0)`;
  - `stipendio_rivisto_il date`;
  - `incasso_mese_magro numeric check (incasso_mese_magro >= 0)`.
- **`promemoria_utente`:** `ultima_scadenza_avvisata uuid`.
- **`piva_fatture`:** `id, user_id default auth.uid(), cliente text not null, importo numeric not null check (importo > 0), data_emissione date not null, data_incasso date, transaction_id uuid references transactions(id) on delete set null, nota text, created_at`.
- **`piva_accantonamenti`:** `id, user_id, transaction_id uuid references transactions(id) on delete set null, importo numeric not null check (importo > 0), data date not null, da_account_id, a_account_id (references accounts on delete set null), created_at`. Indice su `(user_id, data)`.
- **`piva_scadenze`:**
  - `id, user_id, anno int not null, chiave text not null check (chiave in ('f24_giugno','f24_novembre','cassa_acconto','cassa_saldo')), tipo text not null check (tipo in ('f24','cassa')), descrizione text not null, data date not null, importo numeric check (importo > 0), pagata_il date, transaction_id uuid references transactions(id) on delete set null, nascosta boolean not null default false`;
  - `unique (user_id, anno, chiave)`.
- **RPC** (grant execute ad `authenticated`, revoke da `public` e `anon` come in 0008):
  - `crea_movimento(p_tipo text, p_importo numeric, p_data date, p_categoria uuid, p_account uuid, p_goal uuid, p_descrizione text, p_nota text, p_household uuid, p_pagata_da uuid, p_stima boolean) returns uuid`. Insert in `transactions` e, se `p_account` c'è, `saldo_attuale ± p_importo` (+ per income), nella stessa funzione. Sostituisce `creaSpesa` più `aggiornaSaldoSpesa` e vale anche per la casa: i trigger e i vincoli esistenti restano i giudici.
  - `crea_fattura(p_cliente text, p_importo numeric, p_data_emissione date, p_nota text, p_incassa_account uuid default null, p_categoria uuid default null) returns uuid`. Con `p_incassa_account` incassa subito, come `incassa_fattura`, con data = `p_data_emissione`.
  - `incassa_fattura(p_fattura uuid, p_data date, p_account uuid, p_categoria uuid) returns uuid` (id dell'entrata):
    - `for update` sulla fattura; se `data_incasso is not null`, `raise exception 'fattura già incassata'`;
    - il conto e la categoria devono essere personali; la categoria deve essere di tipo `income`;
    - entrata con `descrizione = 'Fattura ' || cliente` e saldo aggiornato;
    - imposta `data_incasso` e `transaction_id`.
  - `accantona_tasse(p_importo numeric, p_data date, p_da_account uuid, p_a_account uuid, p_transaction uuid default null) returns uuid`. Conti personali e diversi, `p_importo > 0`. Sposta i due saldi e inserisce la riga.
  - `annulla_accantonamento(p_id uuid) returns int`. Cancella la riga e riporta i saldi; torna il numero di righe cancellate (0: già sparita, nessun saldo toccato).
  - `paga_scadenza(p_scadenza uuid, p_importo numeric, p_data date, p_account uuid) returns uuid`:
    - `for update`; se `pagata_il is not null`, `raise exception 'scadenza già pagata'`;
    - cerca, o crea, la categoria personale di spesa `'Tasse e contributi'` dell'utente;
    - uscita dal conto e saldo aggiornato;
    - imposta `importo`, `pagata_il` e `transaction_id`.
- **Trigger `before delete` su `transactions`** (`piva_su_elimina_movimento`):
  - `update piva_fatture set data_incasso = null, transaction_id = null where transaction_id = old.id`;
  - `update piva_scadenze set pagata_il = null, transaction_id = null where transaction_id = old.id`.

- [ ] **Passo 1: scrivi il test statico che fallisce**

`tests/migration0010.test.ts`, con lo stesso aiuto `corpo()` di 0009. I test e le loro asserzioni:
- `è racchiusa tra begin; e commit;`
- `crea le tre tabelle con RLS sulle proprie righe`: per ciascuna di `piva_fatture`, `piva_accantonamenti`, `piva_scadenze`:
  - `create table if not exists public.<t>`;
  - `alter table public.<t> enable row level security`;
  - `on public.<t>[\s\S]*?user_id = \(select auth\.uid\(\)\)`.
- `piva_scadenze ha una riga sola per utente, anno e chiave`: `unique \(user_id, anno, chiave\)`, più le 4 chiavi nel check.
- `aggiunge le colonne a piva_settings e promemoria_utente`: tutte e 7 le colonne per nome.
- `ogni RPC è security invoker con search_path`: per le 6 funzioni, il corpo contiene `security invoker` e `set search_path = public`.
- `incassa_fattura e paga_scadenza bloccano la riga e rifiutano il doppio`: il corpo contiene `for update` e `'fattura già incassata'` (o `'scadenza già pagata'`).
- `le RPC rifiutano i conti della casa`: i corpi di `incassa_fattura`, `accantona_tasse`, `paga_scadenza` e `crea_fattura` contengono `household_id is not null` e `'conto non valido'`.
- `il trigger riapre fattura e scadenza quando si elimina il movimento`: `before delete on public.transactions`, più i due `update` sopra.
- `ha il rollback commentato`: righe commentate con `drop table if exists public.piva_fatture`, `drop function if exists public.crea_movimento`, `drop column if exists guidata_dal`.

- [ ] **Passo 2:** `npx vitest run tests/migration0010.test.ts`. Atteso: FAIL (il file non esiste).
- [ ] **Passo 3: scrivi `0010_piva_guidata.sql`** con le interfacce sopra. Intestazione commentata come in 0008: cosa fa, dopo quale migrazione, che è idempotente, dov'è il rollback.
- [ ] **Passo 4:** `npx vitest run tests/migration0010.test.ts`. Atteso: PASS.
- [ ] **Passo 5:** commit `feat(db): migrazione 0010 per la P.IVA guidata`. Nel messaggio a Fabio: "la 0010 va lanciata a mano su Supabase prima di provare i pezzi successivi".

### Task 2: dati P.IVA e aggiunta atomica

**File:**
- Modifica: `src/lib/types.ts` (tipi nuovi e `PivaSettings` esteso), `src/lib/data/pivaSettings.ts`, `src/lib/registraSpesa.ts`, `src/app/add/AddTransactionSheet.tsx`, `src/app/add/page.tsx`, `src/app/in-pari/InPari.tsx`
- Crea: `src/lib/data/piva.ts`
- Test: `tests/data/piva.test.ts`, `tests/data/pivaSettings.test.ts` (estendere), `tests/AddTransactionSheet.test.tsx` (aggiornare), `tests/registraSpesa.test.ts` (creare, o aggiornare se esiste)

**Interfacce:**
- Usa: le RPC del task 1.
- **Produce in `types.ts`:**
  - `PivaSettings` più `contoTasseId: string | null; preset: 'enpap' | 'altro' | null; guidataDal: string | null; stipendioMensile: number | null; stipendioRivistoIl: string | null; incassoMeseMagro: number | null`. Lo stesso per `PivaSettingsInput`.
  - `PivaFattura { id; cliente; importo; dataEmissione; dataIncasso: string | null; transactionId: string | null; nota: string | null }`
  - `PivaAccantonamento { id; transactionId: string | null; importo; data; daAccountId: string | null; aAccountId: string | null }`
  - `ChiaveScadenza = 'f24_giugno' | 'f24_novembre' | 'cassa_acconto' | 'cassa_saldo'`
  - `PivaScadenza { id; anno; chiave: ChiaveScadenza; tipo: 'f24' | 'cassa'; descrizione; data; importo: number | null; pagataIl: string | null; transactionId: string | null; nascosta: boolean }`
- **Produce in `src/lib/data/piva.ts`:**
  - `getFatture(s): Promise<PivaFattura[]>`
  - `creaFattura(s, {cliente, importo, dataEmissione, nota, incassaSu?: {accountId, categoriaId}}): Promise<string>`
  - `incassaFattura(s, id, {data, accountId, categoriaId}): Promise<string>`
  - `updateFattura(s, id, {cliente, importo, dataEmissione, nota})` (solo se non incassata)
  - `deleteFattura(s, id): Promise<number>`
  - `getAccantonamenti(s, {da: string}): Promise<PivaAccantonamento[]>`
  - `accantonaTasse(s, {importo, data, daAccountId, aAccountId, transactionId}): Promise<string>`
  - `annullaAccantonamento(s, id): Promise<number>`
  - `getScadenze(s, anno): Promise<PivaScadenza[]>`
  - `assicuraScadenze(s, righe: Omit<PivaScadenza, 'id' | 'importo' | 'pagataIl' | 'transactionId' | 'nascosta'>[]): Promise<void>`: upsert con `onConflict: 'user_id,anno,chiave', ignoreDuplicates: true`
  - `updateScadenza(s, id, {importo, data})`
  - `nascondiScadenza(s, id, nascosta: boolean)`
  - `pagaScadenza(s, id, {importo, data, accountId}): Promise<string>`
- **Regola sui doppi:** se l'errore Postgres contiene `già incassata` o `già pagata`, i wrapper non lanciano e tornano l'id che già esiste, riletto dalla riga.
- **Produce in `registraSpesa.ts`:** `registraMovimento(s, payload: SpesaPayload, spazio: SpazioSpesa, data?: string): Promise<string>`. Chiama `crea_movimento` con la stessa logica `pagataDaUserId` di oggi. `creaSpesa` e `aggiornaSaldoSpesa` spariscono.

- [ ] **Passo 1: test che falliscono.** Supabase va simulato come nei test di `tests/data/` che esistono già.
  - `incassaFattura chiama incassa_fattura con i parametri giusti`;
  - `incassaFattura su "fattura già incassata" torna l'id esistente senza lanciare`;
  - `assicuraScadenze usa upsert con ignoreDuplicates`;
  - `getPivaSettings legge e mappa le colonne nuove`;
  - `registraMovimento in casa con conto personale passa p_pagata_da`;
  - `registraMovimento personale chiama una sola rpc e nessun adjust_account_balance`;
  - in `AddTransactionSheet.test.tsx`: `un errore al salvataggio lascia il modulo aperto con i campi`, che sostituisce i test su `saldoInSospeso`.
- [ ] **Passo 2:** `npx vitest run tests/data tests/AddTransactionSheet.test.tsx`. Atteso: FAIL.
- [ ] **Passo 3:** implementa le funzioni.
  - `AddTransactionSheet`: togli `saldoInSospeso` e `MESSAGGIO_SALDO`; un salvataggio è una chiamata sola.
  - `add/page.tsx` e `InPari.tsx` usano `registraMovimento`. In InPari, `createRef` serve ancora a non ricreare le righe già salvate.
- [ ] **Passo 4:** `npx vitest run` (tutta la suite). Atteso: PASS.
- [ ] **Passo 5:** commit `feat: dati P.IVA e aggiunta in un passo solo`.

---

## Pezzo 2: impostazione, quota, vaso

### Task 3: calcoli della quota e del vaso

**File:**
- Modifica: `src/lib/calculations/piva.ts`
- Crea: `src/lib/calculations/pivaPreset.ts`
- Test: `tests/calculations/piva.test.ts` (estendere)

**Interfacce prodotte:**
- `PRESET_ENPAP = { coefficienteRedditivita: 78, aliquotaContributoSoggettivo: 10, aliquotaContributoIntegrativo: 2, minimaleContributivoAnnuo: 856 }`
- `DOVE_TROVARLO: Record<'coefficiente'|'aliquota'|'soggettivo'|'integrativo'|'minimale', string>`: una frase ciascuno, scritta dal builder secondo la spec.
- `computePercentualeIncasso(coefficiente: number, aliquotaSostitutiva: number, soggettivo: number, integrativo: number): number`: `coefficiente × (aliquota + soggettivo) / 100 + integrativo`, arrotondata a 1 decimale.
- `computeQuotaIncasso(importo: number, percentuale: number): number`: in euro interi, con `Math.round`.
- `computeStimaAnno(settings: PivaSettings, fatturato: number, oggi: Date): { imposta: number; soggettivo: number; integrativo: number; totale: number }`: compone le funzioni che esistono già, con il minimale.
- `confrontoAnno(stimaTotale: number, messoDaParte: number): { servono: number; messi: number; mancano: number }`. `mancano` non scende mai sotto 0.
- `quoteInSospeso(incassi: Transaction[], accantonamenti: PivaAccantonamento[], percentuale: number, categoriaFatturatoId: string, guidataDal: string | null): { transactionId: string; importo: number; quota: number }[]`:
  - entrate della categoria con `data >= guidataDal`;
  - senza un accantonamento con quel `transactionId`;
  - `guidataDal` null → `[]`.
- `totaleInSospeso(q): number`.

- [ ] **Passo 1: test che falliscono.**
  - `percentuale ENPAP al 5%: 13.7`, con `computePercentualeIncasso(78,5,10,2)`;
  - `percentuale al 15%: 21.5`;
  - `quota di 600 € al 13.7%: 82`;
  - `confronto: servono 4300, messi 3100, mancano 1200`; `mancano mai negativo`;
  - `stima anno applica il minimale 856 se il 10% è più basso`, con fatturato 5000 e coefficiente 78 (soggettivo 390 → 856);
  - `quoteInSospeso esclude incassi prima di guidataDal e quelli già accantonati`;
  - `quoteInSospeso con guidataDal null è vuota`.
- [ ] **Passo 2:** `npx vitest run tests/calculations/piva.test.ts`. Atteso: FAIL.
- [ ] **Passo 3:** implementa.
- [ ] **Passo 4:** stesso comando. Atteso: PASS.
- [ ] **Passo 5:** commit `feat(piva): percentuale per incasso, stima dell'anno, quote in sospeso`.

### Task 4: impostazione guidata

**File:**
- Crea: `src/app/piva/ImpostazioneGuidata.tsx`
- Modifica: `src/app/piva/page.tsx`. Il vecchio `PivaSettingsForm` resta come "Modifica i parametri" da Impostazioni; `PivaDashboard` va rimosso con il suo test.
- Test: `tests/ImpostazioneGuidata.test.tsx`, `tests/PivaPage.test.tsx` (aggiornare)

**Interfacce:**
- Usa: `PRESET_ENPAP`, `DOVE_TROVARLO`, `computeAliquotaSostitutiva`, `computePercentualeIncasso`, `updatePivaSettings` e `createPivaSettings`, `createAccount`.
- Produce: `<ImpostazioneGuidata iniziale={PivaSettings | null} conti={Account[]} categorie={Category[]} onFatto={(input: PivaSettingsInput) => Promise<void>} onAnnulla?={() => void} />`. Salva con `guidataDal = oggiRomaISO()` se era null.

**I 4 passi:**
1. "Che lavoro fai?": `SceltePill` con "Psicologa, ENPAP" e "Altro". Altro non precompila i valori.
2. "Quando hai aperto la P.IVA?": un campo data. Sotto, l'esito: "Primi 5 anni: aliquota 5%" oppure "15%", con la spiegazione di una riga.
3. "Su quale conto metti da parte le tasse?": i conti personali, più "Creane uno". Il conto scelto o creato viene salvato con `contaInDisponibile = false`. Qui si sceglie anche la categoria del fatturato, che già esiste (default: la prima di tipo income con "fattur" o "lavoro" nel nome, altrimenti "Creane una": "Fatture").
4. Riepilogo dei parametri, ognuno con la sua nota "dove lo trovi" e modificabile. Poi la percentuale risultante ("metterai da parte il 13,7% di ogni incasso") e il bottone "Confermo".

- [ ] **Passo 1: test che falliscono.**
  - `con ENPAP il riepilogo mostra 78, 10, 2 e 856`;
  - `data di apertura di 2 anni fa: aliquota 5%`;
  - `il conto scelto viene salvato fuori dal disponibile`;
  - `Confermo salva guidataDal di oggi solo se era vuoto`;
  - in `PivaPage.test.tsx`: `impostazioni vecchie senza conto tasse aprono la guida con i valori salvati`, e `conto tasse eliminato (id che non esiste più tra i conti) riapre la guida al passo 3`.
- [ ] **Passo 2:** `npx vitest run tests/ImpostazioneGuidata.test.tsx tests/PivaPage.test.tsx`. Atteso: FAIL.
- [ ] **Passo 3:** implementa, con una decisione per schermata, `CoverHeader titolo="P.IVA"` e il bottone principale in basso.
- [ ] **Passo 4:** stesso comando. Atteso: PASS.
- [ ] **Passo 5:** commit `feat(piva): impostazione guidata in 4 passi`.

### Task 5: hub, vaso, prompt della quota, riserva

**File:**
- Crea: `src/app/piva/PivaHub.tsx`, `src/app/piva/PromptQuota.tsx`, `src/app/piva/PerchePiva.tsx` (i testi del "Perché?")
- Modifica:
  - `src/app/piva/page.tsx`;
  - `src/lib/calculations/disponibile.ts`: sesto parametro `riservaPiva = 0`;
  - `src/lib/loadHomeData.ts` e `src/app/page.tsx`;
  - `src/app/HomeDashboard.tsx`;
  - `src/app/add/AddTransactionSheet.tsx`;
  - `src/app/history/page.tsx`;
  - `src/lib/calculations/casa/righeNeutre.ts`, oppure un file nuovo `src/lib/calculations/pivaRigheNeutre.ts`.
- Test: `tests/PromptQuota.test.tsx`, `tests/PivaHub.test.tsx`, `tests/calculations/disponibile.test.ts`, `tests/loadHomeData.test.ts`, `tests/AddTransactionSheet.test.tsx`, `tests/HistoryPivaIsolation.test.ts`

**Interfacce:**
- Usa: i task 2 e 3.
- **`PivaHome`** (esportato da `loadHomeData.ts`):

  ```ts
  { contoTasseId: string; categoriaFatturatoId: string; percentuale: number; inSospeso: { transactionId: string; importo: number; quota: number }[]; stipendio: StipendioHome | null }
  ```

  `HomeData.piva: PivaHome | null` vale null se la P.IVA non è attiva o `guidataDal` è vuoto. `StipendioHome` lo definisce il task 10; qui resta `null`.
- `<PromptQuota importo={number} quota={number} contoTasse={string} onFatto={(importoSpostato: number) => Promise<void>} onPiuTardi={() => void} />`. È un `FoglioInferiore`:
  - testo esatto: `Di {importo} metti da parte {quota} sul conto tasse`;
  - importo spostato modificabile;
  - bottoni "Fatto, li ho spostati" e "Più tardi".
- `AddTransactionSheet` prende la prop opzionale `piva?: { categoriaFatturatoId, percentuale, contoTasseId } | null`. Dopo il salvataggio di un'entrata in quella categoria apre `PromptQuota`; per tutti gli altri utenti non cambia niente.
- `righeNeutreAccantonamenti(acc: PivaAccantonamento[]): RigaNeutra[]`: etichetta `Spostato sul conto tasse`, verso `'esce'`, id `pa-{id}`. Le righe si eliminano con `annullaAccantonamento`, tramite `useEliminaConAnnulla`.

**Hub (prima versione):**
- la riga Vaso: saldo del conto tasse e `confrontoAnno` ("Quest'anno servono circa 4.300 €, ne hai messi da parte 3.100 €");
- la lista "Da spostare", con le quote in sospeso, ciascuna con "Fatto";
- il bottone "+ Incasso", che apre il modulo di aggiunta con tipo entrata e categoria del fatturato;
- un link a Impostazioni.
- Il "Perché?" del vaso: la percentuale divisa in imposta, soggettivo e integrativo, il fatturato dell'anno, la frase della stima.

- [ ] **Passo 1: test che falliscono.**
  - `computeDisponibileLibero sottrae riservaPiva`;
  - `loadHomeData con P.IVA spenta: piva null e nessuna lettura di piva_accantonamenti`;
  - `loadHomeData con P.IVA guidata: inSospeso dalle entrate dal guidataDal, anche oltre la finestra di 3 mesi`;
  - `loadHomeData sottrae totaleInSospeso dal disponibile come riservaPiva`;
  - `entrata di categoria fatturato apre il prompt con 82 su 600`;
  - `entrata di altra categoria non apre il prompt`;
  - `Fatto chiama accantonaTasse con conto personale e conto tasse`;
  - `Più tardi chiude e la quota resta in sospeso`;
  - `lo storico mostra Spostato sul conto tasse e non lo conta nei totali`.
- [ ] **Passo 2:** `npx vitest run`. Atteso: FAIL sui test nuovi.
- [ ] **Passo 3:** implementa.
  - `loadHomeData` legge `getPivaSettings` in parallelo con il resto.
  - Solo se la P.IVA è attiva e guidata, legge anche le entrate della categoria dal `guidataDal` e gli accantonamenti dallo stesso giorno.
- [ ] **Passo 4:** `npx vitest run` e `npx next build`. Atteso: PASS e build OK.
- [ ] **Passo 5:** commit `feat(piva): vaso, quota a ogni incasso e riserva nel disponibile`.

---

## Pezzo 3: scadenze

### Task 6: scadenze nel hub

**File:**
- Crea: `src/lib/calculations/pivaScadenze.ts`, `src/app/piva/ScadenzePiva.tsx`
- Modifica: `src/app/piva/page.tsx`, `src/app/piva/PivaHub.tsx`
- Test: `tests/calculations/pivaScadenze.test.ts`, `tests/ScadenzePiva.test.tsx`

**Interfacce:**
- `scadenzeDaCreare(anno: number, guidataDal: string): { anno; chiave; tipo; descrizione; data }[]`:
  - le 4 scadenze con le date di partenza dei vincoli;
  - nell'anno di `guidataDal` solo quelle con `data >= guidataDal`; negli anni dopo tutte e 4.
  - Descrizioni:
    - `F24 di giugno: saldo dell'anno prima e primo acconto`;
    - `F24 di novembre: secondo acconto`;
    - `ENPAP: acconto`;
    - `ENPAP: saldo`.
- `prossimaScadenza(s: PivaScadenza[], oggi: string): PivaScadenza | null`: la prima non pagata e non nascosta con `data >= oggi`.
- `confrontoScadenza(saldoVaso: number, importo: number): { basta: boolean; mancano: number }`.
- `eIlPrimoAnno(guidataDal: string, anno: number): boolean`.
- Il hub chiama `assicuraScadenze(scadenzeDaCreare(annoCorrente, guidataDal))` all'apertura.

**Lista in `ScadenzePiva`:**
- data e descrizione;
- importo, oppure `cifra in arrivo dal commercialista`;
- "Inserisci la cifra", che modifica importo e data;
- dopo la cifra, il confronto: `Nel vaso ci sono {saldo}, servono {importo}`, più `mancano {x}: alziamo la percentuale` se non basta;
- "Pagata", che chiama `pagaScadenza` dal conto tasse;
- "Togli", che nasconde con l'annullamento;
- nel primo anno, una nota sola, chiusa con una frase: "Gli acconti si calcolano sulle tasse dell'anno prima: quest'anno le cifre possono non coincidere con quanto hai messo da parte."

- [ ] **Passo 1: test che falliscono.**
  - `attivata il 17 novembre: solo f24_novembre per quest'anno`;
  - `anno successivo: 4 scadenze`;
  - `prossimaScadenza salta pagate e nascoste`;
  - `confronto 3100 su 3400: mancano 300`;
  - `una scadenza senza importo mostra "cifra in arrivo dal commercialista" e nessuna cifra`;
  - `Pagata due volte non registra due uscite` (secondo tocco disabilitato, wrapper idempotente);
  - `la nota del primo anno compare solo nell'anno di guidataDal`.
- [ ] **Passo 2:** `npx vitest run tests/calculations/pivaScadenze.test.ts tests/ScadenzePiva.test.tsx`. Atteso: FAIL.
- [ ] **Passo 3:** implementa.
- [ ] **Passo 4:** stesso comando. Atteso: PASS.
- [ ] **Passo 5:** commit `feat(piva): scadenze F24 ed ENPAP con confronto sul vaso`.

### Task 7: "Da fare" e notifica

**File:**
- Modifica:
  - `src/lib/calculations/supporto/home.ts`;
  - `src/lib/loadHomeData.ts`;
  - `src/lib/calculations/supporto/notifiche.ts`;
  - `src/lib/data/statoNotifiche.ts`;
  - `src/app/api/promemoria/route.ts`.
- Test: `tests/calculations/supporto/home.test.ts`, `tests/calculations/supporto/notifiche.test.ts`, `tests/data/statoNotifiche.test.ts`, `tests/api/promemoriaRoute.test.ts`

**Interfacce:**
- `Prossimo.tipo` aggiunge `'piva'`.
- `prossimaCosa` riceve `promemoriaPiva: { testo: string; href: string; urgente: boolean }[]`. Ordine: in pari, poi piva urgenti, poi casa, poi piva non urgenti.
- `promemoriaPiva(input: { scadenze: PivaScadenza[]; fatture: PivaFattura[]; inSospeso: number; revisioneStipendio: string | null }, oggi: string)`:
  - **scadenza entro 15 giorni, urgente:** `{descrizione} entro il {giorno mese}`, href `/piva`;
  - **quota da spostare, non urgente:** `Da spostare sul conto tasse: {totale}`;
  - **fatture oltre 60 giorni, non urgente:** `{n} fatture aspettano da più di 60 giorni`;
  - **revisione dello stipendio:** la stringa la produce il task 9; qui resta `null`.
- **`TipoNotifica`** aggiunge `'scadenza'`. `StatoPersona` aggiunge `scadenza: { id: string; descrizione: string; data: string } | null` e `ultimaScadenzaAvvisata: string | null`.
- **In `decidiNotifica`:** subito dopo i controlli del giorno, se `scadenza` c'è, mancano al massimo 7 giorni e `ultimaScadenzaAvvisata !== scadenza.id`, manda la notifica con testo `{descrizione}: scade il {giorno mese}. Controlla il vaso tasse.` e url `/piva`. Ha la precedenza sulle altre.
- **`leggiStatiPersone`** legge per ogni utente la prima `piva_scadenze` non pagata e non nascosta con `data` tra oggi e oggi + 7. La lettura avviene con il client admin, filtrando per `user_id`.
- **La route** scrive `ultima_scadenza_avvisata`.

- [ ] **Passo 1: test che falliscono.**
  - `scadenza fra 10 giorni è urgente e passa davanti alla casa`;
  - `scadenza fra 20 giorni non compare`;
  - `notifica scadenza a 7 giorni`;
  - `notifica scadenza non ripetuta per la stessa scadenza`;
  - `scadenza batte versamento lo stesso giorno`;
  - `leggiStatiPersone filtra le scadenze per utente`;
  - `la route segna ultima_scadenza_avvisata`.
- [ ] **Passo 2:** `npx vitest run tests/calculations/supporto tests/data/statoNotifiche.test.ts tests/api`. Atteso: FAIL.
- [ ] **Passo 3:** implementa.
- [ ] **Passo 4:** stesso comando, poi `npx vitest run`. Atteso: PASS.
- [ ] **Passo 5:** commit `feat(piva): scadenze nel Da fare e notifica 7 giorni prima`.

---

## Pezzo 4: fatture in attesa

### Task 8: fatture

**File:**
- Crea: `src/lib/calculations/pivaFatture.ts`, `src/app/piva/FattureInAttesa.tsx`, `src/app/piva/NuovaFattura.tsx`
- Modifica: `src/app/piva/PivaHub.tsx`, `src/lib/loadHomeData.ts` (fatture vecchie nel "Da fare")
- Test: `tests/calculations/pivaFatture.test.ts`, `tests/FattureInAttesa.test.tsx`, `tests/NuovaFattura.test.tsx`

**Interfacce:**
- `fattureInAttesa(f: PivaFattura[], oggi: string): { totale: number; righe: (PivaFattura & { giorni: number; vecchia: boolean })[] }`:
  - solo quelle con `dataIncasso === null`;
  - ordinate dalla più vecchia;
  - `vecchia` vale `giorni > 60`.
- `<NuovaFattura onSalva={(v: {cliente, importo, dataEmissione, nota, pagataAdesso: boolean}) => Promise<void>} pagataAdessoIniziale={boolean} />`:
  - campi: chi, quanto, data (oggi);
  - interruttore "Pagata adesso".
  - Da "+ Fattura" l'interruttore parte spento. Da "+ Incasso" parte acceso, e `cliente` ha il valore di partenza `Incasso diretto`.
- **"Pagata" su una riga:** sceglie la data (oggi) e il conto (il personale usato l'ultima volta, altrimenti il primo personale nel disponibile). Poi `incassaFattura`, e infine `PromptQuota` con l'entrata creata.
- **La riga del hub:** `Ti devono {totale}`, con `{n} fatture` e `1 da {giorni} giorni` se c'è una fattura vecchia.
- **Il "Perché?" della lista** (testo esatto della spec): "Nel forfettario le tasse si pagano su quello che incassi, non su quello che fatturi. Questa fattura non è ancora soldi tuoi, ma neanche tasse da pagare."
- **Modifica ed eliminazione:** solo per le fatture non incassate; l'eliminazione passa da `useEliminaConAnnulla`. Una fattura incassata mostra "incassata il …" e rimanda allo Storico.
- **"+ Incasso"** del task 5 passa a `NuovaFattura` con `pagataAdessoIniziale`: ogni incasso P.IVA ha la sua fattura.

- [ ] **Passo 1: test che falliscono.**
  - `ordina dalla più vecchia e segna oltre 60 giorni`;
  - `esclude le incassate`;
  - `Pagata adesso chiama creaFattura con incassaSu`;
  - `dopo Pagata si apre il prompt della quota con l'importo della fattura`;
  - `eliminare l'entrata nello storico riporta la fattura in attesa` (il dato riletto ha `dataIncasso` null; il trigger è nel task 1);
  - `una fattura incassata non si modifica`.
- [ ] **Passo 2:** `npx vitest run tests/calculations/pivaFatture.test.ts tests/FattureInAttesa.test.tsx tests/NuovaFattura.test.tsx`. Atteso: FAIL.
- [ ] **Passo 3:** implementa.
- [ ] **Passo 4:** `npx vitest run`. Atteso: PASS.
- [ ] **Passo 5:** commit `feat(piva): fatture in attesa e incasso con un tocco`.

---

## Pezzo 5: stipendio

### Task 9: calcoli dello stipendio

**File:**
- Crea: `src/lib/calculations/stipendio.ts`
- Test: `tests/calculations/stipendio.test.ts`

**Interfacce prodotte:**
- `incassiPerMese(incassi: Transaction[], categoriaFatturatoId: string, oggi: string, mesi: number): number[]`: gli ultimi `mesi` mesi solari interi, escluso quello in corso.
- `speseDelMese(t: Transaction[], contiDisponibile: Set<string>, mese: string): number`: uscite con `accountId` nel set, `goalId === null`, `data` nel mese.
- `propostaStipendio(i: { incassiMensili: number[]; mesiConIncassi: number; percentuale: number; speseMensili: number[]; quotaCasaMensile: number; incassoMeseMagro: number | null }): { a: number | null; b: number; proposta: number | null; serveMeseMagro: boolean }`:
  - con `mesiConIncassi >= 3`, `a = media(incassiMensili) × (1 − percentuale/100)`;
  - altrimenti, se `incassoMeseMagro` non è null, `a = incassoMeseMagro × (1 − percentuale/100)`;
  - altrimenti `a = null` e `serveMeseMagro = true`;
  - `b = media(speseMensili) + quotaCasaMensile`;
  - `proposta = min(a, b)`, oppure null se `a` è null;
  - arrotondamenti a 10 € per difetto.
- `homeConStipendio(i: { disponibileLibero: number; stipendio: number; speseMese: number; versatoCasaMese: number; riservaVersamento: number }): { mostrato: number; rimasto: number; cuscinetto: number; mesiCoperti: number }`:
  - `rimasto = stipendio − speseMese − versatoCasaMese − riservaVersamento`;
  - `mostrato = min(disponibileLibero, rimasto)`;
  - `cuscinetto = max(0, disponibileLibero − rimasto)`;
  - `mesiCoperti = cuscinetto / stipendio`, a 1 decimale.
- `revisioneStipendio(attuale: number, proposta: number | null, rivistoIl: string | null, oggi: string): string | null`:
  - testo solo se sono passati almeno 3 mesi da `rivistoIl` e `|proposta − attuale| / attuale > 0.10`;
  - se la proposta è più alta: `Negli ultimi mesi hai incassato di più: puoi alzare lo stipendio a {proposta}`;
  - se è più bassa: `Negli ultimi mesi sono entrati meno soldi: conviene abbassare lo stipendio a {proposta}`.
- `fineMese(oggi: string): Date`, per il margine.

- [ ] **Passo 1: test che falliscono.**
  - `proposta: incassi netti 1650, servono 1300 → 1300`;
  - `meno di 3 mesi e mese magro 1000 al 13.7% → a 860`;
  - `meno di 3 mesi senza mese magro → serveMeseMagro e proposta null` (mai NaN);
  - `speseDelMese esclude spese collegate a obiettivi e conti fuori dal disponibile`;
  - `Home: disponibile 2900, stipendio 1300, spese 660 → mostrato 640, cuscinetto 2260, mesi 1.7`;
  - `disponibile sotto lo stipendio rimasto → cuscinetto 0`;
  - `revisione solo dopo 3 mesi e oltre il 10%`.
- [ ] **Passo 2:** `npx vitest run tests/calculations/stipendio.test.ts`. Atteso: FAIL.
- [ ] **Passo 3:** implementa.
- [ ] **Passo 4:** stesso comando. Atteso: PASS.
- [ ] **Passo 5:** commit `feat(piva): calcoli di stipendio e cuscinetto`.

### Task 10: stipendio nel hub e nella Home

**File:**
- Crea: `src/app/piva/StipendioPiva.tsx`
- Modifica: `src/app/piva/PivaHub.tsx`, `src/lib/loadHomeData.ts`, `src/app/HomeDashboard.tsx`
- Test: `tests/StipendioPiva.test.tsx`, `tests/loadHomeData.test.ts`, `tests/HomeDashboard.test.tsx` (o il test della Home che esiste)

**Interfacce:**
- Usa: il task 9.
- `StipendioHome = { stipendio: number; rimasto: number; cuscinetto: number; mesiCoperti: number }`. Va dentro `PivaHome.stipendio`.
- Con lo stipendio attivo, `loadHomeData`:
  - mostra `homeConStipendio(...).mostrato` come `disponibileLibero`;
  - calcola `margineGiornaliero` con `fineMese(oggi)` come `dataTarget`;
  - aggiunge `revisioneStipendio` a `promemoriaPiva`;
  - prende `versatoCasaMese` dallo stato della casa (quanto ha già versato nel mese corrente), con 0 se non c'è la casa.
- **`StipendioPiva`:**
  - mostra A, B e la proposta ("Il resto, {a − proposta} al mese, riempie il cuscinetto.");
  - "Va bene" salva `stipendioMensile` e `stipendioRivistoIl = oggi`;
  - "Cambia" apre un campo;
  - con `serveMeseMagro` fa una domanda sola: "In un mese magro, quanto incassi più o meno?"
- **La riga del hub:** `Stipendio di questo mese {stipendio} (te ne restano {rimasto})` e `Cuscinetto {cuscinetto} copre {mesiCoperti} mesi`.
- **Cuscinetto vuoto:** la Home mostra, con calma, "Il cuscinetto è vuoto: questo mese lo stipendio supera quello che hai. Rivediamolo?" con un link a `/piva`.

- [ ] **Passo 1: test che falliscono.**
  - `senza stipendio la Home è identica a prima` (snapshot dei numeri con P.IVA spenta e con P.IVA senza stipendio);
  - `con stipendio il disponibile è il minore e il margine va a fine mese`;
  - `Va bene salva stipendio e data`;
  - `senza storico chiede il mese magro`;
  - `cuscinetto vuoto mostra l'avviso con link a /piva`.
- [ ] **Passo 2:** `npx vitest run tests/StipendioPiva.test.tsx tests/loadHomeData.test.ts`. Atteso: FAIL.
- [ ] **Passo 3:** implementa.
- [ ] **Passo 4:** `npx vitest run` e `npx next build`. Atteso: PASS e build OK.
- [ ] **Passo 5:** commit `feat(piva): stipendio fisso, cuscinetto e Home`.

---

## Pezzo 6: finitura

### Task 11: anteprima, revisione impeccable, documentazione

**File:**
- Modifica: `src/app/anteprima/page.tsx` (vista `piva`, più `piva-guida` e `piva-scadenze`), `src/app/anteprima/VisteProva.tsx` (i dati di prova), `docs/ROADMAP.md`, `DESIGN.md` e `.impeccable/design.json` (solo se nascono componenti nuovi)

- [ ] **Passo 1:** aggiungi le viste di prova con i dati di Miriam inventati:
  - percentuale 13,7%;
  - vaso 3.100 €, anno 4.300 €;
  - 3 fatture, di cui una da 90 giorni;
  - stipendio 1.300 €.
- [ ] **Passo 2:** avvia "dev-webpack" (`.claude/launch.json`) e controlla `/anteprima?vista=piva`, `piva-guida` e `piva-scadenze` a 375 px. Atteso: nessun errore in console, testo leggibile, nessuno scorrimento orizzontale.
- [ ] **Passo 3:** revisione con `impeccable:impeccable-finish-reviewer` sul mondo "Il Libretto". Applica le correzioni materiali.
- [ ] **Passo 4: ROADMAP.**
  - Segna il pezzo 2 come fatto, con data e commit.
  - Aggiungi tra i resti le cose emerse in revisione, che Fabio deve controllare: la 0010 lanciata, i valori ENPAP da verificare, le regole ENPAP che cambiano dal prossimo anno.
- [ ] **Passo 5:** `npx vitest run` e `npx next build`. Atteso: tutto verde.
- [ ] **Passo 6:** commit `docs: P.IVA guidata fatta`, con push.
