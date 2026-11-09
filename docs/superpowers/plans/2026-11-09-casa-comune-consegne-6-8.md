# Casa comune, consegne 6, 7 e 8: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chiudere il blocco 1: fondi della casa per le bollette annuali e per i costi di ingresso, disponibile casa completo, controllo del saldo del conto comune, check-in mensile, stima contro reale, stati vuoti e di errore, verifica dei testi.

**Architecture:** Il motore degli obiettivi (`computeAccantonatoFinora`) è l'unico calcolo dei fondi: i fondi della casa sono `budget_goals` con scope casa, con `accantona_da` (colonna già in produzione dalla 0004, mai scritta finora). I calcoli nuovi sono funzioni pure in `src/lib/calculations/casa/` che restituiscono valore e spiegazione insieme; le scritture passano dal data layer con scope. Una sola migrazione nuova (0008) aggiunge quattro funzioni SQL piccole, eseguita a mano da Fabio. Nessuna lettura nuova sull'intera storia a ogni apertura di home o `/casa`: dove serve un aggregato si usa una query limitata o dati già caricati (vedi Divergenza 12).

**Tech Stack:** Next.js 16.3 (App Router, `src/proxy.ts`), Supabase (Postgres, RLS, RPC), TypeScript, Vitest con Testing Library, date-fns 4, lucide-react.

**Spec:** [docs/superpowers/specs/2026-11-08-co-gestione-casa-design.md](../specs/2026-11-08-co-gestione-casa-design.md), sezioni 6.1, 6.3, 7.7 a 7.10, 8.4 a 8.12, 10, 12 (T9 a T14). Piano precedente: `docs/superpowers/plans/2026-11-08-casa-comune-consegne-4-5.md`. Gli esecutori leggono spec e piano insieme: qui si decidono nomi, firme, file e test; la spec resta la fonte per i testi.

