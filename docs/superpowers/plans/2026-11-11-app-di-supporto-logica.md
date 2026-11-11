# App di supporto: logica, dati e notifiche (piano A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** costruire tutto ciò che non dipende dall'aspetto: prova delle notifiche, migrazione 0009, calcoli (andamento, consiglio, categoria, gestore, notifiche, saldo da Tricount), dati e cron delle notifiche.

**Architecture:**
- I calcoli nuovi sono funzioni pure in `src/lib/calculations/supporto/`, testate con vitest come quelle di `casa/`.
- I dati passano da `src/lib/data/` come oggi.
- Le notifiche partono da una route cron protetta da `CRON_SECRET`, che usa la chiave `service_role` solo sul server e la libreria `web-push`.
- Le schermate (pezzi 1-4 lato UI) stanno nel **piano B**. Si scrive dopo `DESIGN.md`, perché deve seguirne i componenti.

**Tech Stack:** Next.js 16.3.3, React 19, Supabase (`@supabase/supabase-js` 2.x, `@supabase/ssr`), vitest 4, `web-push` (nuova dipendenza).

**Spec:** `docs/superpowers/specs/2026-11-11-app-di-supporto-design.md`. Leggere anche la sezione "Precisazioni dopo la verifica del documento".

## Global Constraints

- Leggere `node_modules/next/dist/docs/` prima di toccare route, service worker o manifest (`AGENTS.md`).
- Migrazioni: solo il nuovo `supabase/migrations/0009_supporto_e_notifiche.sql`. Le migrazioni dalla 0001 alla 0008 non si toccano. Fabio lancia la 0009 a mano.
- Piano gratuito: Supabase e Vercel. Nessuna integrazione Google.
- `service_role`: solo in `process.env.SUPABASE_SERVICE_ROLE_KEY`, letta solo dalla route cron. Mai con prefisso `NEXT_PUBLIC_`, mai importata da codice client.
- VAPID: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (pubblica), `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` solo sul server.
- Giorni e mesi: calendario Europe/Rome con `oggiRomaISO` e `meseRomaISO` (`src/lib/calculations/casa/oggi.ts`). Mai differenze di ore.
- Testi in italiano semplice, senza gergo né colpa. Le parole vietate di `tests/helpers/paroleVietate.ts` e le frasi vietate di `tests/casaTesti.test.ts` valgono anche per `src/lib/calculations/supporto/`.
- Limiti delle notifiche:
  - al massimo 1 per persona al giorno, per tipo e in tutto;
  - "spese": dopo 2 giorni di calendario senza transazioni create, al massimo una ogni 3 giorni;
  - "check-in": al massimo una ogni 3 giorni;
  - "versamento": una al mese, dal giorno N-3.
- Soglie dei consigli: senza dettaglio oltre il 20% dello speso del mese; categoria sopra il solito di almeno il 25% e di almeno 30 €; confronto sugli ultimi 3 mesi completi.
- Commit e push diretti su master a ogni task. Si committano solo i file del task, mai `.impeccable/hook.cache.json`.
- Agenti: haiku per i calcoli piccoli, sonnet per soldi, sicurezza e cron, opus solo per la revisione finale. Ogni prompt dice di seguire `/caveman:caveman`.

## Review Focus

1. **Più dispositivi.** Una persona con 2 iscrizioni riceve la stessa notifica su tutti e due, ma conta come una sola per il limite (Task 7 e Task 9).
2. **Cron che gira due volte lo stesso giorno** (ritentativo di Vercel): nessuna notifica doppia, perché `ultima_*_il = oggi` blocca (Task 7).
3. **Persona senza nessuna transazione mai creata:** nessuna notifica "spese", perché non c'è niente da recuperare (Task 7).
4. **Stima modificata:** se le si dà una categoria, `stima` diventa `false`. Se si cambia solo l'importo, resta `true` (Task 2).
5. **Andamento il giorno 1 o a mese vuoto:** `spesoFinora` vale 0 e la frase resta corretta. Con meno di un mese completo `solito` vale `null` (Task 4).

