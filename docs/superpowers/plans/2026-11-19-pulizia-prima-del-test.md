# Pulizia prima del test da zero: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chiudere tutte le voci aperte della ROADMAP prima che Fabio riparta da zero con dati veri. Fabio, il 19 novembre 2026, ha detto: "sistema tutto".

**Architecture:**
- Una migrazione 0012 raccoglie tutte le modifiche SQL. Sono solo aggiunte, e la lancia Fabio prima che il codice nuovo vada su master.
- Il resto sono correzioni nei file indicati dalla mappa, ognuna con test vitest.
- Una sola funzione nuova: la conferma dei versamenti sugli obiettivi a scadenza.

**Tech Stack:** Next.js 16.3.3 (App Router, server actions), React, TypeScript, Tailwind, Supabase (Postgres, RLS, rpc), vitest + Testing Library.

**Spec:** questo piano e la mappa verificata sul codice, `docs/superpowers/plans/2026-11-19-pulizia-mappa.md`. La mappa riporta per ogni voce (C1…C9, B-1, B-2, B2-1…3, D1…D5, P1…P13, p1…p10, K1…K4) dove sta, la causa e la correzione. Le decisioni di Fabio sono qui sotto. Valgono le spec precedenti: `docs/superpowers/specs/2026-11-19-percorso-apprendimento-design.md`, `2026-11-17-piva-guidata-design.md`, `2026-11-08-co-gestione-casa-design.md`, `2026-11-11-app-di-supporto-design.md`.

## Decisioni

Decisioni di Fabio (19 novembre 2026):
- **K1 Conferma versamento: sì.** Vale solo per gli obiettivi dove si è confermato almeno un versamento, e gli altri restano come oggi.
- **P9 Stipendio oltre quello che c'è:** in hub e Home "0 €" più una frase calma con l'eccedenza ("Hai già speso 120 € più dello stipendio di questo mese."). Mai un numero negativo.
- **P3 Incasso eliminato con quota già spostata:** l'app chiede con un tocco: "La quota di X € è nel conto tasse. La riporto indietro?" Sì, oppure No.
- **P5 Cambio categoria del fatturato:** si riparte da oggi. Solo gli incassi da oggi in poi chiedono la quota.

Scelte di Claude, che Fabio può correggere:
- **C4:** il puntino sulla barra compare dopo che Home o Casa hanno caricato i promemoria. Niente lettura in più nel layout.
- **C5 "Rivedi la quota" scatta in due casi:**
  - se per 2 mesi di fila la spesa reale della casa supera il previsto di oltre il 10%;
  - oppure se sono passati 6 mesi dall'ultima versione del piano.
  Si rimanda con "Più tardi".
- **C8:** vale la regola del check-in.
- **B2-1:** un link diretto "Aggiungi al calendario" in Dettagli di Casa.
- **B2-2:** "Più tardi" si salva nel database (colonna `rimandati` di `promemoria_utente`), così vale su tutti i telefoni.
- **C3:** frase per iOS 18 con il percorso Impostazioni › App › Calendario › Account calendario › Aggiungi account › Altro › Aggiungi calendario in abbonamento, scritta come "se non trovi queste voci".
- **D1:** il logo del login diventa l'icona dell'app (`IconaApp`). Resta l'ombra del logo, che `DESIGN.md` permette. Il suggerimento sotto i campi perde l'ombra.
- **D2:** il numero grande della P.IVA si allinea ai token di `DESIGN.md`. Fabio lo guarda poi sul telefono.
- **D3:** un'eliminazione in sospeso si salva in `localStorage` e si ripete alla riapertura.
- **P1:** "Pagata" propone la data di scadenza se è già passata, altrimenti oggi.
- **P4:** gli incassi su conti fuori dal disponibile non chiedono la quota. Arriva anche "Scarta" (tabella `piva_quote_scartate`).
- **p1:** le categorie iniziali si creano con un blocco, e solo se l'utente non ha movimenti personali.
- **p3:** la lezione dell'avviso conta come lezione del giorno (`segnaProposta`).
- **p6:** non si decide una voce prima della sua data.
- **p9:** "Lo voglio ancora" apre il nuovo obiettivo con nome e cifra già scritti. Il titolo dell'avviso nomina tutti i soldi toccati.
- **K1:** solo obiettivi personali. Per i ricorrenti contano i versamenti del ciclo in corso.
- **Rimandati, con motivo:**
  - **P12** (P.IVA in sola lettura dal client): toglie le policy di scrittura, quindi chiede due migrazioni e un rilascio coordinato. È una difesa in più, non un difetto visibile.
  - **K2** (totale diverso dalla banca): servono i numeri veri. È probabilmente causato da D4, che qui si corregge.
  - **P13**: è un'idea, non un difetto.