**Ordine di esecuzione:** P1, T9.1, T9.2, T9.3, T9.4, T10.1, T10.2, T11.1, T11.2, T12.1, T12.2, T13.1, T13.2, T14.1, T14.2. T10 e T11 sono indipendenti fra loro. **Cancello sulla 0008:** P1 si pusha subito (il file SQL non cambia il comportamento dell'app). Poi si attende la conferma di Fabio che la 0008 è stata eseguita; i task successivi si possono sviluppare e committare in locale, ma `git push` parte solo dopo la conferma (T9.3, T12.2 e T13.2 chiamano funzioni della 0008 e senza si rompono; T11.2 funziona anche senza, con la vecchia `record_balance_check`).

## Global Constraints

- Costo 0 euro al mese: solo Supabase (Postgres e Auth) e Vercel Hobby. Nessuna nuova dipendenza npm.
- EUR, formattazione `it-IT` (`formatEuro`, `formatNumero`, `formatDateIt`), testi tutti in italiano. Nelle frasi la cifra si scrive `776 €` con `formatNumero`.
- Next.js 16 con API diverse da quelle note (`AGENTS.md`). Verificato per questo piano in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`: l'error boundary riceve `retry` (non `reset`); i Server Component sono `async function` che leggono i dati e passano props ai client, come le pagine `/casa` esistenti. Prima di usare un'altra API di Next leggere la guida.
- UI ottimistica dove l'esito non serve per proseguire; errore di salvataggio con il messaggio esistente "Salvataggio fallito, controlla la connessione e riprova."; le pagine client inoltrano gli errori con `useThrowToBoundary`. Ogni pulsante che scrive blocca il doppio tocco con un `useRef` (schema di `useRegistraMovimento`).
- Parole vietate nella parte Casa (testi visibili e DOM): "bloccato", "dilazionato", "sinking fund", "giroconto", "imputazione", "riconciliazione". Ogni test di componente della parte Casa chiama `assertNessunaParolaVietata` (`tests/helpers/paroleVietate.ts`). I letterali di database `'bloccato'`, `'dilazionato'`, `'riconciliazione'` restano ammessi nel codice, mai nel DOM.
- Niente messaggi che fanno sentire in colpa ("hai speso troppo", "in ritardo", "sei indietro"); niente gamification; ogni numero della casa ha "Come si calcola?" (`ComeSiCalcola` con una `Spiegazione`: valore e spiegazione dalla stessa struttura). Un testo di rassicurazione per ogni errore dei numeri ("non è colpa di nessuno").
- Onestà dei numeri: ciò che si mostra è ciò che è salvato. Le stime si dichiarano stime.
- Il personale non esce mai. Data layer: ogni lettura di `accounts`, `categories`, `budget_goals`, `transactions`, `transfers` prende uno `scope` e usa `applyScope`; una funzione per id porta `// household: per id`. I saldi di casa e personali si muovono solo con `adjustAccountBalance` (delta) o con RPC atomiche; mai un saldo assoluto calcolato nel client.
- Mesi e giorni della parte Casa solo con `oggiRomaISO` e `meseRomaISO` (`src/lib/calculations/casa/oggi.ts`); il motore degli obiettivi riceve un `Date` costruito dal giorno di Roma (`oggiRomaData`, T9.1), mai `new Date()` diretto.
- Importi con due decimali (`Math.round(x * 100) / 100`); le colonne `numeric` possono tornare come stringa: i mapper usano `Number()`. Importi scritti a mano con `parseImporto` (`src/lib/calculations/casa/parseImporto.ts`: virgola o punto, mai negativo, null se non è un numero).
- Le migrazioni 0001 a 0007 sono in produzione e non si modificano. Ogni SQL nuovo va in `0008_da_parte_e_controlli.sql`: idempotente, `begin;`/`commit;`, solo ASCII, funzioni `security definer` con `set search_path = public`, `auth.uid()` e appartenenza verificati per primi, stesso `revoke ... from public, anon, authenticated` e `grant ... to authenticated`. La esegue Fabio a mano.
- Prestazioni: nessuna lettura nuova di tutta la storia in home o `/casa`. Le letture nuove ammesse: due query `limit 1` in parallelo alle esistenti (T11.1), una query per tutti gli obiettivi al posto di una per obiettivo (T9.1), query limitate per mese o categoria nelle pagine visitate raramente.
- **Chiusura standard di ogni task** (ultimo step di ogni task): `npm test`, `npm run lint` (errori già presenti in file non toccati ammessi, file nuovi o modificati puliti), `npx next build`, poi `git add` dei soli path elencati nel task (mai `.impeccable/hook.cache.json`, mai `git add .`), `git commit` nello stile esistente (`feat:`, `fix:`, `test:`, `docs:`) chiuso dalla riga `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, `git push` su master (rispettando il cancello sulla 0008).

## Review Focus

Casi che la spec implica ma i test dei task, da soli, non esercitano; ciascuno ha il suo test nel task indicato. I più probabili per primi.

1. **Confine di mese a mezzanotte italiana con server in UTC.** Alle 23:30 UTC del 31 ottobre in Italia è il 1 novembre: `accantona_da`, il mese di D, il mese del check-in e la data del controllo devono dire novembre. Test in T9.1 (`oggiRomaData`), T9.2 (D), T12.1 (`meseDaControllare`), T11.2 (data del controllo).
2. **Importi scritti male.** "940,5" vale 940,5; vuoto, zero, negativo o testo disabilitano il pulsante; mai `NaN` nel DOM; due tocchi su "Metti da parte" o "Segna" fanno una sola scrittura. Test in T9.3, T10.2, T11.2.
3. **Casa senza piano, piano non ancora in vigore o senza conto comune.** D e cuscinetto valgono 0 se il piano parte nel futuro; `/casa/da-parte`, il controllo e il check-in mostrano una frase con la via d'uscita invece di una pagina vuota o di un errore. Test in T9.2, T14.1.
4. **Piano con una modifica già programmata, o con uscenti, quando si accetta una stima.** Salvare una nuova versione dal mese successivo cancellerebbe le versioni future: la card non offre "Aggiorna" e rimanda a "Rivedi la quota". Test in T13.1 e T13.2.
5. **Operazioni a metà e doppie.** Fondo creato ma collegamento alla voce fallito (si riprova senza duplicare); "Metti da parte tutto" ripetuto dopo un errore a metà; check-in già fatto dall'altro membro nello stesso momento (`check-in gia fatto`, frase neutra con il nome di chi l'ha fatto); costo di ingresso pagato dopo la data di ingresso (il fondo non scende da solo: pulsante "L'ho pagato"). Test in T9.3, T10.2, T12.2.

## Divergenze e scelte del pianificatore rispetto alla spec

Dove spec e codice reale divergono o la spec tace, il piano sceglie quanto segue. Gli esecutori non le ribaltano; Fabio può farlo prima dell'esecuzione.

1. **Esempio di 8.7.** La spec dice "125 di 300" in 8.7 e "100 di 300" in 7.7 per la TARI con rata a marzo 2027 creata a novembre 2026. Il motore (mesi di calendario da `accantona_da`) dà 100: si usa 100.
2. **Esempio di 8.10.** Con previste 1.288, registrate 1.241 e non registrate 80 la formula di 7.8 dà un ammanco di 33, non "in avanzo di 47". Vale la formula; i test usano registrate 1.161 per ottenere 47.
3. **Scadenza di un fondo ricorrente.** `scadenza` = ultimo giorno del mese scelto, perché `getSpecoCollegato` conta le spese fino a quella data compresa: con il primo del mese una bolletta pagata il 15 non scalerebbe il fondo.
4. **Rotte.** `/casa/controllo` è il check-in mensile (spec 8.10); il controllo del saldo da solo, raggiunto da "Controlla il conto", sta in `/casa/controllo/conto`; il check-in lo incorpora come passo 0.
5. **Collegamento voce-fondo.** Le voci del piano non sono scrivibili dal client: la 0008 aggiunge `link_plan_item_goal`, che aggiorna la voce e le voci omonime (stessa categoria e stesso nome) delle versioni dal mese della voce in poi, perché `save_household_plan` ricrea le voci a ogni salvataggio. Lo stato "messa da parte" si deriva anche dal fondo aperto con la stessa categoria, così un collegamento fallito si ripara da solo.
6. **Destinazione dell'avanzo.** Solo verso un fondo "da spendere una volta" che riserva l'intero importo (internamente `bloccato`, mai nominato), oppure uno nuovo creato con quel nome. I fondi dei costi di ingresso (graduali) sono esclusi: aumentarne il target non toglierebbe soldi dal disponibile, e l'avanzo sembrerebbe messo da parte senza esserlo. L'aumento del target e la riga del check-in sono una sola RPC (`save_household_checkin`).
7. **Spese del check-in.** Oltre a quanto dice 7.8, `speso` esclude le spese con `goalId` valorizzato e quelle nelle categorie delle voci con frequenza maggiore di 1: il confronto è con le sole voci del mese (`previsto`), e una bolletta o un deposito pagati nel mese non devono sembrare uno sforamento.
8. **Stima contro reale.** Per le voci con frequenza maggiore di 1 la media è delle ultime 3 spese (una per bolletta). Per le voci mensili (spesa alimentare) le spese sono molte per mese: si confrontano i totali degli ultimi 3 mesi chiusi con spese, e `n` è il numero di quei mesi. Soglia e riproposta come in 7.9 (`n + 3`).
9. **Aggiornare la stima.** L'obiettivo della voce si aggiorna subito con `updateGoal`, non "dal ciclo seguente": il motore non ha versioni e rimandare significherebbe mostrare un numero diverso da quello salvato. Il piano nuovo parte dal mese successivo, come in spec. Il testo lo dice.
10. **Costi di ingresso.** Costanti in un solo punto (`costiIngresso.ts`): bollo 32 € (due copie da 16 €), agenzia 1 mensilità più IVA 22%, allacci 100 € per utenza con 3 utenze di partenza, registro 2% del canone annuo diviso 2. Cifre indicative dichiarate tali; Fabio può cambiarle.
11. **Non pianificato.** Il pulsante "Nuova cosa da mettere da parte" nel foglio di aggiunta (spec 8.5): le cose da pagare una volta si creano in `/casa/da-parte` (T10.2). Il puntino dei promemoria sulla barra e il promemoria "Rivedi la quota" restano fuori, come nel piano precedente.
12. **Prestazioni.** `loadCasaData` passa da una query per obiettivo a una sola (T9.1) e aggiunge due query `limit 1` in parallelo (T11.1); `loadCasaStato` aggiunge solo le due `limit 1`. D, stima e check-in usano le transazioni già caricate da `loadCasaData` (la pagina del check-in lo chiama una volta al mese). Resta il difetto noto: `getTransactions` e `getTransfers` senza limite, oltre circa 1000 righe Supabase tronca e i registri sbagliano; lo risolve il blocco 2 con le funzioni `_casa_*`, e D, stima e check-in dovranno passare a letture per mese insieme.
13. **`record_balance_check`.** La 0004 legge il saldo e lo riscrive assoluto senza bloccare la riga: una spesa registrata in quell'istante dall'altro membro andrebbe persa. La 0008 prende la riga con `for update` e valida i parametri. L'assegnazione assoluta resta, ma dentro il blocco e con la differenza memorizzata: è l'equivalente del "imposta saldo" esplicito.
14. **Spese dopo la scadenza.** Per un fondo "una volta" la finestra delle spese collegate chiude alla scadenza (comportamento del motore, anche personale). Il deposito pagato dopo la data di ingresso non lo fa scendere: pulsante "L'ho pagato" che chiude il fondo (T10.2).

## File Structure

| File | Responsabilità | Task |
|---|---|---|
| `supabase/migrations/0008_da_parte_e_controlli.sql`, `tests/migration0008.test.ts`, `supabase/tests/rls_casa.sql` | Quattro funzioni SQL e casi di prova | P1 |
| `src/lib/calculations/{types,accantonato}.ts`, `src/lib/calculations/casa/oggi.ts`, `src/lib/data/{goals,goalSpending,transactions}.ts` | `accantonaDa` nel motore, data di Roma, speso collegato in una query | T9.1 |
| `src/lib/calculations/casa/{disponibileCasa,spiegazioni}.ts`, `src/lib/loadCasaData.ts`, `src/app/casa/{CasaHome,ComeSiCalcola}.tsx` | D, cuscinetto, spiegazioni | T9.2 |
| `src/lib/calculations/casa/fondi.ts`, `src/lib/data/fondiCasa.ts`, `src/app/casa/da-parte/*`, `src/app/goals/GoalsList.tsx` | Bollette in un tocco, variante casa della lista | T9.3 |
| `src/lib/calculations/casa/preselezioneObiettivo.ts`, `src/app/add/*` | Obiettivo scelto dalla categoria | T9.4 |
| `src/lib/calculations/casa/costiIngresso.ts`, `src/app/casa/da-parte/{CostiIngresso,NuovaCosa}.tsx` | Costi di ingresso, cose da pagare una volta | T10.1, T10.2 |
| `src/lib/calculations/casa/controlloSaldo.ts`, `src/lib/data/balanceChecks.ts`, `src/app/casa/controllo/conto/*`, `src/app/casa/ControlloSaldo.tsx` | Controllo del saldo | T11.1, T11.2 |
| `src/lib/calculations/casa/{checkin,promemoria}.ts`, `src/lib/data/checkins.ts`, `src/lib/loadCheckin.ts`, `src/app/casa/controllo/*` | Check-in mensile | T12.1, T12.2 |
| `src/lib/calculations/casa/stimaVsReale.ts`, `src/lib/data/stime.ts`, `src/app/casa/CardStima.tsx` | Stima contro reale | T13.1, T13.2 |
| `src/app/casa/error.tsx`, `tests/casaTesti.test.ts`, `tests/casaParoleVietate.test.tsx`, `docs/ROADMAP.md` | Stati, testi, documenti | T14.1, T14.2 |

---

## Task P1: Migrazione 0008 e casi di prova

**Files:**
- Create: `supabase/migrations/0008_da_parte_e_controlli.sql`
- Create: `tests/migration0008.test.ts`
- Modify: `supabase/tests/rls_casa.sql` (sezione nuova prima del "Referto", nello stile esistente)

**Interfaces:**
- Consumes: `record_balance_check` della 0004 (sezione 3.5), `is_household_writer`, `_casa_oggi`, tabelle `household_checkins`, `household_plan_items`, `budget_goals` (colonna `accantona_da` già presente dalla 0004).
- Produces (firme esatte, usate dai task seguenti):
  - `record_balance_check(p_account uuid, p_saldo_dichiarato numeric, p_data date, p_crea_movimento boolean default true) returns uuid` (invoker, stessa firma, riga con `for update`).
  - `save_household_checkin(p_household uuid, p_mese date, p_atteso_totale numeric, p_versato_totale numeric, p_previsto_mensili numeric, p_speso_mensili numeric, p_non_registrate numeric, p_avanzo numeric, p_destinazione text default null, p_goal_id uuid default null, p_nuova_cosa text default null) returns uuid` (invoker). Errori: `check-in gia fatto`, `mese non ancora chiuso`, `obiettivo non valido`.
  - `link_plan_item_goal(p_household uuid, p_item uuid, p_goal uuid) returns integer` (definer; `p_goal` nullo scollega; ritorna le voci aggiornate).
  - `set_plan_item_stima_ignorata(p_household uuid, p_item uuid, p_n integer) returns integer` (definer).

- [ ] **Step 1: Scrivere il test statico che fallisce**

`tests/migration0008.test.ts`, stesso schema di `tests/migration0007.test.ts`. Test: `'è racchiusa tra begin; e commit;'`; `'definisce solo le quattro funzioni con create or replace'` (nessun `create table`, nessun `drop table`); `'le due funzioni sulle voci del piano sono security definer con search_path = public'`; `'record_balance_check prende la riga con for update e valida saldo e data'` (il corpo contiene `for update`, `saldo mancante`, `data non valida`); `'save_household_checkin rifiuta mese non chiuso e check-in doppio con messaggi ASCII'` (contiene `mese non ancora chiuso`, `check-in gia fatto`, `when unique_violation`); `'rinnova revoke e grant con le firme esatte'` (quattro coppie `revoke execute on function public.<firma> from public, anon, authenticated;` e `grant ... to authenticated;`); `'solo ASCII'` (nessun carattere sopra 0x7F); `'nessuna istruzione di primo livello modifica righe esistenti'` (nessuna riga non commentata in colonna 0 che inizi con `update`, `delete`, `insert`, `truncate`).

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run tests/migration0008.test.ts` Expected: FAIL (file inesistente).

- [ ] **Step 3: Scrivere la migrazione**

Intestazione commentata (motivi, rollback), poi esattamente:

```sql
begin;

-- 1. Controllo del saldo: la riga del conto si blocca mentre si legge, la differenza non si perde se
--    l altro membro registra una spesa nello stesso istante.
create or replace function public.record_balance_check(
  p_account uuid, p_saldo_dichiarato numeric, p_data date, p_crea_movimento boolean default true
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  a public.accounts%rowtype;
  diff numeric;
  cat uuid;
  tx uuid := null;
  bc uuid;
begin
  if p_saldo_dichiarato is null then raise exception 'saldo mancante'; end if;
  if p_data is null or p_data > public._casa_oggi() then raise exception 'data non valida'; end if;
  select * into a from public.accounts where id = p_account for update;
  if not found or a.household_id is null then raise exception 'conto non valido'; end if;
  diff := round(p_saldo_dichiarato - a.saldo_attuale, 2);
  if p_crea_movimento and abs(diff) >= 1 then
    if diff < 0 then
      select id into cat from public.categories
      where household_id = a.household_id and tipo = 'expense' and nome = 'Spese non registrate' limit 1;
      if cat is null then
        insert into public.categories (nome, tipo, household_id)
        values ('Spese non registrate', 'expense', a.household_id) returning id into cat;
      end if;
      insert into public.transactions (tipo, importo, data, categoria_id, account_id, descrizione, household_id, origine)
      values ('expense', -diff, p_data, cat, a.id, 'Spese non registrate', a.household_id, 'riconciliazione')
      returning id into tx;
    else
      select id into cat from public.categories
      where household_id = a.household_id and tipo = 'income' and nome = 'Entrate non registrate' limit 1;
      if cat is null then
        insert into public.categories (nome, tipo, household_id)
        values ('Entrate non registrate', 'income', a.household_id) returning id into cat;
      end if;
      insert into public.transactions (tipo, importo, data, categoria_id, account_id, descrizione, household_id, origine)
      values ('income', diff, p_data, cat, a.id, 'Entrata non registrata', a.household_id, 'riconciliazione')
      returning id into tx;
    end if;
  end if;
  update public.accounts set saldo_attuale = p_saldo_dichiarato where id = a.id;
  insert into public.balance_checks (household_id, account_id, data, saldo_registrato, saldo_dichiarato, differenza, transaction_id)
  values (a.household_id, a.id, p_data, a.saldo_attuale, p_saldo_dichiarato, diff, tx)
  returning id into bc;
  return bc;
end $$;

-- 2. Check-in mensile: la riga e l eventuale aumento del target del fondo scelto per l avanzo sono una
--    sola operazione. Un secondo check-in dello stesso mese annulla tutto.
create or replace function public.save_household_checkin(
  p_household uuid, p_mese date, p_atteso_totale numeric, p_versato_totale numeric,
  p_previsto_mensili numeric, p_speso_mensili numeric, p_non_registrate numeric, p_avanzo numeric,
  p_destinazione text default null, p_goal_id uuid default null, p_nuova_cosa text default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_esito text;
  v_goal uuid := null;
  v_id uuid;
  v_mese_corrente date := date_trunc('month', public._casa_oggi()::timestamp)::date;
begin
  if not public.is_household_writer(p_household) then raise exception 'casa non scrivibile'; end if;
  if p_mese is null or extract(day from p_mese) <> 1 then raise exception 'mese non valido'; end if;
  if p_mese >= v_mese_corrente then raise exception 'mese non ancora chiuso'; end if;
  v_esito := case when abs(p_avanzo) < 1 then 'in_pari' when p_avanzo > 0 then 'avanzo' else 'ammanco' end;
  if p_destinazione is not null then
    if v_esito <> 'avanzo' or p_destinazione not in ('cuscinetto', 'da_parte') then
      raise exception 'destinazione non valida';
    end if;
  end if;
  if p_destinazione = 'da_parte' then
    if p_goal_id is not null then
      update public.budget_goals set importo_target = importo_target + round(p_avanzo, 2)
      where id = p_goal_id and household_id = p_household and stato = 'aperto'
        and modalita = 'bloccato' and not ricorrente;
      if not found then raise exception 'obiettivo non valido'; end if;
      v_goal := p_goal_id;
    elsif nullif(btrim(p_nuova_cosa), '') is not null then
      insert into public.budget_goals (nome, importo_target, modalita, scadenza, categoria_id, ricorrente, frequenza_mesi, stato, household_id)
      values (btrim(p_nuova_cosa), round(p_avanzo, 2), 'bloccato', null, null, false, null, 'aperto', p_household)
      returning id into v_goal;
    else
      raise exception 'obiettivo mancante';
    end if;
  end if;
  insert into public.household_checkins (
    household_id, mese, atteso_totale, versato_totale, previsto_mensili, speso_mensili,
    non_registrate, avanzo, esito, destinazione_avanzo, goal_id)
  values (p_household, p_mese, p_atteso_totale, p_versato_totale, p_previsto_mensili, p_speso_mensili,
    p_non_registrate, p_avanzo, v_esito, p_destinazione, v_goal)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'check-in gia fatto';
end $$;

-- 3. Voci del piano: non sono scrivibili dal client. Collegano il fondo "da parte" (o ne salvano il
--    rifiuto della stima) alla voce e alle voci omonime delle versioni dal mese della voce in poi,
--    perche save_household_plan ricrea le voci a ogni salvataggio.
create or replace function public.link_plan_item_goal(p_household uuid, p_item uuid, p_goal uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  v_item public.household_plan_items%rowtype;
  v_dal date;
  n integer;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  if not public.is_household_writer(p_household) then raise exception 'casa non scrivibile'; end if;
  select i.* into v_item from public.household_plan_items i
  join public.household_plans p on p.id = i.plan_id
  where i.id = p_item and p.household_id = p_household;
  if not found then raise exception 'voce non trovata'; end if;
  select valido_dal into v_dal from public.household_plans where id = v_item.plan_id;
  if p_goal is not null and not exists (
       select 1 from public.budget_goals g
       where g.id = p_goal and g.household_id = p_household and g.stato = 'aperto') then
    raise exception 'obiettivo non valido';
  end if;
  update public.household_plan_items x set goal_id = p_goal
  from public.household_plans p
  where p.id = x.plan_id and p.household_id = p_household and p.valido_dal >= v_dal
    and x.categoria_id is not distinct from v_item.categoria_id
    and lower(x.nome) = lower(v_item.nome);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.set_plan_item_stima_ignorata(p_household uuid, p_item uuid, p_n integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  v_item public.household_plan_items%rowtype;
  v_dal date;
  n integer;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  if not public.is_household_writer(p_household) then raise exception 'casa non scrivibile'; end if;
  if p_n is null or p_n < 0 or p_n > 32000 then raise exception 'valore non valido'; end if;
  select i.* into v_item from public.household_plan_items i
  join public.household_plans p on p.id = i.plan_id
  where i.id = p_item and p.household_id = p_household;
  if not found then raise exception 'voce non trovata'; end if;
  select valido_dal into v_dal from public.household_plans where id = v_item.plan_id;
  update public.household_plan_items x set stima_ignorata_con_n = p_n
  from public.household_plans p
  where p.id = x.plan_id and p.household_id = p_household and p.valido_dal >= v_dal
    and x.categoria_id is not distinct from v_item.categoria_id
    and lower(x.nome) = lower(v_item.nome);
  get diagnostics n = row_count;
  return n;
end $$;

-- revoke e grant per le quattro firme (come la 0007), poi: commit;
```

Poi i quattro `revoke execute on function public.<firma> from public, anon, authenticated;` e `grant execute on function public.<firma> to authenticated;`, `commit;` e il blocco di rollback commentato (rieseguire la definizione di `record_balance_check` della 0004; `drop function` delle altre tre).

Sezione nuova di `supabase/tests/rls_casa.sql`, casi (con tre utenti A e B nella casa, C fuori, come il resto del file): `save_household_checkin` di C fallisce (`casa non scrivibile`); un secondo check-in dello stesso mese fallisce con `check-in gia fatto` e lascia invariato il target del fondo; il mese corrente è rifiutato; destinazione `da_parte` con un fondo ricorrente è rifiutata; `link_plan_item_goal` di C fallisce, con un fondo di un'altra casa fallisce, con `p_goal` nullo scollega; `set_plan_item_stima_ignorata` aggiorna anche le versioni successive e non quelle precedenti; `record_balance_check` con data futura fallisce e con saldo nullo fallisce.

- [ ] **Step 4: Eseguire il test**

Run: `npx vitest run tests/migration0008.test.ts` Expected: PASS.

- [ ] **Step 5: Azione di Fabio, poi chiusura standard**

Chiusura standard con i path: i tre file sopra (il push è consentito subito: non cambia il comportamento dell'app).

**Azione di Fabio** (da comunicargli nel messaggio finale del task, con queste istruzioni esatte):
1. Aprire il progetto su supabase.com, menu "SQL Editor", "New query".
2. Incollare tutto il contenuto di `supabase/migrations/0008_da_parte_e_controlli.sql` e premere "Run". Atteso: "Success. No rows returned". Rieseguirlo è innocuo.
3. Nuova query: incollare la sezione nuova di `supabase/tests/rls_casa.sql` (il file finisce con `rollback`, non cambia dati) e premere "Run". Atteso: tutte le righe del referto con OK, nessun FAIL.
4. Scrivere "0008 eseguita" nella chat: da quel momento i task seguenti si pushano.

---

## Task T9.1: Motore `accantonaDa`, giorno di Roma, speso collegato in una query

**Files:**
- Modify: `src/lib/calculations/types.ts`, `src/lib/calculations/accantonato.ts`, `src/lib/calculations/casa/oggi.ts`, `src/lib/data/goals.ts`, `src/lib/data/goalSpending.ts`, `src/lib/loadCasaData.ts`
- Test: `tests/calculations/accantonato.test.ts`, `tests/calculations/casa/oggi.test.ts`, `tests/data/goals.test.ts`, `tests/data/goalSpending.test.ts`, `tests/loadCasaData.test.ts`

**Interfaces:**
- Consumes: `computeFinestraGoal(goal, today)`, `getTransactionAmountsForGoal`, `applyScope`, `casa`.
- Produces:
  - `GoalForCalc.accantonaDa?: string | null` (`BudgetGoal` lo ha già).
  - `oggiRomaData(now?: Date): Date` in `oggi.ts`: la mezzanotte locale del giorno di Roma (`parseISO(oggiRomaISO(now))`).
  - `createGoal(supabase, input: {…esistente; accantonaDa?: string | null}, scope)`: scrive `accantona_da` quando passato.
  - `getSpecoCollegatoPerObiettivi(supabase, goals: BudgetGoal[], today: Date, scope: Scope): Promise<Record<string, number>>` in `goalSpending.ts`: una sola query su `transactions` (`applyScope`, `in('goal_id', ids)`, `eq('tipo','expense')`, `gte('data', min(windowStart))`), poi somma in JS per finestra di ciascun obiettivo; senza obiettivi non fa query e ritorna `{}`.

- [ ] **Step 1: Scrivere i test che falliscono**

`accantonato.test.ts` (obiettivo TARI: `dilazionato`, `ricorrente`, target 300, `frequenzaMesi` 12, `scadenza` '2027-03-31', `createdAt` '2026-01-01T00:00:00Z'):
- `'con accantonaDa nullo i risultati sono quelli di oggi'`: today 2026-11-09 → 200.
- `'con accantonaDa a metà ciclo i mesi si contano da lì'`: `accantonaDa` '2026-11-09': today 2026-11-09 → 0; 2027-01-15 → 50; 2027-03-31 → 100.
- `'dopo la prima scadenza il ciclo è completo'`: today 2027-04-01 → 25.
- `'un accantonaDa nel futuro non dà mai negativo'`: `accantonaDa` '2027-02-01', today 2026-11-09 → 0.
- `'quota mensile invariata'`: `computeQuotaMensile` con `accantonaDa` → 25.
`oggi.test.ts`: `'oggiRomaData a cavallo della mezzanotte italiana'`: `new Date('2026-10-31T23:30:00Z')` → `format(…, 'yyyy-MM-dd')` = '2026-11-01'.
`goals.test.ts`: `'createGoal scrive accantona_da quando passato'` (payload insert contiene `accantona_da: '2026-11-09'`; senza il campo, `accantona_da: null`).
`goalSpending.test.ts` con `createFakeDb` e `createRecordingClient`: dati G1 (`bloccato`, non ricorrente, `createdAt` 2026-11-01), G2 (TARI sopra); spese casa H1: 40 su G1 (2026-11-05), 30 su G2 (2026-02-10, prima della finestra), 20 su G2 (2026-11-02), 15 income su G1, 99 su G1 in casa H2 → `'somma per obiettivo nella sua finestra'` = `{ G1: 40, G2: 20 }`; `'una sola query con scope e in(goal_id)'` (recording client: una chiamata a `transactions`, contiene `eq('household_id','H1')`, `in('goal_id', ['G1','G2'])`); `'nessun obiettivo, nessuna query'`.
`loadCasaData.test.ts`: il test esistente resta verde e in più `'legge lo speso collegato con una sola query'` (recording).

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run tests/calculations tests/data/goals.test.ts tests/data/goalSpending.test.ts tests/loadCasaData.test.ts` Expected: FAIL sui test nuovi.

- [ ] **Step 3: Implementare**

In `computeAccantonatoTeorico`: l'inizio da cui contare i mesi è `max(windowStart, parseISO(accantonaDa))` se `accantonaDa` valorizzato; `totalMonths` e `quotaMensile` restano quelli di prima; `bloccato` non cambia. `createGoal`: `accantona_da: input.accantonaDa ?? null`. `getSpecoCollegatoPerObiettivi`: usa `computeFinestraGoal` per ogni obiettivo (stessa semantica di `getSpecoCollegato`, estremi inclusi), una query, somma per obiettivo (`windowEnd` nullo = nessun limite superiore). `loadCasaData`: `today` interno = `oggiRomaData(today)` per il motore, e lo speso viene da `getSpecoCollegatoPerObiettivi(supabase, aggiunta.obiettivi, oggi, scopeCasa(id))`. `getSpecoCollegato` e `/goals`, `loadHomeData` (personali) restano come sono.

- [ ] **Step 4: Eseguire i test**

Run: gli stessi comandi. Expected: PASS.

- [ ] **Step 5: Chiusura standard** con i path dei file modificati e dei test.

---

## Task T9.2: Disponibile casa completo (D e cuscinetto) e spiegazioni

**Files:**
- Modify: `src/lib/calculations/casa/disponibileCasa.ts`, `src/lib/calculations/casa/spiegazioni.ts`, `src/lib/loadCasaData.ts`, `src/app/casa/ComeSiCalcola.tsx`, `src/app/casa/CasaHome.tsx`, `src/app/casa/page.tsx`
- Test: `tests/calculations/casa/disponibileCasa.test.ts`, `tests/calculations/casa/spiegazioni.test.ts`, `tests/loadCasaData.test.ts`, `tests/ComeSiCalcola.test.tsx`, `tests/CasaHome.test.tsx`

**Interfaces:**
- Consumes: `computeDisponibileCasa` (input già con `daPagareMese` e `cuscinettoObiettivo`), `pianoDelMese`, `mesiAlPieno` (`cuscinetto.ts`), `Spiegazione`.
- Produces:
  - `computeDaPagareMese(input: { voci: Pick<PlanItem,'categoriaId'|'importoMensile'|'frequenzaMesi'>[]; spese: Pick<Transaction,'tipo'|'importo'|'data'|'categoriaId'>[]; mese: string }): number` in `disponibileCasa.ts`: somma, sulle voci con `frequenzaMesi === 1` e categoria, di `max(0, importoMensile - speso nel mese in quella categoria)` (solo `expense`, mese = primi 7 caratteri di `mese`).
  - `pianoInVigore(piani: PlanBundle[], mese: string): PlanBundle | null` in `versamenti.ts`: come `pianoDelMese` ma `null` se nessuna versione ha `validoDal <= mese`.
  - `spiegaCuscinetto(input: { attuale: number; obiettivo: number; quotaMensile: number }): Spiegazione` e `spiegaDaParte(input: { goal: GoalForCalc; today: Date; spesoCollegato: number }): Spiegazione` in `spiegazioni.ts`.
  - `CasaData.cuscinetto: { attuale: number; obiettivo: number; quotaMensile: number } | null` (null senza piano in vigore).

- [ ] **Step 1: Scrivere i test che falliscono**

`disponibileCasa.test.ts`, `computeDaPagareMese` con voci Affitto (cat 'aff', 750, freq 1), Spesa (cat 'spesa', 300, freq 1), Luce (cat 'luce', 55, freq 2), mese '2026-11-01':
- `'toglie le spese già fatte nel mese'`: spese aff 750 (2026-11-03), spesa 64.2 (2026-11-08), spesa 50 (2026-10-30) → 235.8.
- `'non va sotto zero se si è speso oltre il previsto'`: spesa 400 → 0 per quella voce.
- `'le voci con frequenza maggiore di 1 non contano'`: solo Luce → 0.
- `'le entrate non contano'`.
`spiegazioni.test.ts`: `spiegaCuscinetto({attuale:59, obiettivo:1321, quotaMensile:59})` → `valore` 59, formula contiene "Soldi della casa per gli imprevisti" e "circa 22 mesi" (`mesiAlPieno(1321 - 59, 59)`), ingredienti `Messo da parte finora` 59, `Obiettivo` 1321, `Versato ogni mese per il cuscinetto` 59. `spiegaDaParte` per la TARI di T9.1 (`accantonaDa` '2026-11-09', today 2027-01-15, `spesoCollegato` 0): `valore` 50 uguale a `computeAccantonatoFinora`; ingredienti `Importo della bolletta` 300, `Mesi del ciclo` 12, `Al mese` 25, `Mesi già messi da parte` 2; è l'unica spiegazione in cui `valore` è il prodotto (Al mese × Mesi già messi da parte) e non la somma degli ingredienti; con `spesoCollegato` 20 compare `Già speso su questa bolletta` −20 e `valore` 30.
`loadCasaData.test.ts` (seed del test esistente più un piano valido dal 2026-10-01 con `cuscinetto_obiettivo` 100, `cuscinetto_quota_mensile` 10 e una voce con `categoria_id` 'ca-casa', `frequenza_mesi` 1, `importo_mensile` 300; spesa 'ca-casa' di 20 il 2026-11-10; today 2026-11-15; conto casa 1000, obiettivo bloccato 130):
- `'disponibile con D e cuscinetto'`: `{ a: 1000, b: 130, c: 0, d: 280, e: 590, cuscinetto: 100, valore: 490 }`.
- `'piano che parte nel futuro: D e cuscinetto a zero'` (valido dal 2026-12-01): `valore` 870, `cuscinetto` null.
- `'mezzanotte italiana'`: today `2026-10-31T23:30:00Z` e spesa del 2026-11-01 nella categoria → D calcolato su novembre.
`ComeSiCalcola.test.tsx`: `'i conteggi di mesi non sono euro'`: ingrediente `Mesi del ciclo` 12 mostra "12", non "12,00 €".
`CasaHome.test.tsx`: sotto il numero compare "Cuscinetto 59 di 1.321 €" con "Come si calcola?" quando c'è un piano in vigore; niente riga senza piano.

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run tests/calculations/casa tests/loadCasaData.test.ts tests/ComeSiCalcola.test.tsx tests/CasaHome.test.tsx` Expected: FAIL.

- [ ] **Step 3: Implementare**

`loadCasaData`: `piano = pianoInVigore(piani, meseRomaISO(now))`; `daPagareMese` da `computeDaPagareMese` sulle `transazioni` già caricate (nessuna lettura nuova); `cuscinettoObiettivo` dal piano; `cuscinetto` nel risultato. `ComeSiCalcola.formatIngrediente`: etichette di conteggio (`Numero di persone`, `Mesi del ciclo`, `Mesi già messi da parte`) con `formatNumero`. `CasaHome`: riga "Cuscinetto {attuale} di {obiettivo} €" nella hero card con `spiegaCuscinetto`. `page.tsx` passa `cuscinetto` in `finanze`.

- [ ] **Step 4: Eseguire i test.** Expected: PASS.

- [ ] **Step 5: Chiusura standard** con i path modificati.

---

## Task T9.3: Bollette in un tocco, `/casa/da-parte`, lista in variante casa

**Files:**
- Create: `src/lib/calculations/casa/fondi.ts`, `src/lib/data/fondiCasa.ts`, `src/app/casa/da-parte/page.tsx`, `src/app/casa/da-parte/DaParte.tsx`
- Modify: `src/app/goals/GoalsList.tsx`, `src/app/casa/CasaHome.tsx`
- Test: `tests/calculations/casa/fondi.test.ts`, `tests/data/fondiCasa.test.ts`, `tests/DaParte.test.tsx`, `tests/GoalsList.test.tsx`, `tests/CasaHome.test.tsx`

**Interfaces:**
- Consumes: `createGoal` con `accantonaDa` (T9.1), `getOpenGoals`, `getSpecoCollegatoPerObiettivi`, `oggiRomaData`, `spiegaDaParte` (T9.2), `link_plan_item_goal` (P1), `pianoInVigore`.
- Produces:
  - `fondi.ts`: `scadenzeProposte(input: { oggi: string; frequenzaMesi: number }): string[]` (ultimo giorno di ciascun mese da quello dopo `oggi` fino a `frequenzaMesi` mesi dopo); `anteprimaDaParte(input: { importoRicorrenza: number; frequenzaMesi: number; scadenza: string; oggi: string }): { quotaMensile: number; allaPrimaScadenza: number; mancaAllaPrimaScadenza: number; mesiAllaScadenza: number }` (usa il motore con `accantonaDa = oggi`); `statoVociDaParte(items: PlanItem[], goals: BudgetGoal[]): { item: PlanItem; goal: BudgetGoal | null; stato: 'messa' | 'da_mettere' }[]` (solo voci con `frequenzaMesi > 1`; `messa` se c'è un obiettivo aperto con `id === item.goalId`, oppure un obiettivo aperto ricorrente con `categoriaId === item.categoriaId`).
  - `fondiCasa.ts`: `creaFondoBolletta(supabase, input: { householdId: string; item: PlanItem; scadenza: string; oggi: string }): Promise<BudgetGoal>`: errore `voce senza categoria` se `item.categoriaId` è nullo (prima di scrivere); crea l'obiettivo (casa, `dilazionato`, `ricorrente: true`, `frequenzaMesi` e `importoTarget` della voce, `categoriaId`, `scadenza`, `accantonaDa: oggi`) e poi chiama la RPC `link_plan_item_goal`; se la RPC fallisce l'errore sale ma il fondo resta (si ripara da solo, Divergenza 5).
  - `GoalsList` prop `variante?: 'casa'` e campo opzionale `spiegazione?: Spiegazione` in `GoalWithQuotaMensile`.

- [ ] **Step 1: Scrivere i test che falliscono**

`fondi.test.ts`:
- `'scadenzeProposte per una voce trimestrale'`: oggi '2026-11-09', freq 3 → `['2026-12-31','2027-01-31','2027-02-28']`; freq 12 → 12 date, l'ultima '2027-11-30'.
- `'anteprima TARI: 100 su 300 alla prima scadenza'`: 300, freq 12, scadenza '2027-03-31', oggi '2026-11-09' → `{ quotaMensile: 25, allaPrimaScadenza: 100, mancaAllaPrimaScadenza: 200, mesiAllaScadenza: 4 }`.
- `'anteprima luce bimestrale'`: 110, freq 2, scadenza '2026-12-31', oggi '2026-11-09' → quota 55, alla prima 55, manca 55.
- `'statoVociDaParte'`: voce con `goalId` di un obiettivo aperto → `messa`; `goalId` di un obiettivo chiuso ma obiettivo aperto ricorrente con la stessa categoria → `messa`; nessuno → `da_mettere`; voce con frequenza 1 esclusa.
`fondiCasa.test.ts` (`createFakeDb` con `registerRpc('link_plan_item_goal', …)`): `'crea il fondo con i valori giusti'` (riga in `budget_goals` con `household_id` 'H1', `modalita` 'dilazionato', `ricorrente` true, `frequenza_mesi` 12, `importo_target` 300, `scadenza` '2027-03-31', `categoria_id`, `accantona_da` '2026-11-09'); `'collega la voce'` (rpc con `p_household`, `p_item`, `p_goal`); `'se il collegamento fallisce l'errore sale e il fondo resta'`; `'voce senza categoria non scrive niente'`.
`GoalsList.test.tsx`: `'variante casa: etichetta Da parte, niente Bloccato né Dilazionato'` (`assertNessunaParolaVietata`, testo "100 di 300 €" e "25 € al mese"); `'variante casa vuota: "Ancora niente messo da parte."'`; la variante di default resta identica (test esistenti verdi).
`DaParte.test.tsx` (mock come `RimborsoForm.test.tsx`): voce TARI `da_mettere` → "TARI, circa 300 € l'anno: 25 € al mese da ora." con il selettore "Quando arriva la prossima rata?" (default l'ultima scadenza proposta); scegliendo marzo 2027 compare "Per questa prima volta avrete messo da parte 100 di 300 €; il resto verrà dal cuscinetto. Dalla seconda, 300 su 300."; "Metti da parte" chiama `creaFondoBolletta` una volta anche con doppio click e poi `router.refresh`; errore → "Salvataggio fallito, controlla la connessione e riprova." con la scelta conservata; voce `messa` mostra "100 di 300 €" e "Come si calcola?"; senza piano: "Prima calcolate la quota: servono le voci per sapere cosa mettere da parte." con link a `/casa/quota`; piano senza voci da parte: "Nel piano non ci sono bollette da mettere da parte."; nessuna parola vietata in nessuno stato.
`CasaHome.test.tsx`: sezione "Da parte per le bollette" con i fondi aperti (nome, "100 di 300 €") e, se ci sono voci `da_mettere`, "3 bollette non sono ancora messe da parte" (singolare: "1 bolletta non è ancora messa da parte") con link a `/casa/da-parte`.

- [ ] **Step 2: Eseguire e verificare il fallimento** (`npx vitest run` sui file nominati). Expected: FAIL.

- [ ] **Step 3: Implementare**

`page.tsx` (Server Component come `/casa/quota`): casa, piano in vigore (`getPlanVersions` + `pianoInVigore`), obiettivi casa aperti, speso con `getSpecoCollegatoPerObiettivi`, nessuna lettura delle transazioni intere; passa a `DaParte` (client) le due sezioni: "Da parte, mese per mese" e "Da pagare una volta" (T10.2 la riempie; qui la sezione elenca gli obiettivi aperti non ricorrenti con `GoalsList variante="casa"`). Il testo di anteprima: `${nome}, circa ${importo} € ${freq === 12 ? "l'anno" : `ogni ${freq} mesi`}: ${quota} € al mese da ora.` Se `allaPrimaScadenza === importo` dire "Entro la prima scadenza avrete messo da parte tutto." Scrittura in modo ottimistico lieve: pulsante disabilitato, poi `router.refresh()`.

- [ ] **Step 4: Eseguire i test.** Expected: PASS.

- [ ] **Step 5: Chiusura standard** (cancello 0008: push dopo la conferma).

---

## Task T9.4: Obiettivo scelto dalla categoria

**Files:**
- Create: `src/lib/calculations/casa/preselezioneObiettivo.ts`
- Modify: `src/app/add/AddTransactionForm.tsx`, `src/app/add/AddTransactionSheet.tsx`
- Test: `tests/calculations/casa/preselezioneObiettivo.test.ts`, `tests/AddTransactionForm.test.tsx`, `tests/AddTransactionSheet.test.tsx`

**Interfaces:**
- Consumes: `BudgetGoal`.
- Produces: `obiettivoDaCategoria(goals: Pick<BudgetGoal,'id'|'categoriaId'|'stato'>[], categoriaId: string | null): string | null` (l'id se esiste esattamente un obiettivo aperto con quella categoria, altrimenti null); prop `preselezionaObiettivo?: boolean` di `AddTransactionForm` (default false: il personale non cambia).

- [ ] **Step 1: Scrivere i test che falliscono**

`preselezioneObiettivo.test.ts`: `'un solo obiettivo aperto con la categoria'` → il suo id; `'due obiettivi con la stessa categoria'` → null; `'obiettivo chiuso ignorato'` → null; `'categoria nulla'` → null.
`AddTransactionForm.test.tsx`: con `preselezionaObiettivo` e obiettivo 'g-luce' sulla categoria 'Luce': scegliere "Luce" poi inviare chiama `onSubmit` con `goalId: 'g-luce'`; scegliere "Affitto" → `goalId: null`; toccare il chip dell'obiettivo per deselezionarlo e poi cambiare categoria non lo ripreseleziona (`'una scelta manuale vince'`); senza la prop il comportamento è quello di oggi; i chip degli obiettivi espongono `aria-pressed`.
`AddTransactionSheet.test.tsx`: in modalità Casa la prop è attiva (inviare una bolletta in categoria Luce porta `goalId: 'g-luce'` a `createTransaction`), in Personale no.

- [ ] **Step 2: Eseguire e verificare il fallimento.** Expected: FAIL.

- [ ] **Step 3: Implementare**

Nel form uno stato `goalToccato` (diventa vero al primo tocco su un chip obiettivo); a ogni cambio di categoria o di tipo, se `preselezionaObiettivo` e non toccato, `goalId = obiettivoDaCategoria(goalsDisponibili, categoriaId)`; anche allo stato iniziale. Il foglio passa la prop solo nel ramo Casa.

- [ ] **Step 4: Eseguire i test.** Expected: PASS.

- [ ] **Step 5: Chiusura standard.**

---

## Task T10.1: Calcolo dei costi per entrare in casa

**Files:**
- Create: `src/lib/calculations/casa/costiIngresso.ts`
- Test: `tests/calculations/casa/costiIngresso.test.ts`

**Interfaces:**
- Consumes: `Spiegazione`, `computeFinestraGoal` non serve; `differenceInCalendarMonths`.
- Produces:
  - `export const COSTI_INGRESSO = { depositoMesiMax: 3, registroAliquota: 0.02, bollo: 32, agenziaIva: 0.22, allaccioPerUtenza: 100, utenzeIniziali: 3 }` (unico punto da cambiare).
  - `type ChiaveCosto = 'deposito' | 'registro' | 'bollo' | 'agenzia' | 'allacci' | 'arredo'`.
  - `calcolaCostiIngresso(input: { canoneMensile: number; mesiDeposito: number; cedolareSecca: boolean; agenzia: boolean; numeroUtenze: number; arredo: number }): { chiave: ChiaveCosto; nome: string; importo: number; nota: string; spiegazione: Spiegazione }[]` (sempre le sei voci nello stesso ordine; `mesiDeposito` ristretto a 1..3).
  - `totaleCosti(voci, selezionate: ChiaveCosto[]): number`.
  - `controllaDataIngresso(data: string, oggi: string): 'ok' | 'passata'` (uguale a oggi è ok).
  - `anteprimaGraduale(input: { importo: number; scadenza: string; oggi: string }): { mesi: number; quotaMensile: number }` (`mesi = max(1, differenceInCalendarMonths(scadenza, oggi))`).
  - `NOTE_COSTI` e `AVVISO_COSTI = 'Cifre indicative per orientarvi, non consulenza legale o fiscale.'`.

- [ ] **Step 1: Scrivere i test che falliscono**

Con canone 750, 2 mesi, cedolare no, agenzia no, 3 utenze, arredo 0:
- `'importi di partenza'`: deposito 1500, registro 90, bollo 32, agenzia 0, allacci 300, arredo 0; `totaleCosti` di tutte = 1922.
- `'la cedolare secca azzera registro e bollo'`: registro 0, bollo 0, totale 1800.
- `'agenzia: una mensilità più IVA'`: 915.
- `'mesi di deposito ristretti a 1..3'`: 5 → 2250; 0 → 750.
- `'registro: 2% del canone annuo, diviso a metà'`: spiegazione con ingredienti `Canone di un anno` 9000, `Imposta al 2%` 180, `Quota dell'inquilino` 90, e formula che dice "diviso a metà".
- `'note e avviso'`: la nota del deposito è "Per legge al massimo 3 mensilità. Ve lo restituiscono a fine contratto, con gli interessi."; quella del registro è "Di solito si divide a metà con il proprietario. Se sceglie la cedolare secca non si paga."; `AVVISO_COSTI` esatto; nessuna nota contiene parole vietate.
- `'controllaDataIngresso'`: '2026-11-08' con oggi '2026-11-09' → 'passata'; '2026-11-09' → 'ok'; '2027-03-15' → 'ok'.
- `'anteprimaGraduale'`: 1500, '2027-03-15', oggi '2026-11-09' → `{ mesi: 4, quotaMensile: 375 }`; stessa data del mese → `{ mesi: 1, quotaMensile: importo }`.

- [ ] **Step 2: Eseguire e verificare il fallimento.** Run: `npx vitest run tests/calculations/casa/costiIngresso.test.ts` Expected: FAIL.

- [ ] **Step 3: Implementare** le funzioni (arrotondamento a due decimali, importi mai negativi: ingressi negativi trattati come 0).

- [ ] **Step 4: Eseguire il test.** Expected: PASS.

- [ ] **Step 5: Chiusura standard.**

---

## Task T10.2: Costi di ingresso e cose da pagare una volta in `/casa/da-parte`

**Files:**
- Create: `src/app/casa/da-parte/CostiIngresso.tsx`, `src/app/casa/da-parte/NuovaCosa.tsx`
- Modify: `src/lib/data/fondiCasa.ts`, `src/app/casa/da-parte/DaParte.tsx`, `src/app/casa/da-parte/page.tsx`
- Test: `tests/data/fondiCasa.test.ts`, `tests/CostiIngresso.test.tsx`, `tests/NuovaCosa.test.tsx`, `tests/DaParte.test.tsx`

**Interfaces:**
- Consumes: `calcolaCostiIngresso`, `controllaDataIngresso`, `anteprimaGraduale`, `AVVISO_COSTI` (T10.1); `createGoal`, `closeGoal`; `GoalsList variante="casa"` (T9.3); `parseImporto`; `ComeSiCalcola`.
- Produces: in `fondiCasa.ts`: `creaFondoUnaVolta(supabase, input: { householdId: string; nome: string; importo: number; scadenza: string; oggi: string }): Promise<BudgetGoal>` (casa, `dilazionato`, `ricorrente: false`, `categoriaId: null`, `accantonaDa: oggi`) e `creaFondiIngresso(supabase, input: { householdId: string; scadenza: string; oggi: string; voci: { nome: string; importo: number }[]; esistenti: string[] }): Promise<BudgetGoal[]>` (salta i nomi già in `esistenti`, ignora importi non maggiori di zero, crea in sequenza; così "Metti da parte tutto" ripetuto dopo un errore a metà non duplica).

- [ ] **Step 1: Scrivere i test che falliscono**

`fondiCasa.test.ts`: `'creaFondoUnaVolta scrive un fondo graduale con scadenza e accantona_da'`; `'creaFondiIngresso crea un fondo per voce con importo'` (3 voci, una a 0 → 2 righe); `'ripetuto non duplica'` (con `esistenti: ['Deposito cauzionale']` crea solo le altre).
`CostiIngresso.test.tsx`: l'avviso `AVVISO_COSTI` è in testa; canone preimpostato dalla voce "Affitto" del piano (750) e modificabile; il deposito è 1.500 con "importo indicativo, controllate il contratto"; l'interruttore "Cedolare secca" porta registro e bollo a 0 e il totale delle voci selezionate a 1.800 (testo "Totale: 1.800 €"); ogni voce ha "Come si calcola?"; data di ingresso passata → "La data di ingresso è già passata." e "Metti da parte tutto" disabilitato; data valida mostra "Mettete da parte 1.500 € in 4 mesi: 375 € al mese" per il deposito; "Metti da parte tutto" chiama `creaFondiIngresso` una volta (doppio click compreso) con le voci selezionate e la data come `scadenza`; errore a metà → messaggio neutro e al secondo tentativo i nomi creati sono in `esistenti`; importi scritti a mano per l'arredo ("2000,5" vale 2000,5; "abc", vuoto, negativo disabilitano); nessuna parola vietata.
`NuovaCosa.test.tsx`: nome, importo e "Entro quando" (data) creano un fondo una volta con `creaFondoUnaVolta`; nome vuoto o importo non valido disabilitano; data passata rifiutata con la stessa frase.
`DaParte.test.tsx`: la sezione "Da pagare una volta" elenca i fondi non ricorrenti con "L'ho pagato" (chiama `closeGoal` dopo conferma "Segna come pagato: il fondo si chiude e i soldi tornano disponibili." e poi `router.refresh`); senza fondi: "Ancora niente da pagare una volta."

- [ ] **Step 2: Eseguire e verificare il fallimento.** Expected: FAIL.

- [ ] **Step 3: Implementare** i due componenti client e il loro uso in `DaParte`. Lo stato in `page.tsx` aggiunge il canone (`items.find(nome 'Affitto')?.importoRicorrenza`) e i nomi dei fondi una volta già aperti.

- [ ] **Step 4: Eseguire i test.** Expected: PASS.

- [ ] **Step 5: Chiusura standard.**

---

## Task T11.1: Calcolo e data layer del controllo del saldo

**Files:**
- Create: `src/lib/calculations/casa/controlloSaldo.ts`, `src/lib/data/balanceChecks.ts`
- Modify: `src/lib/calculations/casa/promemoria.ts`, `src/lib/loadCasaData.ts`, `src/lib/loadCasaStato.ts`
- Test: `tests/calculations/casa/controlloSaldo.test.ts`, `tests/calculations/casa/promemoria.test.ts`, `tests/data/balanceChecks.test.ts`, `tests/loadCasaData.test.ts`, `tests/loadCasaStato.test.ts`

**Interfaces:**
- Consumes: `record_balance_check` (0004, rafforzata dalla 0008), `getTransactions` già caricato.
- Produces:
  - `valutaControllo(saldoApp: number, saldoBanca: number): { differenza: number; esito: 'torna' | 'mancano' | 'in_piu'; frase: string }` (differenza arrotondata a 2 decimali; `torna` se `|differenza| < 1`).
  - `speseNonRegistrate(transazioni: Pick<Transaction,'tipo'|'importo'|'data'|'origine'>[], mese: string): number`.
  - `balanceChecks.ts`: `recordBalanceCheck(supabase, input: { accountId: string; saldoDichiarato: number; data: string; creaMovimento: boolean }): Promise<string>` (rpc con `p_account`, `p_saldo_dichiarato`, `p_data`, `p_crea_movimento`); `getControlliRecenti(supabase, householdId: string): Promise<{ ultimoControllo: string | null; ultimoCheckinMese: string | null }>` (due query `limit 1`, in parallelo, `balance_checks` ordinata per `data` e `household_checkins` per `mese`); `messaggioErroreControllo(e: unknown): string` ("Quel conto non è più disponibile." per `conto non valido`, "Quella data non è valida." per `data non valida`, altrimenti il messaggio di salvataggio fallito).
  - `AzionePromemoria.tipo` guadagna `'controllo' | 'checkin'` e il campo opzionale `href?: string`; `Promemoria.tipo` guadagna gli stessi valori; `StatoPromemoria.controllo?: { ultimo: string | null; riferimento: string; haConto: boolean }`.
  - `CasaData.controlli` e `CasaStato.controlli` (`{ ultimoControllo; ultimoCheckinMese }`); `StrisciaPromemoria` mostra un `Link` al posto del pulsante quando `azione.href` è valorizzato.

- [ ] **Step 1: Scrivere i test che falliscono**

`controlloSaldo.test.ts`: `(1020, 940)` → `{ differenza: -80, esito: 'mancano', frase: 'Mancano 80 €. Succede: nessuno ricorda ogni spesa.' }`; `(1020, 1100)` → `{ differenza: 80, esito: 'in_piu', frase: 'In banca ci sono 80 € in più di quelli registrati.' }`; `(1020, 1020.4)` e `(1020, 1020.99)` → `torna` con frase 'Torna tutto.'; `(1020, 1021)` → `in_piu` con differenza 1; `speseNonRegistrate`: 80 su novembre con una riga di ottobre e una di spesa normale ignorate → 80.
`balanceChecks.test.ts`: argomenti della rpc; `getControlliRecenti` con `createFakeDb` (due controlli, due check-in → data e mese più recenti; nessuno → null/null); mappatura degli errori.
`promemoria.test.ts`: `'controllo del saldo dopo 14 giorni'`: `controllo: { ultimo: '2026-10-25', riferimento: '2026-10-01', haConto: true }`, oggi '2026-11-09' (15 giorni) → promemoria `controllo` con testo "Un controllo veloce del conto comune? Confrontate il saldo con quello della banca." e azione `{ tipo: 'controllo', etichetta: 'Controlla', href: '/casa/controllo/conto' }`; ultimo '2026-10-26' (14 giorni) → nessuno; ultimo null con riferimento '2026-10-20' → sì; `haConto: false` → nessuno; viene dopo versamento, crediti e debiti; i test esistenti restano verdi (campo opzionale).
`StrisciaPromemoria.test.tsx`: l'azione con `href` è un link.
`loadCasaData.test.ts` e `loadCasaStato.test.ts`: `controlli` presente; `'nessuna query in più oltre alle due limit 1'` (recording).

- [ ] **Step 2: Eseguire e verificare il fallimento.** Expected: FAIL.

- [ ] **Step 3: Implementare.** I giorni di differenza si contano fra date di giorno (`YYYY-MM-DD`), mai fra istanti. Le due letture entrano nel `Promise.all` esistente dei loader.

- [ ] **Step 4: Eseguire i test.** Expected: PASS.

- [ ] **Step 5: Chiusura standard.**

---

## Task T11.2: Schermata del controllo del saldo

**Files:**
- Create: `src/app/casa/ControlloSaldo.tsx`, `src/app/casa/controllo/conto/page.tsx`
- Modify: `src/app/casa/CasaHome.tsx`, `src/app/casa/page.tsx`, `src/app/HomeDashboard.tsx`
- Test: `tests/ControlloSaldo.test.tsx`, `tests/CasaHome.test.tsx`, `tests/HomeDashboard.test.tsx`

**Interfaces:**
- Consumes: `valutaControllo`, `recordBalanceCheck`, `messaggioErroreControllo`, `speseNonRegistrate`, `oggiRomaISO`, `parseImporto`, `getAccounts` con `casa(id)` (la pagina legge solo i conti, nessuna transazione).
- Produces: `ControlloSaldo({ conti: Account[]; onFatto?: () => void }): JSX` (client; usato anche dal check-in, T12.2); `statoPromemoria` accetta `controllo` e lo passa a `computeReminders` (home e `/casa`).

- [ ] **Step 1: Scrivere i test che falliscono**

`ControlloSaldo.test.tsx` (mock come `RimborsoForm.test.tsx`; conto "Conto comune" con saldo 1.020):
- mostra "Per l'app c'è: 1.020 €"; scrivere "940" mostra "Mancano 80 €. Succede: nessuno ricorda ogni spesa."; "Segna come spese non registrate" chiama `recordBalanceCheck` una volta (anche con doppio click) con `{ accountId: 'ac-casa', saldoDichiarato: 940, data: '2026-11-09', creaMovimento: true }`; poi "Fatto. Il saldo ora è 940 €."
- `'virgola decimale'`: "940,5" vale 940,5.
- `'torna tutto'`: "1020,4" → "Torna tutto." e il pulsante "Fatto" registra con `creaMovimento: false`.
- `'in più'`: "1100" → "In banca ci sono 80 € in più di quelli registrati." con "Segna come entrata non registrata" (`creaMovimento: true`) e il link "Ho dimenticato un versamento" verso `/casa`.
- `'mancano: la via per tornare indietro'`: link "Ho dimenticato di registrare qualcosa" verso `/casa`.
- vuoto, "abc", "-5" e "0" non permettono di registrare (zero è un saldo valido: "0" abilita, vuoto no); mai `NaN` nel DOM; errore → messaggio neutro e il valore resta; due conti → un selettore; nessun conto → "Aggiungete prima il conto comune dalla pagina Casa." con link; la data è `oggiRomaISO` anche con `new Date('2026-10-31T23:30:00Z')` (vale 2026-11-01).
- nessuna parola vietata in nessuno stato.
`CasaHome.test.tsx`: link "Controlla il conto" verso `/casa/controllo/conto`; riga "Spese non registrate questo mese: 80 €" solo se maggiore di zero, senza nomi.
`HomeDashboard.test.tsx`: con ultimo controllo di 15 giorni fa, la riga compatta dei promemoria porta il testo del controllo.

- [ ] **Step 2: Eseguire e verificare il fallimento.** Expected: FAIL.

- [ ] **Step 3: Implementare.** La pagina `/casa/controllo/conto` è un Server Component (casa o `redirect('/casa')`, conti della casa) che rende `ControlloSaldo` con il titolo "Controlla il conto" e "Quanto c'è davvero sul conto comune?". Dopo la scrittura `router.refresh()`.

- [ ] **Step 4: Eseguire i test.** Expected: PASS.

- [ ] **Step 5: Chiusura standard.**

---

## Task T12.1: Calcolo e data layer del check-in

**Files:**
- Create: `src/lib/calculations/casa/checkin.ts`, `src/lib/data/checkins.ts`
- Modify: `src/lib/calculations/casa/promemoria.ts`
- Test: `tests/calculations/casa/checkin.test.ts`, `tests/data/checkins.test.ts`, `tests/calculations/casa/promemoria.test.ts`

**Interfaces:**
- Consumes: `RigaMese`, `PlanBundle`, `pianoInVigore`, `Transaction`, `Checkin`, `Spiegazione`, `save_household_checkin` (P1), `meseRomaISO`.
- Produces:
  - `checkin.ts`: `computeCheckin(input: { mese: string; righePerMembro: Record<string, RigaMese[]>; piano: PlanBundle | null; spese: Transaction[]; precedente: { esito: EsitoCheckin } | null }): CheckinCalcolato` con `CheckinCalcolato = { mese; attesoTotale; versatoTotale; previstoMensili; spesoMensili; nonRegistrate; avanzo; esito: EsitoCheckin; secondoAmmanco: boolean; spiegazioneAvanzo: Spiegazione }`; `mesePrecedente(mese: string): string`; `meseDaControllare(input: { oggi: string; righe: RigaMese[]; ultimoCheckinMese: string | null }): string | null`.
  - `checkins.ts`: `getCheckin(supabase, householdId: string, mese: string): Promise<Checkin | null>`; `saveCheckin(supabase, input: SaveCheckinInput): Promise<string>` con `SaveCheckinInput = { householdId; mese; attesoTotale; versatoTotale; previstoMensili; spesoMensili; nonRegistrate; avanzo; destinazione?: 'cuscinetto' | 'da_parte' | null; goalId?: string | null; nuovaCosa?: string | null }` (rpc `save_household_checkin` con i parametri `p_*`); `class CheckinGiaFattoError extends Error` lanciata quando il messaggio contiene `check-in gia fatto`; `messaggioErroreCheckin(e: unknown): string`.
  - `StatoPromemoria.checkin?: { mese: string | null }`; `statoPromemoria` calcola `mese` con `meseDaControllare` e `ultimoCheckinMese`.

- [ ] **Step 1: Scrivere i test che falliscono**

`checkin.test.ts` (mese '2026-10-01'; due membri con righe: atteso 776 e 604, versato 776 e 604):
- `'avanzo come somma dei due termini'`: previsto 1.288 (voci mensili Affitto 750, Spesa 300, Internet 28, Condominio 50, Manutenzione 30, altre fino a 1.288), spese registrate 1.161, riconciliazione 80 → `attesoTotale` 1380, `versatoTotale` 1380, `spesoMensili` 1161, `nonRegistrate` 80, `avanzo` 47, `esito` 'avanzo'.
- `'un versamento mancante pesa'`: versato 1.076 (304 in meno), previsto 1.288 e speso 1.288 → `avanzo` −304, `esito` 'ammanco'.
- `'soglie dell'esito'`: avanzo 0,5 e −0,99 → 'in_pari'; 1 → 'avanzo'; −1 → 'ammanco'.
- `'esclusioni dalle spese'`: una spesa con `goalId`, una nella categoria di una voce con frequenza 2, una `income`, una di settembre e una `riconciliazione` non entrano in `spesoMensili` (la `riconciliazione` entra solo in `nonRegistrate`).
- `'senza piano il previsto è 0'`.
- `'secondo ammanco'`: esito 'ammanco' con precedente 'ammanco' → true; con precedente 'avanzo' → false; esito 'avanzo' con precedente 'ammanco' → false.
- `'spiegazioneAvanzo'`: `valore` = `avanzo`, formula in parole ("versamenti ricevuti meno attesi, più spese previste meno registrate meno non registrate").
- `meseDaControllare`: oggi '2026-11-09', righe da '2026-10-01', ultimo null → '2026-10-01'; ultimo '2026-10-01' → null; righe solo da '2026-11-01' → null; oggi '2026-12-01', righe da ottobre, ultimo '2026-10-01' → '2026-11-01'; ultimo '2026-09-01' con oggi '2026-11-09' → '2026-10-01'; righe vuote → null.
`checkins.test.ts`: mappatura riga → `Checkin`; argomenti della rpc; `CheckinGiaFattoError`; messaggio "Il check-in di questo mese è già stato fatto."
`promemoria.test.ts`: `'check-in pronto'`: `checkin: { mese: '2026-10-01' }` → promemoria `checkin:2026-10-01` con testo "Il check-in di ottobre è pronto: due minuti per vedere com'è andato il mese." e azione `{ tipo: 'checkin', etichetta: 'Apri', href: '/casa/controllo' }`; `mese: null` → nessuno; ordine: dopo i debiti e prima del controllo del saldo.

- [ ] **Step 2: Eseguire e verificare il fallimento.** Expected: FAIL.

- [ ] **Step 3: Implementare.** `computeCheckin` prende per ogni membro la riga con `mese` uguale; tutti gli importi arrotondati a due decimali; mese delle spese = primi 7 caratteri di `data`.

- [ ] **Step 4: Eseguire i test.** Expected: PASS.

- [ ] **Step 5: Chiusura standard.**

---

## Task T12.2: Pagina del check-in mensile

**Files:**
- Create: `src/lib/loadCheckin.ts`, `src/app/casa/controllo/page.tsx`, `src/app/casa/controllo/CheckinMensile.tsx`
- Modify: `src/app/casa/CasaHome.tsx`
- Test: `tests/loadCheckin.test.ts`, `tests/CheckinMensile.test.tsx`, `tests/CasaHome.test.tsx`

**Interfaces:**
- Consumes: `loadCasaData` (T9.2, già con `controlli`), `computeCheckin`, `meseDaControllare`, `mesePrecedente`, `getCheckin`, `saveCheckin`, `CheckinGiaFattoError` (T12.1); `ControlloSaldo` (T11.2); `ComeSiCalcola`; `getOpenGoals` casa (dall'`aggiunta` di `loadCasaData`).
- Produces: `loadCheckin(supabase, casa: CasaCorrente, now?: Date): Promise<{ stato: 'nessun_mese' | 'da_fare' | 'fatto'; mese: string | null; calcolo: CheckinCalcolato | null; fatto: Checkin | null; chi: string | null; cuscinetto: CasaData['cuscinetto']; conti: Account[]; fondiPerAvanzo: BudgetGoal[]; nomi: Record<string,string> }>` (`fondiPerAvanzo`: obiettivi aperti con `modalita === 'bloccato'` e non ricorrenti); `CheckinMensile` (client).

- [ ] **Step 1: Scrivere i test che falliscono**

`loadCheckin.test.ts` (`createFakeDb`, oggi 2026-11-09, piano attivo da 2026-10-01, righe di ottobre): `'da_fare per ottobre'` con `mese` '2026-10-01'; `'fatto'` con la riga in `household_checkins` (`chi` = nome del membro autore); `'nessun_mese'` senza piano o con piano partito a novembre; il secondo ammanco legge anche il check-in di settembre; con `now = 2026-10-31T23:30:00Z` (in Italia è già il 1 novembre) il mese dovuto è ottobre, non settembre.
`CheckinMensile.test.tsx` (mock come `RimborsoForm.test.tsx`; `saveCheckin` mockata):
- titolo "Ottobre in casa"; riga versamenti "Fabio 776 di 776" e "Anna 604 di 604"; "Spese del mese: previste 1.288 €, registrate 1.161 €, non registrate 80 €"; "Cuscinetto 59 di 1.321 €"; "Come si calcola?" sull'avanzo.
- avanzo 47: "In avanzo di 47 €. Cosa ne facciamo?" con scelta "Lasciamoli al cuscinetto" già selezionata e "Mettiamoli da parte per…" con elenco `fondiPerAvanzo` e "una cosa nuova" (nome obbligatorio); "Fatto, a novembre" chiama `saveCheckin` una volta con `{ householdId, mese: '2026-10-01', attesoTotale: 1380, versatoTotale: 1380, previstoMensili: 1288, spesoMensili: 1161, nonRegistrate: 80, avanzo: 47, destinazione: 'cuscinetto' }`; con la scelta del fondo `destinazione: 'da_parte', goalId`; con la cosa nuova `nuovaCosa: 'Vacanza'`.
- ammanco: "Sono usciti 62 € più del previsto. Li prendiamo dal cuscinetto." senza scelta di destinazione, `destinazione` assente; in pari: "Tutto è andato come previsto."
- secondo ammanco: "È il secondo mese: forse la quota è un po' bassa. Non è colpa di nessuno." con link "Guarda le stime reali" verso `/casa/quota`.
- passo 0: `ControlloSaldo` con "Salta" che passa oltre; dopo `onFatto` passa oltre.
- già fatto da altri: `CheckinGiaFattoError` → "Il check-in di ottobre è già stato fatto da {nome}." senza perdere i dati; stato `fatto`: "Fatto da Fabio il 2 novembre." con i numeri salvati (dal record, non ricalcolati); `nessun_mese`: "Il check-in parte dal primo mese intero con la quota attiva." con link a `/casa`; doppio click su "Fatto" = una sola chiamata; nessuna parola vietata in nessuno stato.
`CasaHome.test.tsx`: il promemoria del check-in compare con il link.

- [ ] **Step 2: Eseguire e verificare il fallimento.** Expected: FAIL.

- [ ] **Step 3: Implementare.** `page.tsx` Server Component (casa o `redirect('/casa')`); `loadCheckin` chiama `loadCasaData` una volta (nessuna lettura propria dell'intera storia) e `getCheckin` per il mese dovuto e il precedente. Dopo `saveCheckin` `router.push('/casa')` con refresh.

- [ ] **Step 4: Eseguire i test.** Expected: PASS.

- [ ] **Step 5: Chiusura standard** (cancello 0008).

---

## Task T13.1: Stima contro reale, calcoli e data layer

**Files:**
- Create: `src/lib/calculations/casa/stimaVsReale.ts`, `src/lib/data/stime.ts`
- Modify: `src/lib/data/transactions.ts`
- Test: `tests/calculations/casa/stimaVsReale.test.ts`, `tests/data/stime.test.ts`, `tests/data/transactions.test.ts`

**Interfaces:**
- Consumes: `PlanItem`, `PlanBundle`, `PlanVersionInput`, `calcolaTotale`, `quoteReali`, `totaleVociMensili` (`quota.ts`, `mensilizza.ts`; leggere `quoteReali` e `buildPlanVersions` in `pianoVersioni.ts` per le firme), `updateGoal`, `savePlan`, `set_plan_item_stima_ignorata` (P1).
- Produces:
  - `type PropostaStima = { itemId: string; nome: string; categoriaId: string; frequenzaMesi: number; importoMensileAttuale: number; mediaReale: number; nuovoMensile: number; nuovoImportoRicorrenza: number; n: number; unita: 'bollette' | 'mesi' }`.
  - `proponiStime(input: { voci: PlanItem[]; spese: Pick<Transaction,'tipo'|'importo'|'data'|'categoriaId'|'origine'>[]; inizioPiano: string; oggi: string }): PropostaStima[]`.
  - `pianoConStimaAggiornata(bundle: PlanBundle, proposta: PropostaStima, validoDal: string): PlanVersionInput | null` (null se qualche quota ha `esceDal` valorizzato); `quoteDelConfronto(bundle: PlanBundle, nuovo: PlanVersionInput): { nome: string; prima: number; dopo: number }[]`; `puoAggiornarePiano(piani: PlanBundle[], meseCorrente: string): boolean` (false se esiste una versione con `validoDal` maggiore del mese corrente).
  - `stime.ts`: `ignoraStima(supabase, householdId: string, itemId: string, n: number): Promise<void>` (rpc `set_plan_item_stima_ignorata`); `applicaStima(supabase, input: { householdId: string; bundle: PlanBundle; proposta: PropostaStima; goal: BudgetGoal | null; validoDal: string }): Promise<void>` (prima `updateGoal` se c'è l'obiettivo, poi `savePlan` con la versione di `pianoConStimaAggiornata`; è riprovabile).
  - `transactions.ts`: `getSpeseCasaPerCategorie(supabase, householdId: string, categoriaIds: string[], da: string): Promise<Transaction[]>` (`applyScope` casa, `in('categoria_id', ids)`, `eq('tipo','expense')`, `gte('data', da)`; senza categorie non fa query).

- [ ] **Step 1: Scrivere i test che falliscono**

`stimaVsReale.test.ts` (oggi '2026-11-09', `inizioPiano` '2026-01-01'):
- `'luce: le ultime tre bollette fanno 71 al mese'`: voce Luce freq 2, `importoRicorrenza` 110 (`importoMensile` 55), tre spese da 142 → una proposta con `mediaReale` 142, `nuovoMensile` 71, `nuovoImportoRicorrenza` 142, `n` 3, `unita` 'bollette'.
- `'servono almeno tre spese'`: due → nessuna.
- `'sotto soglia'`: bollette da 112 (nuovo mensile 56, differenza 1 < max(2, 2,75)) → nessuna.
- `'soglia del 5 per cento'`: Spesa alimentare freq 1, 300 al mese, totali dei mesi chiusi agosto, settembre, ottobre da 330 (più luglio da 100, ignorato perché non fra gli ultimi tre; spese di novembre ignorate perché il mese non è chiuso) → `mediaReale` 330, `nuovoMensile` 330, `unita` 'mesi', `n` 4 (mesi chiusi con spese dal 2026-01-01: luglio incluso nel conteggio).
- `'riproposta dopo n più 3'`: `stimaIgnorataConN` 3 con `n` 3 → nessuna; `n` 5 → nessuna; `n` 6 → sì.
- `'ignora voci senza categoria e spese di riconciliazione'`.
`pianoConStimaAggiornata` con `ESEMPIO_VOCI` e `ESEMPIO_PERSONE` (regola 'proporzionale', cuscinetto 59, arrotondamento 10, valido dal '2026-10-01'): per la proposta di Luce (142 a ricorrenza) con `validoDal` '2026-12-01' → `totaleMensile` 1400, quote 788 (Fabio) e 612 (Anna), voce Luce con `importoRicorrenza` 142, `origineStima` 'reale', `stimaIgnorataConN` nullo; `quoteDelConfronto` → Fabio 776→788, Anna 604→612; con una quota con `esceDal` → null.
`puoAggiornarePiano`: piani [2026-10] e mese corrente '2026-11-01' → true; piani [2026-10, 2026-12] → false.
`stime.test.ts`: `ignoraStima` passa gli argomenti; `applicaStima` chiama `updateGoal` prima di `savePlan` (ordine) e con `goal: null` solo `savePlan`; se `updateGoal` fallisce non salva il piano.
`transactions.test.ts`: `getSpeseCasaPerCategorie` (recording: `eq household_id`, `in categoria_id`, `gte data`).

- [ ] **Step 2: Eseguire e verificare il fallimento.** Expected: FAIL.

- [ ] **Step 3: Implementare.** Per le voci a frequenza 1 le spese si sommano per mese di `data` e si considerano i mesi chiusi (fino al mese prima di `oggi`) con almeno una spesa; per le altre le ultime tre spese per data. `pianoConStimaAggiornata` ricalcola `sottotot`, `calcolaTotale` e le quote con la stessa regola del piano (come `PianoAttuale`/`buildPlanVersions`), mantenendo redditi, percentuali, `inCasaDal`, giorno di versamento e cuscinetto.

- [ ] **Step 4: Eseguire i test.** Expected: PASS.

- [ ] **Step 5: Chiusura standard.**

---

## Task T13.2: Card "stima contro reale" nel check-in e nella pagina quota

**Files:**
- Create: `src/app/casa/CardStima.tsx`
- Modify: `src/app/casa/controllo/CheckinMensile.tsx`, `src/lib/loadCheckin.ts`, `src/app/casa/quota/page.tsx`, `src/app/casa/quota/QuotaClient.tsx`
- Test: `tests/CardStima.test.tsx`, `tests/CheckinMensile.test.tsx`, `tests/QuotaPage.test.tsx` (nuovo, sullo schema di `tests/PianoAttuale.test.tsx`)

**Interfaces:**
- Consumes: tutto da T13.1; `getSpeseCasaPerCategorie`; per il check-in le `transazioni` già caricate da `loadCasaData`.
- Produces: `CardStima({ proposta: PropostaStima; bundle: PlanBundle; goal: BudgetGoal | null; householdId: string; validoDal: string; programmata: boolean; onFatto: () => void }): JSX`; `loadCheckin` restituisce anche `proposte: PropostaStima[]`, `pianiFuturi: PlanBundle[]` e `fondiPerVoce`.

- [ ] **Step 1: Scrivere i test che falliscono**

`CardStima.test.tsx` (mock di `applicaStima` e `ignoraStima`): per Luce "Luce: avete previsto 55 € al mese, le ultime 3 bollette fanno in media 71 € al mese." e "Con 71 €: Fabio 776 → 788 €, Anna 604 → 612 €." (con la freccia come carattere `→`); per le voci mensili "Spesa alimentare: avete previsto 300 € al mese, negli ultimi 3 mesi ne sono usciti in media 330 €."; "Aggiorna la stima" chiama `applicaStima` una volta (doppio click compreso) con `validoDal` '2026-12-01', `goal` della voce e poi `onFatto`; il testo dice "La parte messa da parte per questa voce si aggiorna subito; la quota nuova parte da dicembre."; "Non ora" chiama `ignoraStima` con `n` della proposta (3) e nasconde la card; errore → "Salvataggio fallito, controlla la connessione e riprova." e la card resta; `programmata: true` → nessun pulsante "Aggiorna", frase "C'è già una modifica programmata: la trovate in Rivedi la quota." con link a `/casa/quota`; piano con uscenti (proposta non applicabile) → stessa via d'uscita; nessuna parola vietata.
`CheckinMensile.test.tsx`: le card appaiono sotto i numeri e non bloccano il "Fatto"; nessuna proposta, nessuna card; dopo il secondo ammanco il link "Guarda le stime reali" porta alla stessa lista (`/casa/quota`).
`QuotaPage.test.tsx`: la pagina quota mostra le card sopra `PianoAttuale` quando ci sono proposte e legge le spese con una query limitata a categorie e data di inizio.

- [ ] **Step 2: Eseguire e verificare il fallimento.** Expected: FAIL.

- [ ] **Step 3: Implementare.** `validoDal` = primo del mese successivo (`meseRomaISO`, mese dopo). `quota/page.tsx` legge le spese con `getSpeseCasaPerCategorie` solo se il piano ha voci con categoria e il piano è attivo.

- [ ] **Step 4: Eseguire i test.** Expected: PASS.

- [ ] **Step 5: Chiusura standard** (cancello 0008).

---

## Task T14.1: Stati vuoti e di errore della parte Casa

**Files:**
- Create: `src/app/casa/error.tsx`
- Modify: `src/app/casa/CasaHome.tsx`, `src/app/casa/movimenti/MovimentiCasa.tsx`, `src/app/casa/da-parte/DaParte.tsx`, `src/app/casa/controllo/CheckinMensile.tsx`, `src/app/casa/ControlloSaldo.tsx`
- Test: `tests/CasaError.test.tsx`, `tests/CasaHome.test.tsx`, `tests/MovimentiCasa.test.tsx`

**Interfaces:**
- Consumes: i componenti dei task precedenti.
- Produces: error boundary `src/app/casa/error.tsx` con props `{ error: Error & { digest?: string }; retry: () => void }` (la firma verificata in `error.md`).

- [ ] **Step 1: Scrivere i test che falliscono**

`CasaError.test.tsx`: titolo "Non riesco a leggere la casa", testo "I tuoi dati personali non sono toccati. Riprova tra un attimo.", il pulsante "Riprova" chiama `retry`, il link "Torna alla home" va a `/`; nessuna parola vietata.
`CasaHome.test.tsx`: `'se conti e spese non si leggono'` (finanze assente): "Non riesco a leggere conti e spese della casa. Riprova tra poco." e restano raggiungibili quota e impostazioni; `'nessuna spesa'`: "Ancora nessuna spesa di casa. Appena ne aggiungete una, la vedete qui entrambi."; senza conto comune il modulo di creazione è visibile; senza piano nessuna sezione di versamenti e un invito a calcolare la quota.
`MovimentiCasa.test.tsx`: mese senza movimenti → "Nessun movimento in questo mese." (senza colpa, senza conteggi).
Test già scritti nei task T9.3, T11.2, T12.2 coprono gli stati di `/casa/da-parte`, del controllo e del check-in (senza piano, senza conto comune, nessun mese da controllare): qui si verifica soltanto che i testi coincidano con questo elenco e si aggiunge a `ControlloSaldo` il caso "senza conti".

- [ ] **Step 2: Eseguire e verificare il fallimento.** Expected: FAIL.

- [ ] **Step 3: Implementare.** I testi sono quelli sopra, in tono neutro. Nessun nuovo stato di caricamento (è del blocco 2).

- [ ] **Step 4: Eseguire i test.** Expected: PASS.

- [ ] **Step 5: Chiusura standard** con i path modificati.

---

## Task T14.2: Parole vietate, coerenza dei testi, documenti

**Files:**
- Create: `tests/casaTesti.test.ts`, `tests/casaParoleVietate.test.tsx`
- Modify: i file di testo che la verifica segnala; `docs/ROADMAP.md`
- Test: i due file nuovi

**Interfaces:**
- Consumes: `PAROLE_VIETATE`, `assertNessunaParolaVietata` (`tests/helpers/paroleVietate.ts`), tutti i componenti della parte Casa.
- Produces: due guardie permanenti.

- [ ] **Step 1: Scrivere i test**

`casaTesti.test.ts` (statico): legge tutti i `.ts` e `.tsx` sotto `src/app/casa/` e `src/lib/calculations/casa/`, toglie i commenti e i soli letterali interi `'bloccato'`, `'dilazionato'`, `'riconciliazione'` (valori di database) e fallisce se rimane una delle `PAROLE_VIETATE` (senza distinguere le maiuscole); fallisce anche per le frasi "hai speso troppo", "in ritardo", "sei indietro". Allowlist esplicita nel file, una voce per riga con il motivo (per esempio la frase "Non è colpa di nessuno" non è nella lista delle frasi vietate e passa).
`casaParoleVietate.test.tsx` (DOM): monta `CasaHome` (con piano, senza piano, senza finanze), `DaParte` (voci da mettere, messe, senza piano), `GoalsList variante="casa"` (con fondi, vuota), `CostiIngresso`, `NuovaCosa`, `ControlloSaldo` (mancano, in più, torna, nessun conto), `CheckinMensile` (avanzo, ammanco, secondo ammanco, in pari, fatto, nessun mese), `CardStima` (bollette, mesi, programmata), `CasaSenzaCasa`, `error.tsx`, e chiama `assertNessunaParolaVietata` su ciascuno.

- [ ] **Step 2: Eseguire.** Run: `npx vitest run tests/casaTesti.test.ts tests/casaParoleVietate.test.tsx` Expected: i test passano solo dopo aver corretto ogni occorrenza segnalata; ogni correzione si fa nel file che la contiene, mai allargando l'allowlist senza motivo.

- [ ] **Step 3: Passata di coerenza dei testi.** Percorrere a mano ogni schermata della parte Casa (con `npm run dev` e dati di prova, o leggendo i componenti) e uniformare: "versamento" (mai "bonifico" come nome della cosa), "quota", "cuscinetto" con la definizione di una riga raggiungibile con "Come si calcola?", "da parte" (mai "accantonato" né "fondo" nel DOM), "spese non registrate", cifre come `776 €`, nomi al posto di "l'altro", tono neutro. Ogni correzione di testo aggiorna i test che la citano.

- [ ] **Step 4: Aggiornare `docs/ROADMAP.md`**

Nel blocco 1: stato del 9 novembre 2026 con consegne 6 a 8 fatte, piano in `docs/superpowers/plans/2026-11-09-casa-comune-consegne-6-8.md`, migrazioni fino alla 0008 eseguite; elenco di cosa c'è (bollette in un tocco, costi di ingresso, disponibile casa completo, controllo del saldo, check-in mensile, stima contro reale); i rimandati ancora aperti (scrittura atomica riga e saldo, modifica spesa con carta personale, `id` obiettivo nel calendario, avviso iOS 18, puntino sulla barra, promemoria "Rivedi la quota", pulsante "Nuova cosa da mettere da parte" nel foglio di aggiunta). Nel blocco 2, nelle note sulla velocità: letture nuove aggiunte da queste consegne (le due `limit 1` in `loadCasaData` e `loadCasaStato`, il check-in e D e la stima che usano le transazioni già caricate) e quelle tolte (una query per obiettivo sostituita da una), con l'avvertenza che D, stima e check-in vanno spostati su letture per mese quando si risolve il limite di circa 1000 righe.

- [ ] **Step 5: Chiusura standard** con i path dei test, dei file di testo modificati e di `docs/ROADMAP.md`.

---

## Self-Review

**Copertura della spec (T9 a T14).** T9: motore `accantona_da` (T9.1), bollette in un tocco e collegamento voce-obiettivo (T9.3, P1), preselezione (T9.4), disponibile casa con B, C, D e cuscinetto (T9.2). T10: checklist, cedolare, data di ingresso, obiettivi graduali con scadenza alla data (T10.1, T10.2). T11: `record_balance_check` (P1), `balanceChecks.ts`, schermata, riga delle spese non registrate, promemoria (T11.1, T11.2). T12: `checkin.ts`, `checkins.ts`, `/casa/controllo`, destinazione dell'avanzo, secondo ammanco, promemoria (T12.1, T12.2). T13: `stimaVsReale.ts`, card nel check-in e nella quota, aggiornamento di piano e obiettivo (T13.1, T13.2). T14: stati vuoti e di errore, parole vietate, coerenza, ROADMAP (T14.1, T14.2). La sezione 7.10 (spiegazioni) è coperta da `spiegaCuscinetto`, `spiegaDaParte`, la spiegazione di ogni costo di ingresso e quella dell'avanzo. Lacune dichiarate: Divergenza 11.

**Coerenza dei tipi.** `PropostaStima`, `SaveCheckinInput`, `CheckinCalcolato`, `AzionePromemoria.href` e `CasaData.cuscinetto` sono definiti in un task e usati negli altri con lo stesso nome; `oggiRomaData` (T9.1) è citato in Global Constraints; `ControlloSaldo` (T11.2) è riusato da T12.2.

**Proporzione.** Codice completo solo per la migrazione (SQL che esegue un umano); tutto il resto sono firme, nomi di test e valori esatti.