---

### Task 0: prova delle notifiche (usa e getta, poi si toglie al Task 10)

**Files:**
- Create: `public/sw.js` (resta: lo usa il Task 9)
- Create: `src/app/prova-notifiche/page.tsx`, `src/app/prova-notifiche/actions.ts` (da togliere)
- Modify: `package.json` (`web-push`, `@types/web-push`)

**Interfaces:**
- Produces: `public/sw.js`.
  - Su `push`: `self.registration.showNotification(data.titolo, { body: data.testo, data: { url: data.url } })`.
  - Su `notificationclick`: apre o mette a fuoco `data.url`.
  - Non mette in cache niente.

- [ ] **Step 1:** leggere la guida PWA e le notifiche in `node_modules/next/dist/docs/`. Confermare dove va il service worker e come si registra in Next 16.
- [ ] **Step 2:** `npm install web-push` e `npm install -D @types/web-push`.
- [ ] **Step 3:** scrivere `public/sw.js` come da Interfaces.
- [ ] **Step 4:** scrivere la pagina `/prova-notifiche`, visibile solo con login (`utenteOLogin`).
  - Un pulsante "Manda una notifica di prova".
  - Al tocco: registra il service worker, chiede il permesso, crea l'iscrizione con `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
  - Poi chiama la server action `mandaProva(iscrizione)`, che usa `webpush.sendNotification` con titolo "Prova", testo "Se leggi questo, le notifiche funzionano." e url `/`.
  - Mostra l'esito in chiaro, compreso l'errore con il suo `statusCode`.
- [ ] **Step 5:** generare le chiavi con `npx web-push generate-vapid-keys`. Scrivere a Fabio i 3 nomi di variabile da aggiungere su Vercel (Production). Le chiavi si passano solo fuori dalla chat, mai nel repository.
- [ ] **Step 6:** `npm run build`. Expected: build ok.
- [ ] **Step 7:** commit e push.

```bash
git add public/sw.js src/app/prova-notifiche package.json package-lock.json
git commit -m "spike: prova delle notifiche sul telefono"
```

- [ ] **Step 8, verifica manuale di Fabio:** su iPhone, con l'app aperta dalla schermata Home, va su `/prova-notifiche` e tocca il pulsante.
  - **Risultato atteso:** la notifica arriva anche ad app chiusa.
  - **Se non arriva:** annotarlo nella ROADMAP. Il Task 9 costruisce lo stesso le decisioni, ma il piano B mostra i promemoria in cima alla Home invece di mandarli.

### Task 1: migrazione 0009

**Files:**
- Create: `supabase/migrations/0009_supporto_e_notifiche.sql`
- Test: `tests/migration0009.test.ts` (sul modello di `tests/migration0008.test.ts`)

**Interfaces:**
- Produces:
  - `push_iscrizioni(id uuid pk, user_id uuid not null default auth.uid() → auth.users on delete cascade, endpoint text not null unique, p256dh text not null, auth text not null, created_at timestamptz default now())`.
  - `promemoria_utente(user_id uuid pk default auth.uid() → auth.users on delete cascade, notifiche_attive boolean null, ultima_spese_il date, ultima_checkin_il date, ultimo_versamento_mese date, nessuna_spesa_fino_al date)`.
  - `transactions.stima boolean not null default false`.
  - `transfers.causale` accetta anche `'saldo_iniziale'`.
  - `public.record_saldo_iniziale(p_household uuid, p_creditore uuid, p_debitore uuid, p_importo numeric) returns uuid`, `security definer`, `set search_path = public`.

- [ ] **Step 1: test che falliscono.** Leggere il file come fa `migration0008.test.ts`, togliendo i commenti, e verificare:

```ts
it('crea push_iscrizioni con endpoint unico e RLS sulle proprie righe', () => {
  expect(codice).toMatch(/create table if not exists public\.push_iscrizioni/);
  expect(codice).toMatch(/endpoint text not null unique/);
  expect(codice).toMatch(/alter table public\.push_iscrizioni enable row level security/);
  expect(codice).toMatch(/on public\.push_iscrizioni[\s\S]*?user_id = \(select auth\.uid\(\)\)/);
});
it('crea promemoria_utente con RLS sulle proprie righe', () => { /* stesso schema */ });
it('aggiunge transactions.stima false di default', () => {
  expect(codice).toMatch(/alter table public\.transactions add column if not exists stima boolean not null default false/);
});
it('estende la causale dei trasferimenti con saldo_iniziale', () => {
  expect(codice).toMatch(/'saldo_iniziale'/);
});
it('record_saldo_iniziale controlla membri attivi, persone diverse e un solo saldo per casa', () => {
  const f = corpo(codice, 'record_saldo_iniziale');
  expect(f).toMatch(/security definer/);
  expect(f).toMatch(/p_creditore = p_debitore/);
  expect(f).toMatch(/attivo/);
  expect(f).toMatch(/causale = 'saldo_iniziale'/); // già presente → eccezione
  expect(f).toMatch(/solo_registrazione/);
});
it('ha in fondo la parte per tornare indietro, commentata', () => {
  expect(sql).toMatch(/-- drop table if exists public\.push_iscrizioni/);
});
```

- [ ] **Step 2:** `npx vitest run tests/migration0009.test.ts`. Expected: FAIL, file mancante.
- [ ] **Step 3: scrivere la 0009.** Note:
  - **Causale.** Il nome del vincolo di `transfers.causale` va trovato nel catalogo (`pg_constraint`) come fa la 0004 alle righe 172-177. Va tolto e ricreato con `'saldo_iniziale'`.
  - **Vincolo `per_conto_di`.** Va allargato allo stesso modo: `per_conto_di_user_id` e `beneficiario_user_id` insieme sono ammessi anche con `'saldo_iniziale'`.
  - **`record_saldo_iniziale`:**
    - chi chiama, `p_creditore` e `p_debitore` sono membri attivi di `p_household`;
    - `p_creditore <> p_debitore` e `p_importo > 0`;
    - non esiste già un trasferimento `saldo_iniziale` per la casa;
    - inserisce `user_id = auth.uid()`, `beneficiario_user_id = p_creditore`, `per_conto_di_user_id = p_debitore`, `solo_registrazione = true`, `data = oggi` (Europe/Rome), conti null.
  - Le policy di `push_iscrizioni` e `promemoria_utente` sono `select`, `insert`, `update` e `delete` con `user_id = (select auth.uid())`.
- [ ] **Step 4:** `npx vitest run tests/migration0009.test.ts`. Expected: PASS.
- [ ] **Step 5:** commit e push (`feat: migrazione 0009, notifiche, stime e saldo da Tricount`). Nel messaggio a Fabio: "Lancia la 0009 nel SQL editor prima del Task 9."

### Task 2: dati, stima e chi ha creato la casa

**Files:**
- Modify: `src/lib/types.ts` (`Transaction.stima: boolean`, `Household.createdBy: string`, `TransferCausale` più `'saldo_iniziale'`)
- Modify: `src/lib/data/transactions.ts` (`TRANSACTION_COLUMNS` più `stima`, `mapRow`, `createTransaction`, `updateTransaction`)
- Modify: `src/lib/data/households.ts` (select di `created_by`)
- Modify: i fake in `tests/helpers/`, se mappano le colonne
- Test: `tests/data/transactions.test.ts`, `tests/data/households.test.ts` (aggiungere ai file esistenti o crearli)

**Interfaces:**
- Produces:
  - `createTransaction(supabase, input & { stima?: boolean }, scope)`: scrive `stima: input.stima ?? false`.
  - `updateTransaction(supabase, id, input)`: scrive `stima: false` solo quando `input.categoriaId !== null`. Altrimenti non tocca la colonna.
  - `Household.createdBy`.