## Global Constraints

- Prima di scrivere codice Next leggere `node_modules/next/dist/docs/` (`AGENTS.md`).
- Migrazioni 0001-0011 intoccabili. La 0012 va:
  - racchiusa fra `begin;` e `commit;`;
  - scritta in modo idempotente (`if not exists`, `create or replace`, `drop policy if exists`);
  - chiusa dal rollback commentato in fondo.
- Fabio la lancia a mano. Il codice che usa le funzioni nuove va su master solo dopo.
- Nuove tabelle: RLS `auth.uid() = user_id`. Funzioni definer: `set search_path = public`, guardia su `auth.uid()`, `revoke all … from public, anon`, `grant execute … to authenticated`. Funzioni invoker dove basta l'RLS.
- I saldi si scrivono solo insieme alla riga, in una funzione SQL. Nessun nuovo aggiornamento in due passi.
- Testi in italiano semplice. Passano `PAROLE_VIETATE`. Niente "devi/dovresti", niente colpa, niente percentuali di completamento.
- `DESIGN.md`, bersagli ≥44px, modalità scura via token.
- Spazio personale invisibile agli altri membri.
- Commit con riga finale `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Mai `.impeccable/hook.cache.json`. Niente stash, reset o cambi di branch: si lavora su master.
- File scritti con lo strumento di scrittura, non con heredoc della shell, che rovinano `\b`.
- Modelli: sonnet per i task 1, 2, 4, 6, 8; haiku per il 10; sonnet per gli altri; opus solo per la revisione finale.

## Review Focus

1. **Modifica ed eliminazione di un movimento con la rete che cade a metà:** riga e saldo cambiano insieme o per niente. Vale anche per una spesa di casa pagata con la carta personale, e il credito verso la casa resta giusto. Test nei task 1 e 2.
2. **Conferma versamento su un obiettivo senza conferme:** il disponibile non cambia rispetto a oggi. Con una conferma vale il minore fra quota a tempo e confermato, meno lo speso collegato. Test nel task 8.
3. **Due membri che toccano "Metti da parte" insieme:** un solo fondo. Test SQL nel task 1.
4. **Stipendio superato (Miriam):** hub e Home mostrano lo stesso numero (0 €) e la stessa frase. Test nel task 6.
5. **Eliminazione rimandata ripetuta all'apertura:** non deve mai cancellare due volte né sbagliare il saldo. La funzione è idempotente su una riga già cancellata. Test nei task 1 e 2.

---

### Task 1: Migrazione 0012

**Files:** `supabase/migrations/0012_pulizia.sql`, `tests/migration0012.test.ts` (sul modello di `tests/migration0011.test.ts`), `supabase/tests/movimenti_atomici.sql`, aggiornamento di `supabase/tests/ricomincia_da_zero.sql` e `supabase/tests/rls_casa.sql`.

**Produces (SQL):**
1. `crea_categorie_iniziali()`: `pg_advisory_xact_lock(hashtext(v_me::text || 'categorie'))` prima del controllo. Non crea niente se l'utente ha almeno un movimento personale (p1). Firma e grant invariati.
2. `get_calendar_feed`: aggiunge `'id', g.id` agli obiettivi (C2).
3. `crea_fondo_bolletta(p_household uuid, p_item uuid, p_scadenza date, p_oggi date) returns uuid`.
   - Fa cerca-o-crea del fondo ricorrente della voce, con `pg_advisory_xact_lock(hashtext(p_item::text))`, e lo collega alla voce come oggi fa `link_plan_item_goal` (C7).
   - Controlla che chi chiama sia membro attivo della casa.
   - Revoke e grant come sopra.
4. `elimina_movimento(p_id uuid) returns void` e `modifica_movimento(p_id uuid, p_tipo text, p_importo numeric, p_data date, p_categoria uuid, p_account uuid, p_goal uuid, p_descrizione text, p_nota text, p_stima boolean) returns void`.
   - Sono security invoker.
   - Bloccano i conti coinvolti in ordine di id.
   - Applicano a riga e saldi lo stesso effetto di `crea_movimento` (0010) al contrario e poi di nuovo.
   - Rispettano `check_household_refs` e la spesa pagata con carta personale.
   - `elimina_movimento` su una riga che non c'è più non fa niente (idempotente).
   - Riguarda D3, D4 e C1.
5. `incassa_fattura`: se il cliente è `'Incasso in studio'` la descrizione è solo "Incasso in studio". Più un `update` delle righe già scritte "Fattura Incasso in studio" dell'utente (P8).
6. Indice unico parziale su `piva_fatture(transaction_id) where transaction_id is not null`. Prima un blocco che gestisce eventuali doppioni: tiene il collegamento della fattura più vecchia e scollega le altre (P10).
7. Vincolo `piva_fatture_date_check check (data_incasso is null or data_incasso >= data_emissione) not valid`, poi `validate` (P11).
8. Tabella `piva_quote_scartate(transaction_id uuid primary key references transactions on delete cascade, user_id uuid not null default auth.uid(), scartata_il date not null)` con RLS (P4).
9. `promemoria_utente.rimandati jsonb not null default '{}'` (B2-2).
10. Tabella `goal_versamenti(id uuid pk, goal_id uuid not null references budget_goals on delete cascade, user_id uuid not null default auth.uid(), data date not null, importo numeric not null check (importo > 0), created_at timestamptz default now())`, indice su `goal_id`, RLS sulle proprie righe (K1).
12. `piva_settings.categoria_dal date`, che può essere null. Lo scrive il form quando cambia la categoria del fatturato (P5).
11. `ricomincia_da_zero()` (`create or replace`, stesse regole della 0011): cancella anche `goal_versamenti` e `piva_quote_scartate` dell'utente, prima degli obiettivi e dei movimenti.

- [ ] **Step 1: test statico che fallisce** (`tests/migration0012.test.ts`). Una prova per punto:
  - presenza;
  - `security definer`, `set search_path` e revoke/grant dove servono;
  - RLS sulle 2 tabelle;
  - il blocco consultivo in `crea_categorie_iniziali` e `crea_fondo_bolletta`;
  - `elimina_movimento` contiene il caso "riga assente";
  - `ricomincia_da_zero` cancella le 2 tabelle nuove con `v_me`.
- [ ] **Step 2:** `npx vitest run tests/migration0012.test.ts` → FAIL.
- [ ] **Step 3:** scrivere la migrazione.
- [ ] **Step 4:** scrivere `supabase/tests/movimenti_atomici.sql` (stile `ricomincia_da_zero.sql`, `begin … rollback`). Casi:
  - modifica di importo e conto di una spesa personale, con i due saldi giusti;
  - eliminazione di una spesa, con il saldo che torna;
  - doppia eliminazione senza effetto;
  - spesa di casa con carta personale modificata, con credito e saldo personale giusti;
  - due `crea_fondo_bolletta` sulla stessa voce che danno un solo fondo;
  - una fattura con data d'incasso prima dell'emissione che dà errore.

  Aggiungere a `rls_casa.sql` il blocco B-2: un debito da Tricount blocca uscita e chiusura.
- [ ] **Step 5:** `npx vitest run tests/migration0012.test.ts` → PASS. Poi la suite intera.
- [ ] **Step 6:** commit `feat(pulizia): migrazione 0012`.
- [ ] **Step 7:** il controllore chiede a Fabio di lanciare la 0012, poi `movimenti_atomici.sql`, `ricomincia_da_zero.sql` e `rls_casa.sql`. I task 2, 5 (parte C7), 6 (P3, P4 Scarta, P8) e 8 vanno su master solo dopo.

### Task 2: Movimenti atomici nel client, modifica con carta personale, eliminazione ripresa

**Voci:** D4, C1, D3. **Files:** `src/lib/data/transactions.ts` (nuove `eliminaMovimento`, `modificaMovimento` via rpc), `src/app/history/page.tsx`, `src/app/casa/movimenti/MovimentiCasa.tsx`, `src/app/casa/movimenti/page.tsx`, `src/lib/eliminazioneRimandata.ts`, `src/app/AnnullaProvider.tsx`; test relativi.

- Ogni modifica ed eliminazione di movimento chiama una sola rpc. Nessuna chiamata ad `adjust_account_balance` resta in questi percorsi: un test lo verifica con grep sul sorgente.
- C1: la riga di casa pagata con carta personale mostra "Modifica". Il conto personale compare come "Io, con <conto>" e non si cambia.
- D3: un'eliminazione in sospeso si scrive in `localStorage` (chiave per id) prima del timer. Si rimuove a scrittura riuscita. All'avvio dell'app le chiavi rimaste si ripetono con `elimina_movimento`, che è idempotente. Tutto dentro try/catch.
- Test:
  - chiamata rpc con gli argomenti giusti;
  - errore della rpc, che non cambia lo stato e mostra il messaggio;
  - ripresa dell'eliminazione;
  - una spesa con carta personale modificabile.

### Task 3: Percorso, pulizia

**Voci:** p1 (lato codice: la Home non crea categorie se ci sono movimenti), p2, p3, p4, p5, p6, p8, p9, p10.

**Files:** come nella mappa, gruppi T1-T3. Più `src/app/goals/page.tsx` e `CreateGoalForm.tsx` per il precompilato.

- p2: `loadHomeBase()` restituisce `{ home, grezzi }`. `loadPercorsoData` lo usa senza letture doppie. Le transazioni non finiscono in `HomeData`.
- p9:
  - `/goals?nuovo=1&nome=…&importo=…`: si validano lunghezza e importo, poi i valori vanno nel modulo come `initial`;
  - il titolo dell'avviso unisce i tipi toccati ("che servono per la quota della casa e le tasse").
- Test per ogni voce, come nella mappa.

### Task 4: Calcoli e testi della Casa

**Voci:** C8, C9, B-1, B2-3, K3. **Files:** mappa, gruppo T5.

- K3: per gli obiettivi ricorrenti l'inizio della finestra è escluso, sia in `goalSpending.ts` sia nel calcolo dello speso collegato. Test sul giorno di confine.
- B-1: due voci per mese (saldo da Tricount e quota), con test.
- B2-3: `quotaDal` dalla prima quota del membro o dalla data d'ingresso, con un caso di prova "entra il 17".

### Task 5: Interfaccia della Casa

**Voci:** C2 (lato codice), C3, C4, C6, C7 (il client chiama `crea_fondo_bolletta`), B2-1, B2-2 (lettura e scrittura di `rimandati` al posto di `localStorage`, con `localStorage` come ripiego se la lettura fallisce).

**Files:** mappa, gruppo T6, più `src/lib/data/fondiCasa.ts` e `src/app/casa/rimandaPromemoria.ts`.

### Task 6: P.IVA

**Voci:** P1, P2, P3 (domanda con un tocco), P4 (filtro sui conti più "Scarta"), P5 (si riparte da oggi: il form scrive `categoria_dal` = oggi quando la categoria cambia, e `quoteInSospeso` usa la più recente fra `guidataDal` e `categoriaDal`), P6, P7, P9 (0 € più frase, in hub e Home), P11 (messaggio nel form).

**Files:** mappa, gruppo T7.

### Task 7: "Rivedi la quota"

**Voce:** C5. **Files:** mappa, gruppo T9.

Regola: 2 mesi completi di fila con la spesa reale della casa (stessa fonte della stima contro reale) oltre il previsto del 10%, oppure 6 mesi dall'ultima versione del piano. Vale solo per chi gestisce. Link a `/casa/quota`. Si rimanda con "Più tardi". Test sui due casi e sul caso che non scatta.

### Task 8: Conferma versamento

**Voce:** K1. **Files:** `src/lib/calculations/accantonato.ts`, `src/lib/calculations/disponibile.ts`, nuovo `src/lib/data/goalVersamenti.ts`, `src/lib/loadHomeData.ts`, `src/app/goals/*`, `src/lib/calculations/supporto/home.ts` (Da fare).

**Regola:**
- Per un obiettivo personale dilazionato con almeno un versamento nella finestra corrente (`computeFinestraGoal`), il riservato è `max(0, min(teorico, versato) − speso)`.
- Per un obiettivo senza versamenti il riservato non cambia.
- Il vecchio `computeAccantonatoFinora` resta il caso base.
- Il calcolo nuovo è una funzione pura con test.

**Interfaccia:**
- Nella card dell'obiettivo: "Ho messo da parte" con la quota del mese già scritta e la data di oggi.
- Nel "Da fare" della Home, solo per gli obiettivi con almeno una conferma: "Hai messo da parte i <quota> € per <nome> questo mese?". Compare dopo le altre voci più urgenti.

**Lezione:** una riga in `numeriLezione` per la lezione `prima-da-parte` (quanto confermato questo mese).

**Test:**
- obiettivo senza conferme: numeri identici a prima, per tutte le funzioni che usano l'accantonato;
- con una conferma sotto la quota;
- con una conferma sopra;
- con lo speso collegato;
- ricorrente, con un versamento del ciclo precedente che non conta;
- il disponibile della Home.

### Task 9: Design, residui

**Voci:** D1, D2, D5. **Files:** mappa, gruppo T8, più `DESIGN.md` se cambia una regola.

Controllo nel browser a 375px, in chiaro e in scuro.

### Task 10: Documenti

ROADMAP:
- segnare fatte le voci chiuse;
- togliere B-3 e K4, già fatti;
- lasciare solo P12, K2, P13 e le cose "Solo Fabio" (mappa);
- aggiungere la checklist della prova da zero.

`PRODUCT.md` se K1 cambia la descrizione del disponibile.

---

## Dopo l'ultimo task

1. Revisione finale opus dell'intero intervallo.
2. Una sola ondata di correzioni, poi la ri-revisione.
3. Push su master.
4. Messaggio a Fabio con la checklist del test da zero.
