# Casa comune, consegne 4 e 5: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare in produzione le spese comuni (conto comune, spese di casa, selettore Personale|Casa, disponibile casa), i movimenti fra membri (versamenti, rimborsi, restituzioni, crediti, debiti, righe neutre nello storico), la riserva del versamento nel disponibile personale con i promemoria, e il feed calendario privato.

**Architecture:** Il data layer con `Scope` esiste già: la casa si legge sempre con `casa(householdId)`, il personale resta il default. I calcoli nuovi sono funzioni pure in `src/lib/calculations/casa/` che riproducono le definizioni SQL già in produzione (`_casa_arretrati`, `_casa_credito_aperto`, `_casa_debiti_aperti`), così la UI e i blocchi di uscita non possono divergere. Le scritture fra membri passano solo dalle RPC `record_transfer` e `delete_transfer`; i saldi dei conti di casa si muovono solo con `adjust_account_balance` (delta). Una sola migrazione nuova (0007) raccoglie le correzioni SQL emerse dalle revisioni, eseguita a mano da Fabio.

**Tech Stack:** Next.js 16.3 (App Router, `src/proxy.ts`), Supabase (Postgres, RLS, RPC), TypeScript, Vitest con Testing Library, date-fns 4, lucide-react.

**Spec:** [docs/superpowers/specs/2026-11-08-co-gestione-casa-design.md](../specs/2026-11-08-co-gestione-casa-design.md), sezioni 6.3, 7.3 a 7.7, 8.4 a 8.6, 8.12, 9.2, 12 (T6, T7, T8, T8b). Piano precedente (consegne 1 a 3, già in produzione): `docs/superpowers/plans/2026-11-08-casa-comune-consegne-1-3.md`. Gli esecutori leggono spec e piano insieme: qui si decidono nomi, firme, file e test; la spec resta la fonte per testi e motivazioni.

**Ordine di esecuzione:** P1, P2, P3, P4, T6.1, T6.2, T7.1, T7.2, T7.3, T7.4, T8.1, T8.2, T8b.1, T8b.2. P5 si esegue dopo che Fabio ha confermato di aver lanciato la 0007 (può slittare anche dopo T8b.2: nessun altro task ne dipende). Le attese su Fabio sono le sezioni "Azione di Fabio" di P1, T7.1 e T8b.2; solo P5 aspetta davvero una sua conferma.

## Global Constraints