- [ ] **Step 1: test che falliscono.**
  - `createTransaction con stima true la scrive`;
  - `createTransaction senza stima scrive false`;
  - `updateTransaction con categoria toglie la stima`;
  - `updateTransaction senza categoria non manda stima` (il payload di update non ha la chiave `stima`);
  - `getMyHousehold mappa created_by in createdBy`.
- [ ] **Step 2:** `npx vitest run tests/data`. Expected: FAIL.
- [ ] **Step 3:** implementare come da Interfaces.
- [ ] **Step 4:** `npm test` e `npx tsc --noEmit`. Expected: tutto verde. Se qualche test esistente costruisce `Transaction` o `Household` a mano, aggiornare le fixture con `stima: false` e `createdBy`.
- [ ] **Step 5:** commit e push (`feat: stima sulle transazioni e chi ha creato la casa`).

### Task 3: categoria indovinata

**Files:**
- Create: `src/lib/calculations/supporto/indovinaCategoria.ts`
- Modify: `tests/casaTesti.test.ts` (`CARTELLE` più `'src/lib/calculations/supporto'`)
- Test: `tests/calculations/supporto/indovinaCategoria.test.ts`

**Interfaces:**
- Produces: `indovinaCategoria(descrizione: string, storico: Pick<Transaction,'descrizione'|'categoriaId'|'data'|'tipo'>[], oggi: string): string | null`.
  - Si considerano solo le righe `tipo === 'expense'`.
  - Si confronta la descrizione dopo `trim` e minuscole.
  - Se c'è una spesa con la stessa descrizione e una categoria, vale la categoria della più recente.
  - Altrimenti vale la categoria più frequente fra le spese con `data` negli ultimi 30 giorni, `oggi` compreso. A parità vince la più recente.
  - Altrimenti `null`.

- [ ] **Step 1: test.**
  - `stessa descrizione → categoria della più recente`;
  - `descrizione nuova → la più usata negli ultimi 30 giorni`;
  - `spese più vecchie di 30 giorni non contano`;
  - `nessuna spesa → null`;
  - `le entrate non contano`;
  - `"  Esselunga " e "esselunga" sono uguali`.
- [ ] **Step 2:** eseguire. Expected: FAIL.
- [ ] **Step 3:** implementare.
- [ ] **Step 4:** `npx vitest run tests/calculations/supporto tests/casaTesti.test.ts`. Expected: PASS.
- [ ] **Step 5:** commit e push (`feat: categoria indovinata per l'aggiunta veloce`).

### Task 4: andamento del mese

**Files:**
- Create: `src/lib/calculations/supporto/andamento.ts`
- Test: `tests/calculations/supporto/andamento.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Andamento {
  spesoFinora: number;            // spese del mese di oggi fino a oggi compreso
  solito: number | null;          // media dello speso allo stesso giorno nei mesi completi, null se 0 mesi
  mesiConfronto: number;          // 0..3
  curva: { giorno: number; mese: number; solito: number | null }[]; // dal giorno 1 a oggi, cumulato
  perCategoria: { categoriaId: string | null; mese: number; solito: number | null }[];
}
export function calcolaAndamento(spese: Pick<Transaction,'tipo'|'importo'|'data'|'categoriaId'>[], oggi: string): Andamento;
```

- Solo `tipo === 'expense'`. Le stime contano: arrivano già come spese.
- **Mesi di confronto:** i 3 mesi di calendario prima di quello di oggi. Un mese conta solo se esiste almeno una spesa in quel mese o prima. Così un utente nuovo non confronta con mesi vuoti.
- **Giorno di confronto:** `min(giorno di oggi, ultimo giorno di quel mese)`.
- **Arrotondamento:** a 2 decimali, come `arrotonda` in `casa/`.

- [ ] **Step 1: test.**
  - `giorno 10 con 3 mesi pieni → solito = media degli speso fino al 10`;
  - `31 gennaio confronta con il 31 dicembre, il 30 novembre e il 31 ottobre`;
  - `utente con spese solo dal mese scorso → mesiConfronto 1`;
  - `nessun mese precedente → solito null, mesiConfronto 0`;
  - `giorno 1 senza spese → spesoFinora 0`;
  - `le entrate non contano`;
  - `perCategoria separa le spese senza categoria (categoriaId null)`.
- [ ] **Step 2:** eseguire. Expected: FAIL.
- [ ] **Step 3:** implementare.
- [ ] **Step 4:** eseguire. Expected: PASS.
- [ ] **Step 5:** commit e push (`feat: andamento del mese rispetto al solito`).

### Task 5: consiglio

**Files:**
- Create: `src/lib/calculations/supporto/consiglio.ts`
- Test: `tests/calculations/supporto/consiglio.test.ts`

**Interfaces:**
- Consumes: `Andamento` (Task 4); `computeQuotaMensile` e `computeAccantonatoFinora` (`src/lib/calculations/accantonato.ts`).
- Produces:

```ts
export type TipoConsiglio = 'senza_dettaglio' | 'categoria_sopra' | 'obiettivo_corto' | 'in_linea';
export interface Consiglio { tipo: TipoConsiglio; testo: string; perche: string; categoriaId?: string; goalId?: string }
export function scegliConsiglio(input: {
  andamento: Andamento;
  spesoStime: number;                     // somma delle spese del mese con stima = true
  nomiCategorie: Record<string, string>;
  obiettiviCorti: { goalId: string; nome: string; mancano: number }[]; // calcolati da chi chiama
  oggi: string;
}): Consiglio;
export function obiettiviCorti(goals: GoalWithSpeso[], saldoDisponibile: number, oggi: Date): { goalId: string; nome: string; mancano: number }[];
```

- **Ordine:** la prima regola che vale vince.
  1. `spesoStime > 0.2 * andamento.spesoFinora` → `senza_dettaglio`.
  2. La categoria con `mese - solito` più alta, con `solito` non `null`, `mese >= solito * 1.25` e `mese - solito >= 30` → `categoria_sopra`.
  3. `obiettiviCorti` non vuoto → `obiettivo_corto`, sul primo.
  4. Altrimenti `in_linea`.
- **Testi** dalla tabella dello spec. Importi con `formatEuro` senza `,00`, come `euroInFrase` in `HomeDashboard`.
  - Consiglio 3: "Per {nome} mancano {mancano} €. Mettendone da parte un po' ogni mese ci arrivi senza fretta."
  - Consiglio 4: "Il mese va come al solito." In più una frase da `docs/research/2026-11-08-economia-domestica.md`, scelta fra 4 brevi in base al mese, così cambia senza caso.
- **`perche`:** 1-2 frasi che spiegano il numero, per il pulsante "Perché?".
- **`obiettiviCorti`:** sono gli obiettivi `dilazionato` aperti con scadenza in cui `computeQuotaMensile(goal, oggi)` moltiplicata per i mesi rimasti non copre `importoTarget - accantonato`. Usare le funzioni esistenti di `accantonato.ts`: leggerle prima. Se la regola non si scrive senza ambiguità con quelle funzioni, ripiegare su "scadenza entro 60 giorni e accantonato sotto il 50%". Annotarlo nel commit.

- [ ] **Step 1: test.**
  - `stime al 25% → senza_dettaglio con l'importo nel testo`;
  - `stime al 20% esatto non bastano`;
  - `categoria +25% e +30 € → categoria_sopra con il nome`;
  - `+40% ma solo +20 € → non scatta`;
  - `solito null → regola 2 saltata`;
  - `obiettivo corto → obiettivo_corto`;
  - `niente → in_linea`;
  - `nessun testo contiene parole vietate` (importare `PAROLE_VIETATE`).
- [ ] **Step 2:** eseguire. Expected: FAIL.
- [ ] **Step 3:** implementare.
- [ ] **Step 4:** eseguire più `tests/casaTesti.test.ts`. Expected: PASS.
- [ ] **Step 5:** commit e push (`feat: un consiglio alla volta dai numeri del mese`).

### Task 6: chi gestisce la casa