- Costo 0 euro al mese: solo Supabase (Postgres e Auth) e Vercel Hobby. Nessuna nuova dipendenza npm.
- EUR, formattazione `it-IT` (`formatEuro`, `formatNumero`, `formatDateIt`), tutti i testi in italiano. Nelle frasi la cifra si scrive `776 €` con `formatNumero`.
- Next.js 16 con API diverse da quelle note (`AGENTS.md`). Verificato per questo piano: in un route handler `params` è una `Promise` (`await params`), i GET non sono in cache di default (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`); la sessione si controlla in `src/proxy.ts`. Prima di toccare un'altra API di Next leggere la guida in `node_modules/next/dist/docs/`.
- UI ottimistica: dove l'esito non serve per proseguire lo stato locale si aggiorna subito e la scrittura va in background; l'errore usa il messaggio esistente "Salvataggio fallito, controlla la connessione e riprova.". Le pagine client inoltrano gli errori con `useThrowToBoundary`.
- Parole vietate nella parte Casa (testi visibili e DOM): "bloccato", "dilazionato", "sinking fund", "giroconto", "imputazione", "riconciliazione". Ogni test di componente della parte Casa chiama `assertNessunaParolaVietata` (`tests/helpers/paroleVietate.ts`).
- Niente messaggi che fanno sentire in colpa: mai "hai speso troppo", "in ritardo", "sei indietro". L'unica eccezione ammessa è la frase neutra e fattuale dei debiti fra membri ("{nome} deve ancora 603 € a te"), senza scadenze né rosso. Niente gamification, niente confronti fra membri come merito o colpa.
- Il personale non esce mai: conti, transazioni, obiettivi, categorie, P.IVA personali non sono leggibili da altri. Il beneficiario di un rimborso non sceglie né vede il conto personale che riceve (lo risolve `record_transfer`).
- Una casa ha N membri (da 1 in su); una persona ha al massimo una casa attiva. Le regole valgono per N: nei testi "l'altro" non compare, si usano i nomi, "gli altri" o "tutti".
- Data layer: ogni lettura di `accounts`, `categories`, `budget_goals`, `transactions`, `transfers` prende uno `scope` (default `PERSONALE`) e usa `applyScope`; una funzione che lavora per id porta il marcatore `// household: per id`. Il test statico (P2) lo fa rispettare. I saldi dei conti di casa si aggiornano solo con `adjustAccountBalance` (delta), mai con il saldo assoluto calcolato nel client.
- Mesi e giorni della parte Casa (riserva, versamento del mese, data delle spese di casa) si calcolano con `oggiRomaISO` e `meseRomaISO` (`src/lib/calculations/casa/oggi.ts`), mai con `new Date()` diretto: il server Vercel lavora in UTC. Il personale esistente non cambia.
- Importi in euro con due decimali: le funzioni di calcolo arrotondano con `Math.round(x * 100) / 100`. Le colonne `numeric` possono tornare come stringa: i mapper usano `Number()`.
- Le migrazioni 0001 a 0006 sono già applicate in produzione e non si modificano. Ogni SQL nuovo va in `0007_igiene_fk_e_correzioni_casa.sql`: idempotente, `begin;`/`commit;`, funzioni `security definer` con `set search_path = public`, `auth.uid()` e membership verificati per primi, stesso `revoke ... from public, anon, authenticated` e `grant ... to authenticated`. La esegue Fabio a mano nel SQL editor di Supabase.
- **Chiusura standard di ogni task** (l'ultimo step di ogni task la richiama): `npm test`, `npm run lint` (errori già presenti in file non toccati sono ammessi, file nuovi o modificati puliti), `npx next build`, poi `git add` dei soli path elencati nel task (mai `.impeccable/hook.cache.json`, mai `git add .`), `git commit` nello stile esistente (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`) chiuso dalla riga `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, `git push` su master.

## Review Focus

Casi che la spec implica ma che i test dei task, da soli, non esercitano; ciascuno ha il suo test nel task indicato. I più probabili per primi.

1. **Mezzanotte di fine mese in Italia con server in UTC.** Alle 23:30 UTC del 31 ottobre in Italia è il 1 novembre: la riserva deve contare novembre e una spesa di casa registrata a quell'ora ha data 2026-11-01. Test in T8.1 (`loadCasaStato` con `now = 2026-10-31T23:30:00Z`) e in T6.2 (data della spesa di casa).
2. **Importi scritti male nei moduli di movimento.** "776,5" vale 776,5; vuoto, zero o negativo disabilitano il bottone; mai `NaN` nel DOM; "Registra" premuto due volte fa una sola chiamata. Test in T7.3.
3. **Rimborso a chi non ha un conto personale, o debitore uscito dalla casa.** `record_transfer` risponde `il beneficiario non ha conti` o `membro non valido`: la UI mostra una frase neutra con la via d'uscita ("già riflesso nei saldi") e non perde i dati digitati. Test in T7.3; casi SQL in T7.1.
4. **Casa senza piano, piano in bozza, casa chiusa.** Senza piano o con piano in bozza la riserva è 0 e il disponibile personale è invariato; con casa archiviata (`getMyHousehold` nullo) non compare il selettore Personale|Casa. Test in T8.1 e T6.2.
5. **Feed calendario anomalo.** Token con suffisso `.ics`, troppo corto o con caratteri strani, e dati senza piano (`giornoVersamento` nullo): 404 identico per ogni token non valido, ICS valido senza eventi di versamento. Test in T8b.1.

## Divergenze e scelte del pianificatore rispetto alla spec

Dove spec e codice reale divergono o la spec tace, il piano sceglie quanto segue. Gli esecutori non le ribaltano; Fabio può farlo prima dell'esecuzione.

1. **Definizione di "piano attivo" nella riserva.** La spec (7.4) parla di un unico `inizio(u)` con l'attivazione del piano; la funzione SQL `_casa_arretrati`, già in produzione e già usata per bloccare l'uscita, decide mese per mese (posizione in casa, non uscita, nessuna quota maggiore di zero senza membro già entrato). Il TS di T7.1 riproduce `_casa_arretrati`, non la prosa della spec: riserva e blocco dell'uscita non possono dare numeri diversi.
2. **Dove nasce il credito.** La spec 12 mette la scelta "Chi ha pagato" nel T6 ma il credito nel T7. T6.2 offre solo il conto comune; T7.2 aggiunge "Io, con carta" e `pagata_da_user_id`.
3. **Disponibile casa a gradini.** T6.1 consegna A meno B; T7.2 aggiunge C (crediti); T9 aggiungerà D e il cuscinetto. Fino ad allora `cuscinettoObiettivo` resta 0, altrimenti il numero cambierebbe senza che D sia contato.
4. **`Transaction` non ha l'autore.** Per mostrare i nomi accanto alle spese T6.1 aggiunge `userId?: string` e la colonna `user_id` in `TRANSACTION_COLUMNS` (campo opzionale, i test esistenti restano validi salvo il `toEqual` di `tests/data/transactions.test.ts`, aggiornato).
5. **Caricamenti.** `loadHomeData` guadagna un terzo parametro `userId` (default `null`: senza utente nessuna lettura di casa, quindi `HomeIsolation` resta identico). `app/page.tsx` ottiene l'utente con `supabase.auth.getUser()` (una richiesta di rete in più, come già fanno le pagine `/casa`). Chi non ha una casa paga una sola lettura in più (`household_members`).
6. **Modifica di una spesa di casa.** La spec dice "si corregge in due" ma non descrive la schermata: T6.2 offre elimina e modifica in `/casa/movimenti` con delta di saldo; modifica ed elimina sono nascoste per le spese con `pagataDaUserId` di un altro (la RLS le blocca).
7. **Rinomina di una voce personalizzata del piano.** La RPC abbina le categorie per nome e ne crea una nuova a ogni rinomina. Si corregge mandando `categoria_id` insieme al nuovo nome (P4, client) e rinominando la categoria collegata dentro `save_household_plan` (0007).
8. **FK sugli autori.** 0007 mette `on delete set null` su `households.created_by`, `household_plans.created_by`, `household_invites.created_by` e `household_plan_shares.user_id`: cancellare l'utente fondatore non distrugge più la casa del socio. Le altre FK verso `auth.users` (membro, autore di spese e trasferimenti, debitore) restano `cascade`: sono dati di un'altra persona che non hanno un valore sostitutivo corretto (un `per_conto_di_user_id` nullo cambierebbe il significato del versamento). Resta valido "non cancellare un account con una casa attiva": nessun flusso di cancellazione esiste.
9. **Uscenti nel wizard.** Difetto reale: il wizard manda sempre `esceDal: null` e non include chi è uscito, quindi rivedere il piano dal mese corrente cancella la riga dell'uscito, perdendone `user_id` ed `esce_dal` (e con essi la protezione contro il riuso della posizione). P5 riporta avanti le righe degli usciti; richiede la 0007 (la RPC ricostruisce `user_id` per gli usciti e non cancella le righe con `esce_dal`).
10. **Puntino dei promemoria sul NavBar** (spec 8.1) non è pianificato: richiederebbe una lettura per ogni pagina. I promemoria stanno in `/casa` e come riga compatta in home. Da decidere con Fabio.
11. **Esenzioni.** Il test statico dopo P2 controlla anche `transfers` e segnala `.from(` fuori da una funzione o con tabella dinamica.

## File Structure

| File | Responsabilità | Task |
|---|---|---|
| `supabase/migrations/0007_igiene_fk_e_correzioni_casa.sql`, `tests/migration0007.test.ts` | FK autori, `join_household`, `record_transfer`, `save_household_plan` | P1 |
| `supabase/tests/rls_casa.sql` | Casi nuovi di 0007 (P1) e del caso 12 (T7.1) | P1, T7.1 |
| `tests/helpers/scopeGuard.ts`, `tests/data/scopeGuard.test.ts` | Guardia statica rinforzata | P2 |
| `src/app/casa/quota/{quotaWizardState.ts,quotaWizardUi.tsx,usaBozzaQuota.ts,Passo*.tsx}` | Spezzatura di `QuotaWizard.tsx` | P3 |
| `src/lib/calculations/casa/disponibileCasa.ts` | Cascata A, B, C, D, E e spiegazione | T6.1 |
| `src/lib/data/{accounts,transactions,casaSetup}.ts`, `src/lib/loadCasaData.ts` | Delta di saldo, autore, conto comune, caricamenti casa | T6.1 |
| `src/app/FoglioInferiore.tsx`, `src/app/add/AddTransactionSheet.tsx`, `src/app/casa/{CasaFab,ContoComuneForm}.tsx`, `src/app/casa/movimenti/*` | Selettore, foglio, home casa, movimenti | T6.2 |
| `src/lib/data/transfers.ts`, `src/lib/calculations/casa/{crediti,debitiMembri,versamenti}.ts` | Trasferimenti e registri | T7.1 |
| `src/app/casa/{CasaAzioni,VersamentoForm,RimborsoForm,RestituisciForm,PannelliVersamenti}.tsx` | Moduli di movimento e pannelli di `/casa` | T7.2, T7.3 |
| `src/lib/calculations/casa/righeNeutre.ts`, `src/app/history/StoricoCasa.tsx` | Righe neutre nello storico | T7.4 |
| `src/lib/calculations/casa/{riservoVersamento,promemoria}.ts`, `src/lib/loadCasaStato.ts`, `src/app/casa/StrisciaPromemoria.tsx` | Riserva, promemoria | T8.1, T8.2 |
| `src/lib/calculations/casa/calendario.ts`, `src/app/api/calendario/[token]/route.ts`, `src/proxy.ts`, `src/lib/data/calendarFeeds.ts`, `src/app/casa/impostazioni/CalendarioCasa.tsx` | Feed ICS | T8b.1, T8b.2 |

---

## Task P1: Migrazione 0007 e casi nuovi dello script di prova

**Files:**
- Create: `supabase/migrations/0007_igiene_fk_e_correzioni_casa.sql`
- Create: `tests/migration0007.test.ts`
- Modify: `supabase/tests/rls_casa.sql` (nuova sezione prima del "Referto", quattro nuovi utenti nell'`insert into auth.users` iniziale)

**Interfaces:**
- Consumes: stato dopo 0004, 0005, 0006 (definizioni correnti: `save_household_plan` e `join_household` in `0006_piano_redditi_e_ingressi.sql`; `record_transfer` in `0004_casa_comune.sql` sezione 3.5).
- Produces: nessuna firma nuova. Cambiano i comportamenti:
  - `households.created_by`, `household_plans.created_by`, `household_invites.created_by`, `household_plan_shares.user_id` diventano nullable con `on delete set null`.
  - `join_household(p_codice text, p_display_name text) returns uuid`: i segnaposto con `esce_dal` valorizzato non si occupano (due predicati `s.esce_dal is null`).
  - `record_transfer(p_household uuid, p_causale text, p_importo numeric, p_data date, p_da_account uuid, p_a_account uuid, p_beneficiario uuid, p_per_conto_di uuid, p_mese_competenza date, p_solo_registrazione boolean, p_nota text) returns uuid`: nei rimborsi e nelle restituzioni `solo_registrazione` (non rinuncia) `v_da` e `v_a` diventano null, così nessun conto altrui resta collegato da una FK `restrict` (ruling F9).
  - `save_household_plan(p_household uuid, p_payload jsonb) returns uuid[]`: (a) se una voce porta `categoria_id` e `categoria_nome` diverso dal nome attuale, la categoria di casa collegata si rinomina in place; (b) una quota del payload con `esce_dal` e senza membro attivo sulla posizione riprende `user_id` dall'ultima riga di quella posizione in qualunque versione (letto prima dell'eliminazione delle versioni future); (c) l'ultima `delete` delle quote non tocca le righe con `esce_dal` valorizzato.

- [ ] **Step 1: Scrivere il test statico che fallisce**

`tests/migration0007.test.ts`, stesso schema di `tests/migration0006.test.ts` (legge il file, ignora le righe che iniziano con `--`). Test:
- `'è racchiusa tra begin; e commit;'`
- `'ridefinisce solo join_household, save_household_plan e record_transfer con create or replace'` (nessun `create table`, nessun `drop table`)
- `'ogni funzione è security definer con search_path = public'`
- `'rinnova revoke e grant delle tre funzioni con le firme esatte'` (firme: `join_household(text, text)`, `save_household_plan(uuid, jsonb)`, `record_transfer(uuid, text, numeric, date, uuid, uuid, uuid, uuid, date, boolean, text)`; `revoke execute on function public.<firma> from public, anon, authenticated;` e `grant execute on function public.<firma> to authenticated;`)
- `'le quattro colonne autore passano a on delete set null'` (il file contiene `'households', 'created_by'`, `'household_plans', 'created_by'`, `'household_invites', 'created_by'`, `'household_plan_shares', 'user_id'` e `on delete set null`)
- `'join_household salta i segnaposto con esce_dal'` (il corpo contiene `s.esce_dal is null` almeno due volte)
- `'record_transfer azzera i conti delle registrazioni senza rinuncia'` (il corpo contiene `v_da := null;` almeno due volte oltre a `v_da uuid := p_da_account;`)
- `'save_household_plan rinomina la categoria collegata e non cancella le quote degli usciti'` (il corpo contiene `update public.categories set nome` e `and esce_dal is null`)
- `'nessuna istruzione di primo livello cancella o modifica righe esistenti'` (nessuna riga non commentata che inizi in colonna 0 con `update`, `delete`, `insert`, `truncate`, `drop table`)

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run tests/migration0007.test.ts`
Expected: FAIL (file inesistente).

- [ ] **Step 3: Scrivere `0007_igiene_fk_e_correzioni_casa.sql`**

Struttura: intestazione commentata con motivi e con il rollback; `begin;`; blocco FK; tre `create or replace function`; revoke e grant; `commit;`. Le tre funzioni si copiano **per intero** dalla definizione corrente (join_household e save_household_plan da 0006, record_transfer da 0004 sezione 3.5, compreso il commento di intestazione) e si applicano solo i ritocchi sotto. Il blocco FK, completo:

```sql
do $do$
declare
  r record;
  cname text;
begin
  for r in select * from (values
    ('households', 'created_by'),
    ('household_plans', 'created_by'),
    ('household_invites', 'created_by'),
    ('household_plan_shares', 'user_id')
  ) as x(tab, col)
  loop
    execute format('alter table public.%I alter column %I drop not null', r.tab, r.col);
    if not exists (
      select 1 from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.conrelid = format('public.%I', r.tab)::regclass and c.contype = 'f'
        and a.attname = r.col and c.confrelid = 'auth.users'::regclass and c.confdeltype = 'n'
    ) then
      select c.conname into cname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.conrelid = format('public.%I', r.tab)::regclass and c.contype = 'f'
        and a.attname = r.col and c.confrelid = 'auth.users'::regclass;
      if cname is not null then
        execute format('alter table public.%I drop constraint %I', r.tab, cname);
      end if;
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null',
        r.tab, r.tab || '_' || r.col || '_fkey', r.col);
    end if;
  end loop;
end $do$;
```

Ritocchi di `join_household` (due righe, dentro la select del segnaposto e nell'`update` finale):
```sql
  where p.household_id = hid and s.user_id is null and s.esce_dal is null
  ...
  where p.id = s.plan_id and p.household_id = hid and s.slot = slot_n and s.user_id is null and s.esce_dal is null;
```

Ritocchi di `record_transfer`: nel ramo `rimborso` (non rinuncia) e nel ramo `restituzione` (senza `p_per_conto_di`), il blocco `if p_solo_registrazione then` diventa
```sql
        if p_solo_registrazione then
          -- nessun conto resta collegato: una FK restrict su un conto altrui bloccherebbe quel conto
          v_da := null;
          v_a := null;
        else
```

Ritocchi di `save_household_plan` (partendo da 0006):
1. In `declare`: `uscenti_slot smallint[] := '{}'; uscenti_user uuid[] := '{}'; u_prev uuid;`.
2. Nel primo ciclo sulle quote del payload (quello del controllo reddito), subito dopo l'`if mem_user is not null and mem_user <> uid then ... end if;` e prima di `end loop`:
```sql
      if mem_user is null and nullif(q ->> 'esce_dal', '') is not null then
        u_prev := null;
        select s.user_id into u_prev
        from public.household_plan_shares s
        join public.household_plans p on p.id = s.plan_id
        where p.household_id = p_household and s.slot = slot_n and s.user_id is not null
        order by p.valido_dal desc limit 1;
        if u_prev is not null and not (slot_n = any (uscenti_slot)) then
          uscenti_slot := uscenti_slot || slot_n;
          uscenti_user := uscenti_user || u_prev;
        end if;
      end if;
```
3. Nel ciclo di inserimento delle quote, dopo il `select m.user_id, m.display_name into mem_user, mem_name ...`:
```sql
      if mem_user is null and slot_n = any (uscenti_slot) then
        mem_user := uscenti_user[array_position(uscenti_slot, slot_n)];
      end if;
```
4. Nel ciclo delle voci, dopo il controllo `categoria non appartenente alla casa`:
```sql
      if cat is not null and coalesce(voce ->> 'categoria_nome', '') <> ''
         and not exists (select 1 from public.categories c
                         where c.id = cat and lower(c.nome) = lower(voce ->> 'categoria_nome')) then
        update public.categories set nome = voce ->> 'categoria_nome'
        where id = cat and household_id = p_household and tipo = 'expense';
      end if;
```
5. L'ultima `delete` diventa `delete from public.household_plan_shares where plan_id = pid and slot <> all(slots) and esce_dal is null;`.

In fondo, `revoke`/`grant` delle tre funzioni come nei test, e un commento di rollback (rieseguire le definizioni di 0004/0006 e, per le FK, `on delete cascade`).

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npx vitest run tests/migration0007.test.ts` Expected: PASS.

- [ ] **Step 5: Casi nuovi in `supabase/tests/rls_casa.sql`**

Aggiungere quattro utenti all'`insert into auth.users` (email `rls-x1@test.invalid` a `rls-x4@test.invalid`, id `41414141-0000-0000-0000-000000000041` e analoghi) e, prima del "Referto", un blocco `begin ... end;` con questi casi (helper `zz_ok`, `zz_err`, `zz_verifica` esistenti; le RPC si chiamano nella forma già usata nello script):
- `'eliminare l utente fondatore non cancella la casa ne la membership del socio'`: x1 crea la casa, x2 entra col codice; come proprietario `delete from auth.users where id = x1`; verifica che la riga di `households` esista ancora e che `household_members` contenga ancora x2.
- `'join_household non lega un segnaposto con esce_dal'`: casa con un piano il cui segnaposto slot 2 ha `esce_dal` valorizzato (insert come proprietario); x3 entra: il suo `slot` non è 2.
- `'rinominare una voce con categoria_id rinomina la categoria e non ne crea una nuova'`: x1 salva un piano con voce `categoria_nome` "Palestra"; salva di nuovo con `categoria_id` della categoria e `categoria_nome` "Yoga": il nome della categoria è "Yoga" e il numero di categorie di casa non è cambiato.
- `'rivedere il piano con una quota di un uscito ne conserva user_id ed esce_dal'`: x4 entra e poi esce (nessun registro aperto); un membro rimasto salva un piano che include la posizione di x4 con `esce_dal` al mese successivo: la riga in `household_plan_shares` ha `user_id = x4` ed `esce_dal` valorizzato.

- [ ] **Step 6: Chiusura standard**

Path: `supabase/migrations/0007_igiene_fk_e_correzioni_casa.sql`, `tests/migration0007.test.ts`, `supabase/tests/rls_casa.sql`. Commit: `feat: migrazione 0007 con FK autori, uscenti e rinomina categorie`.

- [ ] **Step 7: Azione di Fabio (0007 e script di prova)**

1. Nel pannello Supabase, SQL editor, incollare l'intero contenuto di `supabase/migrations/0007_igiene_fk_e_correzioni_casa.sql` e premere Run. Atteso: "Success. No rows returned". Rieseguirla una seconda volta: stesso esito (è idempotente).
2. Incollare `supabase/tests/rls_casa.sql` e premere Run. Lo script termina con un errore voluto che annulla tutto e mostra il referto: atteso `RISULTATO: N OK, 0 FAIL`.
3. Scrivere "0007 eseguita" nella chat. Solo P5 aspetta questa conferma; la 0007 non cambia nulla per l'app attuale.

---

## Task P2: Guardia statica del data layer rinforzata

**Files:**
- Modify: `tests/helpers/scopeGuard.ts`
- Modify: `tests/data/scopeGuard.test.ts`

**Interfaces:**
- Consumes: i file di `src/lib/data/*.ts` (tutti conformi oggi); il marcatore `// household: per id`; `FILE_ESENTI = ['keepAlive.ts']`.
- Produces: `findUnscopedQueries(source: string): string[]` (stessa firma). Ritorna il nome della funzione o arrow function che legge una tabella guardata senza scope, `'<fuori da una funzione>'` per un `.from(` fuori da ogni funzione, `'<nome> (tabella dinamica)'` per `.from(` con argomento non letterale. Tabelle guardate: `accounts|categories|budget_goals|transactions|transfers`. Regola di conteggio per funzione: senza marcatore, i segni di scope (`applyScope(`, `scopeHouseholdId(`, `.is('household_id'`, `.eq('household_id'`) devono essere almeno quanti i `.from('<tabella guardata>')`. T7.1 e T6.1 lo rispettano per costruzione.

- [ ] **Step 1: Scrivere i test che falliscono** (in `tests/data/scopeGuard.test.ts`, accanto ai tre esistenti, che restano)
- `'segnala una arrow function esportata con from(accounts) senza scope'`: `export const leggi = async (supabase) => {\n  return supabase.from('accounts').select('id');\n};\n` → `['leggi']`.
- `'segnala una arrow function con parametri su più righe'`: `export const leggi = async (\n  supabase: X,\n  scope: Scope\n): Promise<Y> => {\n  return supabase.from('transactions').select('id');\n};\n` → `['leggi']`.
- `'accetta una arrow function con applyScope'` → `[]`.
- `'segnala .from( fuori da qualunque funzione'`: `const q = supabase.from('transactions').select('id');\n` → `['<fuori da una funzione>']`.
- `'segnala una tabella dinamica'`: `export async function a(s, t) { return s.from(t).select('id'); }` → `['a (tabella dinamica)']`.
- `'segnala la seconda lettura quando la funzione ha un solo segno di scope'`: una funzione `x` con `applyScope(s.from('accounts')...)` e `s.from('categories').select('id')` → `['x']`.
- `'segnala transfers senza scope e accetta transfers con applyScope'`.

- [ ] **Step 2: Run** `npx vitest run tests/data/scopeGuard.test.ts` Expected: FAIL (i nuovi).

- [ ] **Step 3: Implementare** in `tests/helpers/scopeGuard.ts`. Si divide il sorgente a ogni inizio di istruzione in colonna 0 (`/^(?=(?:export\s+(?:default\s+)?)?(?:async\s+function|function|const|let|var|class)\b)/m`); il nome viene dall'intestazione di funzione `function nome` o di arrow `const nome ... =>` (parametri anche su più righe: `[\s\S]*?` fino a `)\s*(:[^=>{]+)?=>`); un blocco senza nome di funzione che contiene `.from(` di una tabella guardata è `'<fuori da una funzione>'`. La tabella dinamica si riconosce con `/\.from\(\s*(?!['"])/`. Poi applicare la regola di conteggio sopra.

- [ ] **Step 4: Run** il test del guard e l'intera suite `npx vitest run tests/data` Expected: PASS (nessun file attuale di `src/lib/data` deve essere segnalato; se uno lo è, correggere il file con scope o marcatore, non la guardia).

- [ ] **Step 5: Chiusura standard.** Path: i due file sopra. Commit: `test: guardia statica anche per arrow function, fuori funzione, tabelle dinamiche e transfers`.

---

## Task P3: Spezzare QuotaWizard senza cambiare comportamento

**Files:**
- Modify: `src/app/casa/quota/QuotaWizard.tsx` (875 righe, diventa orchestratore sotto le 80)
- Create: `src/app/casa/quota/quotaWizardState.ts`, `quotaWizardUi.tsx`, `usaBozzaQuota.ts`, `PassoRedditi.tsx`, `PassoSpese.tsx`, `PassoCuscinetto.tsx`, `PassoDivisione.tsx`, `PassoQuando.tsx`
- Test: `tests/QuotaWizard.test.tsx` (invariato, 44 test)

**Interfaces:**
- Consumes: il codice attuale di `QuotaWizard.tsx`.
- Produces (nessun cambio di export pubblici: `QuotaWizard` mantiene le stesse props e lo stesso file):
  - `quotaWizardState.ts`: tipi `PersonaState`, `VoceState`, `RegolaScelta`; costanti `ARROTONDAMENTO`, `PASSI`, `REGOLE`, i tre messaggi di errore; funzioni pure `messaggioErrore(e: unknown): string`, `testoNumero`, `arrotonda2`, `parseMesi`, `opzioniMesi`, `ultimeQuote`, `personeIniziali`, `vociIniziali`, `testoAvviso`, `nuovaChiave`.
  - `quotaWizardUi.tsx`: classi condivise (`inputClass`, `carta`, `bottoneSecondario`, `bottonePrimario`), `euro`, componente `MesiSelect`.
  - `usaBozzaQuota.ts`: `usaBozzaQuota(props: QuotaWizardProps): BozzaQuota` con tutto lo stato (`useState`), i valori derivati (da "Valori derivati" fino a `puoProseguire`) e le azioni `setPersona`, `setVoce`, `aggiungiPersona`, `conferma`; `export type BozzaQuota = ReturnType<typeof usaBozzaQuota>`; `export interface QuotaWizardProps` (le props attuali).
  - `Passo*.tsx`: ciascuno `export function PassoX({ b }: { b: BozzaQuota })`, con il JSX del passo corrispondente (passi 1 a 5 attuali, blocchi `passo === N`).

- [ ] **Step 1: Baseline.** Run `npx vitest run tests/QuotaWizard.test.tsx tests/PianoAttuale.test.tsx` Expected: PASS, 44 test nel wizard. Annotare il conteggio.
- [ ] **Step 2: Spostare il codice** lungo le cesure sopra, tagliando e incollando senza riscrivere logica né testi. `QuotaWizard.tsx` resta con l'intestazione dei passi, i bottoni Indietro/Avanti/Confermiamo e la scelta del `Passo` da renderizzare.
- [ ] **Step 3: Verifica.** Run gli stessi test: stesso conteggio, PASS, senza modificare nessun test. Run `wc -l` sui nuovi file: ciascuno sotto le 260 righe.
- [ ] **Step 4: Chiusura standard.** Path: `src/app/casa/quota/*.ts`, `src/app/casa/quota/*.tsx` (solo i file elencati). Commit: `refactor: QuotaWizard spezzato in stato, hook e passi`.

---

## Task P4: Rinomina voce, parole "l'altro" e parole vietate nei test

**Files:**
- Modify: `src/lib/data/householdPlans.ts` (`PlanVoceInput`, `savePlan`)
- Modify: `src/app/casa/quota/quotaWizardState.ts`, `usaBozzaQuota.ts` (VoceState e vociPiano)
- Modify: `src/app/casa/CasaSenzaCasa.tsx`, `src/app/casa/inizia/InizioCasa.tsx`
- Test: `tests/data/householdPlans.test.ts`, `tests/QuotaWizard.test.tsx`, `tests/CasaSenzaCasa.test.tsx`, `tests/InizioCasa.test.tsx`, `tests/IniziaPage.test.tsx`

**Interfaces:**
- Consumes: P3.
- Produces: `PlanVoceInput` guadagna `categoriaId?: string | null`; `savePlan` lo manda come `categoria_id` (accanto a `categoria_nome`, che resta). `VoceState.categoriaId: string | null`, riempito da `PlanItem.categoriaId` in `vociIniziali`; una voce nuova ha `null`. Con la 0007 eseguita la RPC rinomina la categoria; prima della 0007 la RPC usa `categoria_id` e ignora il nome nuovo (nessuna categoria orfana in nessun caso).

- [ ] **Step 1: Test che falliscono.**
  - `householdPlans.test.ts`: `'savePlan manda categoria_id accanto a categoria_nome'` (la chiamata RPC contiene `categoria_id: 'c9'` e `categoria_nome: 'Yoga'`; con `categoriaId` assente manda `categoria_id: null`).
  - `QuotaWizard.test.tsx`: `'rinominare una voce personalizzata esistente manda la stessa categoriaId con il nuovo nome'` (piano con voce "Palestra", `categoriaId: 'c9'`; si rinomina in "Yoga"; `savePlan` riceve per quella voce `{ categoriaId: 'c9', categoriaNome: 'Yoga', nome: 'Yoga' }`) e `'una voce aggiunta dopo ha categoriaId null'`.
  - `CasaSenzaCasa.test.tsx`: `'non nomina "l\'altro": usa "le altre persone di casa"'` (testo esatto: `Cosa vedono le altre persone di casa?` seguito da `Solo conti, spese e obiettivi della casa. Le tue cose personali no, mai.`).
  - `InizioCasa.test.tsx`: l'etichetta del nome visualizzato è `Come ti chiami per gli altri in casa?`.
  - `IniziaPage.test.tsx`: aggiungere `assertNessunaParolaVietata(container)` ai test di render (è l'unico test della parte Casa che non lo chiama); nessun altro file di test della parte Casa lo salta.
- [ ] **Step 2: Run** i cinque file. Expected: FAIL sui nuovi.
- [ ] **Step 3: Implementare** come da Interfaces. I testi: `CasaSenzaCasa.tsx` e `InizioCasa.tsx` con le frasi esatte dei test.
- [ ] **Step 4: Run** i cinque file. Expected: PASS.
- [ ] **Step 5: Chiusura standard.** Path: i file elencati. Commit: `fix: la rinomina di una voce mantiene la categoria e testi senza "l'altro"`.

---

## Task P5: Wizard, gli usciti restano nel piano (dopo la conferma di Fabio sulla 0007)

**Blocco:** non iniziare finché Fabio non ha scritto "0007 eseguita" (la RPC senza 0007 trasformerebbe la riga di un uscito in un segnaposto con `esce_dal`, occupabile da un nuovo ingresso).

**Files:**
- Modify: `src/lib/calculations/casa/pianoVersioni.ts`, `src/app/casa/quota/quotaWizardState.ts`, `usaBozzaQuota.ts`
- Test: `tests/calculations/casa/pianoVersioni.test.ts`, `tests/QuotaWizard.test.tsx`

**Interfaces:**
- Consumes: `PlanQuotaInput` (ha già `esceDal?: string | null`), `PlanShare`, `buildPlanVersions(draft: PianoDraft): PlanVersionInput[]`.
- Produces: `PianoDraft.uscenti?: UscitoDraft[]` con `UscitoDraft = { slot: number; displayName: string; redditoNettoMensile: number; redditoIrregolare: boolean; inCasaDal: string | null; esceDal: string; quotaMensile: number }`. `uscentiDaPiani(piani: PlanBundle[]): UscitoDraft[]` in `quotaWizardState.ts`: per ogni posizione la cui riga più recente (versione più recente che la contiene) ha `esceDal !== null`, con la quota di quella riga. `buildPlanVersions` aggiunge a ogni versione una `PlanQuotaInput` per ogni uscito: `quotaMensile` uguale a quella salvata se `validoDal < esceDal`, altrimenti 0; `esceDal` valorizzato; `percentuale: null` (così la somma 100 della regola personalizzata non cambia).

- [ ] **Step 1: Test che falliscono.**
  - `pianoVersioni.test.ts`: `'una quota di un uscito resta in ogni versione con esceDal e senza percentuale'`; `'la quota dell uscito vale quella salvata prima di esceDal e zero dopo'` (esceDal `2026-12-01`: versione `2026-11-01` ha 603, versione `2026-12-01` ha 0); `'senza uscenti il risultato è identico a prima'`.
  - `QuotaWizard.test.tsx`: `'rivedere il piano dopo l uscita di Giulia invia ancora la sua posizione con esceDal 2026-12-01'` (piano con slot 2 `esceDal: '2026-12-01'`, `userId: 'u2'`; `savePlan` riceve in `versioni[0].quote` una quota `{ slot: 2, esceDal: '2026-12-01', percentuale: null }`) e `'gli usciti non compaiono come persone nei passi'`.
  - `quotaWizardState`: `'uscentiDaPiani ignora chi ha esceDal nullo e usa la riga più recente'`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implementare** come da Interfaces (il wizard passa `uscenti: uscentiDaPiani(piani)` nel draft). **Step 4: Run** i tre file: PASS.
- [ ] **Step 5: Chiusura standard.** Path: i cinque file. Commit: `fix: il wizard riporta avanti le quote di chi è uscito`.

---

## Task T6.1: Disponibile casa, saldi a delta, conto comune, caricamenti

**Files:**
- Create: `src/lib/calculations/casa/disponibileCasa.ts`, `src/lib/data/casaSetup.ts`, `src/lib/loadCasaData.ts`
- Modify: `src/lib/data/accounts.ts`, `src/lib/data/transactions.ts`, `src/lib/types.ts`, `src/lib/loadHomeData.ts`
- Test: `tests/calculations/casa/disponibileCasa.test.ts`, `tests/data/accounts.test.ts`, `tests/data/transactions.test.ts`, `tests/data/casaSetup.test.ts`, `tests/loadCasaData.test.ts`, `tests/HomeIsolation.test.ts`

**Interfaces:**
- Consumes: `Scope`, `casa(id)`, `getAccounts/getCategories/getOpenGoals/getTransactions` con scope; `getMyHousehold(supabase, userId): Promise<CasaCorrente | null>` (`{ household, members, invite, me }`); `computeAccantonatoFinora`, `getSpecoCollegato`; `Spiegazione` (`valore`, `formula`, `ingredienti[{etichetta, valore}]`); RPC `adjust_account_balance(p_account uuid, p_delta numeric)` (security invoker: lancia `conto non trovato` se non tocca righe).
- Produces:
  - `computeDisponibileCasa(input: { conti: AccountBalance[]; obiettivi: GoalForCalc[]; today: Date; crediti?: number; daPagareMese?: number; cuscinettoObiettivo?: number }): DisponibileCasa` con `DisponibileCasa = { valore, a, b, c, d, e, cuscinetto, spiegazione: Spiegazione }`. A = saldi dei conti con `contaInDisponibile`; B = somma `computeAccantonatoFinora(g, today, g.specoCollegato ?? 0)` sugli obiettivi aperti; C = `crediti` (default 0); D = `daPagareMese` (default 0); E = A - B - C - D; `cuscinetto = clamp(E, 0, cuscinettoObiettivo ?? 0)`; `valore = E - cuscinetto`. Ingredienti con segno: `Soldi sul conto comune` (+A), `Messi da parte` (-B), `Rimborsi da fare` (-C), `Spese del mese ancora da pagare` (-D), `Cuscinetto` (-cuscinetto, solo se maggiore di zero); la loro somma è `valore`. Formula: `Soldi sul conto comune, meno quelli già messi da parte, meno i rimborsi e le spese del mese ancora da pagare.` (le parti a zero si omettono dalla frase solo se così si semplifica, ma il testo non contiene parole vietate).
  - `adjustAccountBalance(supabase: SupabaseClient, id: string, delta: number): Promise<void>` in `accounts.ts` (RPC `adjust_account_balance` con `{ p_account: id, p_delta: delta }`, errore rilanciato).
  - `Transaction.userId?: string`; `TRANSACTION_COLUMNS` include `user_id`; `mapRow` lo mappa.
  - `casaSetup.ts`: `categorieCasaBase(): { nome: string; tipo: CategoriaTipo }[]` (i nomi di `VOCI_CASA_TIPICHE` come spese, più `Altro` spesa e `Altre entrate` entrata); `seedCategorieCasa(supabase, householdId): Promise<void>` crea solo le categorie di casa mancanti per nome (confronto senza maiuscole, anche contro quelle già create dal wizard); `creaContoComune(supabase, householdId, input: { nome: string; saldoAttuale: number }): Promise<Account>` = `createAccount(..., casa(householdId))` con `contaInDisponibile: true`, poi `seedCategorieCasa`.
  - `loadCasaAggiunta(supabase, casa: CasaCorrente): Promise<CasaAggiunta>` con `CasaAggiunta = { householdId: string; meUserId: string; nomi: { userId: string; nome: string }[]; conti: Account[]; categorie: Category[]; obiettivi: BudgetGoal[] }` (letture con `casa(householdId)`).
  - `loadCasaData(supabase, casa: CasaCorrente, today: Date = new Date()): Promise<CasaData>` con `CasaData = { casa: CasaCorrente; aggiunta: CasaAggiunta; transazioni: Transaction[]; obiettiviConAccantonato: (BudgetGoal & { accantonato: number })[]; disponibile: DisponibileCasa }`; `disponibile` = `computeDisponibileCasa` con i conti e gli obiettivi di casa (`specoCollegato` da `getSpecoCollegato`).
  - `loadHomeData(supabase, today = new Date(), userId: string | null = null)`: `HomeData.casa: CasaAggiunta | null` (null senza `userId` o senza casa attiva; con `userId` fa `getMyHousehold` nella stessa `Promise.all` delle altre letture). I campi personali non cambiano.

- [ ] **Step 1: Test che falliscono.**
  - `disponibileCasa.test.ts`: `'A meno B: 1000 di saldo e 130 messi da parte danno 870'` (valore 870, `a` 1000, `b` 130); `'il cuscinetto si riempie: E 1500 con obiettivo 1321 dà valore 179 e cuscinetto 1321'`; `'E 1000 con obiettivo 1321 dà valore 0 e cuscinetto 1000'`; `'E negativo resta negativo e il cuscinetto è 0: -50'`; `'crediti e daPagareMese si sottraggono: 1000, 45, 100 danno 855'`; `'gli ingredienti sommano al valore'` (toBeCloseTo); `'nessuna parola vietata nella formula e nelle etichette'`; `'un conto escluso dal disponibile non conta in A'`.
  - `accounts.test.ts`: `'adjustAccountBalance chiama adjust_account_balance con p_account e p_delta'` (con `fakeRpcClient`), `'rilancia l errore della RPC'`.
  - `transactions.test.ts`: `'mapRow espone userId'` (aggiornare l'atteso dei `toEqual` esistenti).
  - `casaSetup.test.ts`: `'seedCategorieCasa crea solo le mancanti, senza distinguere le maiuscole'` (casa con "luce" già presente: non ne crea un'altra), `'creaContoComune crea il conto di casa con contaInDisponibile e semina le categorie'`, `'categorieCasaBase contiene le voci tipiche, Altro e Altre entrate'`.
  - `loadCasaData.test.ts` (con `createFakeDb`, utenti A e B membri di H1, C fuori): `'carica solo conti, categorie e obiettivi di casa'`, `'il disponibile è 870 con un conto di casa da 1000 e un obiettivo di casa da 130'`, `'non include mai le righe personali di A'`.
  - `HomeIsolation.test.ts`: `'con userId e una casa, disponibile, dettaglio, margine e data target restano quelli personali e casa contiene solo righe di casa'`.
- [ ] **Step 2: Run** i sei file. Expected: FAIL.
- [ ] **Step 3: Implementare** come da Interfaces. Nota: `loadCasaData` carica le transazioni con `getTransactions(supabase, casa(id))` (tutte, il volume è piccolo).
- [ ] **Step 4: Run** i sei file. Expected: PASS.
- [ ] **Step 5: Chiusura standard.** Path: tutti i file elencati. Commit: `feat: disponibile casa, saldi a delta e caricamenti della casa`.

---

## Task T6.2: Selettore Personale|Casa, home della casa, movimenti

**Files:**
- Create: `src/app/FoglioInferiore.tsx`, `src/app/add/AddTransactionSheet.tsx`, `src/app/casa/CasaFab.tsx`, `src/app/casa/ContoComuneForm.tsx`, `src/app/casa/movimenti/page.tsx`, `src/app/casa/movimenti/MovimentiCasa.tsx`, `src/lib/calculations/casa/etichette.ts`
- Modify: `src/app/HomeDashboard.tsx`, `src/app/page.tsx`, `src/app/add/AddTransactionForm.tsx`, `src/app/casa/CasaHome.tsx`, `src/app/casa/page.tsx`, `src/lib/calculations/accountBalance.ts`
- Test: `tests/AddTransactionSheet.test.tsx`, `tests/HomeDashboard.test.tsx`, `tests/AddTransactionForm.test.tsx`, `tests/CasaHome.test.tsx`, `tests/MovimentiCasa.test.tsx`, `tests/calculations/casa/etichette.test.ts`, `tests/calculations/accountBalance.test.ts`

**Interfaces:**
- Consumes: T6.1 (`CasaAggiunta`, `CasaData`, `loadCasaData`, `creaContoComune`, `adjustAccountBalance`, `computeDisponibileCasa`), `ComeSiCalcola({ spiegazione })`, `createTransaction(supabase, input, scope)`, `updateTransaction`, `deleteTransaction`, `oggiRomaISO`, `formatEuro`.
- Produces:
  - `FoglioInferiore({ titolo, onClose, children })`: l'attuale markup del foglio dal basso (backdrop, maniglia, titolo, X), estratto da `HomeDashboard`.
  - `AddTransactionSheet({ aperto, onClose, personale, casa, contiPersonali, modoIniziale, meUserId, onSaved })` con `personale: { categories: Category[]; accounts: Account[]; goals: GoalWithAccantonato[] } | null`, `casa: CasaAggiunta | null`, `contiPersonali?: Account[]` (usato da T7.2), `modoIniziale?: 'ricorda' | 'personale' | 'casa'` (default `'ricorda'`), `onSaved(): void`. Il selettore `Personale | Casa` compare solo se `personale` e `casa` sono entrambi non nulli. Memoria in `localStorage['aggiungiModo']` con try/catch (valori `personale` o `casa`; assente o illeggibile = personale); `modoIniziale: 'casa'` ignora la memoria. Salvataggio personale: esattamente la logica di prima (`createTransaction` poi `updateAccountBalance` col saldo assoluto, data `format(new Date(), 'yyyy-MM-dd')`). Salvataggio casa: `createTransaction(supabase, { ..., data: oggiRomaISO() }, casa(householdId))` poi, se il conto è scelto, `adjustAccountBalance(supabase, accountId, tipo === 'income' ? +importo : -importo)`. Nota sotto il selettore in modalità Casa: `Lo vedrà anche Anna` o `Lo vedranno anche Anna e Marco` (da `nomiAltri(nomi, meUserId)`).
  - `AddTransactionForm` guadagna props opzionali, tutte con default che lasciano il comportamento attuale: `contoEtichetta?: string` (default `Conto`), `nascondiGestisciCategorie?: boolean`, `obiettivoEtichetta?: string` (default `Obiettivo (opzionale)`), `nota?: string`, `idContiSoloSpesa?: string[]` (i conti con questi id compaiono solo con `tipo === 'expense'`, usato da T7.2). In modalità Casa: `contoEtichetta="Chi ha pagato"`, `obiettivoEtichetta="Da parte (opzionale)"`, nessun `onCreateGoal`, nessun link "Gestisci categorie".
  - `etichette.ts`: `nomiAltri(nomi: { userId: string; nome: string }[], meUserId: string): string | null` (`'Anna'`, `'Anna e Marco'`, `'Anna, Marco e Giulia'`, null se nessun altro); `etichettaChiHaPagato(t: Transaction, conti: Account[], nomi: Record<string, string>): string` (se `pagataDaUserId`: il suo nome; altrimenti il nome del conto di casa; altrimenti il nome dell'autore `t.userId`; altrimenti stringa vuota).
  - `deltaPerModifica(vecchia: TransazioneSaldo, nuova: TransazioneSaldo): { accountId: string; delta: number }[]` in `accountBalance.ts` (un delta per conto, uniti, senza voci a zero).
  - `CasaHome` (props nuove tutte opzionali per non rompere i test esistenti): `finanze?: { disponibile: DisponibileCasa; conti: Account[]; ultimeSpese: Transaction[]; nomi: Record<string, string>; aggiunta: CasaAggiunta }`. Con `finanze`: hero `Disponibile casa` (`formatEuro(valore)`) con `ComeSiCalcola`; card `Conto comune` con i conti e i saldi oppure, se non ce ne sono, `ContoComuneForm` (`Aprite il conto comune qui`, nome precompilato `Conto comune`, saldo attuale; `creaContoComune` poi `router.refresh()`); `Ultime spese di casa` (le prime 5 spese, con `etichettaChiHaPagato`) e link `Vedi tutte` a `/casa/movimenti`; `CasaFab` (pulsante `+` con `aria-label="Aggiungi spesa di casa"` che apre `AddTransactionSheet` con `modoIniziale="casa"` e `personale={null}`).
  - `/casa/movimenti`: pagina server che carica `getMyHousehold` poi `loadCasaData` e passa a `MovimentiCasa({ casa, aggiunta, transazioni, meUserId })` (client): elenco spese ed entrate di casa ordinate per data, filtro per mese (select dei mesi presenti, default mese corrente di Roma), per ogni riga data, descrizione, categoria, importo (`-`/`+` con `formatEuro`), chi ha pagato; `Elimina` e `Modifica` (con `AddTransactionForm initial`) solo se `pagataDaUserId` è nullo o è `meUserId`. Eliminare: `deleteTransaction` poi `adjustAccountBalance(accountId, tipo === 'expense' ? +importo : -importo)`; modificare: `updateTransaction` poi un `adjustAccountBalance` per ogni voce di `deltaPerModifica`. Stato locale aggiornato subito, errore con il messaggio standard.
  - `HomeDashboard` usa `AddTransactionSheet` al posto del foglio inline e riceve `casa?: CasaAggiunta | null` e `meUserId?: string`; `app/page.tsx` ottiene l'utente con `supabase.auth.getUser()` (se assente `redirect('/login')`) e chiama `loadHomeData(supabase, new Date(), user.id)`. Il pulsante resta `aria-label="Aggiungi transazione"`.

- [ ] **Step 1: Test che falliscono.**
  - `AddTransactionSheet.test.tsx` (mock di `@/lib/supabase/client`, `@/lib/data/transactions`, `@/lib/data/accounts` come in `HomeDashboard.test.tsx`): `'senza casa non mostra il selettore'`; `'con casa mostra Personale e Casa e parte da Personale senza memoria'`; `'ricorda l ultima scelta in localStorage'`; `'modoIniziale casa ignora la memoria'`; `'con localStorage che lancia il selettore funziona comunque'`; `'in modalità Casa mostra categorie e conti di casa, "Chi ha pagato" e "Lo vedrà anche Anna"'`; `'salvare in Casa crea la transazione con scope casa e chiama adjustAccountBalance con -12.5'`; `'una spesa di casa registrata alle 23:30 UTC del 31 ottobre ha data 2026-11-01'` (`vi.useFakeTimers` + `setSystemTime`); `'salvare in Personale non chiama adjustAccountBalance'`; `'nessuna parola vietata'`.
  - `etichette.test.ts`: tre varianti di `nomiAltri`; `etichettaChiHaPagato` con pagata da u2 → `Anna`, con conto di casa → `Conto comune`, senza conto → nome autore.
  - `accountBalance.test.ts`: `'deltaPerModifica: una spesa da 10 a 15 sullo stesso conto dà delta -5'`; `'cambio conto sposta +10 sul vecchio e -15 sul nuovo'`.
  - `AddTransactionForm.test.tsx`: `'contoEtichetta e obiettivoEtichetta cambiano i titoli'`; `'idContiSoloSpesa nasconde quei conti per le entrate'`; i test esistenti restano invariati.
  - `CasaHome.test.tsx`: `'con finanze mostra il disponibile casa 870,00 e il pannello Come si calcola'`; `'senza conto comune mostra il modulo e crea il conto'`; `'il pulsante + apre il foglio in modalità Casa senza selettore'`; i test esistenti restano.
  - `MovimentiCasa.test.tsx`: `'filtra per mese'`; `'Elimina rimuove subito la riga e chiama adjustAccountBalance con +64.2'`; `'non mostra Elimina né Modifica per una spesa pagata da un altro'`; `'se la scrittura fallisce mostra il messaggio standard'`; `'nessuna parola vietata'`.
  - `HomeDashboard.test.tsx`: i test esistenti passano invariati; nuovo `'con una casa passata mostra il selettore nel foglio'`.
- [ ] **Step 2: Run** i file. Expected: FAIL.
- [ ] **Step 3: Implementare** come da Interfaces; il foglio e la logica di salvataggio personale si spostano da `HomeDashboard` senza cambiare il comportamento personale.
- [ ] **Step 4: Run** i file. Expected: PASS, compresi tutti i test di `HomeDashboard`, `AddTransactionForm` e `HomeIsolation`.
- [ ] **Step 5: Chiusura standard.** Path: tutti i file elencati. Commit: `feat: spese di casa, selettore Personale|Casa, disponibile casa e movimenti`. Verifica a mano suggerita a Fabio dopo il deploy: due account reali registrano una spesa di casa e la vedono sull'altro telefono.

---

## Task T7.1: Trasferimenti, registri e casi SQL del caso 12

**Files:**
- Create: `src/lib/data/transfers.ts`, `src/lib/calculations/casa/crediti.ts`, `debitiMembri.ts`, `versamenti.ts`
- Modify: `src/lib/data/householdPlans.ts` (aggiunge `getPlanVersions`), `supabase/tests/rls_casa.sql`
- Test: `tests/data/transfers.test.ts`, `tests/data/householdPlans.test.ts`, `tests/calculations/casa/{crediti,debitiMembri,versamenti}.test.ts`

**Interfaces:**
- Consumes: tipo `Transfer` (`src/lib/types.ts`), `Transaction.pagataDaUserId`, `PlanBundle`, `Scope`. RPC (nomi esatti dei parametri):
  - `record_transfer(p_household, p_causale, p_importo, p_data, p_da_account, p_a_account, p_beneficiario, p_per_conto_di, p_mese_competenza, p_solo_registrazione, p_nota) returns uuid`
  - `delete_transfer(p_id uuid) returns void` (solo l'autore, altrimenti `movimento non trovato`)
  - Errori noti di `record_transfer`: `importo non valido`, `casa non valida`, `beneficiario non valido`, `membro non valido`, `combinazione non valida`, `conti mancanti`, `conto di origine non valido`, `conto della casa non valido`, `rinuncia non valida`, `il beneficiario non ha conti`, `causale non valida`.
- Produces:
  - `transfers.ts`: `getTransfers(supabase, scope: Scope = PERSONALE): Promise<Transfer[]>` (ordine data e created_at decrescente, mapper con `Number()` su `importo`); `RecordTransferInput = { householdId: string | null; causale: TransferCausale; importo: number; data: string; daAccountId?: string | null; aAccountId?: string | null; beneficiarioUserId?: string | null; perContoDiUserId?: string | null; meseCompetenza?: string | null; soloRegistrazione?: boolean; nota?: string | null }`; `recordTransfer(supabase, input): Promise<string>`; `deleteTransfer(supabase, id): Promise<void>`; `messaggioErroreTrasferimento(e: unknown): string` (`il beneficiario non ha conti` → `Chi riceve il rimborso non ha ancora un conto nell'app: scegliete "Già riflesso nei saldi".`; `membro non valido` → `Quella persona non è più in casa.`; altro → `Salvataggio fallito, controlla la connessione e riprova.`).
  - `householdPlans.ts`: `getPlanVersions(supabase, householdId): Promise<PlanBundle[]>` (tutte le versioni in ordine di `valido_dal`, con voci e quote).
  - `crediti.ts`: `creditoMembro(userId: string, spese: Pick<Transaction, 'tipo' | 'importo' | 'pagataDaUserId'>[], transfers: Transfer[]): number` = `max(0, Σ spese expense con pagataDaUserId = userId + Σ versamenti con beneficiarioUserId = userId − Σ rimborsi con beneficiarioUserId = userId)`, arrotondato a 2 decimali (rispecchia `_casa_credito_aperto`); `creditiPerMembro(userIds: string[], spese, transfers): Record<string, number>`.
  - `debitiMembri.ts`: `DebitoMembro = { debitoreId: string; creditoreId: string; importo: number; mesi: { mese: string; importo: number }[] }`; `debitiMembri(transfers: Transfer[]): DebitoMembro[]` (solo coppie con importo > 0; prestato = versamenti con autore c e `perContoDiUserId` = d; restituito = restituzioni (autore d, beneficiario c, senza per conto di) + versamenti (autore d, beneficiario c) + rinunce (restituzione con autore c, beneficiario c, per conto di d); `mesi` applica il restituito al mese più vecchio per primo, tiene solo i mesi con residuo); `debitoVersoMembri(userId: string, debiti: DebitoMembro[]): number` (somma dove `debitoreId = userId`).
  - `versamenti.ts` (rispecchia `_casa_arretrati`): `RigaMese = { mese: string; atteso: number; versato: number; mancano: number }`; `righeVersamento(input: { userId: string; oggi: string; piani: PlanBundle[]; membri: { userId: string; joinedAt: string }[]; transfers: Transfer[] }): RigaMese[]`. Algoritmo, per ogni primo del mese da `min(validoDal)` al mese di `oggi` compreso: piano = ultima versione con `validoDal <= mese`; quota = riga di quel piano con `userId` uguale; la riga del mese esiste solo se (`inCasaDal` nullo o il suo mese `<= mese`) e (`esceDal` nullo o `> mese`) e il membro non è entrato dopo il mese (`meseRomaISO(new Date(joinedAt)) > mese` lo esclude; nessuna riga membro = nessun vincolo) e il piano è attivo quel mese (nessuna riga del piano con `quotaMensile > 0`, `esceDal` nullo o `> mese`, che abbia `userId` nullo o un membro entrato dopo il mese); `versato` = Σ importo dei trasferimenti `versamento` con `meseCompetenza = mese` e (autore = userId senza `perContoDiUserId` né `beneficiarioUserId`, oppure `perContoDiUserId = userId`); `mancano = max(0, atteso − versato)`. Le righe con `atteso` 0 restano (posizione a 0%). `riservaDaRighe(righe: RigaMese[]): number` = Σ `mancano`.

- [ ] **Step 1: Test che falliscono** (`createFakeDb` con `transfers`, `fakeRpcClient`; tutti gli importi in euro):
  - `transfers.test.ts`: `'getTransfers con scope casa legge solo i trasferimenti della casa'`; `'getTransfers personale chiede household_id nullo'` (con `createRecordingClient`); `'recordTransfer mappa i parametri sulle RPC con i nomi p_*'` (assert sull'oggetto args completo); `'deleteTransfer chiama delete_transfer con p_id'`; `'messaggioErroreTrasferimento traduce i tre casi'`.
  - `householdPlans.test.ts`: `'getPlanVersions restituisce tutte le versioni in ordine con voci e quote'`.
  - `crediti.test.ts`: spesa 45 pagata da u1 e rimborso 20 a u1 → 25; rimborso 60 → 0; un versamento di restituzione di 10 a favore di u1 → +10; una rinuncia (rimborso `soloRegistrazione`, autore u1, beneficiario u1, importo 45) → 0; le spese `income` e senza `pagataDaUserId` non contano; `creiditiPerMembro` con tre membri.
  - `debitiMembri.test.ts`: u1 versa 603 per conto di u2 (mese 2026-10-01) → debito u2 verso u1 603; restituzione diretta di 200 → 403; versamento di restituzione di 100 → 303; rinuncia di u1 di 100 → 203; mai negativo; con prestato di 603 per ottobre e 603 per novembre e restituito 700 i `mesi` sono `[{ mese: '2026-11-01', importo: 506 }]`; con tre membri (u1 per u2 100, u1 per u3 50, u2 per u3 20) `debitoVersoMembri('u2')` = 120 e le coppie sono tre.
  - `versamenti.test.ts` (oggi `2026-11-15`; piano `2026-10-01` con u1 quota 777 e u2 quota 603; u1 e u2 entrati a settembre 2026): u2 con un versamento proprio di 300 per novembre → righe `[{ mese: '2026-10-01', atteso: 603, versato: 0, mancano: 603 }, { mese: '2026-11-01', atteso: 603, versato: 300, mancano: 303 }]` e `riservaDaRighe` 906; u1 con 777 per ottobre e per novembre → mancano 0; `'un versamento per conto di chiude l arretrato di u2'` (u1 versa 603 per conto di u2 per ottobre: u2 ottobre mancano 0, u1 ottobre ancora 777); `'un versamento di restituzione non conta come quota'`; `'un segnaposto senza utente rende il piano non attivo: nessuna riga'`; `'una posizione a 0% ha righe con atteso 0'`; `'inCasaDal nel mese successivo toglie le righe prima'`; `'esceDal 2026-11-01 toglie novembre e lascia ottobre'`; `'chi entra a novembre ha solo novembre e l ottobre dell altro non conta'` (u2 `joinedAt` `2026-11-03T10:00:00Z`: righe di u1 = `[novembre]`); `'una versione di piano cambiata a metà storia usa la quota giusta per mese'`; `'solo registrazione chiude la riserva'` (trasferimento `soloRegistrazione: true` conta come versato).
- [ ] **Step 2: Run** i file. Expected: FAIL.
- [ ] **Step 3: Implementare** come da Interfaces. `getTransfers` usa `applyScope` (la guardia di P2 lo verifica).
- [ ] **Step 4: Casi nuovi dello script RLS** in `supabase/tests/rls_casa.sql`, nella sezione "12" o in un blocco nuovo (due utenti nuovi `rls-t1`, `rls-t2` e una casa `h5` dedicata creata con `create_household` e `join_household`; conti personali e conto comune di prova; t2 esce dopo l'ingresso e rimane ex membro; t1 resta). Casi, con le chiamate nella forma già usata (`record_transfer(h, causale, importo, data, da, a, beneficiario, per_conto_di, mese, solo, nota)`):
  - `'una rinuncia a una restituzione non registrata dal creditore fallisce'` (`zz_err_msg`, atteso `rinuncia non valida`: restituzione con `p_beneficiario` ≠ chiamante, `p_per_conto_di` valorizzato, `p_solo_registrazione` vero)
  - `'una rinuncia a una restituzione con debitore ex membro fallisce'` (atteso `membro non valido`)
  - `'una rinuncia a un credito con importo e conti fallisce'` (rimborso con `p_beneficiario` = chiamante, `p_solo_registrazione` falso o conti valorizzati: `rinuncia non valida`)
  - `'un rimborso da un conto che non è della casa fallisce'` (`p_da_account` = conto personale del chiamante: `conto della casa non valido`)
  - `'una restituzione solo registrazione con un conto altrui non lascia conti collegati'` (dopo la chiamata, `da_account_id` e `a_account_id` della riga sono nulli; `zz_verifica`)
  - `'un rimborso solo registrazione non lascia conti collegati'` (idem)
- [ ] **Step 5: Run** `npx vitest run tests/data tests/calculations/casa`. Expected: PASS.
- [ ] **Step 6: Chiusura standard.** Path: tutti i file elencati. Commit: `feat: trasferimenti, registri di crediti, debiti e versamenti, casi SQL del caso 12`.
- [ ] **Step 7: Azione di Fabio (facoltativa, non blocca nulla).** Dopo il deploy, rilanciare `supabase/tests/rls_casa.sql` nel SQL editor (0007 già eseguita): atteso `0 FAIL` anche con i sei casi nuovi.

---

## Task T7.2: "Io, con carta", credito nel disponibile casa, movimenti fra membri con annulla

**Files:**
- Create: `src/lib/calculations/casa/descriviTrasferimento.ts`
- Modify: `src/lib/data/transactions.ts` (`createTransaction`), `src/app/add/AddTransactionSheet.tsx`, `src/lib/loadCasaData.ts`, `src/app/casa/movimenti/MovimentiCasa.tsx`, `src/app/casa/movimenti/page.tsx`, `src/app/casa/page.tsx`, `src/app/page.tsx`
- Test: `tests/AddTransactionSheet.test.tsx`, `tests/data/transactions.test.ts`, `tests/loadCasaData.test.ts`, `tests/MovimentiCasa.test.tsx`, `tests/calculations/casa/descriviTrasferimento.test.ts`

**Interfaces:**
- Consumes: T6.1, T6.2, T7.1 (`creditiPerMembro`, `getTransfers`, `deleteTransfer`), tipo `Transfer`.
- Produces:
  - `createTransaction` accetta `pagataDaUserId?: string | null` nell'input e lo scrive come `pagata_da_user_id` (solo con scope casa; il vincolo SQL richiede `pagata_da_user_id = user_id` e il conto personale dell'autore).
  - `AddTransactionSheet` in modalità Casa: l'elenco "Chi ha pagato" è `[...conti di casa, ...contiPersonali con nome "Io, con <nome>"]`, i personali passati in `idContiSoloSpesa`; il default è il primo conto di casa (se non c'è, il primo personale). Scegliere un conto personale: `createTransaction(..., { accountId: contoPersonale, pagataDaUserId: meUserId }, casa(id))` poi `adjustAccountBalance(contoPersonale, -importo)`. `app/page.tsx` e `casa/page.tsx` passano i conti personali (`getAccounts` personale).
  - `CasaData` guadagna `trasferimenti: Transfer[]` e `crediti: Record<string, number>` (per ogni membro); `computeDisponibileCasa` riceve `crediti` = somma dei crediti.
  - `descriviTrasferimento(t: Transfer, nomi: Record<string, string>): { titolo: string; dettaglio: string | null }`: versamento → `Versamento di Fabio` con dettaglio `per conto di Anna, novembre` o `novembre`; versamento con beneficiario → `Versamento di Fabio a favore di Anna`; rimborso → `Rimborso a Fabio`; rimborso con autore = beneficiario e `soloRegistrazione` → `Fabio rinuncia a un rimborso`; restituzione → `Restituzione di Anna a Fabio`; restituzione con `perContoDiUserId` → `Fabio rinuncia a una restituzione di Anna`. Il mese si scrive in italiano minuscolo (`novembre`).
  - `MovimentiCasa` mostra anche i trasferimenti in stile neutro (nessun segno, nessun colore di spesa, esclusi da ogni totale), con `Annulla` solo per l'autore: `deleteTransfer` poi aggiorna la lista; errore con il messaggio standard.

- [ ] **Step 1: Test che falliscono.**
  - `transactions.test.ts`: `'createTransaction scrive pagata_da_user_id con scope casa'`.
  - `AddTransactionSheet.test.tsx`: `'in Casa offre il conto comune e "Io, con <conto>"'`; `'scegliere Io, con carta crea la spesa con pagataDaUserId e scala il conto personale con delta -30'`; `'le entrate non offrono i conti personali'`; `'una spesa di casa con conto comune non imposta pagataDaUserId'`.
  - `loadCasaData.test.ts`: `'il disponibile casa sottrae i crediti: conto 1000, spesa anticipata 45, il valore è 955'`.
  - `descriviTrasferimento.test.ts`: i sei esempi sopra con nomi `{ u1: 'Fabio', u2: 'Anna' }`; `'nessun titolo contiene parole vietate'`.
  - `MovimentiCasa.test.tsx`: `'mostra un versamento in stile neutro e senza importo nei totali'`; `'Annulla compare solo per l autore e chiama deleteTransfer'`; `'una spesa pagata da Fabio con la sua carta mostra "Fabio" come chi ha pagato'`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implementare.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Chiusura standard.** Path: file elencati. Commit: `feat: spese pagate con la carta personale, crediti e movimenti fra membri`.

---

## Task T7.3: Versamento, rimborso, restituzione e pannelli di `/casa`

**Files:**
- Create: `src/app/casa/CasaAzioni.tsx`, `VersamentoForm.tsx`, `RimborsoForm.tsx`, `RestituisciForm.tsx`, `PannelliVersamenti.tsx`
- Modify: `src/app/casa/CasaHome.tsx`, `src/app/casa/page.tsx`, `src/lib/loadCasaData.ts`
- Test: `tests/VersamentoForm.test.tsx`, `tests/RimborsoForm.test.tsx`, `tests/RestituisciForm.test.tsx`, `tests/PannelliVersamenti.test.tsx`, `tests/CasaHome.test.tsx`, `tests/loadCasaData.test.ts`

**Interfaces:**
- Consumes: T7.1 (`recordTransfer`, `RecordTransferInput`, `messaggioErroreTrasferimento`, `righeVersamento`, `debitiMembri`, `creditiPerMembro`, `getPlanVersions`), `FoglioInferiore`, `parseImporto` (`src/lib/calculations/casa/parseImporto.ts`, ritorna `number | null`, accetta la virgola), `oggiRomaISO`, `meseRomaISO`.
- Produces:
  - `CasaData` guadagna `piani: PlanBundle[]` (`getPlanVersions`) e, per ogni membro, `righe: Record<string, RigaMese[]>` (`righeVersamento` con `oggi = oggiRomaISO(today)`, `membri` = membri attivi) e `debiti: DebitoMembro[]`.
  - `VersamentoForm({ householdId, membri, meUserId, contiPersonali, contiCasa, meseDefault, onDone, onClose })`: campi `Da` (conto personale), `A` (conto comune), `Importo`, `Data` (default oggi di Roma), `Per il mese di`, `Per me / Per conto di <nome>` (solo con altri membri), spunta `Il bonifico l'ho già riflesso nei saldi`. Invia `recordTransfer({ householdId, causale: 'versamento', importo, data, daAccountId, aAccountId, meseCompetenza, perContoDiUserId, soloRegistrazione })`. Importo con `parseImporto`; vuoto, zero o negativo disabilitano `Registra`; `Registra` si disabilita dopo il primo tocco finché la RPC non risponde (una sola chiamata anche con doppio tocco). Errore: `messaggioErroreTrasferimento`, i campi restano.
  - `RimborsoForm({ householdId, creditore: { userId, nome }, importoIniziale, contiCasa, onDone, onClose })`: importo preimpostato al credito, conto comune, spunta `già riflesso nei saldi`; invia `causale: 'rimborso'` con `beneficiarioUserId = creditore.userId`, `daAccountId` = conto comune. Non mostra né chiede nessun conto del creditore.
  - `RestituisciForm({ householdId, debito: DebitoMembro, nomeCreditore, contiPersonali, contiCasa, onDone, onClose })`: due modi, `Restituisco direttamente` (`causale: 'restituzione'`, `daAccountId` dell'autore, `beneficiarioUserId` = creditore, spunta `già riflesso`) e `Verso di più sul conto comune` (`causale: 'versamento'` con `beneficiarioUserId` = creditore, da conto personale a conto comune, senza mese). Importo qualunque, anche parziale; non supera il debito residuo.
  - Rinunce (bottone `Rinuncia` nel pannello): credito → `recordTransfer({ causale: 'rimborso', beneficiarioUserId: meUserId, soloRegistrazione: true, importo: credito })`; debito, registrata dal creditore → `{ causale: 'restituzione', beneficiarioUserId: meUserId, perContoDiUserId: debitore, soloRegistrazione: true, importo }`.
  - `CasaAzioni({ ... })` client: tiene lo stato `azioneAperta` (`'versamento' | 'rimborso' | 'restituisci' | 'rinuncia_credito' | 'rinuncia_debito' | null` con il parametro) e apre i moduli in un `FoglioInferiore`; a salvataggio riuscito `router.refresh()` e chiude. Espone `apri(azione)` ai figli e, in T8.2, alla striscia dei promemoria.
  - `PannelliVersamenti`: `Versamenti di <mese>` (una riga per membro: `Fabio 777 di 777 € fatto`, `Anna 300 di 603 € mancano 303 €`, oppure `Nessun versamento in questo periodo` per chi ha atteso 0) con pulsante `Registra un versamento`; `Arretrati e quote coperte` (per ogni mese passato con `mancano > 0` `<mese>: <nome> <importo> €, ancora da versare`; per ogni debito `<mese>: <creditore> ha versato <importo> € per <debitore>. <debitore> deve a <creditore> <importo> € (quota di <mese>).` con `Restituisci` visibile solo al debitore e `Rinuncia` solo al creditore); `Crediti` (al creditore `In attesa del rimborso: 45 €` e `Rinuncia`; agli altri membri `A Fabio spettano 45 € per spese anticipate.` e `Rimborsa`). Tono neutro, nessun rosso, nessuna scadenza.

- [ ] **Step 1: Test che falliscono.**
  - `VersamentoForm.test.tsx`: `'registra un versamento con importo 776,5 e mese di novembre'` (la RPC riceve `importo: 776.5`, `meseCompetenza: '2026-11-01'`, `daAccountId` e `aAccountId` scelti); `'per conto di Anna invia perContoDiUserId'`; `'vuoto, zero e negativo disabilitano Registra e non mostrano NaN'`; `'un doppio tocco su Registra fa una sola chiamata'`; `'se la RPC risponde "membro non valido" mostra la frase neutra e conserva i campi'`; `'con già riflesso nei saldi invia soloRegistrazione true'`; `'nessuna parola vietata'`.
  - `RimborsoForm.test.tsx`: `'importo preimpostato a 45 e chiama record_transfer rimborso con beneficiario'`; `'non chiede un conto del creditore'`; `'il messaggio "il beneficiario non ha conti" suggerisce già riflesso nei saldi'`.
  - `RestituisciForm.test.tsx`: `'restituzione diretta parziale di 200 su 603'`; `'verso di più sul conto comune manda versamento con beneficiario e senza mese'`; `'non accetta più del debito residuo'`.
  - `PannelliVersamenti.test.tsx`: `'mostra Fabio 777 di 777 € fatto e Anna 300 di 603 € mancano 303 €'`; `'Restituisci solo al debitore e Rinuncia solo al creditore'`; `'il creditore vede In attesa del rimborso senza pulsante Rimborsa'`; `'gli altri membri vedono Rimborsa'`; `'chi ha atteso 0 vede Nessun versamento in questo periodo'`; `'le frasi sui debiti non contengono "ritardo" né parole vietate'`.
  - `loadCasaData.test.ts`: `'righe e debiti rispecchiano i registri con tre membri'`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implementare.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Chiusura standard.** Path: file elencati. Commit: `feat: versamenti, rimborsi, restituzioni e pannelli della casa`.

---

## Task T7.4: Righe neutre nello storico personale

**Files:**
- Create: `src/lib/calculations/casa/righeNeutre.ts`, `src/app/history/StoricoCasa.tsx`
- Modify: `src/app/history/page.tsx`
- Test: `tests/calculations/casa/righeNeutre.test.ts`, `tests/StoricoCasa.test.tsx`, `tests/HistoryPivaIsolation.test.ts`

**Interfaces:**
- Consumes: `getMyHousehold`, `getTransactions(supabase, casa(id))`, `getTransfers(supabase, casa(id))`, `filterTransactionsByPeriodo`, `PeriodoFilter` state della pagina (`periodo`, `rangePersonalizzato`).
- Produces: `RigaNeutra = { id: string; data: string; etichetta: string; importo: number; verso: 'esce' | 'entra' }`; `righeNeutreStorico(input: { userId: string; transazioni: Transaction[]; trasferimenti: Transfer[]; nomi: Record<string, string> }): RigaNeutra[]` ordinate per data decrescente, con le regole:
  - versamento con autore = userId → `Versamento alla casa, <mese>` (mese di `meseCompetenza`, minuscolo), `verso: 'esce'`; con `perContoDiUserId` → `Versamento alla casa per conto di <nome>, <mese>`; con `beneficiarioUserId` → `Versamento alla casa a favore di <nome>`;
  - rimborso con `beneficiarioUserId = userId`, non `soloRegistrazione` e `aAccountId` non nullo → `Rimborso dalla casa`, `verso: 'entra'`;
  - restituzione con autore = userId, non rinuncia, non `soloRegistrazione` → `Restituzione a <nome>`, `esce`; con `beneficiarioUserId = userId`, senza `perContoDiUserId`, non `soloRegistrazione` → `Restituzione da <nome>`, `entra`;
  - spesa di casa con `pagataDaUserId = userId` e `tipo = 'expense'` → `Spesa di casa pagata da te: <descrizione>`, `esce`;
  - i trasferimenti `soloRegistrazione` di versamento si mostrano (il bonifico è registrato) senza cambiare `verso`; le rinunce non compaiono.
  - `StoricoCasa({ righe })` (client): sezione `Movimenti con la casa` sotto la lista, righe in stile neutro; le righe non entrano in `aggregateByCategory`, nei totali né nei grafici (la pagina le tiene in uno stato separato e le filtra solo per periodo con `filterTransactionsByPeriodo`-simile sui campi `data`).

- [ ] **Step 1: Test che falliscono.**
  - `righeNeutre.test.ts`: un test per ciascuna delle regole sopra (con importi 776, 45, 200, 64,2 e nomi `{ u1: 'Fabio', u2: 'Anna' }`); `'non compare nulla dell altro membro: un versamento di u2 non produce righe per u1'`; `'le rinunce non compaiono'`; `'ordine per data decrescente'`.
  - `StoricoCasa.test.tsx`: `'mostra le righe neutre e nessuna parola vietata'`; `'senza righe non mostra la sezione'`.
  - `HistoryPivaIsolation.test.ts`: aggiungere `'trasferimenti e spese di casa presenti non cambiano totali e grafici'` (stessi dati personali con e senza righe di casa: `aggregateByCategory` identico).
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implementare.** La pagina `history/page.tsx`, dopo `refresh()` personale, legge `supabase.auth.getUser()` e `getMyHousehold`; se c'è una casa, carica transazioni e trasferimenti di casa e calcola le righe; errori inoltrati con `fail`. **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Chiusura standard.** Path: file elencati. Commit: `feat: righe neutre della casa nello storico personale`.

---

## Task T8.1: Riserva del versamento e dei debiti nel disponibile personale

**Files:**
- Create: `src/lib/loadCasaStato.ts`, `src/lib/calculations/casa/riservoVersamento.ts`
- Modify: `src/lib/calculations/disponibile.ts`, `src/lib/loadHomeData.ts`, `src/app/HomeDashboard.tsx`, `src/app/page.tsx`, `src/lib/calculations/casa/spiegazioni.ts`
- Test: `tests/calculations/disponibile.test.ts`, `tests/calculations/casa/riservoVersamento.test.ts`, `tests/loadCasaStato.test.ts`, `tests/HomeIsolation.test.ts`, `tests/HomeDashboard.test.tsx`, `tests/calculations/casa/spiegazioni.test.ts`

**Interfaces:**
- Consumes: T7.1 (`righeVersamento`, `riservaDaRighe`, `debitiMembri`, `debitoVersoMembri`, `creditiPerMembro`, `getTransfers`, `getPlanVersions`), T6.1 (`CasaAggiunta`, `loadHomeData` con `userId`), `Spiegazione`.
- Produces:
  - `computeDisponibileLibero(accounts, goals, today, riservaVersamento = 0, riservaDebiti = 0): number` = saldi − accantonato − riservaVersamento − riservaDebiti (può essere negativo; i test esistenti restano verdi).
  - `riservoVersamento.ts`: `riservoVersamento(righe: RigaMese[]): number` (alias di `riservaDaRighe` per nome della spec); `spiegaRiserva(input: { righe: RigaMese[]; debitoDaRestituire: number }): Spiegazione` con ingredienti `Versamento alla casa, <mese>` (uno per mese con `mancano > 0`) e `Da restituire` e formula `Il versamento di ogni mese è riservato dall'inizio del mese, finché non lo registri.`.
  - `loadCasaStato(supabase, casa: CasaCorrente, now: Date = new Date()): Promise<CasaStato>` con `CasaStato = { householdId: string; nomeCasa: string; me: HouseholdMember; membri: HouseholdMember[]; piano: PlanBundle | null (versione in vigore o la prima futura); righe: RigaMese[] (del chiamante); riservaVersamento: number; debiti: DebitoMembro[]; debitoDaRestituire: number; crediti: Record<string, number>; avvisoArretrati: boolean }`. `oggi = oggiRomaISO(now)`. `avvisoArretrati` vero se i mesi con `mancano > 0` sono più di 2. Riserva 0 senza piano, con piano in bozza (righe vuote per costruzione) e per posizioni a 0%.
  - `HomeData.casa` diventa `CasaPerHome | null` = `{ aggiunta: CasaAggiunta; stato: CasaStato }`; `disponibileLibero` = `computeDisponibileLibero(accounts, goalsConSpeso, today, stato.riservaVersamento, stato.debitoDaRestituire)` (senza casa, come prima). `margineGiornaliero` si ricalcola dal nuovo disponibile.
  - `HomeDashboard` mostra nel dettaglio, dopo gli obiettivi: righe in sottrazione `Versamento alla casa, novembre` (`-` importo, una per mese con `mancano > 0`) e `Da restituire a <nome>` (una per creditore), poi righe informative non in somma: `Dalla casa ti spettano 45 €` (se il credito del chiamante è maggiore di zero) e, al creditore, `<nome> deve a te 603 €, quota di novembre`. Con `avvisoArretrati` una riga `Sono più di due mesi di versamenti da registrare. Se li hai già fatti, registrali con "Già riflesso nei saldi".`. Sono tutte nel DOM solo se il dettaglio è aperto, come oggi.

- [ ] **Step 1: Test che falliscono.**
  - `disponibile.test.ts`: `'sottrae riserva del versamento e dei debiti: saldo 1000, versamento 777, debiti 0 dà 223'`; `'con debiti 603 e versamento 777 su 1000 dà -380'`; `'i parametri omessi valgono 0'`.
  - `riservoVersamento.test.ts`: **`'nessun doppio conteggio: registrare il versamento di 777 abbassa il saldo di 777 e la riserva di 777, il disponibile resta 223'`** (si compongono `righeVersamento` con e senza il trasferimento e `computeDisponibileLibero`); `'registrare un versamento per conto di Anna lascia invariato il disponibile di Anna (riserva -603, debito +603)'`; `'restituire 200 abbassa conto e debito di 200: disponibile invariato'`; `'spiegaRiserva: valore uguale alla riserva e ingredienti che sommano'`.
  - `loadCasaStato.test.ts` (`createFakeDb` con `household_members`, `household_plans`, `household_plan_shares`, `transfers`, `transactions`): `'senza piano la riserva è 0'`; `'con piano in bozza (una posizione senza utente) la riserva è 0'`; `'a mezzanotte italiana: now 2026-10-31T23:30:00Z conta novembre'` (piano dal 2026-10-01 con quota 777: righe fino a `2026-11-01`, riserva 1554); `'avvisoArretrati dopo più di 2 mesi'`; `'tre membri: i debiti sono per coppia e il debitore somma tutti i creditori'`; `'un membro fuori dalla casa non vede nulla della riserva di un altro'`.
  - `HomeIsolation.test.ts`: `'un membro con piano attivo ha disponibile = base meno riserva e un non membro resta alla base'`.
  - `HomeDashboard.test.tsx`: `'mostra Versamento alla casa, novembre con segno meno solo a dettaglio aperto'`; `'mostra le righe informative del credito e del debito dell altro senza sommarle'`; `'senza casa il dettaglio è identico a prima'`; `'nessuna parola vietata'`.
  - `spiegazioni.test.ts`: `'spiegaRiserva'` come sopra.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implementare.** **Step 4: Run.** Expected: PASS, compreso l'intero `HomeIsolation`.
- [ ] **Step 5: Chiusura standard.** Path: file elencati. Commit: `feat: la riserva del versamento e dei debiti scala il disponibile personale`.

---

## Task T8.2: Promemoria in app

**Files:**
- Create: `src/lib/calculations/casa/promemoria.ts`, `src/app/casa/StrisciaPromemoria.tsx`
- Modify: `src/app/casa/CasaHome.tsx`, `src/app/casa/CasaAzioni.tsx`, `src/app/casa/page.tsx`, `src/app/HomeDashboard.tsx`
- Test: `tests/calculations/casa/promemoria.test.ts`, `tests/StrisciaPromemoria.test.tsx`, `tests/CasaHome.test.tsx`, `tests/HomeDashboard.test.tsx`

**Interfaces:**
- Consumes: T8.1 (`CasaStato`), T7.3 (`CasaAzioni.apri`), `formatNumero`, `oggiRomaISO`.
- Produces:
  - `computeReminders(stato: StatoPromemoria, utente: { userId: string }, oggi: string): Promemoria[]` (al massimo 2). `StatoPromemoria = { giornoVersamento: number | null; mesePiano: string | null; versamentoMese: { atteso: number; versato: number } | null; nomi: Record<string, string>; crediti: Record<string, number>; debiti: DebitoMembro[] }`. `Promemoria = { id: string; tipo: 'versamento' | 'credito' | 'debito'; testo: string; azione: null | { tipo: 'versamento' | 'rimborso' | 'restituisci'; etichetta: string; importo: number; altroUserId?: string } }`. Ordine e testi (importi con `formatNumero` e `€`):
    1. `versamento`: se `versato < atteso` e `oggi` è dal giorno `giornoVersamento − 3` del mese in poi. Prima del giorno: `Il tuo versamento di 776 € è da fare entro il 5.` Dal giorno in poi (anche dopo): `Il versamento di novembre è ancora da registrare. Già fatto? Registralo con la spunta "già riflesso".` Azione `Registra` (`tipo: 'versamento'`). L'importo è `atteso − versato`.
    2. `credito`: se il chiamante ha `crediti[me] > 0`: `In attesa del rimborso: 45 €.` senza azione; per ogni altro membro con credito: `A Anna spettano 45 € per spese anticipate.` con azione `Rimborsa` (`altroUserId` = creditore).
    3. `debito`: se il chiamante è debitore verso Anna: `Resta da restituire a Anna: 603 € (quota di novembre). Anche a rate, quando puoi.` con `Restituisci`; se è creditore: `Anna deve ancora 603 € a te.` senza azione.
  - `StrisciaPromemoria({ promemoria, oggi, onAzione })` (client): mostra i promemoria con i pulsanti `azione.etichetta` e `Più tardi`; `Più tardi` nasconde quello per la giornata, memoria `localStorage['promemoria:<id>:<oggi>']` con try/catch (se `localStorage` lancia, funziona comunque, il nascondimento vale solo per la sessione). In `/casa` `onAzione` chiama `CasaAzioni.apri`; in home la riga compatta in cima (una sola riga, il primo promemoria) è un link a `/casa`.

- [ ] **Step 1: Test che falliscono** (`promemoria.test.ts`; oggi `2026-11-03`, giorno 5, atteso 776, versato 0, u1 = chiamante):
  - `'3 giorni prima del giorno di versamento compare il versamento con testo e azione Registra'` (oggi `2026-11-02`: testo `Il tuo versamento di 776 € è da fare entro il 5.`); `'prima di quella data non compare'` (oggi `2026-11-01`)
  - `'dopo il giorno il tono resta neutro e senza la parola ritardo'` (oggi `2026-11-20`, testo `Il versamento di novembre è ancora da registrare. Già fatto? Registralo con la spunta "già riflesso".`)
  - `'versato uguale ad atteso: silenzio'` (lista vuota quando tutto è a posto)
  - `'il creditore vede In attesa del rimborso senza azione, gli altri membri Rimborsa'`, e con tre membri tutti tranne il creditore hanno l'azione
  - `'il debitore vede Restituisci, il creditore solo l informazione'`
  - `'al massimo due promemoria nell ordine versamento, credito, debito'` (con i tre tipi presenti restano i primi due)
  - `'nessun testo contiene colpa, ritardo, scaduto o parole vietate'`
  - `StrisciaPromemoria.test.tsx`: `'Più tardi nasconde il promemoria per oggi e scrive la chiave in localStorage'`; `'con localStorage che lancia, Più tardi nasconde comunque'`; `'il pulsante azione chiama onAzione con l azione'`.
  - `CasaHome.test.tsx`: `'la striscia compare in cima a /casa'`; `HomeDashboard.test.tsx`: `'in home compare una sola riga compatta che porta a /casa'`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implementare.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Chiusura standard.** Path: file elencati. Commit: `feat: promemoria di versamento, credito e debito in casa e in home`.

---

## Task T8b.1: Funzione pura del calendario, route handler ed eccezione del proxy

**Files:**
- Create: `src/lib/calculations/casa/calendario.ts`, `src/app/api/calendario/[token]/route.ts`
- Modify: `src/proxy.ts`
- Test: `tests/calculations/casa/calendario.test.ts`, `tests/api/calendarioRoute.test.ts`, `tests/proxy.test.ts`

**Interfaces:**
- Consumes: RPC `get_calendar_feed(p_token text) returns jsonb` (grant anche ad `anon`; ritorna null se il token non esiste, è revocato, il membro è uscito o la casa è archiviata). Forma del jsonb (chiavi snake_case, esattamente nove): `nome_casa`, `membro`, `giorno_versamento` (può essere null), `quota_mensile` (può essere null), `obiettivi: [{ nome, scadenza, importo, ricorrente, frequenza_mesi }]`, `credito_proprio`, `credito_altri`, `ultimo_controllo` (date o null), `ultimo_checkin` (date o null).
- Produces:
  - `FeedData = { nomeCasa: string; membro: string; giornoVersamento: number | null; quotaMensile: number | null; obiettivi: { nome: string; scadenza: string; importo: number; ricorrente: boolean; frequenzaMesi: number | null }[]; creditoProprio: number; creditoAltri: number; ultimoControllo: string | null; ultimoCheckin: string | null }` e `parseFeed(raw: unknown): FeedData | null` (null se la forma non è valida; ignora ogni chiave extra, quindi nessun campo estraneo arriva mai nell'ICS).
  - `eventiCalendario(feed: FeedData, oggi: string): EventoCalendario[]` con `EventoCalendario = { uid: string; data: string; titolo: string; descrizione: string | null }`. Orizzonte: da `oggi` a `oggi + 12 mesi` compresi, eventi di giornata intera. Regole: versamento il giorno `giornoVersamento` di ogni mese dell'orizzonte con data `>= oggi` e solo se `giornoVersamento` e `quotaMensile > 0` esistono (titolo `Versamento alla casa: 777 €`, uid `versamento-<data>@budget-app`); controllo del mese il primo di ogni mese con data `>= oggi` (`Controllo del mese in casa`, uid `checkin-<data>@budget-app`); controllo del saldo ogni 14 giorni da `ultimoControllo` (la prima occorrenza `>= oggi`; senza controlli, da `oggi`), titolo `Controllo del saldo del conto comune`; per ogni obiettivo: scadenza singola se `>= oggi`, oppure se `ricorrente` ogni `frequenzaMesi` mesi dalla scadenza, titolo `<nome>: 300 €`; credito: se `creditoProprio > 0` `In attesa del rimborso: 45 €`, se `creditoAltri > 0` `Rimborso da fare: 45 €`, entrambi alla data del prossimo check-in (primo del mese successivo a `oggi`).
  - `costruisciIcs(feed: FeedData, oggi: string): string`: `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID`, `CALSCALE:GREGORIAN`, `X-WR-CALNAME:<nomeCasa>`, un `VEVENT` per evento con `UID`, `DTSTAMP:<oggi senza trattini>T000000Z`, `DTSTART;VALUE=DATE:YYYYMMDD`, `DTEND;VALUE=DATE:<giorno dopo>`, `SUMMARY`; righe chiuse da `\r\n`, testo con escape di `\`, `;`, `,` e a capo, righe piegate a 75 ottetti con `\r\n` e uno spazio; chiude con `END:VCALENDAR\r\n`.
  - Route: `GET(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response>`. Rimuove un eventuale suffisso `.ics` dal token; token vuoto o più corto di 32 caratteri o con caratteri fuori da `[A-Za-z0-9_-]` → 404 senza chiamare il database; altrimenti `createClient` di `@supabase/supabase-js` con `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`persistSession: false`, come `keep-alive`) e `rpc('get_calendar_feed', { p_token })`. `data` nullo o forma non valida → 404 con corpo `Non trovato` identico per ogni caso; errore della RPC → 503 con lo stesso stile di corpo (`Servizio non disponibile`); successo → 200, `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: no-store`, corpo `costruisciIcs(feed, oggiRomaISO())`.
  - `proxy.ts`: `const isCalendar = request.nextUrl.pathname.startsWith('/api/calendario/');` esente dal redirect al login, come `isKeepAlive`.

- [ ] **Step 1: Test che falliscono.**
  - `calendario.test.ts` con `feed` = `{ nomeCasa: 'Casa Rossi', membro: 'Fabio', giornoVersamento: 5, quotaMensile: 777, obiettivi: [{ nome: 'TARI', scadenza: '2027-03-31', importo: 300, ricorrente: true, frequenzaMesi: 12 }], creditoProprio: 45, creditoAltri: 0, ultimoControllo: '2026-11-01', ultimoCheckin: '2026-10-01' }` e `oggi = '2026-11-08'`: `'versamento: 12 eventi, il primo 2026-12-05 (quello del 5 novembre è passato)'`; `'check-in: 12 eventi, dal 2026-12-01'`; `'controllo del saldo: 26 eventi ogni 14 giorni, il primo 2026-11-15'`; `'TARI: 1 evento il 2027-03-31 e la ricorrenza successiva è fuori orizzonte'`; `'credito proprio: 1 evento "In attesa del rimborso: 45 €" il 2026-12-01, nessun "Rimborso da fare"'`; `'totale 52 eventi'`; `'UID stabili: due chiamate danno gli stessi UID'`; `'senza piano (giornoVersamento e quotaMensile nulli) nessun evento di versamento e ICS valido'`; `'senza ultimo controllo il primo controllo è oggi'`.
  - ICS: `'inizia con BEGIN:VCALENDAR\\r\\nVERSION:2.0 e finisce con END:VCALENDAR\\r\\n'`; `'ogni riga termina con CRLF'` (nessun `\n` senza `\r`); `'data di giornata intera: DTSTART;VALUE=DATE:20261205 e DTEND;VALUE=DATE:20261206'`; `'escape: "Casa; Rossi, e figli" diventa "Casa\\; Rossi\\, e figli"'`; `'una riga lunga è piegata a 75 ottetti'`; `'parseFeed scarta una chiave personale extra: nessun campo estraneo finisce nell ICS'` (oggetto con `conti_personali: 'segreto'` → l'ICS non contiene `segreto`); `'parseFeed ritorna null con una forma non valida'`.
  - `tests/api/calendarioRoute.test.ts` (mock di `@supabase/supabase-js` con `rpc` simulato): `'token sconosciuto o revocato: 404 con lo stesso corpo'`; `'token corto o con caratteri strani: 404 senza chiamare rpc'`; `'token valido: 200, text/calendar; charset=utf-8, no-store e BEGIN:VCALENDAR'`; `'il suffisso .ics viene ignorato'`; `'errore della rpc: 503'`; `'non richiede nessuna sessione né cookie'`.
  - `tests/proxy.test.ts` (`// @vitest-environment node`, mock di `@supabase/ssr` con `getSession` che ritorna `{ data: { session: null } }`): `'/api/calendario/<token> passa senza redirect'` e `'/goals senza sessione reindirizza a /login'`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implementare.** Prima di scrivere la route rileggere `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (sezione dynamic route segments) e `proxy.md`. **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Chiusura standard.** Path: file elencati. Commit: `feat: feed calendario ICS privato con route senza sessione`.

---

## Task T8b.2: Impostazioni del calendario

**Files:**
- Create: `src/lib/data/calendarFeeds.ts`, `src/app/casa/impostazioni/CalendarioCasa.tsx`
- Modify: `src/app/casa/impostazioni/ImpostazioniCasa.tsx`
- Test: `tests/data/calendarFeeds.test.ts`, `tests/CalendarioCasa.test.tsx`, `tests/ImpostazioniCasa.test.tsx`

**Interfaces:**
- Consumes: tabella `calendar_feeds` (select ammessa solo al proprietario dalla RLS: colonne `id, household_id, user_id, token, created_at, revocato_il`), RPC `rotate_calendar_feed() returns text` (revoca il feed attivo e ne crea uno nuovo, ritorna il token) e `revoke_calendar_feed() returns void`; tipo `CalendarFeed`; route `/api/calendario/<token>`.
- Produces:
  - `getMyCalendarFeed(supabase): Promise<CalendarFeed | null>` (feed con `revocato_il` nullo, il più recente), `rotateCalendarFeed(supabase): Promise<string>`, `revokeCalendarFeed(supabase): Promise<void>`.
  - `CalendarioCasa({ feedIniziale: CalendarFeed | null, origin?: string })` (client): link `<origin>/api/calendario/<token>`; pulsanti `Copia` (`navigator.clipboard.writeText` in try/catch, in caso di errore seleziona il testo), `Rigenera`, `Revoca` (stato locale aggiornato subito), `Scarica una volta` (scarica il corpo della route come `casa.ics` tramite `fetch` e `Blob`, solo con un link attivo); senza link, il pulsante `Crea il link`. Avviso fisso: `Chiunque abbia questo link vede le scadenze della casa: non condividerlo.` e `Può volerci qualche ora perché il calendario si aggiorni.` Istruzioni brevi per Google Calendar (`Altri calendari, Da URL`) e per iPhone (`Impostazioni, Calendario, Account, Aggiungi account, Altro, Aggiungi calendario con abbonamento`). `ImpostazioniCasa` monta la sezione `Calendario`; la pagina server passa `getMyCalendarFeed`.

- [ ] **Step 1: Test che falliscono.**
  - `calendarFeeds.test.ts`: `'getMyCalendarFeed mappa il feed attivo e ignora i revocati'`; `'rotateCalendarFeed chiama rotate_calendar_feed e ritorna il token'`; `'revokeCalendarFeed chiama revoke_calendar_feed'`; `'rilancia gli errori delle RPC'`.
  - `CalendarioCasa.test.tsx`: `'senza feed mostra Crea il link'`; `'Rigenera mostra subito il nuovo link e non quello vecchio'`; `'Revoca toglie il link e torna a Crea il link'`; `'Copia usa la clipboard e con clipboard che lancia non rompe la pagina'`; `'mostra l avviso "non condividerlo" e quello delle ore di aggiornamento'`; `'Scarica una volta compare solo con un link attivo'`; `'nessuna parola vietata'`; `'errore di rete mostra il messaggio standard'`.
  - `ImpostazioniCasa.test.tsx`: `'mostra la sezione Calendario'` (i test esistenti restano).
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implementare.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Chiusura standard.** Path: file elencati. Commit: `feat: impostazioni del calendario con copia, rigenera, revoca e scarico`.
- [ ] **Step 6: Azione di Fabio (verifica a mano dopo il deploy su Vercel).** In `/casa/impostazioni` creare il link; aggiungerlo a Google Calendar (`Altri calendari`, `Da URL`) e sull'iPhone (`Impostazioni`, `Calendario`, `Account`, `Aggiungi account`, `Altro`, `Aggiungi calendario con abbonamento`): devono comparire versamento, controlli e scadenze della casa e nient'altro. Poi `Rigenera`: il vecchio link deve dare "Non trovato"; `Revoca`: anche il nuovo. Nessuna variabile d'ambiente da aggiungere su Vercel.

---

## Autorevisione

- **Copertura spec:** T6 (T6.1, T6.2), T7 (T7.1 a T7.4: `record_transfer` e `delete_transfer` già in produzione, registro dei debiti, versamento per conto di, restituzione, rimborso, credito, righe neutre, lista con annulla), T8 (T8.1, T8.2: riserva, riserva del debito, righe nel dettaglio, `computeReminders` con i primi tre tipi, striscia), T8b (T8b.1, T8b.2: `calendario.ts`, route, proxy, impostazioni, istruzioni, scarico una tantum). Il disponibile casa completo (D, cuscinetto) resta a T9 per la spec.
- **Elementi riportati dalle revisioni:** FK degli autori, `join_household` con `esce_dal`, orfano F9 e rinomina categoria (P1, con i casi nello script); gap del caso 12 (T7.1); guardia statica (P2); spezzatura del wizard (P3); parole "l'altro" e test senza `assertNessunaParolaVietata` (P4); uscenti nel wizard (P5).
- **Coerenza dei nomi tra task:** `CasaAggiunta` (T6.1) usata da T6.2, T7.2, T8.1; `CasaData` cresce in T7.2 (`trasferimenti`, `crediti`) e T7.3 (`piani`, `righe`, `debiti`); `RigaMese` e `riservaDaRighe` (T7.1) usati da T8.1 e T8.2; `DebitoMembro` (T7.1) usato da T7.3, T8.1, T8.2; `FoglioInferiore` (T6.2) usato da T7.3.