**Files:**
- Create: `src/lib/calculations/supporto/gestore.ts`
- Test: `tests/calculations/supporto/gestore.test.ts`

**Interfaces:**
- Consumes: `Household.createdBy` (Task 2), `HouseholdMember`.
- Produces: `chiGestisce(household: Pick<Household,'createdBy'>, members: HouseholdMember[]): string | null`.
  - Restituisce `createdBy` se è un membro attivo.
  - Altrimenti il membro attivo con `joinedAt` minore.
  - Senza membri attivi, `null`.

- [ ] **Step 1: test.**
  - `il creatore attivo gestisce`;
  - `creatore uscito → il primo entrato fra gli attivi`;
  - `tre membri → uno solo gestisce`;
  - `nessun attivo → null`.
- [ ] **Steps 2-4:** eseguire, implementare, eseguire. Expected prima FAIL, poi PASS.
- [ ] **Step 5:** commit e push (`feat: chi gestisce la casa`).

### Task 7: decisioni delle notifiche

**Files:**
- Create: `src/lib/calculations/supporto/notifiche.ts`
- Test: `tests/calculations/supporto/notifiche.test.ts`

**Interfaces:**
- Produces:

```ts
export type TipoNotifica = 'spese' | 'checkin' | 'versamento';
export interface Notifica { tipo: TipoNotifica; titolo: string; testo: string; url: string }
export interface StatoPersona {
  userId: string;
  iscritta: boolean;                 // almeno una riga in push_iscrizioni
  notificheAttive: boolean | null;
  ultimaCreazione: string | null;    // giorno Europe/Rome dell'ultima transazione creata, ogni spazio
  ultimaSpeseIl: string | null;
  ultimaCheckinIl: string | null;
  ultimoVersamentoMese: string | null; // 'YYYY-MM-01'
  nessunaSpesaFinoAl: string | null;
  gestisce: boolean;
  checkinDaFare: string | null;      // mese da controllare (da meseDaControllare), solo se gestisce
  versamento: { giorno: number; importo: number; versato: number; mese: string } | null;
}
export function decidiNotifica(p: StatoPersona, oggi: string): Notifica | null;
export function periodoDaRecuperare(ultimaCreazione: string | null, nessunaSpesaFinoAl: string | null, oggi: string): { dal: string; al: string } | null;
```

- **Regole.** Si restituisce **una sola** notifica, al massimo, in quest'ordine: versamento, check-in, spese. Il limite di una al giorno per persona sta qui.
  - **Requisiti per tutte:** `iscritta && notificheAttive === true`. Se una qualsiasi `ultima*Il === oggi`, nessuna notifica (cron ripetuto).
  - **Versamento:** serve `versamento` non `null` e `versato < importo`. `ultimoVersamentoMese` deve essere diverso da `versamento.mese`, e il giorno di oggi deve stare fra `max(1, giorno - 3)` e `giorno`, compresi.
    - Testo: "La tua quota di {mese}: {importo} € entro il {giorno}."
    - URL: `/casa`.
  - **Check-in:** servono `gestisce`, `checkinDaFare` e `ultimaCheckinIl` nullo o di almeno 3 giorni fa.
    - Testo: "{Mese} è chiuso: controlliamolo in 2 minuti."
    - URL: `/casa/controllo`.
  - **Spese:** servono `ultimaCreazione` non nullo e `periodoDaRecuperare` non nullo, cioè l'ultimo giorno coperto, `max(ultimaCreazione, nessunaSpesaFinoAl)`, è almeno 2 giorni prima di oggi. Serve anche `ultimaSpeseIl` nullo o di almeno 3 giorni fa.
    - Testo dello spec: "Sono due giorni senza spese segnate. Ti va di rimetterti in pari? Ci vuole un minuto."
    - URL: la route del riepilogo, che si chiama `/in-pari`. Il piano B usa lo stesso nome.
- **`periodoDaRecuperare`:** dal giorno dopo l'ultimo coperto fino a oggi. `null` se l'ultimo coperto è ieri o oggi, o se `ultimaCreazione` è nullo.

- [ ] **Step 1: test.** Usare date fisse, per esempio `oggi = '2026-11-11'`.
  - `ultima transazione il 9 → spese, periodo dal 10 all'11`;
  - `ultima il 10 → niente`;
  - `nessuna transazione mai → niente`;
  - `"non ho speso" fino al 10 → niente`;
  - `spese mandata l'8 → il 10 niente, l'11 sì` (3 giorni di calendario dall'8 = 11);
  - `già mandata oggi (ultima*Il = oggi) → niente`;
  - `versamento il 5: dal 2 al 5 sì, il 1 no, il 6 no`;
  - `versamento già versato → niente`;
  - `versamento e spese insieme → solo versamento`;
  - `check-in solo a chi gestisce`;
  - `notificheAttive false o null → niente`;
  - `non iscritta → niente`;
  - `nessun testo con parole vietate`.
- [ ] **Steps 2-4:** eseguire, implementare, eseguire. Expected prima FAIL, poi PASS.
- [ ] **Step 5:** commit e push (`feat: quando mandare una notifica, e quale`).

### Task 8: saldo da Tricount nei debiti fra membri

**Files:**
- Modify: `src/lib/calculations/casa/debitiMembri.ts`
- Modify: `src/lib/data/transfers.ts` (nuova `registraSaldoIniziale`)
- Test: `tests/calculations/casa/debitiMembri.test.ts`, `tests/data/transfers.test.ts`

**Interfaces:**
- Consumes: `record_saldo_iniziale` (Task 1), `TransferCausale` più `'saldo_iniziale'` (Task 2).
- Produces:
  - `registraSaldoIniziale(supabase, input: { householdId: string; creditoreId: string; debitoreId: string; importo: number }): Promise<string>`, tramite `supabase.rpc('record_saldo_iniziale', …)`.
  - `debitiMembri`: un trasferimento `saldo_iniziale` vale come prestato da `beneficiarioUserId` a `perContoDiUserId`, nel mese di `data`.

- [ ] **Step 1: test.**
  - `saldo_iniziale crea un debito del debitore verso il creditore`;
  - `una restituzione successiva lo copre`;
  - `saldo_iniziale non cambia crediti verso la casa né disponibile casa` (passarlo a `creditiPerMembro` e al calcolo di `disponibileCasa` e verificare i valori invariati);
  - `registraSaldoIniziale chiama la rpc con i nomi dei parametri`.
- [ ] **Steps 2-4:** eseguire, implementare, eseguire. Expected prima FAIL, poi PASS. Poi `npm test`.
- [ ] **Step 5:** controllare con `grep` le letture dei trasferimenti che filtrano per `causale` (check-in, versamenti, movimenti di casa, storico): `saldo_iniziale` non deve finire in totali di spesa o di versamento. Aggiungere un test dove serve.
- [ ] **Step 6:** commit e push (`feat: saldo di partenza da Tricount`). Revisione con sonnet.

### Task 9: iscrizioni e cron delle notifiche

**Files:**
- Create: `src/lib/data/notifiche.ts` (lato client: iscrizione e risposta al permesso)
- Create: `src/lib/data/statoNotifiche.ts` (lato server: legge e aggiorna con il client `service_role`)
- Create: `src/app/api/promemoria/route.ts`
- Modify: `vercel.json` (cron `{ "path": "/api/promemoria", "schedule": "0 16 * * *" }`)
- Test: `tests/data/notifiche.test.ts`, `tests/api/promemoriaRoute.test.ts` (sul modello di `tests/api/calendarioRoute.test.ts`)

**Interfaces:**
- Consumes: `decidiNotifica` e `StatoPersona` (Task 7); `chiGestisce` (Task 6); `meseDaControllare` (`casa/checkin.ts`); le righe dei versamenti, costruite come in `src/lib/loadCasaStato.ts`; `isAuthorizedCron` (`src/lib/data/keepAlive.ts`); `public/sw.js` (Task 0).
- Produces:
  - `salvaIscrizione(supabase, sub: PushSubscriptionJSON): Promise<void>`: fa upsert su `endpoint`.
  - `rispondiNotifiche(supabase, attive: boolean): Promise<void>`: fa upsert su `promemoria_utente`.
  - `segnaNessunaSpesa(supabase, finoAl: string): Promise<void>`.
  - `leggiStatiPersone(admin, oggi): Promise<{ stato: StatoPersona; iscrizioni: { id: string; endpoint: string; p256dh: string; auth: string }[] }[]>`.
  - `GET /api/promemoria`: risponde `{ inviate: number, rimosse: number }`.

- [ ] **Step 1: test della route.**
  - `senza CRON_SECRET giusto → 401`;
  - `persona da avvisare con 2 iscrizioni → sendNotification chiamato 2 volte, promemoria_utente aggiornato una volta con ultima_spese_il = oggi`;
  - `iscrizione che risponde 410 → cancellata, le altre proseguono`;
  - `errore su una persona non ferma le altre`;
  - `la query sulle transazioni seleziona solo user_id e created_at` (verificare l'argomento di `.select`);
  - `il payload della notifica non contiene importi personali` (la notifica "spese" non ha cifre).
- [ ] **Step 2:** test di `notifiche.ts`: upsert con `onConflict: 'endpoint'` e upsert di `promemoria_utente`.
- [ ] **Step 3:** eseguire. Expected: FAIL.
- [ ] **Step 4: implementare.**
  - Il client admin si crea con `createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })` dentro la route, mai in un modulo importabile dal client.
  - Ultima creazione per persona: `max(created_at)` portato a giorno Europe/Rome, leggendo a pagine con `leggiTutte` solo `user_id, created_at`.
  - Gestore e versamenti: per ogni casa attiva con membri iscritti.
  - Invio con `webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)`, poi `sendNotification(sub, JSON.stringify({ titolo, testo, url }))`.
  - Dopo almeno un invio riuscito si aggiorna il campo `ultima_*` del tipo mandato, oppure `ultimo_versamento_mese`.
- [ ] **Step 5:** eseguire, poi `npm test`, `npx tsc --noEmit`, `npm run build`. Expected: tutto verde.
- [ ] **Step 6:** revisione di sicurezza con sonnet. Controlla: la chiave `service_role` non arriva al bundle client (cercare `SUPABASE_SERVICE_ROLE_KEY` in `.next/static` dopo il build: zero risultati), il segreto del cron, le colonne lette, i dati personali nei testi.
- [ ] **Step 7:** commit e push (`feat: notifiche dei promemoria`). Scrivere a Fabio cosa aggiungere a Vercel:
  - `SUPABASE_SERVICE_ROLE_KEY`, presa da Supabase in Project Settings, API;
  - `CRON_SECRET`, se manca.

### Task 10: togliere la prova e aggiornare la roadmap

**Files:**
- Delete: `src/app/prova-notifiche/`
- Modify: `docs/ROADMAP.md` (blocco 2: piano A fatto, esito della prova su iPhone, piano B da scrivere dopo `DESIGN.md`)

- [ ] **Step 1:** cancellare la cartella. `npm run build`. Expected: build ok, nessun riferimento rimasto.
- [ ] **Step 2:** aggiornare la ROADMAP.
- [ ] **Step 3:** commit e push (`chore: via la prova delle notifiche, roadmap aggiornata`).
- [ ] **Step 4:** revisione finale di tutto il piano A con opus.

## Dopo il piano A

Il blocco 2 prosegue così:
1. `PRODUCT.md`;
2. audit con `/impeccable:impeccable`;
3. `DESIGN.md`;
4. **piano B**: le schermate dei pezzi 1-4 dello spec, cioè foglio di aggiunta veloce, Home con andamento e consiglio, Casa con "Da fare" e "Dettagli", vista della compagna, pagina `/in-pari`, scheda del permesso e passaggio da Tricount;
5. le eliminazioni con annullamento;
6. la palette.
