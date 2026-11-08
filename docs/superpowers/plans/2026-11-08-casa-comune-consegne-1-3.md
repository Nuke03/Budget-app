# Casa comune, consegne 1 a 3: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare in produzione le fondamenta della casa condivisa (schema completo e isolamento dei dati), la casa con invito, ingresso, uscita e chiusura, e il calcolo guidato della quota mensile di ciascun membro.

**Architecture:** Una sola migrazione SQL (eseguita a mano da Fabio) crea tutto lo schema della spec, comprese le parti usate dalle consegne 4 a 8. Il data layer esistente guadagna un parametro `Scope` con default personale, così ogni lettura di oggi resta personale per costruzione; un test statico impedisce di dimenticare il filtro. I calcoli della quota sono funzioni pure in `src/lib/calculations/casa/`, la UI nuova vive sotto `src/app/casa/`.

**Tech Stack:** Next.js 16 (App Router, `src/proxy.ts`, Server Component per le pagine, Client Component per l'interazione), Supabase (Postgres, RLS, RPC), TypeScript, Vitest con Testing Library, date-fns 4, lucide-react.

**Spec:** [docs/superpowers/specs/2026-11-08-co-gestione-casa-design.md](../specs/2026-11-08-co-gestione-casa-design.md). Gli esecutori leggono la spec insieme al piano: qui si decidono nomi, firme, file e test; la spec resta la fonte per testi, regole e motivazioni.

**Ambito:** solo le consegne 1, 2 e 3 (T1 a T5). Le consegne 4 a 8 (T6 a T14) avranno piani propri, scritti sul codice reale dopo questa consegna. La migrazione di T1 però contiene già lo schema intero (tabelle, colonne, funzioni, policy, trigger, feed calendario), perché Fabio vuole eseguire lo SQL una volta sola.

## Global Constraints

- Costo 0 euro al mese: solo Supabase (Postgres e Auth) e Vercel Hobby. Nessuna nuova dipendenza npm; `date-fns-tz` non si aggiunge (il fuso `Europe/Rome` si calcola con `Intl`).
- EUR, formattazione `it-IT` (`formatEuro`, `formatDateIt`), tutti i testi della UI in italiano.
- Next.js 16 con API diverse da quelle note (`AGENTS.md`): prima di usare una API di Next leggere la guida in `node_modules/next/dist/docs/` (per esempio `01-app/03-api-reference/04-functions/redirect.md`, `use-router.md`, `use-pathname.md`). Sessione controllata in `src/proxy.ts` (le rotte `/casa/*` sono già coperte dal matcher), errori in `error.tsx` con `retry`, pagine client che inoltrano gli errori con `useThrowToBoundary`.
- UI ottimistica come oggi: dove il risultato non serve per proseguire lo stato locale si aggiorna subito e la scrittura va in background; l'errore usa il messaggio esistente "Salvataggio fallito, controlla la connessione e riprova.". Creare o entrare in una casa e salvare il piano restano operazioni con attesa, perché servono l'esito.
- Nessun offline, nessuna integrazione bancaria, niente notifiche push, niente integrazioni Google.
- Parole vietate nella parte Casa (testi visibili e DOM): "bloccato", "dilazionato", "sinking fund", "giroconto", "imputazione", "riconciliazione". Ogni test di componente della parte Casa chiama `assertNessunaParolaVietata` (T3).
- Niente messaggi che fanno sentire in colpa, niente gamification, niente confronti fra membri presentati come merito o colpa. Nessuna regola di divisione è presentata come "giusta".
- Il reddito inserito nel piano è visibile a tutti i membri (decisione di Fabio); i dati personali (conti, transazioni, obiettivi, categorie, P.IVA) non sono mai leggibili da altri.
- La migrazione è idempotente, in `begin; ... commit;`, senza `update` né `delete` su righe esistenti: tutte le righe di oggi restano con `household_id` nullo.
- "Oggi" e "mese corrente" della parte Casa si calcolano in fuso `Europe/Rome` con la funzione unica di T4, mai con `new Date()` direttamente (il server Vercel lavora in UTC). La parte personale esistente non cambia.
- Una persona appartiene al massimo a una casa attiva; nessun tetto al numero di membri (le regole valgono per N da 1 in su).
- Ogni task finisce con `npm test`, `npm run lint` e `npx next build` verdi, poi `git commit` e `git push` su master (regola fissa di Fabio: vede ogni consegna su Vercel). Messaggi di commit nello stile esistente (`feat: ...`, `docs: ...`), chiusi con la riga `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Casi che la spec implica ma che nessun test di task esercita da solo, i più probabili per primi. Ciascuno ha il suo test nel task indicato.

1. **Mezzanotte di fine mese in Italia mentre il server è in UTC.** Alle 23:30 UTC del 31 ottobre in Italia è già il 1 novembre: il mese di partenza del piano e "oggi" non devono slittare. Test in T4 (`oggi.test.ts`) e in T5 (il wizard usa il `meseCorrente` ricevuto dal server).
2. **Casa di una sola persona e reddito a zero.** Con N = 1 o con un reddito 0 nessuna divisione per zero, nessun `NaN`, la quota è comunque la somma esatta del totale. Test in T4 (`quota.test.ts`) e in T5 (wizard con una sola persona).
3. **Campi vuoti, virgola decimale e valori negativi nel wizard.** "1800,5" vale 1800,5; vuoto o negativo disabilita "Avanti" e non produce mai `NaN` nel DOM. Test in T5 (`parseImporto` e wizard).
4. **Chi ha chiuso la casa o è uscito.** Un membro con `attivo = false` (casa archiviata) o senza riga di membro è trattato come "senza casa": `/casa` offre di crearne o unirsi a un'altra, non mostra la casa vecchia. Test in T3 (`getMyHousehold`).
5. **Codice invito scritto a mano.** Minuscolo, con trattino o con spazi finali deve funzionare; scaduto, revocato, rigenerato o inesistente danno lo stesso messaggio generico. Test in T1 (script RLS) e in T3 (`joinHousehold` e form).

## Divergenze e scelte del pianificatore rispetto alla spec

Dove la spec è contraddittoria o incompleta il piano sceglie quanto segue. Gli esecutori non le ribaltano; Fabio può farlo prima dell'esecuzione.

1. **Arrotondamento delle quote.** La spec dice "per difetto e gli euro che avanzano al reddito maggiore", ma dà 776 e 604 per la proporzionale con 1.800 e 1.400 (la regola data produce 777 e 603), mentre l'esempio a tre persone (655, 508, 217) segue la regola data. Il piano applica la regola scritta in 7.2 ovunque: **777 e 603**. Anche le frasi di esempio della UI si leggono con questi numeri. Se Fabio preferisce 776 e 604 serve cambiare la regola (resto ai decimali maggiori), che però rompe l'esempio a tre.
2. **Cuscinetto di default.** "5% di 1.321" fa 66, non 59 come dice l'esempio della ricerca. Il default calcolato è il 5% arrotondato (66); i test con 59 passano 59 come input esplicito. Inoltre l'esempio dà 1.380 solo con l'assicurazione a 8 euro al mese (96 l'anno); con 8,33 il totale arrotondato per eccesso è 1.390. I test dell'esempio usano 96 l'anno.
3. **Utenti dello script RLS.** Fabio ha due account reali, ma la spec chiede tre o quattro utenti. Lo script crea utenti finti dentro la transazione e annulla tutto alla fine.
4. **Permessi sulle funzioni.** Su Supabase `execute` è assegnato di default anche ad `anon` e `authenticated` (non solo a `public`): la migrazione revoca da `public`, `anon` e `authenticated` e concede il minimo.
5. **Rinuncia a un debito fra membri.** La spec non dice dove memorizzare il debitore. La rinuncia è una `restituzione` registrata dal creditore con `beneficiario_user_id` uguale a se stesso, `per_conto_di_user_id` uguale al debitore, `solo_registrazione`, senza conti. Per questo `per_conto_di_user_id` è ammesso anche sulla `restituzione`.
6. **Alfabeto del codice invito.** Senza 0, O, 1, I, L restano 31 simboli (la spec dice 32). Non cambia nulla di pratico.
7. **Posizioni uscite e stato del piano.** Una posizione con `esce_dal` valorizzato è esclusa dal calcolo "bozza o attivo", altrimenti la definizione "legata = `user_id` e `esce_dal` nullo" renderebbe bozza un piano che la spec dice resti attivo.
8. **Schermata "Prossimi passi".** La spec la mette a fine wizard con tre carte; due su tre puntano a funzioni delle consegne 4 e 6, quindi in T5 il wizard salva e ricade sulla pagina del piano. Le carte arrivano con le consegne che creano le destinazioni.
9. **Icona di Casa nella barra.** Home usa già l'icona `Home`: Casa usa `Building2` di lucide, distinta.

## File Structure

| File | Responsabilità | Task |
|---|---|---|
| `supabase/migrations/0004_casa_comune.sql` | Schema completo, funzioni, RLS, trigger | T1 |
| `supabase/tests/rls_casa.sql` | Prova manuale delle policy e delle funzioni | T1 |
| `tests/migration0004.test.ts` | Controlli statici sul file SQL | T1 |
| `src/lib/data/scope.ts` | `Scope`, `PERSONALE`, `casa()`, `applyScope`, `scopeHouseholdId` | T2 |
| `src/lib/data/{accounts,categories,goals,transactions}.ts` | Parametro di scope, nuove colonne | T2 |
| `src/lib/types.ts` | Tipi nuovi e campi opzionali | T2 |
| `src/lib/loadHomeData.ts` | Calcolo della home estratto dalla pagina | T2 |
| `tests/helpers/{fakeSupabase,recordingSupabase,fakeDb,fakeRpc,scopeGuard,paroleVietate,esempioCasa}.ts` | Helper di test | T2, T3, T4 |
| `src/lib/data/households.ts` | Casa, invito, ingresso, uscita, chiusura | T3 |
| `src/app/casa/*`, `src/app/NavBar.tsx` | Pagine `/casa`, `/casa/inizia`, `/casa/impostazioni`, navigazione | T3 |
| `src/lib/calculations/casa/{oggi,vociTipiche,mensilizza,cuscinetto,quota,spiegazioni,parseImporto}.ts` | Calcoli puri della quota | T4, T5 |
| `src/lib/format.ts` | `formatNumero` | T4 |
| `src/lib/data/householdPlans.ts`, `src/lib/calculations/casa/{statoPiano,pianoVersioni}.ts` | Piano della quota | T5 |
| `src/app/casa/quota/*`, `src/app/casa/ComeSiCalcola.tsx` | Wizard, pagina del piano | T5 |

---

## Task 1: Migrazione 0004 e script di prova RLS

**Files:**
- Create: `supabase/migrations/0004_casa_comune.sql`
- Create: `supabase/tests/rls_casa.sql`
- Test: `tests/migration0004.test.ts`

**Interfaces:**
- Consumes: lo stato dopo le migrazioni 0001 a 0003 (nessun'altra assunzione).
- Produces, per tutti i task successivi (colonne `snake_case`, i client TypeScript le mappano in `camelCase`):
  - Tabelle: `households`, `household_members`, `household_invites`, `household_plans`, `household_plan_items`, `household_plan_shares`, `transfers`, `balance_checks`, `household_checkins`, `calendar_feeds`.
  - Colonne nuove: `household_id` su `accounts`, `categories`, `budget_goals`, `transactions`; `transactions.pagata_da_user_id`, `transactions.origine`; `budget_goals.accantona_da`.
  - RPC (i nomi dei parametri sono quelli da passare a `supabase.rpc`):
    - `create_household(p_nome text, p_display_name text) returns uuid`
    - `create_invite(p_household uuid) returns text` (codice senza trattino, 8 caratteri; rigenerare revoca i precedenti)
    - `revoke_invite(p_household uuid) returns void`
    - `join_household(p_codice text, p_display_name text) returns uuid` (errore unico `Codice non valido o scaduto`)
    - `leave_household() returns void` e `close_household() returns void`; errori con messaggio esatto `ULTIMO_MEMBRO`, `NON_ULTIMO_MEMBRO`, `CREDITO_APERTO`, `DEBITO_APERTO`, `ARRETRATI_APERTI`
    - `save_household_plan(p_household uuid, p_payload jsonb) returns uuid[]` (forma del payload nel commento SQL sopra la funzione)
    - `record_transfer(p_household, p_causale, p_importo, p_data, p_da_account, p_a_account, p_beneficiario, p_per_conto_di, p_mese_competenza, p_solo_registrazione, p_nota) returns uuid`, `delete_transfer(p_id uuid)`, `adjust_account_balance(p_account uuid, p_delta numeric)`, `record_balance_check(p_account uuid, p_saldo_dichiarato numeric, p_data date, p_crea_movimento boolean default true) returns uuid`
    - `rotate_calendar_feed() returns text`, `revoke_calendar_feed()`, `get_calendar_feed(p_token text) returns jsonb` (nullo se il token non vale)
    - `is_household_member(h)`, `is_household_writer(h)`
  - La migrazione è già stata provata su un Postgres locale (PGlite) con 0001 a 0003: doppia esecuzione senza errori e i flussi principali (ingresso con tre membri, spese con carta personale, rimborso, versamento per conto di, uscita con credito e debito aperti, piano, controllo del saldo, feed). L'esecutore **copia il file così com'è**, non lo riformula.

- [ ] **Step 1: Scrivere il test statico che fallisce**

`tests/migration0004.test.ts` legge `supabase/migrations/0004_casa_comune.sql` e verifica (tutti i controlli ignorano le righe che iniziano con `--`, quindi anche il blocco di rollback commentato):
- `'inizia con begin; e ha un commit; prima del blocco di rollback commentato'`
- `'ogni create table usa if not exists'`
- `'ogni create policy di primo livello è preceduta da drop policy if exists con lo stesso nome e tabella'` (regex `^create policy (\w+) on ([\w.]+)`)
- `'ogni funzione security definer imposta search_path = public'` (spezza il file su `create or replace function`)
- `'nessuna istruzione di primo livello modifica o cancella righe esistenti'` (nessuna riga non commentata che inizi in colonna 0 con `update`, `delete`, `insert`, `truncate`, e nessun `drop table` o `drop column` fuori dai commenti)
- `'le quattro tabelle esistenti perdono owner_full_access e nessuna policy con quel nome viene ricreata'`
- `'ogni funzione public dichiarata compare nella revoke da public, anon e authenticated'` (estrae i nomi da `create or replace function public.<nome>(`)
- `'solo get_calendar_feed è concessa ad anon'` (una sola occorrenza di `to anon;` e riguarda `get_calendar_feed(text)`)
- `'contiene tutte le tabelle del modello'` (le dieci tabelle nuove con `create table if not exists public.<nome>`)

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run tests/migration0004.test.ts`
Expected: FAIL (file `0004_casa_comune.sql` non esiste).

- [ ] **Step 3: Creare `supabase/migrations/0004_casa_comune.sql` con questo contenuto esatto**

```sql
-- 0004_casa_comune.sql
-- Casa comune: schema completo (tabelle, colonne, funzioni, policy, trigger) per tutte le
-- consegne della co-gestione. Idempotente: rieseguirla non cambia nulla. Nessun update o
-- delete su righe esistenti: tutte le righe di oggi restano personali (household_id nullo).
-- Da eseguire a mano nel SQL editor di Supabase, una sola volta.
begin;

-- =====================================================================
-- 1. TABELLE NUOVE
-- =====================================================================

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'La nostra casa',
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  archiviata_il timestamptz
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  slot smallint not null check (slot >= 1),
  attivo boolean not null default true,
  primary key (household_id, user_id),
  unique (household_id, slot)
);

-- una persona appartiene al massimo a una casa attiva
create unique index if not exists household_members_una_casa_attiva
  on public.household_members (user_id) where attivo;

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  codice text not null unique,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  scade_il timestamptz not null default (now() + interval '7 days'),
  revocato_il timestamptz
);

create table if not exists public.household_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  valido_dal date not null check (extract(day from valido_dal) = 1),
  giorno_versamento smallint not null check (giorno_versamento between 1 and 28),
  regola text not null check (regola in ('parti_uguali', 'proporzionale', 'pari_residuo', 'personalizzata')),
  cuscinetto_obiettivo numeric not null default 0,
  cuscinetto_quota_mensile numeric not null default 0,
  arrotondamento numeric not null default 10 check (arrotondamento > 0),
  totale_mensile numeric not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (household_id, valido_dal)
);

create table if not exists public.household_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.household_plans(id) on delete cascade,
  nome text not null,
  categoria_id uuid references public.categories(id) on delete set null,
  frequenza_mesi smallint not null check (frequenza_mesi >= 1),
  importo_ricorrenza numeric not null check (importo_ricorrenza >= 0),
  importo_mensile numeric generated always as (importo_ricorrenza / frequenza_mesi) stored,
  origine_stima text not null default 'suggerita' check (origine_stima in ('suggerita', 'utente', 'reale')),
  goal_id uuid references public.budget_goals(id) on delete set null,
  stima_ignorata_con_n smallint,
  ordine smallint not null default 0
);

create table if not exists public.household_plan_shares (
  plan_id uuid not null references public.household_plans(id) on delete cascade,
  slot smallint not null check (slot >= 1),
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null,
  reddito_netto_mensile numeric not null default 0 check (reddito_netto_mensile >= 0),
  reddito_irregolare boolean not null default false,
  percentuale numeric check (percentuale is null or (percentuale >= 0 and percentuale <= 100)),
  in_casa_dal date,
  esce_dal date,
  quota_mensile numeric not null default 0 check (quota_mensile >= 0),
  primary key (plan_id, slot)
);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete restrict,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  da_account_id uuid references public.accounts(id) on delete restrict,
  a_account_id uuid references public.accounts(id) on delete restrict,
  importo numeric not null check (importo > 0),
  data date not null,
  causale text not null check (causale in ('versamento', 'rimborso', 'restituzione', 'altro')),
  beneficiario_user_id uuid references auth.users(id) on delete cascade,
  per_conto_di_user_id uuid references auth.users(id) on delete cascade,
  mese_competenza date,
  solo_registrazione boolean not null default false,
  nota text,
  created_at timestamptz not null default now(),
  check (da_account_id is null or a_account_id is null or da_account_id <> a_account_id),
  check (household_id is not null or causale = 'altro'),
  check (per_conto_di_user_id is null or causale in ('versamento', 'restituzione')),
  check (per_conto_di_user_id is null or beneficiario_user_id is null or causale = 'restituzione'),
  check (mese_competenza is null or (causale = 'versamento' and extract(day from mese_competenza) = 1))
);

create table if not exists public.balance_checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  account_id uuid not null references public.accounts(id) on delete restrict,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data date not null,
  saldo_registrato numeric not null,
  saldo_dichiarato numeric not null,
  differenza numeric not null,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_checkins (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  mese date not null check (extract(day from mese) = 1),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  atteso_totale numeric not null default 0,
  versato_totale numeric not null default 0,
  previsto_mensili numeric not null default 0,
  speso_mensili numeric not null default 0,
  non_registrate numeric not null default 0,
  avanzo numeric not null default 0,
  esito text not null check (esito in ('in_pari', 'avanzo', 'ammanco')),
  destinazione_avanzo text check (destinazione_avanzo in ('cuscinetto', 'da_parte')),
  goal_id uuid references public.budget_goals(id) on delete set null,
  unique (household_id, mese)
);

create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  revocato_il timestamptz
);

-- al massimo un feed non revocato per membro
create unique index if not exists calendar_feeds_un_feed_attivo
  on public.calendar_feeds (household_id, user_id) where revocato_il is null;

create index if not exists transfers_household_idx on public.transfers (household_id) where household_id is not null;
create index if not exists household_plans_household_idx on public.household_plans (household_id);
create index if not exists balance_checks_household_idx on public.balance_checks (household_id);

-- =====================================================================
-- 2. COLONNE SULLE TABELLE ESISTENTI (nessun dato esistente cambia)
-- =====================================================================

alter table public.accounts add column if not exists household_id uuid references public.households(id) on delete restrict;
alter table public.categories add column if not exists household_id uuid references public.households(id) on delete restrict;
alter table public.budget_goals add column if not exists household_id uuid references public.households(id) on delete restrict;
alter table public.transactions add column if not exists household_id uuid references public.households(id) on delete restrict;
alter table public.transactions add column if not exists pagata_da_user_id uuid references auth.users(id) on delete cascade;
alter table public.transactions add column if not exists origine text;
alter table public.budget_goals add column if not exists accantona_da date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_origine_check') then
    alter table public.transactions
      add constraint transactions_origine_check check (origine is null or origine in ('riconciliazione'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_pagata_check') then
    alter table public.transactions
      add constraint transactions_pagata_check
      check (pagata_da_user_id is null or (household_id is not null and pagata_da_user_id = user_id));
  end if;
end $$;

create index if not exists accounts_household_idx on public.accounts (household_id) where household_id is not null;
create index if not exists categories_household_idx on public.categories (household_id) where household_id is not null;
create index if not exists budget_goals_household_idx on public.budget_goals (household_id) where household_id is not null;
create index if not exists transactions_household_idx on public.transactions (household_id) where household_id is not null;

-- =====================================================================
-- 3. FUNZIONI
-- Le funzioni security definer scavalcano le RLS: iniziano con una verifica
-- esplicita su auth.uid() e non si fidano mai di un id passato come parametro.
-- =====================================================================

-- 3.1 Helper usati dalle policy

create or replace function public.is_household_member(h uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = h and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_household_writer(h uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    join public.households c on c.id = m.household_id
    where m.household_id = h and m.user_id = (select auth.uid()) and c.archiviata_il is null
  );
$$;

-- 3.2 Helper interni (non eseguibili dal client)

-- "oggi" in fuso Europe/Rome (il server Vercel e Postgres lavorano in UTC)
create or replace function public._casa_oggi()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;

-- casa attiva (non archiviata) di un utente, oppure null
create or replace function public._casa_attiva(u uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select m.household_id
  from public.household_members m
  join public.households c on c.id = m.household_id
  where m.user_id = u and m.attivo and c.archiviata_il is null
  limit 1;
$$;

create or replace function public._casa_membro_attivo(h uuid, u uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    join public.households c on c.id = m.household_id
    where m.household_id = h and m.user_id = u and m.attivo and c.archiviata_il is null
  );
$$;

-- codice di invito: 8 caratteri da 31 simboli senza ambigui (niente 0, O, 1, I, L)
create or replace function public._casa_genera_codice()
returns text language plpgsql volatile set search_path = public as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  risultato text := '';
  i int;
begin
  -- si saltano i byte 6 e 8 e 9 dell'uuid v4, che hanno bit fissi
  for i in 0..7 loop
    risultato := risultato || substr(alfabeto, (get_byte(b, case when i < 6 then i else i + 4 end) % length(alfabeto)) + 1, 1);
  end loop;
  return risultato;
end $$;

-- credito di u verso la casa: anticipato meno rimborsato (mai negativo)
create or replace function public._casa_credito_aperto(h uuid, u uuid)
returns numeric language sql security definer stable set search_path = public as $$
  select greatest(0,
    coalesce((select sum(t.importo) from public.transactions t
              where t.household_id = h and t.tipo = 'expense' and t.pagata_da_user_id = u), 0)
    + coalesce((select sum(x.importo) from public.transfers x
                where x.household_id = h and x.causale = 'versamento' and x.beneficiario_user_id = u), 0)
    - coalesce((select sum(x.importo) from public.transfers x
                where x.household_id = h and x.causale = 'rimborso' and x.beneficiario_user_id = u), 0));
$$;

-- debiti fra membri ancora aperti in cui u e debitore o creditore (somma di debito(d, c))
create or replace function public._casa_debiti_aperti(h uuid, u uuid)
returns numeric language sql security definer stable set search_path = public as $$
  select coalesce(sum(greatest(0, q.prestato - q.restituito)), 0)
  from (
    select p.c, p.d,
      (select coalesce(sum(t.importo), 0) from public.transfers t
        where t.household_id = h and t.causale = 'versamento'
          and t.user_id = p.c and t.per_conto_di_user_id = p.d) as prestato,
      (select coalesce(sum(t.importo), 0) from public.transfers t
        where t.household_id = h and (
              (t.causale = 'restituzione' and t.user_id = p.d and t.beneficiario_user_id = p.c
                 and t.per_conto_di_user_id is null)
           or (t.causale = 'versamento' and t.user_id = p.d and t.beneficiario_user_id = p.c)
           or (t.causale = 'restituzione' and t.user_id = p.c and t.beneficiario_user_id = p.c
                 and t.per_conto_di_user_id = p.d))) as restituito
    from (
      select distinct user_id as c, per_conto_di_user_id as d
      from public.transfers
      where household_id = h and causale = 'versamento' and per_conto_di_user_id is not null
    ) p
    where p.c = u or p.d = u
  ) q;
$$;

-- arretrati di versamento di u: somma, per ogni mese dall'inizio dei piani a oggi,
-- di max(0, atteso - versato). Atteso = quota del piano valido per il mese, ma solo se
-- u era in casa, la sua posizione non e gia uscita e il piano era attivo quel mese
-- (ogni posizione con quota maggiore di zero e legata a un membro gia entrato).
create or replace function public._casa_arretrati(h uuid, u uuid)
returns numeric language sql security definer stable set search_path = public as $$
  with mesi as (
    select g::date as mese
    from generate_series(
      (select date_trunc('month', min(valido_dal)::timestamp) from public.household_plans where household_id = h),
      date_trunc('month', public._casa_oggi()::timestamp),
      interval '1 month') as g
  ),
  attesi as (
    select ms.mese, s.quota_mensile as atteso
    from mesi ms
    cross join lateral (
      select p.id from public.household_plans p
      where p.household_id = h and p.valido_dal <= ms.mese
      order by p.valido_dal desc limit 1
    ) pv
    join public.household_plan_shares s on s.plan_id = pv.id and s.user_id = u
    where (s.in_casa_dal is null or date_trunc('month', s.in_casa_dal::timestamp)::date <= ms.mese)
      and (s.esce_dal is null or s.esce_dal > ms.mese)
      and not exists (
        select 1 from public.household_members mu
        where mu.household_id = h and mu.user_id = u
          and date_trunc('month', mu.joined_at at time zone 'Europe/Rome')::date > ms.mese)
      and not exists (
        select 1 from public.household_plan_shares s2
        where s2.plan_id = pv.id and s2.quota_mensile > 0
          and (s2.esce_dal is null or s2.esce_dal > ms.mese)
          and (s2.user_id is null or exists (
                select 1 from public.household_members m2
                where m2.household_id = h and m2.user_id = s2.user_id
                  and date_trunc('month', m2.joined_at at time zone 'Europe/Rome')::date > ms.mese)))
  )
  select coalesce(sum(greatest(0, a.atteso - coalesce((
      select sum(t.importo) from public.transfers t
      where t.household_id = h and t.causale = 'versamento' and t.mese_competenza = a.mese
        and ((t.user_id = u and t.per_conto_di_user_id is null and t.beneficiario_user_id is null)
             or t.per_conto_di_user_id = u)), 0))), 0)
  from attesi a;
$$;

-- conto personale di b su cui accreditare un rimborso o una restituzione: quello della
-- spesa anticipata piu vecchia, altrimenti quello di un suo versamento, altrimenti il piu vecchio
create or replace function public._casa_conto_beneficiario(h uuid, b uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select coalesce(
    (select t.account_id from public.transactions t
      where t.household_id = h and t.pagata_da_user_id = b and t.account_id is not null
      order by t.data, t.created_at limit 1),
    (select x.da_account_id from public.transfers x
      where x.household_id = h and x.user_id = b and x.da_account_id is not null
      order by x.data, x.created_at limit 1),
    (select a.id from public.accounts a
      where a.user_id = b and a.household_id is null
      order by a.created_at limit 1));
$$;

-- 3.3 Trigger

create or replace function public.forbid_household_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id non modificabile';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id non modificabile';
  end if;
  if tg_table_name = 'transactions' then
    if new.pagata_da_user_id is distinct from old.pagata_da_user_id then
      raise exception 'pagata_da_user_id non modificabile';
    end if;
  end if;
  return new;
end $$;

-- categoria, obiettivo e conto referenziati devono avere lo stesso household_id della riga.
-- Eccezione: una spesa di casa pagata con la carta personale dell'autore puo riferire un
-- conto personale dell'autore. Gira da invoker: una riga invisibile per RLS risulta non trovata.
create or replace function public.check_household_refs()
returns trigger language plpgsql set search_path = public as $$
declare ok boolean;
begin
  if new.categoria_id is not null then
    select exists (
      select 1 from public.categories c
      where c.id = new.categoria_id and c.household_id is not distinct from new.household_id
    ) into ok;
    if not ok then raise exception 'categoria non valida per questa casa'; end if;
  end if;
  if tg_table_name = 'transactions' then
    if new.goal_id is not null then
      select exists (
        select 1 from public.budget_goals g
        where g.id = new.goal_id and g.household_id is not distinct from new.household_id
      ) into ok;
      if not ok then raise exception 'obiettivo non valido per questa casa'; end if;
    end if;
    if new.account_id is not null then
      select exists (
        select 1 from public.accounts a
        where a.id = new.account_id
          and (a.household_id is not distinct from new.household_id
               or (new.household_id is not null
                   and new.pagata_da_user_id is not null
                   and new.pagata_da_user_id = new.user_id
                   and a.household_id is null
                   and a.user_id = new.user_id))
      ) into ok;
      if not ok then raise exception 'conto non valido per questa casa'; end if;
    end if;
  end if;
  return new;
end $$;

-- 3.4 Casa, invito, ingresso, uscita, chiusura

create or replace function public.create_household(p_nome text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  if coalesce(trim(p_display_name), '') = '' then raise exception 'nome mancante'; end if;
  if public._casa_attiva(uid) is not null
     or exists (select 1 from public.household_members where user_id = uid and attivo) then
    raise exception 'hai gia una casa';
  end if;
  insert into public.households (nome, created_by)
  values (coalesce(nullif(trim(p_nome), ''), 'La nostra casa'), uid)
  returning id into hid;
  insert into public.household_members (household_id, user_id, display_name, slot)
  values (hid, uid, trim(p_display_name), 1);
  return hid;
end $$;

create or replace function public.create_invite(p_household uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  v_codice text;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  if not public._casa_membro_attivo(p_household, uid) then raise exception 'casa non valida'; end if;
  update public.household_invites set revocato_il = now()
  where household_id = p_household and revocato_il is null;
  loop
    v_codice := public._casa_genera_codice();
    exit when not exists (select 1 from public.household_invites i where i.codice = v_codice);
  end loop;
  insert into public.household_invites (household_id, codice, created_by)
  values (p_household, v_codice, uid);
  return v_codice;
end $$;

create or replace function public.revoke_invite(p_household uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'non autenticato'; end if;
  if not public._casa_membro_attivo(p_household, uid) then raise exception 'casa non valida'; end if;
  update public.household_invites set revocato_il = now()
  where household_id = p_household and revocato_il is null;
end $$;

create or replace function public.join_household(p_codice text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  normalizzato text := upper(regexp_replace(coalesce(p_codice, ''), '[^A-Za-z0-9]', '', 'g'));
  hid uuid;
  slot_n smallint;
  v_nome text := trim(coalesce(p_display_name, ''));
begin
  if uid is null then raise exception 'non autenticato'; end if;
  select i.household_id into hid
  from public.household_invites i
  join public.households c on c.id = i.household_id
  where i.codice = normalizzato and i.revocato_il is null and i.scade_il > now()
    and c.archiviata_il is null;
  if hid is null then raise exception 'Codice non valido o scaduto'; end if;
  if v_nome = '' then raise exception 'nome mancante'; end if;
  if exists (select 1 from public.household_members where user_id = uid and attivo) then
    raise exception 'hai gia una casa';
  end if;

  -- un segnaposto del piano mai appartenuto a un membro, altrimenti una posizione nuova
  select s.slot into slot_n
  from public.household_plan_shares s
  join public.household_plans p on p.id = s.plan_id
  where p.household_id = hid and s.user_id is null
    and not exists (
      select 1 from public.household_plan_shares s2
      join public.household_plans p2 on p2.id = s2.plan_id
      where p2.household_id = hid and s2.slot = s.slot and s2.user_id is not null)
    and not exists (
      select 1 from public.household_members m where m.household_id = hid and m.slot = s.slot)
  order by s.slot limit 1;
  if slot_n is null then
    select greatest(
      coalesce((select max(m.slot) from public.household_members m where m.household_id = hid), 0),
      coalesce((select max(s.slot) from public.household_plan_shares s
                join public.household_plans p on p.id = s.plan_id where p.household_id = hid), 0)
    ) + 1 into slot_n;
  end if;

  insert into public.household_members (household_id, user_id, display_name, slot)
  values (hid, uid, v_nome, slot_n);

  update public.household_plan_shares s
  set user_id = uid, display_name = v_nome
  from public.household_plans p
  where p.id = s.plan_id and p.household_id = hid and s.slot = slot_n and s.user_id is null;

  return hid;
end $$;

create or replace function public.leave_household()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  h uuid;
  mese_dopo date := (date_trunc('month', public._casa_oggi()::timestamp) + interval '1 month')::date;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  h := public._casa_attiva(uid);
  if h is null then raise exception 'nessuna casa'; end if;
  if (select count(*) from public.household_members where household_id = h and attivo) <= 1 then
    raise exception 'ULTIMO_MEMBRO';
  end if;
  if public._casa_credito_aperto(h, uid) > 0 then raise exception 'CREDITO_APERTO'; end if;
  if public._casa_debiti_aperti(h, uid) > 0 then raise exception 'DEBITO_APERTO'; end if;
  if public._casa_arretrati(h, uid) > 0 then raise exception 'ARRETRATI_APERTI'; end if;

  -- la quota attesa di chi esce finisce dal mese successivo, nelle versioni valide da allora
  update public.household_plan_shares s
  set esce_dal = mese_dopo
  from public.household_plans p
  where p.id = s.plan_id and p.household_id = h and s.user_id = uid and s.esce_dal is null
    and (p.valido_dal >= mese_dopo
         or p.id = (select p2.id from public.household_plans p2
                    where p2.household_id = h and p2.valido_dal <= mese_dopo
                    order by p2.valido_dal desc limit 1));

  update public.calendar_feeds set revocato_il = now()
  where household_id = h and user_id = uid and revocato_il is null;

  delete from public.household_members where household_id = h and user_id = uid;
end $$;

create or replace function public.close_household()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  h uuid;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  h := public._casa_attiva(uid);
  if h is null then raise exception 'nessuna casa'; end if;
  if (select count(*) from public.household_members where household_id = h and attivo) > 1 then
    raise exception 'NON_ULTIMO_MEMBRO';
  end if;
  if public._casa_credito_aperto(h, uid) > 0 then raise exception 'CREDITO_APERTO'; end if;
  if public._casa_debiti_aperti(h, uid) > 0 then raise exception 'DEBITO_APERTO'; end if;

  update public.households set archiviata_il = now() where id = h;
  update public.household_members set attivo = false where household_id = h and user_id = uid;
  update public.calendar_feeds set revocato_il = now() where household_id = h and revocato_il is null;
  update public.household_invites set revocato_il = now() where household_id = h and revocato_il is null;
end $$;

-- 3.5 Trasferimenti e saldi

-- Registra un trasferimento e aggiorna i saldi nella stessa transazione.
--   versamento    : da conto personale dell'autore a conto di casa. p_per_conto_di = debitore la cui
--                   quota viene versata; p_beneficiario = creditore (versamento di restituzione).
--   rimborso      : registrato da un membro diverso dal beneficiario, da conto di casa al conto personale
--                   del beneficiario (scelto dalla funzione). Rinuncia a un credito: registrata dal
--                   beneficiario stesso, solo_registrazione, senza conti.
--   restituzione  : registrata dal debitore (p_beneficiario = creditore), da un suo conto personale a
--                   quello del creditore (scelto dalla funzione). Rinuncia a un debito: registrata dal
--                   creditore con p_beneficiario = se stesso e p_per_conto_di = debitore, solo_registrazione.
--   altro         : solo con p_household nullo, fra due conti personali dell'autore.
create or replace function public.record_transfer(
  p_household uuid,
  p_causale text,
  p_importo numeric,
  p_data date,
  p_da_account uuid default null,
  p_a_account uuid default null,
  p_beneficiario uuid default null,
  p_per_conto_di uuid default null,
  p_mese_competenza date default null,
  p_solo_registrazione boolean default false,
  p_nota text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  v_da uuid := p_da_account;
  v_a uuid := p_a_account;
  v_mese date := null;
  v_id uuid;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  if p_importo is null or p_importo <= 0 then raise exception 'importo non valido'; end if;
  if p_data is null then raise exception 'data mancante'; end if;
  if p_causale not in ('versamento', 'rimborso', 'restituzione', 'altro') then
    raise exception 'causale non valida';
  end if;

  if p_household is null then
    if p_causale <> 'altro' or p_beneficiario is not null or p_per_conto_di is not null then
      raise exception 'trasferimento personale non valido';
    end if;
    if v_da is null or v_a is null or v_da = v_a
       or not exists (select 1 from public.accounts where id = v_da and household_id is null and user_id = uid)
       or not exists (select 1 from public.accounts where id = v_a and household_id is null and user_id = uid) then
      raise exception 'conti non validi';
    end if;
  else
    if not public._casa_membro_attivo(p_household, uid) then raise exception 'casa non valida'; end if;
    if p_beneficiario is not null and not public._casa_membro_attivo(p_household, p_beneficiario) then
      raise exception 'beneficiario non valido';
    end if;
    if p_per_conto_di is not null and not public._casa_membro_attivo(p_household, p_per_conto_di) then
      raise exception 'membro non valido';
    end if;

    if p_causale = 'versamento' then
      if p_per_conto_di is not null and p_beneficiario is not null then raise exception 'combinazione non valida'; end if;
      if p_per_conto_di = uid or p_beneficiario = uid then raise exception 'combinazione non valida'; end if;
      if not p_solo_registrazione and (v_da is null or v_a is null) then raise exception 'conti mancanti'; end if;
      if v_da is not null and not exists (
           select 1 from public.accounts where id = v_da and household_id is null and user_id = uid) then
        raise exception 'conto di origine non valido';
      end if;
      if v_a is not null and not exists (
           select 1 from public.accounts where id = v_a and household_id = p_household) then
        raise exception 'conto della casa non valido';
      end if;
      if p_beneficiario is null then
        v_mese := date_trunc('month', coalesce(p_mese_competenza, p_data)::timestamp)::date;
      end if;

    elsif p_causale = 'rimborso' then
      if p_beneficiario is null or p_per_conto_di is not null then raise exception 'combinazione non valida'; end if;
      if p_beneficiario = uid then
        -- rinuncia al proprio credito: nessun movimento di soldi
        if not p_solo_registrazione or v_da is not null or v_a is not null then
          raise exception 'rinuncia non valida';
        end if;
      else
        if p_solo_registrazione then
          -- il conto comune e gia aggiornato a mano: nessun saldo viene toccato
          v_a := null;
        else
          if v_da is null or not exists (
               select 1 from public.accounts where id = v_da and household_id = p_household) then
            raise exception 'conto della casa non valido';
          end if;
          v_a := public._casa_conto_beneficiario(p_household, p_beneficiario);
          if v_a is null then raise exception 'il beneficiario non ha conti'; end if;
        end if;
      end if;

    elsif p_causale = 'restituzione' then
      if p_beneficiario is null then raise exception 'combinazione non valida'; end if;
      if p_per_conto_di is not null then
        -- rinuncia a un debito: la registra il creditore
        if p_beneficiario <> uid or not p_solo_registrazione or v_da is not null or v_a is not null then
          raise exception 'rinuncia non valida';
        end if;
      else
        if p_beneficiario = uid then raise exception 'combinazione non valida'; end if;
        if p_solo_registrazione then
          v_a := null;
        else
          if v_da is null or not exists (
               select 1 from public.accounts where id = v_da and household_id is null and user_id = uid) then
            raise exception 'conto di origine non valido';
          end if;
          v_a := public._casa_conto_beneficiario(p_household, p_beneficiario);
          if v_a is null then raise exception 'il beneficiario non ha conti'; end if;
        end if;
      end if;

    else
      raise exception 'causale non valida per una casa';
    end if;
  end if;

  insert into public.transfers (
    household_id, user_id, da_account_id, a_account_id, importo, data, causale,
    beneficiario_user_id, per_conto_di_user_id, mese_competenza, solo_registrazione, nota)
  values (
    p_household, uid, v_da, v_a, p_importo, p_data, p_causale,
    p_beneficiario, p_per_conto_di, v_mese, p_solo_registrazione, p_nota)
  returning id into v_id;

  if not p_solo_registrazione then
    if v_da is not null then
      update public.accounts set saldo_attuale = saldo_attuale - p_importo where id = v_da;
    end if;
    if v_a is not null then
      update public.accounts set saldo_attuale = saldo_attuale + p_importo where id = v_a;
    end if;
  end if;

  return v_id;
end $$;

create or replace function public.delete_transfer(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  t public.transfers%rowtype;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  select * into t from public.transfers where id = p_id and user_id = uid for update;
  if not found then raise exception 'movimento non trovato'; end if;
  if t.household_id is not null and not public.is_household_writer(t.household_id) then
    raise exception 'casa non scrivibile';
  end if;
  if not t.solo_registrazione then
    if t.da_account_id is not null then
      update public.accounts set saldo_attuale = saldo_attuale + t.importo where id = t.da_account_id;
    end if;
    if t.a_account_id is not null then
      update public.accounts set saldo_attuale = saldo_attuale - t.importo where id = t.a_account_id;
    end if;
  end if;
  delete from public.transfers where id = p_id;
end $$;

-- invoker: decidono le policy, funziona per qualsiasi membro su un conto di casa
create or replace function public.adjust_account_balance(p_account uuid, p_delta numeric)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.accounts set saldo_attuale = saldo_attuale + p_delta where id = p_account;
  if not found then raise exception 'conto non trovato'; end if;
end $$;

-- Controllo del saldo del conto comune. Differenza di almeno 1 euro e p_crea_movimento:
-- in meno crea la spesa "Spese non registrate", in piu l'entrata "Entrata non registrata"
-- (categorie di casa create se mancano, origine 'riconciliazione'). Il saldo diventa quello dichiarato.
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
  select * into a from public.accounts where id = p_account;
  if not found or a.household_id is null then raise exception 'conto non valido'; end if;
  diff := p_saldo_dichiarato - a.saldo_attuale;
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

-- 3.6 Piano della quota
--
-- Forma del payload (camelCase NON usato: chiavi snake_case):
-- { "versioni": [ {
--     "valido_dal": "2026-12-01", "giorno_versamento": 5, "regola": "proporzionale",
--     "cuscinetto_obiettivo": 1321, "cuscinetto_quota_mensile": 59, "arrotondamento": 10,
--     "totale_mensile": 1380,
--     "voci":  [ { "nome": "Luce", "categoria_id": null, "categoria_nome": "Luce", "frequenza_mesi": 2,
--                  "importo_ricorrenza": 110, "origine_stima": "suggerita", "goal_id": null,
--                  "stima_ignorata_con_n": null, "ordine": 0 } ],
--     "quote": [ { "slot": 1, "display_name": "Fabio", "reddito_netto_mensile": 1800,
--                  "reddito_irregolare": false, "percentuale": null, "in_casa_dal": null,
--                  "esce_dal": null, "quota_mensile": 777 } ]
-- } ] }
-- Una riga di piano per valido_dal (rivedere nello stesso mese la sostituisce). user_id e nome
-- dei membri entrati arrivano dai membri, non dal payload. Una posizione legata a un altro
-- membro non puo cambiare reddito rispetto all'ultima versione salvata.
-- Ritorna gli id dei piani salvati, nello stesso ordine delle versioni.
create or replace function public.save_household_plan(p_household uuid, p_payload jsonb)
returns uuid[] language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  mese_corrente date := date_trunc('month', public._casa_oggi()::timestamp)::date;
  v jsonb;
  voce jsonb;
  q jsonb;
  vdal date;
  pid uuid;
  ids uuid[] := '{}';
  cat uuid;
  slot_n smallint;
  slots smallint[];
  mem_user uuid;
  mem_name text;
  prev numeric;
  nuovo numeric;
  somma numeric;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  if not public.is_household_writer(p_household) then raise exception 'casa non scrivibile'; end if;
  if jsonb_typeof(p_payload -> 'versioni') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'versioni') = 0 then
    raise exception 'payload non valido';
  end if;

  for v in select value from jsonb_array_elements(p_payload -> 'versioni') loop
    vdal := (v ->> 'valido_dal')::date;
    if vdal is null or extract(day from vdal) <> 1 then
      raise exception 'valido_dal deve essere il primo del mese';
    end if;
    if vdal < mese_corrente then raise exception 'valido_dal nel passato'; end if;
    if (v ->> 'regola') = 'personalizzata' then
      select coalesce(sum((x ->> 'percentuale')::numeric), 0) into somma
      from jsonb_array_elements(coalesce(v -> 'quote', '[]'::jsonb)) x;
      if abs(somma - 100) > 0.01 then raise exception 'le percentuali devono sommare a 100'; end if;
    end if;

    insert into public.household_plans (
      household_id, valido_dal, giorno_versamento, regola, cuscinetto_obiettivo,
      cuscinetto_quota_mensile, arrotondamento, totale_mensile, created_by)
    values (
      p_household, vdal, (v ->> 'giorno_versamento')::smallint, v ->> 'regola',
      coalesce((v ->> 'cuscinetto_obiettivo')::numeric, 0),
      coalesce((v ->> 'cuscinetto_quota_mensile')::numeric, 0),
      coalesce((v ->> 'arrotondamento')::numeric, 10),
      coalesce((v ->> 'totale_mensile')::numeric, 0), uid)
    on conflict (household_id, valido_dal) do update set
      giorno_versamento = excluded.giorno_versamento,
      regola = excluded.regola,
      cuscinetto_obiettivo = excluded.cuscinetto_obiettivo,
      cuscinetto_quota_mensile = excluded.cuscinetto_quota_mensile,
      arrotondamento = excluded.arrotondamento,
      totale_mensile = excluded.totale_mensile
    returning id into pid;

    delete from public.household_plan_items where plan_id = pid;
    for voce in select value from jsonb_array_elements(coalesce(v -> 'voci', '[]'::jsonb)) loop
      cat := nullif(voce ->> 'categoria_id', '')::uuid;
      if cat is null and coalesce(voce ->> 'categoria_nome', '') <> '' then
        select c.id into cat from public.categories c
        where c.household_id = p_household and c.tipo = 'expense' and not c.archiviata
          and lower(c.nome) = lower(voce ->> 'categoria_nome') limit 1;
        if cat is null then
          insert into public.categories (nome, tipo, household_id)
          values (voce ->> 'categoria_nome', 'expense', p_household) returning id into cat;
        end if;
      end if;
      insert into public.household_plan_items (
        plan_id, nome, categoria_id, frequenza_mesi, importo_ricorrenza, origine_stima,
        goal_id, stima_ignorata_con_n, ordine)
      values (
        pid, voce ->> 'nome', cat, (voce ->> 'frequenza_mesi')::smallint,
        (voce ->> 'importo_ricorrenza')::numeric,
        coalesce(voce ->> 'origine_stima', 'suggerita'),
        nullif(voce ->> 'goal_id', '')::uuid,
        (voce ->> 'stima_ignorata_con_n')::smallint,
        coalesce((voce ->> 'ordine')::smallint, 0));
    end loop;

    slots := '{}';
    for q in select value from jsonb_array_elements(coalesce(v -> 'quote', '[]'::jsonb)) loop
      slot_n := (q ->> 'slot')::smallint;
      slots := slots || slot_n;
      mem_user := null;
      mem_name := null;
      select m.user_id, m.display_name into mem_user, mem_name
      from public.household_members m
      where m.household_id = p_household and m.slot = slot_n and m.attivo;
      nuovo := coalesce((q ->> 'reddito_netto_mensile')::numeric, 0);
      if mem_user is not null and mem_user <> uid then
        select s.reddito_netto_mensile into prev
        from public.household_plan_shares s
        join public.household_plans p on p.id = s.plan_id
        where p.household_id = p_household and s.slot = slot_n and p.valido_dal <= vdal
        order by p.valido_dal desc limit 1;
        if found and prev is distinct from nuovo then
          raise exception 'il reddito di un altro membro non si modifica';
        end if;
      end if;
      insert into public.household_plan_shares (
        plan_id, slot, user_id, display_name, reddito_netto_mensile, reddito_irregolare,
        percentuale, in_casa_dal, esce_dal, quota_mensile)
      values (
        pid, slot_n, mem_user, coalesce(mem_name, q ->> 'display_name'), nuovo,
        coalesce((q ->> 'reddito_irregolare')::boolean, false),
        (q ->> 'percentuale')::numeric,
        (q ->> 'in_casa_dal')::date,
        (q ->> 'esce_dal')::date,
        coalesce((q ->> 'quota_mensile')::numeric, 0))
      on conflict (plan_id, slot) do update set
        user_id = excluded.user_id,
        display_name = excluded.display_name,
        reddito_netto_mensile = excluded.reddito_netto_mensile,
        reddito_irregolare = excluded.reddito_irregolare,
        percentuale = excluded.percentuale,
        in_casa_dal = excluded.in_casa_dal,
        esce_dal = excluded.esce_dal,
        quota_mensile = excluded.quota_mensile;
    end loop;
    delete from public.household_plan_shares where plan_id = pid and slot <> all(slots);

    ids := ids || pid;
  end loop;
  return ids;
end $$;

-- 3.7 Calendario (feed ICS privato)

create or replace function public.rotate_calendar_feed()
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  h uuid;
  tok text;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  h := public._casa_attiva(uid);
  if h is null then raise exception 'nessuna casa'; end if;
  update public.calendar_feeds set revocato_il = now()
  where household_id = h and user_id = uid and revocato_il is null;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.calendar_feeds (household_id, user_id, token) values (h, uid, tok);
  return tok;
end $$;

create or replace function public.revoke_calendar_feed()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'non autenticato'; end if;
  update public.calendar_feeds set revocato_il = now()
  where user_id = uid and revocato_il is null;
end $$;

-- Unica via di lettura del feed: nessuna sessione, solo il token. Ritorna null (senza
-- distinguere i motivi) se il token non esiste, e revocato, il membro e uscito o la casa e
-- archiviata. Legge solo dati di casa, mai tabelle personali.
-- Forma: { nome_casa, membro, giorno_versamento, quota_mensile, obiettivi: [ { nome, scadenza,
-- importo, ricorrente, frequenza_mesi } ], credito_proprio, credito_altri, ultimo_controllo, ultimo_checkin }
create or replace function public.get_calendar_feed(p_token text)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  f public.calendar_feeds%rowtype;
  hh public.households%rowtype;
  m public.household_members%rowtype;
  mese date := date_trunc('month', public._casa_oggi()::timestamp)::date;
  pid uuid;
  giorno smallint;
  quota numeric;
  altri numeric;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select * into f from public.calendar_feeds where token = p_token and revocato_il is null;
  if not found then return null; end if;
  select * into hh from public.households where id = f.household_id and archiviata_il is null;
  if not found then return null; end if;
  select * into m from public.household_members
  where household_id = f.household_id and user_id = f.user_id and attivo;
  if not found then return null; end if;

  select p.id, p.giorno_versamento into pid, giorno
  from public.household_plans p
  where p.household_id = hh.id
  order by (p.valido_dal > mese), (case when p.valido_dal <= mese then p.valido_dal end) desc nulls last, p.valido_dal
  limit 1;
  if pid is not null then
    select s.quota_mensile into quota
    from public.household_plan_shares s
    where s.plan_id = pid and s.user_id = f.user_id and s.esce_dal is null;
  end if;

  select coalesce(sum(public._casa_credito_aperto(hh.id, x.user_id)), 0) into altri
  from public.household_members x
  where x.household_id = hh.id and x.attivo and x.user_id <> f.user_id;

  return jsonb_build_object(
    'nome_casa', hh.nome,
    'membro', m.display_name,
    'giorno_versamento', giorno,
    'quota_mensile', quota,
    'obiettivi', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'nome', g.nome, 'scadenza', g.scadenza, 'importo', g.importo_target,
               'ricorrente', g.ricorrente, 'frequenza_mesi', g.frequenza_mesi) order by g.scadenza), '[]'::jsonb)
      from public.budget_goals g
      where g.household_id = hh.id and g.stato = 'aperto' and g.scadenza is not null),
    'credito_proprio', public._casa_credito_aperto(hh.id, f.user_id),
    'credito_altri', altri,
    'ultimo_controllo', (select max(b.data) from public.balance_checks b where b.household_id = hh.id),
    'ultimo_checkin', (select max(c.mese) from public.household_checkins c where c.household_id = hh.id));
end $$;

-- =====================================================================
-- 4. PERMESSI SULLE FUNZIONI
-- Supabase assegna di default execute ad anon e authenticated: si toglie esplicitamente.
-- =====================================================================

revoke execute on function
  public.is_household_member(uuid),
  public.is_household_writer(uuid),
  public._casa_oggi(),
  public._casa_attiva(uuid),
  public._casa_membro_attivo(uuid, uuid),
  public._casa_genera_codice(),
  public._casa_credito_aperto(uuid, uuid),
  public._casa_debiti_aperti(uuid, uuid),
  public._casa_arretrati(uuid, uuid),
  public._casa_conto_beneficiario(uuid, uuid),
  public.forbid_household_change(),
  public.check_household_refs(),
  public.create_household(text, text),
  public.create_invite(uuid),
  public.revoke_invite(uuid),
  public.join_household(text, text),
  public.leave_household(),
  public.close_household(),
  public.record_transfer(uuid, text, numeric, date, uuid, uuid, uuid, uuid, date, boolean, text),
  public.delete_transfer(uuid),
  public.adjust_account_balance(uuid, numeric),
  public.record_balance_check(uuid, numeric, date, boolean),
  public.save_household_plan(uuid, jsonb),
  public.rotate_calendar_feed(),
  public.revoke_calendar_feed(),
  public.get_calendar_feed(text)
from public, anon, authenticated;

grant execute on function
  public.is_household_member(uuid),
  public.is_household_writer(uuid),
  public._casa_oggi(),
  public.create_household(text, text),
  public.create_invite(uuid),
  public.revoke_invite(uuid),
  public.join_household(text, text),
  public.leave_household(),
  public.close_household(),
  public.record_transfer(uuid, text, numeric, date, uuid, uuid, uuid, uuid, date, boolean, text),
  public.delete_transfer(uuid),
  public.adjust_account_balance(uuid, numeric),
  public.record_balance_check(uuid, numeric, date, boolean),
  public.save_household_plan(uuid, jsonb),
  public.rotate_calendar_feed(),
  public.revoke_calendar_feed(),
  public.get_calendar_feed(text)
to authenticated;

-- unica funzione raggiungibile senza sessione
grant execute on function public.get_calendar_feed(text) to anon;

-- =====================================================================
-- 5. RLS
-- =====================================================================

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.household_plans enable row level security;
alter table public.household_plan_items enable row level security;
alter table public.household_plan_shares enable row level security;
alter table public.transfers enable row level security;
alter table public.balance_checks enable row level security;
alter table public.household_checkins enable row level security;
alter table public.calendar_feeds enable row level security;

-- nessun accesso anonimo alle tabelle nuove; nessuna scrittura diretta dove passano le funzioni
revoke all on table
  public.households, public.household_members, public.household_invites, public.household_plans,
  public.household_plan_items, public.household_plan_shares, public.transfers,
  public.balance_checks, public.household_checkins, public.calendar_feeds
from anon;

revoke insert, update, delete, truncate on table
  public.household_members, public.household_invites, public.transfers, public.calendar_feeds
from authenticated;

-- dei dati della casa un membro puo cambiare solo il nome
revoke insert, update, delete, truncate on table public.households from authenticated;
grant update (nome) on table public.households to authenticated;

-- 5.1 Le quattro tabelle esistenti: personale come oggi, casa per i membri
do $do$
declare
  t text;
  cond_l constant text := $c$(household_id is null and user_id = (select auth.uid()))
    or (household_id is not null and public.is_household_member(household_id))$c$;
  cond_s constant text := $c$(household_id is null and user_id = (select auth.uid()))
    or (household_id is not null and public.is_household_writer(household_id))$c$;
  cond_ins constant text := $c$(household_id is null and user_id = (select auth.uid()))
    or (household_id is not null and user_id = (select auth.uid()) and public.is_household_writer(household_id))$c$;
  extra text;
  cond_del text;
begin
  foreach t in array array['accounts', 'categories', 'budget_goals', 'transactions'] loop
    execute format('drop policy if exists "owner_full_access" on public.%I', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    -- le spese di casa pagate con una carta personale le modifica o elimina solo chi ha pagato
    extra := case when t = 'transactions'
      then ' and (pagata_da_user_id is null or pagata_da_user_id = (select auth.uid()))' else '' end;
    -- i conti di casa non si eliminano
    cond_del := case when t = 'accounts'
      then '(household_id is null and user_id = (select auth.uid()))'
      else '(' || cond_s || ')' || extra end;

    execute format('create policy %I on public.%I for select to authenticated using (%s)',
      t || '_select', t, cond_l);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)',
      t || '_insert', t, cond_ins);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
      t || '_update', t, '(' || cond_s || ')' || extra, '(' || cond_s || ')' || extra);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)',
      t || '_delete', t, cond_del);
  end loop;
end $do$;

-- 5.2 Tabelle nuove

drop policy if exists households_select on public.households;
create policy households_select on public.households for select to authenticated
  using (public.is_household_member(id));
drop policy if exists households_update on public.households;
create policy households_update on public.households for update to authenticated
  using (public.is_household_writer(id)) with check (public.is_household_writer(id));

drop policy if exists household_members_select on public.household_members;
create policy household_members_select on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists household_invites_select on public.household_invites;
create policy household_invites_select on public.household_invites for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists calendar_feeds_select on public.calendar_feeds;
create policy calendar_feeds_select on public.calendar_feeds for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists transfers_select on public.transfers;
create policy transfers_select on public.transfers for select to authenticated
  using ((household_id is null and user_id = (select auth.uid()))
         or (household_id is not null and public.is_household_member(household_id)));

-- piani, controlli del saldo e check-in: lettura ai membri, scrittura ai membri di una casa non archiviata
do $do$
declare
  t text;
  extra text;
begin
  foreach t in array array['household_plans', 'balance_checks', 'household_checkins'] loop
    extra := case when t = 'household_plans' then '' else ' and user_id = (select auth.uid())' end;
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))',
      t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_household_writer(household_id)%s)',
      t || '_insert', t, extra);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_household_writer(household_id)) with check (public.is_household_writer(household_id))',
      t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_household_writer(household_id))',
      t || '_delete', t);
  end loop;
end $do$;

-- voci e quote del piano: tramite il piano
do $do$
declare
  t text;
  via_piano_m constant text := 'exists (select 1 from public.household_plans p where p.id = plan_id and public.is_household_member(p.household_id))';
  via_piano_w constant text := 'exists (select 1 from public.household_plans p where p.id = plan_id and public.is_household_writer(p.household_id))';
begin
  foreach t in array array['household_plan_items', 'household_plan_shares'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_select', t, via_piano_m);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_insert', t, via_piano_w);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_update', t, via_piano_w, via_piano_w);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_delete', t, via_piano_w);
  end loop;
end $do$;

-- =====================================================================
-- 6. TRIGGER
-- =====================================================================

drop trigger if exists accounts_forbid_household_change on public.accounts;
create trigger accounts_forbid_household_change before update on public.accounts
  for each row execute function public.forbid_household_change();
drop trigger if exists categories_forbid_household_change on public.categories;
create trigger categories_forbid_household_change before update on public.categories
  for each row execute function public.forbid_household_change();
drop trigger if exists budget_goals_forbid_household_change on public.budget_goals;
create trigger budget_goals_forbid_household_change before update on public.budget_goals
  for each row execute function public.forbid_household_change();
drop trigger if exists transactions_forbid_household_change on public.transactions;
create trigger transactions_forbid_household_change before update on public.transactions
  for each row execute function public.forbid_household_change();

drop trigger if exists transactions_check_household_refs on public.transactions;
create trigger transactions_check_household_refs before insert or update on public.transactions
  for each row execute function public.check_household_refs();
drop trigger if exists budget_goals_check_household_refs on public.budget_goals;
create trigger budget_goals_check_household_refs before insert or update on public.budget_goals
  for each row execute function public.check_household_refs();

commit;

-- =====================================================================
-- ROLLBACK (solo se serve tornare indietro; eseguire a parte, decommentando).
-- Attenzione: cancella tutti i dati della casa. I dati personali non cambiano.
-- =====================================================================
-- begin;
-- drop trigger if exists accounts_forbid_household_change on public.accounts;
-- drop trigger if exists categories_forbid_household_change on public.categories;
-- drop trigger if exists budget_goals_forbid_household_change on public.budget_goals;
-- drop trigger if exists transactions_forbid_household_change on public.transactions;
-- drop trigger if exists transactions_check_household_refs on public.transactions;
-- drop trigger if exists budget_goals_check_household_refs on public.budget_goals;
-- do $do$ declare t text; begin
--   foreach t in array array['accounts','categories','budget_goals','transactions'] loop
--     execute format('drop policy if exists %I on public.%I', t || '_select', t);
--     execute format('drop policy if exists %I on public.%I', t || '_insert', t);
--     execute format('drop policy if exists %I on public.%I', t || '_update', t);
--     execute format('drop policy if exists %I on public.%I', t || '_delete', t);
--     execute format('create policy "owner_full_access" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
--   end loop; end $do$;
-- drop table if exists public.calendar_feeds, public.household_checkins, public.balance_checks,
--   public.transfers, public.household_plan_shares, public.household_plan_items,
--   public.household_plans, public.household_invites, public.household_members;
-- alter table public.accounts drop column if exists household_id;
-- alter table public.categories drop column if exists household_id;
-- alter table public.budget_goals drop column if exists household_id, drop column if exists accantona_da;
-- alter table public.transactions drop constraint if exists transactions_pagata_check,
--   drop constraint if exists transactions_origine_check, drop column if exists household_id,
--   drop column if exists pagata_da_user_id, drop column if exists origine;
-- drop table if exists public.households;
-- drop function if exists public.get_calendar_feed(text), public.revoke_calendar_feed(),
--   public.rotate_calendar_feed(), public.save_household_plan(uuid, jsonb),
--   public.record_balance_check(uuid, numeric, date, boolean), public.adjust_account_balance(uuid, numeric),
--   public.delete_transfer(uuid), public.record_transfer(uuid, text, numeric, date, uuid, uuid, uuid, uuid, date, boolean, text),
--   public.close_household(), public.leave_household(), public.join_household(text, text),
--   public.revoke_invite(uuid), public.create_invite(uuid), public.create_household(text, text),
--   public.check_household_refs(), public.forbid_household_change(),
--   public._casa_conto_beneficiario(uuid, uuid), public._casa_arretrati(uuid, uuid),
--   public._casa_debiti_aperti(uuid, uuid), public._casa_credito_aperto(uuid, uuid),
--   public._casa_genera_codice(), public._casa_membro_attivo(uuid, uuid), public._casa_attiva(uuid),
--   public._casa_oggi(), public.is_household_writer(uuid), public.is_household_member(uuid);
-- commit;
```

- [ ] **Step 4: Eseguire il test statico e verificare che passi**

Run: `npx vitest run tests/migration0004.test.ts`
Expected: PASS (tutti i controlli del Step 1).

- [ ] **Step 5: Creare `supabase/tests/rls_casa.sql`**

Il file è uno script unico, da incollare nel SQL editor di Supabase. Struttura fissa (provata su PGlite, copiare l'harness così com'è):

```sql
-- supabase/tests/rls_casa.sql
-- Prova delle policy RLS e delle funzioni della casa comune. Si esegue a mano nel SQL editor
-- di Supabase DOPO la migrazione 0004. Non lascia nulla nel database: crea utenti finti e
-- dati di prova, poi termina con un errore voluto che annulla tutto e mostra il referto.
-- Esito atteso: "RISULTATO: ... 0 FAIL" e solo righe OK.
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'rls-a@test.invalid'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'rls-b@test.invalid'),
  ('cccccccc-0000-0000-0000-00000000000c', 'rls-c@test.invalid'),
  ('dddddddd-0000-0000-0000-00000000000d', 'rls-d@test.invalid');

create table public.zz_esiti (n serial, nome text, ok boolean, dettaglio text);
grant all on public.zz_esiti to public;
grant all on sequence public.zz_esiti_n_seq to public;

create function public.zz_reset() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create function public.zz_as(u uuid) returns void language plpgsql as $$
begin
  perform public.zz_reset();
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  set local role authenticated;
end $$;

-- il comando deve riuscire
create function public.zz_ok(p_nome text, u uuid, p_stmt text) returns void language plpgsql as $$
begin
  perform public.zz_as(u);
  begin
    execute p_stmt;
    insert into public.zz_esiti (nome, ok) values (p_nome, true);
  exception when others then
    insert into public.zz_esiti (nome, ok, dettaglio) values (p_nome, false, sqlerrm);
  end;
  perform public.zz_reset();
end $$;

-- il comando deve fallire con un errore
create function public.zz_err(p_nome text, u uuid, p_stmt text) returns void language plpgsql as $$
begin
  perform public.zz_as(u);
  begin
    execute p_stmt;
    insert into public.zz_esiti (nome, ok, dettaglio) values (p_nome, false, 'doveva fallire e invece e riuscito');
  exception when others then
    insert into public.zz_esiti (nome, ok) values (p_nome, true);
  end;
  perform public.zz_reset();
end $$;

-- la query (select) deve restituire esattamente p_attese righe
create function public.zz_righe(p_nome text, u uuid, p_query text, p_attese int) returns void language plpgsql as $$
declare n int;
begin
  perform public.zz_as(u);
  begin
    execute 'select count(*) from (' || p_query || ') q' into n;
    insert into public.zz_esiti (nome, ok, dettaglio)
    values (p_nome, n = p_attese, case when n = p_attese then null else 'righe: ' || n || ', attese: ' || p_attese end);
  exception when others then
    insert into public.zz_esiti (nome, ok, dettaglio) values (p_nome, false, sqlerrm);
  end;
  perform public.zz_reset();
end $$;

-- CASI. Attori: A e B (casa), C (entra dopo), D (sempre fuori).
do $test$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  b constant uuid := 'bbbbbbbb-0000-0000-0000-00000000000b';
  c constant uuid := 'cccccccc-0000-0000-0000-00000000000c';
  d constant uuid := 'dddddddd-0000-0000-0000-00000000000d';
  h uuid; codice text; conto_a uuid; conto_casa uuid; rep text;
begin
  -- Preparazione come proprietario (senza ruolo): casa, membri, conti
  insert into public.households (nome, created_by) values ('Casa prova', a) returning id into h;
  insert into public.household_members (household_id, user_id, display_name, slot)
    values (h, a, 'A', 1), (h, b, 'B', 2);
  insert into public.accounts (user_id, nome, saldo_attuale) values (a, 'Conto personale A', 500)
    returning id into conto_a;
  insert into public.accounts (user_id, nome, saldo_attuale, household_id) values (a, 'Conto comune', 1000, h)
    returning id into conto_casa;

  -- Isolamento
  perform public.zz_righe('B non legge i conti personali di A', b,
    format('select 1 from public.accounts where id = %L', conto_a), 0);
  perform public.zz_righe('B legge il conto comune creato da A', b,
    format('select 1 from public.accounts where id = %L', conto_casa), 1);
  perform public.zz_righe('D (fuori) non legge il conto comune', d,
    format('select 1 from public.accounts where id = %L', conto_casa), 0);
  perform public.zz_err('D non puo scrivere nella casa', d,
    format('insert into public.accounts (nome, household_id) values (''x'', %L)', h));
  perform public.zz_err('insert di casa con user_id altrui fallisce', b,
    format('insert into public.accounts (nome, household_id, user_id) values (''x'', %L, %L)', h, a));
  perform public.zz_ok('B aggiorna il saldo del conto comune creato da A', b,
    format('select public.adjust_account_balance(%L, 50)', conto_casa));
  perform public.zz_err('household_id non si cambia', b,
    format('update public.accounts set household_id = null where id = %L', conto_casa));
  perform public.zz_err('niente scrittura diretta su transfers', b,
    format('insert into public.transfers (household_id, importo, data, causale) values (%L, 1, current_date, ''versamento'')', h));

  -- Invito e ingresso
  perform public.zz_as(a);
  select public.create_invite(h) into codice;
  perform public.zz_reset();
  perform public.zz_err('codice errato', c, 'select public.join_household(''ZZZZZZZZ'', ''C'')');
  perform public.zz_ok('codice valido anche in minuscolo con trattino', c,
    format('select public.join_household(%L, ''C'')', lower(substr(codice, 1, 4) || '-' || substr(codice, 5))));

  -- Referto
  perform public.zz_reset();
  select 'RISULTATO: ' || count(*) filter (where ok) || ' OK, ' || count(*) filter (where not ok) || ' FAIL' || E'\n' ||
         coalesce((select string_agg('FAIL: ' || nome || ' (' || coalesce(dettaglio, '') || ')', E'\n' order by n)
                   from public.zz_esiti where not ok), '') || E'\n' ||
         (select string_agg('OK: ' || nome, E'\n' order by n) from public.zz_esiti where ok)
    into rep from public.zz_esiti;
  raise exception E'\n%', rep;
end $test$;
```

Poi si **estende il blocco `do $test$`** con tutti i casi seguenti, nello stile dei casi già presenti (preparare i dati come proprietario; chiamare le funzioni `security definer` come utente con `zz_ok`/`zz_err`; quando serve un id restituito da una funzione, nel blocco `do` fare `perform public.zz_as(utente); select public.funzione(...) into variabile; perform public.zz_reset();`). Attori: A e B nella casa, C entra dopo, D sempre fuori. Ogni caso ha un nome parlante e un solo esito atteso:

1. A non legge i conti, le categorie, gli obiettivi e le transazioni personali di B (e viceversa); D non legge nulla della casa.
2. Un membro legge e scrive righe di casa; un non membro no; un insert di casa con `user_id` altrui fallisce.
3. Un membro non può cambiare `household_id` né `user_id` né `pagata_da_user_id` (update fallisce).
4. Non si può riferire una categoria, un obiettivo o un conto personale in una riga di casa (insert fallisce); eccezione: una spesa di casa con `pagata_da_user_id` uguale all'autore può riferire un conto personale dell'autore.
5. B non modifica né cancella una spesa di casa pagata con la carta di A (update e delete toccano 0 righe); B modifica e cancella una spesa di casa normale scritta da A.
6. `adjust_account_balance` funziona da B su un conto di casa creato da A; B non può cancellare un conto di casa (0 righe).
7. Un trasferimento personale (`household_id` nullo) non è leggibile dall'altro; nessuno scrive in `transfers` con insert, update o delete diretti.
8. `join_household` fallisce con codice inesistente, scaduto (impostare `scade_il` nel passato come proprietario), revocato e rigenerato (il vecchio non vale più); riesce con un codice valido anche da più persone (B e poi C) e con lo stesso codice in minuscolo con trattino.
9. Con tre membri le regole dei punti 2, 5 e 7 valgono per ogni coppia (A modifica una spesa scritta da C; un "per conto di" fra A e B non coinvolge C); un quarto utente D fuori non vede nulla.
10. `leave_household` riesce a chi non ha registri aperti e dopo di lui l'accesso alle righe di casa sparisce; fallisce con `CREDITO_APERTO` (spesa con carta personale non rimborsata), con `DEBITO_APERTO` (un `record_transfer` di versamento con `p_per_conto_di`) sia come debitore sia come creditore, con `ARRETRATI_APERTI` (piano attivo con quota non versata nel mese corrente; costruire il piano come proprietario con `valido_dal` uguale al primo del mese corrente e `joined_at` anteriore), e con `ULTIMO_MEMBRO` per l'ultimo membro.
11. L'ultimo membro può `close_household`; dopo la chiusura la casa è leggibile in sola lettura (insert e update falliscono) e il membro può crearne o unirsi a un'altra.
12. `record_transfer` rifiuta un `p_per_conto_di` che non sia un altro membro attivo della stessa casa, rifiuta una rinuncia non valida e un rimborso registrato dal beneficiario stesso senza `p_solo_registrazione`; il rimborso registrato da B aggiorna entrambi i saldi; `delete_transfer` li ripristina e solo l'autore può cancellare.
13. `get_calendar_feed` con token errato, revocato o di casa archiviata ritorna nullo; con token valido ritorna solo dati di casa (controllare le chiavi restituite); `anon` può eseguire solo questa funzione (`create_household` come `anon` fallisce, lettura diretta di `transfers` e `calendar_feeds` come `anon` fallisce); `calendar_feeds` non è leggibile dall'altro membro.
14. `save_household_plan` crea il piano con voci e quote; rifiuta un `valido_dal` nel passato e un reddito diverso per una posizione legata a un altro membro; accetta due versioni in una chiamata.
15. `join_household` lega un membro che entra al segnaposto con `user_id` nullo (stesso `slot`) e non riusa mai la posizione di un ex membro.
16. `record_balance_check` come B su un conto di casa: crea la spesa "Spese non registrate" con `origine = 'riconciliazione'` e allinea il saldo.
17. Un membro non può modificare `archiviata_il` né altre colonne di `households` oltre a `nome`.

- [ ] **Step 6: Verificare che il repository sia ancora verde**

Run: `npm test` poi `npm run lint` poi `npx next build`
Expected: tutto verde (T1 non cambia codice dell'app).

- [ ] **Step 7: Commit e push**

```bash
git add supabase/migrations/0004_casa_comune.sql supabase/tests/rls_casa.sql tests/migration0004.test.ts
git commit -m "feat: add household schema migration and RLS test script"
git push origin master
```

(Il commit non cambia il comportamento dell'app: la migrazione è un file e non viene eseguita da nessuno finché Fabio non la lancia.)

- [ ] **Step 8: Azione di Fabio (a mano, una volta sola)**

Istruzioni esatte da riportare a Fabio, poi **fermarsi e aspettare la sua risposta**:

1. Apri il progetto su supabase.com, menu **SQL Editor**, **New query**.
2. Apri il file `supabase/migrations/0004_casa_comune.sql` (dal repository in locale o su GitHub), seleziona tutto, copia, incolla nell'editor e premi **Run**. Esito atteso: "Success. No rows returned".
3. Premi **Run** una seconda volta sulla stessa query: deve finire di nuovo senza errori (la migrazione è idempotente).
4. Nuova query: incolla tutto `supabase/tests/rls_casa.sql` e premi **Run**. Il risultato compare come errore rosso con il referto: è voluto, perché annulla ogni dato di prova. Il testo deve iniziare con `RISULTATO: N OK, 0 FAIL` e contenere solo righe `OK:`. Se compare un `FAIL:` o un altro errore, **non correggere nulla a mano**: copia il testo completo a Claude.
5. Apri l'app su Vercel e controlla che Home, Conti, Obiettivi e Storico mostrino gli stessi numeri di prima.
6. Scrivi a Claude "migrazione eseguita, RLS tutto OK".

**Punto di controllo bloccante:** T2 non parte (e nulla di T2 si pusha) prima del via libera di Fabio al punto 6. Da T2 in poi l'app legge `household_id` e fallirebbe su ogni pagina se la migrazione non fosse stata eseguita.

---

## Task 2: Scope nel data layer, tipi, helper di test

**Files:**
- Modify: `tests/helpers/fakeSupabase.ts`
- Create: `tests/helpers/recordingSupabase.ts`, `tests/helpers/fakeDb.ts`, `tests/helpers/fakeRpc.ts`, `tests/helpers/scopeGuard.ts`
- Create: `src/lib/data/scope.ts`, `src/lib/loadHomeData.ts`
- Modify: `src/lib/data/accounts.ts`, `categories.ts`, `goals.ts`, `transactions.ts`, `src/lib/types.ts`, `src/app/page.tsx`
- Test: `tests/helpers/fakeSupabase.test.ts`, `tests/helpers/fakeDb.test.ts`, `tests/data/scope.test.ts`, `tests/data/scopeReads.test.ts`, `tests/data/scopeGuard.test.ts`, `tests/HomeIsolation.test.ts`, `tests/HistoryPivaIsolation.test.ts`

**Interfaces:**
- Consumes: la migrazione di T1 già eseguita (colonne `household_id`, `pagata_da_user_id`, `origine`, `accantona_da`).
- Produces:
  - `src/lib/data/scope.ts`:
    ```ts
    export type Scope = { kind: 'personale' } | { kind: 'casa'; householdId: string };
    export const PERSONALE: Scope;
    export function casa(householdId: string): Scope;
    export function scopeHouseholdId(scope: Scope): string | null; // null per personale
    export function applyScope<Q extends { is(c: string, v: null): Q; eq(c: string, v: string): Q }>(query: Q, scope: Scope): Q;
    // personale: query.is('household_id', null); casa: query.eq('household_id', scope.householdId)
    ```
  - Firme nuove del data layer (lo scope è sempre l'ultimo parametro, default `PERSONALE`): `getAccounts(supabase, scope?)`, `createAccount(supabase, input, scope?)`, `getCategories(supabase, scope?)`, `createCategory(supabase, input, scope?)`, `getOpenGoals(supabase, scope?)`, `createGoal(supabase, input, scope?)`, `getTransactions(supabase, scope?)`, `createTransaction(supabase, input, scope?)`, `getLastIncomeDate(supabase, scope?)`, `getRecentTransactionAmounts(supabase, categoriaId, limite, parolaChiave?, scope?)`. Le funzioni che lavorano per id (`updateAccountBalance`, `updateAccountDetails`, `updateCategory`, `archiveCategory`, `updateGoal`, `closeGoal`, `updateTransaction`, `deleteTransaction`, `getTransactionAmountsForGoal`) non cambiano firma e portano il commento marcatore `// household: per id`.
  - Tipi nuovi in `src/lib/types.ts` (camelCase delle colonne; tutti i campi sono obbligatori salvo diversa indicazione):
    ```ts
    export type RegolaQuota = 'parti_uguali' | 'proporzionale' | 'pari_residuo' | 'personalizzata';
    export interface Household { id: string; nome: string; createdAt: string; archiviataIl: string | null }
    export interface HouseholdMember { householdId: string; userId: string; displayName: string; joinedAt: string; slot: number; attivo: boolean }
    export interface HouseholdInvite { id: string; householdId: string; codice: string; createdAt: string; scadeIl: string; revocatoIl: string | null }
    export interface HouseholdPlan { id: string; householdId: string; validoDal: string; giornoVersamento: number; regola: RegolaQuota; cuscinettoObiettivo: number; cuscinettoQuotaMensile: number; arrotondamento: number; totaleMensile: number; createdAt: string }
    export type OrigineStima = 'suggerita' | 'utente' | 'reale';
    export interface PlanItem { id: string; planId: string; nome: string; categoriaId: string | null; frequenzaMesi: number; importoRicorrenza: number; importoMensile: number; origineStima: OrigineStima; goalId: string | null; stimaIgnorataConN: number | null; ordine: number }
    export interface PlanShare { planId: string; slot: number; userId: string | null; displayName: string; redditoNettoMensile: number; redditoIrregolare: boolean; percentuale: number | null; inCasaDal: string | null; esceDal: string | null; quotaMensile: number }
    export type TransferCausale = 'versamento' | 'rimborso' | 'restituzione' | 'altro';
    export interface Transfer { id: string; householdId: string | null; userId: string; daAccountId: string | null; aAccountId: string | null; importo: number; data: string; causale: TransferCausale; beneficiarioUserId: string | null; perContoDiUserId: string | null; meseCompetenza: string | null; soloRegistrazione: boolean; nota: string | null; createdAt: string }
    export interface BalanceCheck { id: string; householdId: string; accountId: string; userId: string; data: string; saldoRegistrato: number; saldoDichiarato: number; differenza: number; transactionId: string | null; createdAt: string }
    export type EsitoCheckin = 'in_pari' | 'avanzo' | 'ammanco';
    export interface Checkin { id: string; householdId: string; mese: string; userId: string; createdAt: string; attesoTotale: number; versatoTotale: number; previstoMensili: number; spesoMensili: number; nonRegistrate: number; avanzo: number; esito: EsitoCheckin; destinazioneAvanzo: 'cuscinetto' | 'da_parte' | null; goalId: string | null }
    export interface CalendarFeed { id: string; householdId: string; userId: string; token: string; createdAt: string; revocatoIl: string | null }
    ```
    In più `Transaction.pagataDaUserId?: string | null`, `Transaction.origine?: 'riconciliazione' | null`, `BudgetGoal.accantonaDa?: string | null` (opzionali: i test esistenti con `toEqual` restano validi, perché `toEqual` ignora le proprietà `undefined`).
  - `src/lib/loadHomeData.ts`:
    ```ts
    export interface HomeData { disponibileLibero: number; margineGiornaliero: number; dataTarget: Date; accounts: Account[]; categories: Category[]; goals: (BudgetGoal & { accantonato: number })[] }
    export async function loadHomeData(supabase: SupabaseClient, today: Date = new Date()): Promise<HomeData>;
    ```
  - Helper di test:
    ```ts
    // recordingSupabase.ts
    export interface RecordedCall { table: string; chain: { method: string; args: unknown[] }[] }
    export function createRecordingClient(rows?: unknown[]): { client: any; calls: RecordedCall[] };
    export function callsOf(call: RecordedCall, method: string): unknown[][]; // gli args di ogni invocazione di `method`
    // fakeDb.ts
    export interface FakeDbOptions { userId: string; membri?: Record<string, string[]> } // householdId -> userId dei membri
    export function createFakeDb(seed: Record<string, Record<string, unknown>[]>, opts: FakeDbOptions): {
      client: any; tables: Record<string, Record<string, unknown>[]>;
      registerRpc(name: string, handler: (args: any) => { data?: unknown; error?: { message: string } | null }): void;
      rpcCalls: { name: string; args: unknown }[];
    };
    // fakeRpc.ts
    export function fakeRpcClient(responses?: Record<string, { data?: unknown; error?: { message: string } | null }>): { client: any; calls: { name: string; args: unknown }[] };
    // scopeGuard.ts
    export function findUnscopedQueries(source: string): string[]; // nomi delle funzioni con from('accounts'|'categories'|'budget_goals'|'transactions') senza scope né marcatore
    ```
    `fakeDb` supporta `from(t).select().eq/neq/is/in/gt/gte/lt/lte/ilike/order/limit/single/maybeSingle`, `insert` (assegna `id` se manca, `user_id` = `opts.userId`, `household_id` = null se manca), `update(...).eq(...)`, `delete().eq(...)`, `rpc(name, args)`; la visibilità imita la RLS (riga personale visibile se `user_id === opts.userId`; riga di casa visibile se `opts.membri[household_id]` contiene `opts.userId`). Le query sono "thenable" come in `fakeSupabase.ts`.

- [ ] **Step 1: Estendere `tests/helpers/fakeSupabase.ts` con `.is()` (primo passo, prima di qualsiasi scope)**

Test in `tests/helpers/fakeSupabase.test.ts`: `'la catena select().is().order() risolve con le righe'` e `'select().is().eq().limit() resta thenable e risolve con le righe'`. Aggiungere a `fakeSelectClient` i metodi `is`, `in`, `neq`, `gt`, `lt` (tutti restituiscono il builder, come `eq`). Run: `npx vitest run tests/helpers/fakeSupabase.test.ts` (prima FAIL, poi PASS), poi `npm test` (i test esistenti restano verdi).

- [ ] **Step 2: Scrivere i test di `scope.ts` e delle letture con scope, vederli fallire**

`tests/data/scope.test.ts`: `'applyScope personale chiama is(household_id, null)'`, `'applyScope casa chiama eq(household_id, id)'`, `'scopeHouseholdId ritorna null per personale e l\'id per casa'`.

`tests/data/scopeReads.test.ts` con `createRecordingClient`: per ciascuna di `getAccounts`, `getCategories`, `getOpenGoals`, `getTransactions`, `getLastIncomeDate`, `getRecentTransactionAmounts` (`it.each`):
- `'<fn> senza scope filtra household_id is null'`: `callsOf(call, 'is')` contiene `['household_id', null]` e `callsOf(call, 'eq')` non contiene `'household_id'` come primo argomento.
- `'<fn> con scope casa filtra eq(household_id, h1)'`: `callsOf(call, 'eq')` contiene `['household_id', 'h1']` e `callsOf(call, 'is')` non contiene `'household_id'`.
Per le create: `'createAccount con scope casa scrive household_id'` (e analoghi per categoria, obiettivo, transazione): `callsOf(call, 'insert')[0][0]` contiene `household_id: 'h1'`; senza scope `household_id: null`.

Run: `npx vitest run tests/data` Expected: FAIL.

- [ ] **Step 3: Implementare `src/lib/data/scope.ts` e applicare lo scope**

Implementare `scope.ts` come da Interfaces. Nei quattro file del data layer: ogni lettura chiama `applyScope(query, scope)` subito dopo `.select(...)` (prima di `.order(...)`, che nei fake è terminale); ogni create aggiunge `household_id: scopeHouseholdId(scope)` all'insert; le funzioni per id ricevono il commento `// household: per id` sopra la query. Estrarre le liste di colonne ripetute in costanti di file (`TRANSACTION_COLUMNS`, `GOAL_COLUMNS`) e aggiungervi `pagata_da_user_id, origine` e `accantona_da`; `mapRow` mappa i nuovi campi in `pagataDaUserId`, `origine`, `accantonaDa`. Nessuna colonna `household_id` nelle liste `select` (non serve al client).
Run: `npx vitest run tests/data` Expected: PASS (inclusi i test esistenti).

- [ ] **Step 4: Aggiungere i tipi nuovi a `src/lib/types.ts`** come da Interfaces. Verifica: `npx tsc --noEmit` senza errori.

- [ ] **Step 5: Test statico del data layer (fallisce, poi passa)**

`tests/data/scopeGuard.test.ts`:
- `'findUnscopedQueries segnala una funzione con from(accounts) senza scope'` (sorgente di esempio inline)
- `'accetta applyScope, scopeHouseholdId, .is(household_id) , .eq(household_id) e il marcatore // household: per id'`
- `'ogni file in src/lib/data rispetta lo scope tranne la allowlist'`: legge `src/lib/data/*.ts` con `fs`, salta i file in `FILE_ESENTI = ['keepAlive.ts']` (commento: `pingDatabase` legge `accounts` solo per tenere sveglio il progetto Supabase, non restituisce dati a nessuno; il marcatore resta riservato alle funzioni per id) e si aspetta `findUnscopedQueries(source)` vuoto.
Implementare `tests/helpers/scopeGuard.ts`: spezza il sorgente per funzione (`/^(export )?(async )?function \w+/m`), per ogni funzione che contiene `.from('accounts'|'categories'|'budget_goals'|'transactions')` richiede almeno uno fra `applyScope(`, `scopeHouseholdId(`, `.is('household_id'`, `.eq('household_id'`, `// household: per id`.
Run: `npx vitest run tests/data/scopeGuard.test.ts` Expected: PASS.

- [ ] **Step 6: `fakeDb` e `fakeRpc` con i loro test**

`tests/helpers/fakeDb.test.ts`: `'eq e is filtrano come Postgres'`, `'una riga personale di un altro utente non è visibile'`, `'una riga di casa è visibile ai membri e non a chi è fuori'`, `'insert assegna id, user_id e household_id nullo'`, `'update ed eq modificano solo le righe visibili'`, `'rpc registrata ritorna il risultato e traccia la chiamata'`. Implementare `fakeDb.ts` e `fakeRpc.ts` come da Interfaces.

- [ ] **Step 7: Estrarre `loadHomeData` e provare l'isolamento della home**

Spostare in `src/lib/loadHomeData.ts` la logica ora dentro `HomePage` (letture in parallelo, `getSpecoCollegato`, `computeDisponibileLibero`, `stimaDataTarget`, `computeMargineGiornaliero`, `computeAccantonatoFinora`) senza cambiare i risultati; `src/app/page.tsx` chiama `loadHomeData(supabase)` e passa `dataTarget={data.dataTarget.toISOString()}` a `HomeDashboard`, che non cambia.

`tests/HomeIsolation.test.ts` con `createFakeDb` (membri: `{ H1: ['A','B','C'] }`; utente D fuori; `today = new Date('2026-11-15T12:00:00Z')`). Per l'utente A: un conto personale da 1000 che conta nel disponibile, un obiettivo personale `bloccato` da 130, un'entrata personale; più un conto di casa da 5000, un obiettivo di casa `bloccato` da 999 e un'entrata di casa con data successiva a quella personale. Test:
- `'la home di A ignora conti, obiettivi ed entrate di casa'`: `disponibileLibero` è esattamente `870` e il risultato coincide (`toEqual`) con quello di un `fakeDb` che contiene solo le righe personali di A.
- `'la data target non è spostata da un\'entrata di casa'`: `dataTarget` identica al caso senza righe di casa.
- `'vale per ciascuno dei tre membri e per D'`: `it.each(['A','B','C','D'])` confronto con la baseline personale di ciascuno.

`tests/HistoryPivaIsolation.test.ts`: con lo stesso `fakeDb`, `getTransactions(client)` ritorna solo le transazioni personali; `aggregateByCategory` e `computeFatturatoAnnuo(transactions, categoriaFatturatoId, 2026)` danno gli stessi valori con e senza righe di casa (fatturato `6000` nell'esempio) e con un trasferimento di casa presente nelle tabelle.

- [ ] **Step 8: Verifica completa, commit e push**

Run: `npm test` poi `npm run lint` poi `npx next build`. Controllare a mano nel browser locale (`npm run dev`) che Home, Conti, Obiettivi, Storico e P.IVA mostrino gli stessi numeri di prima.
```bash
git add -A
git commit -m "feat: add household scope to the data layer with isolation tests"
git push origin master
```

---

## Task 3: Casa, invito, ingresso, uscita, scheletro `/casa`, navigazione

**Files:**
- Create: `src/lib/data/households.ts`
- Create: `src/app/casa/page.tsx`, `src/app/casa/CasaSenzaCasa.tsx`, `src/app/casa/CasaHome.tsx`
- Create: `src/app/casa/inizia/page.tsx`, `src/app/casa/inizia/InizioCasa.tsx`
- Create: `src/app/casa/impostazioni/page.tsx`, `src/app/casa/impostazioni/ImpostazioniCasa.tsx`
- Create: `tests/helpers/paroleVietate.ts`
- Modify: `src/app/NavBar.tsx`, `src/app/accounts/page.tsx`, `src/app/add/AddTransactionForm.tsx`, `PRODUCT.md`, `docs/ROADMAP.md`
- Test: `tests/data/households.test.ts`, `tests/CasaSenzaCasa.test.tsx`, `tests/CasaHome.test.tsx`, `tests/InizioCasa.test.tsx`, `tests/ImpostazioniCasa.test.tsx`, `tests/NavBar.test.tsx`

**Interfaces:**
- Consumes: RPC di T1 (nomi e parametri nella sezione Interfaces di T1); da T2 i tipi `Household`, `HouseholdMember`, `HouseholdInvite`, `createFakeDb`, `fakeRpcClient`.
- Produces:
  ```ts
  // src/lib/data/households.ts
  export interface CasaCorrente { household: Household; members: HouseholdMember[]; invite: HouseholdInvite | null; me: HouseholdMember }
  export async function getMyHousehold(supabase: SupabaseClient, userId: string): Promise<CasaCorrente | null>;
  // null se l'utente non ha una riga di membro con attivo = true in una casa non archiviata.
  // members: solo i membri attivi di quella casa, ordinati per slot. invite: il più recente non revocato e non scaduto (filtro in JS), oppure null.
  export async function createHousehold(supabase: SupabaseClient, input: { nome: string; displayName: string }): Promise<string>;
  export async function createInvite(supabase: SupabaseClient, householdId: string): Promise<string>;   // ritorna il codice senza trattino
  export async function revokeInvite(supabase: SupabaseClient, householdId: string): Promise<void>;
  export async function joinHousehold(supabase: SupabaseClient, input: { codice: string; displayName: string }): Promise<string>;
  export async function leaveHousehold(supabase: SupabaseClient): Promise<void>;
  export async function closeHousehold(supabase: SupabaseClient): Promise<void>;
  export type MotivoBlocco = 'credito' | 'debito' | 'arretrati' | 'ultimo_membro' | 'non_ultimo_membro';
  export class CasaBloccataError extends Error { reason: MotivoBlocco }
  // leaveHousehold e closeHousehold traducono i messaggi CREDITO_APERTO, DEBITO_APERTO, ARRETRATI_APERTI, ULTIMO_MEMBRO, NON_ULTIMO_MEMBRO in CasaBloccataError; ogni altro errore si rilancia com'è.
  export function formatCodiceInvito(codice: string): string; // 'K7M2QX9P' -> 'K7M2-QX9P'
  ```
  Componenti (props esatte):
  ```ts
  CasaSenzaCasa(): JSX          // due strade e riga "Cosa vede l'altro?"
  CasaHome(props: { casa: CasaCorrente }): JSX   // scheletro: nome, membri, link Impostazioni; T5 aggiunge la carta del piano
  InizioCasa(props: { defaultDisplayName: string }): JSX
  ImpostazioniCasa(props: { casa: CasaCorrente }): JSX
  ```
  Helper di test `tests/helpers/paroleVietate.ts`: `export const PAROLE_VIETATE: string[]` (le sei della sezione Global Constraints) e `export function assertNessunaParolaVietata(container: HTMLElement): void` (confronto senza distinzione di maiuscole su `textContent`, lancia con la parola trovata).

- [ ] **Step 1: Test di `households.ts` (fallisce)**

`tests/data/households.test.ts` con `createFakeDb` (tabelle `household_members`, `households`, `household_invites`) e `fakeRpcClient`:
- `'getMyHousehold ritorna null per chi non ha una riga di membro'`
- `'getMyHousehold ritorna null per un membro con attivo false (casa chiusa)'` (Review Focus 4)
- `'getMyHousehold ritorna casa, solo i membri attivi ordinati per slot e il membro corrente'`
- `'getMyHousehold ignora inviti revocati e scaduti e prende il più recente valido'`
- `'createHousehold chiama create_household con p_nome e p_display_name e ritorna l\'id'`
- `'createInvite chiama create_invite con p_household e ritorna il codice'` e `'revokeInvite chiama revoke_invite'`
- `'joinHousehold passa il codice digitato senza spazi ai bordi'`: input `' k7m2-qx9p '` produce `p_codice: 'k7m2-qx9p'` (la normalizzazione completa è nell'SQL; Review Focus 5)
- `'joinHousehold rilancia l\'errore dell\'RPC'`
- `'leaveHousehold traduce CREDITO_APERTO in CasaBloccataError con reason credito'` e analoghi per `DEBITO_APERTO` (debito), `ARRETRATI_APERTI` (arretrati), `ULTIMO_MEMBRO` (ultimo_membro); `'closeHousehold traduce NON_ULTIMO_MEMBRO'`
- `'formatCodiceInvito mette il trattino a metà'`
Run: `npx vitest run tests/data/households.test.ts` Expected: FAIL.

- [ ] **Step 2: Implementare `src/lib/data/households.ts`** come da Interfaces. `getMyHousehold` legge `household_members` (tutte le righe visibili), individua la riga di `userId` con `attivo`, poi legge `households` e `household_invites` della casa; filtri sui membri e sugli inviti fatti in JS per restare testabili. Run: stesso comando, Expected: PASS.

- [ ] **Step 3: Helper `paroleVietate` e test dei componenti (falliscono)**

- `tests/CasaSenzaCasa.test.tsx`: `'mostra "Creo la casa" e "Ho un codice di invito" come link a /casa/inizia'`, `'mostra la riga "Cosa vede l\'altro?" con la frase sulla privacy'`, `'non contiene parole vietate'`.
- `tests/CasaHome.test.tsx`: `'mostra il nome della casa e i nomi dei membri'`, `'ha il link Impostazioni verso /casa/impostazioni'`, `'non contiene parole vietate'`.
- `tests/InizioCasa.test.tsx` (mock di `@/lib/data/households`, `@/lib/supabase/client`, `next/navigation`): `'il nome di chi crea è precompilato con defaultDisplayName'`; `'crea la casa, genera l\'invito e mostra il codice con il trattino e "Copia il codice"'` (`createHousehold` poi `createInvite`, codice `K7M2QX9P` mostrato `K7M2-QX9P`); `'entra con un codice e va su /casa'` (`router.push('/casa')` e `refresh`); `'un codice rifiutato mostra "Codice non valido o scaduto. Chiedine uno nuovo."'`; `'chiede il nome visualizzato anche a chi entra'`; `'non contiene parole vietate'`.
- `tests/ImpostazioniCasa.test.tsx`: `'elenca i membri'`; `'mostra il codice di invito con "Rigenera" e "Revoca"'` (chiamano `createInvite` e `revokeInvite`); `'Esci dalla casa chiama leaveHousehold e torna a /casa'`; `'con un credito aperto mostra "Prima di uscire serve chiudere i soldi che hai anticipato: fatti rimborsare dal conto comune o scegli di rinunciarvi."'` (anche per debito e arretrati, con testi neutri: "Prima di uscire serve chiudere la quota versata per te o da te: restituitela, anche a rate, oppure rinunciate." e "Prima di uscire serve versare le quote del piano di questo mese e dei mesi passati."); `'se sei l\'ultimo membro mostra "Chiudi la casa" con la conferma "Non vedrai più i dati della casa. I soldi sul conto comune non si muovono da soli: mettetevi d\'accordo prima su come dividerli."'` e chiama `closeHousehold`; `'non contiene parole vietate'`.
- `tests/NavBar.test.tsx` (mock di `usePathname`): `'ha sei voci con Casa e senza Categorie'`; `'Casa è attiva su /casa e su /casa/quota'` (`aria-current="page"` sul link attivo); `'le altre voci restano attive solo sul percorso esatto'`.
Run: `npx vitest run tests/CasaSenzaCasa.test.tsx tests/CasaHome.test.tsx tests/InizioCasa.test.tsx tests/ImpostazioniCasa.test.tsx tests/NavBar.test.tsx` Expected: FAIL.

- [ ] **Step 4: Implementare componenti, pagine e navigazione**

Leggere prima `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`.
- Pagine Server Component (`page.tsx`) nello schema: `const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login'); const casa = await getMyHousehold(supabase, user.id);`. `/casa`: `casa ? <CasaHome casa={casa} /> : <CasaSenzaCasa />`. `/casa/inizia`: se `casa` esiste `redirect('/casa')`, altrimenti `<InizioCasa defaultDisplayName={parte locale dell'email} />`. `/casa/impostazioni`: senza casa `redirect('/casa')`, altrimenti `<ImpostazioniCasa casa={casa} />`.
- Componenti client: stile e classi dei form esistenti (`/accounts`); chiamate con `createClient()` da `@/lib/supabase/client`, errori con messaggio sotto il pulsante, `router.refresh()` dopo ogni scrittura. "Copia il codice" usa `navigator.clipboard` con try/catch; "Condividi" usa `navigator.share` solo se disponibile. Testi come in spec 8.1 e 8.2.
- `NavBar.tsx`: sostituire la voce Categorie con `{ href: '/casa', label: 'Casa', icon: Building2 }` (quinta posizione, prima di P.IVA), attivo se `pathname === l.href` oppure (solo per Casa) `pathname.startsWith('/casa')`; aggiungere `aria-current="page"` al link attivo.
- `src/app/accounts/page.tsx`: in fondo alla pagina un link "Gestisci categorie" verso `/categories`. `AddTransactionForm.tsx`: sotto i chip delle categorie un link piccolo "Gestisci categorie" verso `/categories` (se i test del form falliscono per `next/link`, usare un normale `<a href="/categories">`).
Run: i test dello Step 3, Expected: PASS.

- [ ] **Step 5: Aggiornare `PRODUCT.md` e `docs/ROADMAP.md`**

`PRODUCT.md` (in inglese come il resto del file):
- Sezione Users: sostituire "each with fully isolated personal finance data (no sharing or cross-visibility between the two accounts)" con "each with a private personal finance space, plus an optional shared household space (the Casa) that every member of the household can see".
- Principio 3: sostituire con "Two private worlds, one shared home: personal finances stay invisible to everyone else in the household, while the household's own money (common account, shared expenses, bills) is visible to all its members. Nothing in the UI should make anyone second-guess which is which."
- Sezione Capabilities and Constraints: primo punto sostituito da "Supabase Auth accounts, with data protected by Postgres Row Level Security: personal rows (`household_id` null) are readable and writable only by their author; household rows (`household_id` set) are readable and writable by every active member of that household. Personal data is never visible to another member, not even as totals. A household has N members who join with a shareable invite code; no self-service signup."; ultimo punto ("A future, separate project may add shared household expense splitting...") sostituito da "Shared household management (common account, monthly contributions, shared expenses and bills) is built in stages; the personal space and the household space stay separate, and the second never exposes the first."
`docs/ROADMAP.md`, blocco 1: aggiungere sotto il titolo "**Stato (8 novembre 2026):** spec approvata in `docs/superpowers/specs/2026-11-08-co-gestione-casa-design.md`; consegne 1 a 3 pianificate in `docs/superpowers/plans/2026-11-08-casa-comune-consegne-1-3.md`. Le domande iniziali sono risolte nella spec. Consegna 1 (fondamenta) e consegna 2 (casa, invito, ingresso, uscita): fatte."

- [ ] **Step 6: Verifica, commit e push**

Run: `npm test` poi `npm run lint` poi `npx next build`. Controllo manuale in locale: dopo aver creato la casa dal proprio account, `/casa` mostra il nome e i membri, la barra ha sei voci con Casa.
```bash
git add -A
git commit -m "feat: add household creation, invite, join, leave and close with the /casa skeleton"
git push origin master
```
Controllo di accettazione per Fabio (a mano, dopo il deploy): due account reali si collegano con lo stesso codice (anche un terzo, se disponibile), l'uscita funziona e l'ultimo rimasto può chiudere la casa.

---

## Task 4: Calcoli della quota

**Files:**
- Create: `src/lib/calculations/casa/oggi.ts`, `vociTipiche.ts`, `mensilizza.ts`, `cuscinetto.ts`, `quota.ts`, `spiegazioni.ts`
- Modify: `src/lib/format.ts`
- Create: `tests/helpers/esempioCasa.ts`
- Test: `tests/calculations/casa/{oggi,vociTipiche,mensilizza,cuscinetto,quota,spiegazioni}.test.ts`, `tests/format.test.ts`

**Interfaces:**
- Consumes: `RegolaQuota` da `src/lib/types.ts` (T2). Nessuna UI, nessuna rete.
- Produces:
  ```ts
  // oggi.ts
  export function oggiRomaISO(now?: Date): string;  // 'yyyy-MM-dd' in fuso Europe/Rome (Intl.DateTimeFormat con timeZone)
  export function meseRomaISO(now?: Date): string;  // 'yyyy-MM-01'
  // mensilizza.ts
  export function mensilizza(importoRicorrenza: number, frequenzaMesi: number): number;   // importoRicorrenza / frequenzaMesi; lancia se frequenzaMesi < 1
  export function totaleVociMensili(voci: { importoRicorrenza: number; frequenzaMesi: number }[]): number;
  export function isVoceDaParte(frequenzaMesi: number): boolean;  // frequenzaMesi > 1
  // vociTipiche.ts
  export interface VoceTipica { chiave: string; nome: string; frequenzaMesi: number; stimaRicorrenza: number | null; rigaDidattica: string }
  export const VOCI_CASA_TIPICHE: VoceTipica[];
  // cuscinetto.ts
  export function cuscinettoDefault(sottotot: number, mesi?: 1 | 2): { obiettivo: number; quotaMensile: number };
  export function mesiAlPieno(obiettivo: number, quotaMensile: number): number | null;
  // quota.ts
  export function calcolaTotale(sottotot: number, cuscinettoQuotaMensile: number, arrotondamento: number): number;
  export interface PersonaQuotaInput { slot: number; nome: string; redditoNetto: number | null; percentuale?: number | null }
  export interface QuotaPersona { slot: number; nome: string; quota: number; resta: number | null; peso: number | null }
  export type AvvisoQuota =
    | { tipo: 'quota_supera_reddito'; slot: number; nome: string }
    | { tipo: 'spese_oltre_redditi' }
    | { tipo: 'redditi_mancanti'; slot: number; nome: string };
  export interface RisultatoQuota { totale: number; persone: QuotaPersona[]; avvisi: AvvisoQuota[]; regolaDisponibile: boolean }
  export function calcolaQuota(input: { persone: PersonaQuotaInput[]; totale: number; regola: RegolaQuota }): RisultatoQuota;
  // spiegazioni.ts
  export interface Spiegazione { valore: number; formula: string; ingredienti: { etichetta: string; valore: number }[] }
  export function spiegaTotaleMensile(input: { sottotot: number; cuscinettoQuotaMensile: number; arrotondamento: number }): Spiegazione;
  export function spiegaQuotaPersona(input: { regola: RegolaQuota; sottotot: number; cuscinettoQuotaMensile: number; arrotondamento: number; persone: PersonaQuotaInput[]; slot: number }): Spiegazione;
  // format.ts
  export function formatNumero(value: number): string;  // it-IT, useGrouping true, massimo 2 decimali, senza simbolo
  ```
  Fixture condivisa `tests/helpers/esempioCasa.ts`: `ESEMPIO_VOCI` (le dieci voci tipiche con affitto 750 e assicurazione 96 l'anno, quindi `sottotot` 1321), `ESEMPIO_PERSONE` (Fabio slot 1 reddito 1800, Giulia slot 2 reddito 1400), `ESEMPIO_CUSCINETTO_QUOTA = 59`.

Convenzioni: gli importi si trattano in euro interi dentro `calcolaQuota`; `totale` deve essere un intero, altrimenti la funzione lancia (l'arrotondamento del wizard è 1, 5 o 10). Il resto dell'arrotondamento va tutto a un solo membro: quello con reddito maggiore (percentuale maggiore per la `personalizzata`); a parità, lo slot minore.

- [ ] **Step 1: Test di `oggi.ts`, `mensilizza.ts`, `vociTipiche.ts`, `cuscinetto.ts`, `formatNumero` (falliscono)**

- `oggi.test.ts`: `'31 ottobre 23:30 UTC è già 1 novembre in Italia'` (`oggiRomaISO(new Date('2026-10-31T23:30:00Z')) === '2026-11-01'`, `meseRomaISO(...) === '2026-11-01'`; Review Focus 1); `'in estate l\'offset è +2'` (`'2026-06-30T22:30:00Z'` dà `'2026-07-01'`); `'a metà giornata resta lo stesso giorno'` (`'2026-11-08T10:00:00Z'` dà `'2026-11-08'`).
- `mensilizza.test.ts`: `'TARI 300 su 12 fa 25'`, `'luce 110 su 2 fa 55'`, `'equivalenza: importoMensile per frequenza dà la ricorrenza'`, `'lancia con frequenza 0'`, `'isVoceDaParte è vera solo oltre 1'`, `'totaleVociMensili somma i mensili'`.
- `vociTipiche.test.ts`: `'contiene le dieci voci della spec'` (affitto, condominio, luce, gas, acqua, internet, TARI, assicurazione casa, spesa alimentare, manutenzione) con frequenze 1, 1, 2, 2, 3, 1, 12, 12, 1, 1 e stime null, 50, 110, 110, 60, 28, 300, 100, 300, 30; `'i mensili sono 50, 55, 55, 20, 28, 25, 8,33, 300, 30'` (`toBeCloseTo` per 8,33); le righe didattiche sono quelle della tabella 7.1 della spec (affitto "Il canone del contratto.", condominio "Di solito paga l'inquilino una parte; guardate il contratto.", luce e gas "La bolletta arriva ogni due mesi: mettiamo da parte metà al mese.", acqua "Spesso arriva a trimestri o a conguaglio.", TARI "Il comune la chiede in 2 o 3 rate: qui la dividiamo per 12.", assicurazione "Non è obbligatoria, ma copre incendio e danni a terzi.", spesa "È la voce che più varia: la rivedrete dopo 3 mesi."; internet e manutenzione stringa vuota).
- `cuscinetto.test.ts`: `'default: 5% di 1321 arrotondato fa 66 e obiettivo 1321'`; `'con 2 mesi l\'obiettivo è 2642'`; `'mesiAlPieno(1321, 59) fa 22'`; `'mesiAlPieno con quota 0 è null'`.
- `format.test.ts` (aggiungere): `'formatNumero(1321) è "1.321"'`, `'formatNumero(1380.5) è "1.380,5"'`, `'formatNumero(59) è "59"'`.
Run: `npx vitest run tests/calculations/casa tests/format.test.ts` Expected: FAIL.

- [ ] **Step 2: Implementare** `oggi.ts`, `mensilizza.ts`, `vociTipiche.ts`, `cuscinetto.ts` e `formatNumero`. Run: stesso comando, Expected: PASS.

- [ ] **Step 3: Test di `calcolaTotale` e `calcolaQuota` (falliscono)**

`tests/calculations/casa/quota.test.ts`:
- `'calcolaTotale: 1321 + 59 con arrotondamento 10 fa 1380'`; `'con 1321,33 + 59 fa 1390'`; `'con arrotondamento 1 fa 1381 su 1380,33'`.
- Esempio della ricerca, `totale` 1380, redditi 1800 e 1400 (slot 1 e 2):
  - `'parti uguali: 690 e 690, resta 1110 e 710, peso 0,383 e 0,493'`
  - `'proporzionale: 777 e 603, resta 1023 e 797, somma 1380'` (rispetto alla spec che scrive 776 e 604, vedi Divergenze punto 1)
  - `'pari residuo: 890 e 490, resta 910 e 910'`
- Tre membri, redditi 1800, 1400, 600, `totale` 1380:
  - `'parti uguali: 460 a testa'`
  - `'proporzionale: 655, 508 e 217 (il resto di 2 euro va al reddito maggiore)'`
  - `'pari residuo azzera il terzo e ricalcola sui restanti: 890, 490 e 0, resta 600 al terzo'`
- Personalizzata: `'100 e 0 dà 1380 e 0'`; `'70 e 30 dà 966 e 414'`; `'totale 1001 con 70 e 30 dà 701 e 300 (il resto va alla percentuale maggiore)'`; non richiede i redditi (`redditoNetto: null` accettato, `regolaDisponibile` vero).
- Un solo membro (Review Focus 2): `'N = 1: parti uguali, proporzionale, pari residuo e personalizzata 100 danno tutte 1380'`.
- Reddito a zero: `'proporzionale con redditi 1800 e 0 dà 1380 e 0, peso null per il secondo'`; `'pari residuo con redditi 1800 e 0 dà 1380 e 0'`; nessun `NaN` in nessun campo del risultato.
- Parità: `'a parità di reddito il resto va allo slot minore'` (totale 1001, parti uguali, redditi uguali: 501 e 500).
- Avvisi: `'quota_supera_reddito quando la quota supera il reddito'` (redditi 1000 e 300, parti uguali: avviso per il secondo); `'spese_oltre_redditi quando il totale supera la somma dei redditi'`; `'redditi_mancanti disabilita proporzionale e pari residuo'` (`regolaDisponibile` falso, quote 0, un avviso per persona senza reddito); parti uguali e personalizzata restano disponibili senza redditi.
- `'lancia se totale non è intero'`.
- Proprietà: `'su 300 casi pseudo casuali (generatore con seme fisso) la somma delle quote è sempre uguale al totale e nessuna quota è negativa'`, per ognuna delle quattro regole, con N da 1 a 5.

- [ ] **Step 4: Implementare `quota.ts`**

Algoritmo che i test non dettano interamente (pseudo codice, non copiare alla lettera):
```
calcolaTotale = ceil((sottotot + cuscinettoQuotaMensile) / arrotondamento) * arrotondamento
quote reali q_i (numeri con decimali) per regola:
  parti_uguali:  totale / N
  proporzionale: totale * r_i / S
  pari_residuo:  insieme = tutti; ripeti { R = (somma r_insieme - totale) / |insieme|;
                 q_i = r_i - R per i dell'insieme; se qualche q_i < 0, azzera quelli e toglili dall'insieme }
                 finché nessuna q_i è negativa (chi è fuori ha q = 0)
  personalizzata: totale * p_i / 100
arrotonda: q_i = floor(q_i reale); avanzo = totale - somma(q_i); avanzo intero va al membro con chiave maggiore
           (reddito, per la personalizzata la percentuale; a parità slot minore)
resta_i = r_i - q_i (null se reddito null); peso_i = q_i / r_i (null se r_i nullo o <= 0)
```
Con pari residuo e nessuno nell'insieme (caso degenere) tutte le quote valgono 0 e `spese_oltre_redditi` è comunque segnalato.
Run: `npx vitest run tests/calculations/casa/quota.test.ts` Expected: PASS.

- [ ] **Step 5: Test e implementazione di `spiegazioni.ts`**

`tests/calculations/casa/spiegazioni.test.ts`:
- `'spiegaTotaleMensile: valore 1380 e formula "Spese comuni 1.321 euro + cuscinetto 59 euro = 1.380 euro."'`; `'gli ingredienti sommano al valore, arrotondamento incluso'` (con 1321,33 + 59 gli ingredienti sono spese comuni, cuscinetto e un terzo ingrediente "Arrotondamento" che porta la somma a 1390).
- `'spiegaQuotaPersona proporzionale: valore coincide con calcolaQuota (777) e la formula è "Spese comuni 1.321 euro + cuscinetto 59 euro = 1.380 euro, divisi secondo il reddito.\nFabio: 1.800 su 3.200 di reddito, cioè 56%."'`; gli ingredienti sono reddito della persona, reddito di tutti e totale.
- `'parti uguali, pari residuo e personalizzata'`: stesso schema; la prima riga dice "divisi in parti uguali.", "divisi in modo che a tutti restino gli stessi soldi." e "divisi con le percentuali scelte."; `valore` coincide sempre con `calcolaQuota`.
- `'nessuna parola vietata nelle formule'`.
Implementare con `formatNumero`. Run: `npx vitest run tests/calculations/casa tests/format.test.ts` Expected: PASS.

- [ ] **Step 6: Creare `tests/helpers/esempioCasa.ts`** (usata da T5) e verificare con `npx tsc --noEmit`.

- [ ] **Step 7: Verifica, commit e push**

Run: `npm test` poi `npm run lint` poi `npx next build`.
```bash
git add -A
git commit -m "feat: add household quota calculations with explanations"
git push origin master
```

---

## Task 5: Wizard "Calcola la nostra quota", salvataggio del piano, ComeSiCalcola

**Files:**
- Create: `src/lib/data/householdPlans.ts`
- Create: `src/lib/calculations/casa/statoPiano.ts`, `pianoVersioni.ts`, `parseImporto.ts`
- Create: `src/app/casa/ComeSiCalcola.tsx`
- Create: `src/app/casa/quota/page.tsx`, `QuotaClient.tsx`, `QuotaWizard.tsx`, `PianoAttuale.tsx`
- Modify: `src/app/casa/page.tsx` e `CasaHome.tsx` (carta "La nostra quota"), `docs/ROADMAP.md`
- Test: `tests/data/householdPlans.test.ts`, `tests/calculations/casa/{statoPiano,pianoVersioni,parseImporto}.test.ts`, `tests/ComeSiCalcola.test.tsx`, `tests/QuotaWizard.test.tsx`, `tests/PianoAttuale.test.tsx`

**Interfaces:**
- Consumes: da T1 `save_household_plan` (payload nel commento SQL: chiavi `snake_case`, `versioni[]` con `voci[]` e `quote[]`); da T2 `PlanItem`, `PlanShare`, `HouseholdPlan`, `HouseholdMember`, `createFakeDb`, `fakeRpcClient`; da T3 `CasaCorrente`, `CasaHome`, `assertNessunaParolaVietata`; da T4 `calcolaQuota`, `calcolaTotale`, `totaleVociMensili`, `mensilizza`, `VOCI_CASA_TIPICHE`, `cuscinettoDefault`, `mesiAlPieno`, `spiegaTotaleMensile`, `spiegaQuotaPersona`, `Spiegazione`, `meseRomaISO`, `formatNumero`, `esempioCasa`.
- Produces:
  ```ts
  // householdPlans.ts
  export interface PlanBundle { plan: HouseholdPlan; items: PlanItem[]; shares: PlanShare[] }
  export async function getPlanForMonth(supabase: SupabaseClient, householdId: string, meseISO: string): Promise<PlanBundle | null>;
  // piano con valido_dal massimo <= meseISO; se non ce n'è, il primo futuro; null se la casa non ha piani. Items per `ordine`, shares per `slot`.
  export interface PlanVoceInput { nome: string; categoriaNome: string; frequenzaMesi: number; importoRicorrenza: number; origineStima: OrigineStima; goalId?: string | null; stimaIgnorataConN?: number | null; ordine: number }
  export interface PlanQuotaInput { slot: number; displayName: string; redditoNettoMensile: number; redditoIrregolare: boolean; percentuale: number | null; inCasaDal: string | null; esceDal?: string | null; quotaMensile: number }
  export interface PlanVersionInput { validoDal: string; giornoVersamento: number; regola: RegolaQuota; cuscinettoObiettivo: number; cuscinettoQuotaMensile: number; arrotondamento: number; totaleMensile: number; voci: PlanVoceInput[]; quote: PlanQuotaInput[] }
  export async function savePlan(supabase: SupabaseClient, householdId: string, versioni: PlanVersionInput[]): Promise<string[]>;
  // statoPiano.ts
  export function statoPiano(shares: Pick<PlanShare, 'quotaMensile' | 'userId' | 'esceDal'>[]): 'bozza' | 'attivo';
  // pianoVersioni.ts
  export interface PianoDraftPersona { slot: number; displayName: string; userId: string | null; redditoNetto: number | null; redditoIrregolare: boolean; inCasaDal: string | null }
  export type PeriodoIniziale = { tipo: 'normale' } | { tipo: 'tutto_a_chi_abita' } | { tipo: 'percentuali'; percentuali: Record<number, number> };
  export interface PianoDraft { persone: PianoDraftPersona[]; voci: PlanVoceInput[]; cuscinettoObiettivo: number; cuscinettoQuotaMensile: number; arrotondamento: number; regola: RegolaQuota; periodoIniziale: PeriodoIniziale; giornoVersamento: number; partenza: string }
  export function buildPlanVersions(draft: PianoDraft): PlanVersionInput[];
  // parseImporto.ts
  export function parseImporto(testo: string): number | null;   // '1800,5' -> 1800.5; '' , 'abc' o negativo -> null
  // ComeSiCalcola.tsx
  export function ComeSiCalcola(props: { spiegazione: Spiegazione; className?: string }): JSX; // pulsante "Come si calcola?" che apre formula e ingredienti
  // QuotaWizard.tsx
  export function QuotaWizard(props: { householdId: string; meUserId: string; meseCorrente: string; membri: HouseholdMember[]; pianoAttuale: PlanBundle | null; onSaved: () => void }): JSX;
  // PianoAttuale.tsx
  export function PianoAttuale(props: { bundle: PlanBundle; meseCorrente: string; onRivedi: () => void }): JSX;
  ```
  `meseCorrente` è sempre `'yyyy-MM-01'` calcolato dal server con `meseRomaISO()`.

- [ ] **Step 1: Test di `parseImporto`, `statoPiano` e `buildPlanVersions` (falliscono)**

- `parseImporto.test.ts` (Review Focus 3): `'accetta la virgola'` (`'1800,5'` vale `1800.5`), `'accetta il punto'`, `'vuoto, spazi e testo danno null'`, `'i negativi danno null'`, `'zero è valido'`.
- `statoPiano.test.ts`: `'è bozza se una posizione con quota maggiore di zero non è legata'`; `'è attivo quando tutte le posizioni con quota maggiore di zero sono legate'`; `'una posizione a quota 0 non legata non blocca il piano'`; `'una posizione con esceDal valorizzato è esclusa dal controllo'` (Divergenze punto 7); `'senza posizioni è bozza'`.
- `pianoVersioni.test.ts` con `esempioCasa` (voci con `sottotot` 1321, cuscinetto 59, arrotondamento 10, quindi `totaleMensile` 1380; partenza `'2026-12-01'`, giorno 5, regola `proporzionale`):
  - `'tutti già in casa: una sola versione dal mese di partenza con le quote 777 e 603'`
  - `'la compagna entra dal 2027-02-01 con "tutto a chi abita già": versione 2026-12-01 personalizzata con percentuali 100 e 0 (quote 1380 e 0) e versione 2027-03-01 proporzionale con 777 e 603'`
  - `'percentuali 70 e 30 per il primo periodo danno 966 e 414'`
  - `'periodo iniziale "normale" con la compagna che entra più tardi: una sola versione (la seconda sarebbe identica)'`
  - `'tre persone con ingressi scaglionati (seconda dal 2027-02-01, terza dal 2027-04-01): versioni 2026-12-01, 2027-03-01 e 2027-05-01; a marzo la terza ha quota 0'`
  - `'una persona già legata con in_casa_dal nel passato non crea versioni extra'`
  - `'le percentuali che non sommano a 100 lanciano'`
  - `'chi non è presente in una versione ha quota 0 e percentuale 0'`
Run: `npx vitest run tests/calculations/casa` Expected: FAIL.

- [ ] **Step 2: Implementare `parseImporto.ts`, `statoPiano.ts`, `pianoVersioni.ts`**

Regole di `buildPlanVersions` (i test le fissano per i casi sopra, questi sono i punti che non determinano):
1. `quotaDal(p)` = `partenza` se `p.inCasaDal` è nullo o `<= partenza`, altrimenti il mese successivo a `p.inCasaDal`.
2. Le date delle versioni sono `partenza` più ogni `quotaDal(p)` distinto, in ordine. Una persona è presente nella versione `V` se `quotaDal(p) <= V`.
3. Prima versione con più di una versione: se `periodoIniziale` è `tutto_a_chi_abita`, regola `personalizzata` con 100 ripartito in parti uguali fra i presenti (gli altri 0); se `percentuali`, regola `personalizzata` con quelle percentuali (devono sommare a 100, altrimenti lancia); se `normale`, la regola scelta calcolata su tutte le persone. Le versioni successive usano la regola scelta sui soli presenti (gli assenti hanno quota 0).
4. Una versione identica nelle quote per slot alla precedente è scartata.
5. `percentuale` valorizzata solo nelle versioni `personalizzata`; `redditoNettoMensile` nullo diventa 0; `inCasaDal` e `displayName` si copiano dalla persona.
Run: stesso comando, Expected: PASS.

- [ ] **Step 3: Test di `householdPlans.ts` (fallisce), poi implementazione**

- `'getPlanForMonth ritorna il piano con valido_dal massimo non oltre il mese, con voci per ordine e quote per slot'` (fakeDb con tre tabelle)
- `'getPlanForMonth ritorna il primo piano futuro se nessuno è ancora valido'` e `'ritorna null senza piani'`
- `'savePlan chiama save_household_plan con p_household e p_payload in snake_case'` con asserzione sul payload completo di una versione (`valido_dal: '2026-12-01'`, `giorno_versamento: 5`, `regola: 'proporzionale'`, `cuscinetto_obiettivo: 1321`, `cuscinetto_quota_mensile: 59`, `arrotondamento: 10`, `totale_mensile: 1380`, una voce `{ nome: 'Luce', categoria_nome: 'Luce', frequenza_mesi: 2, importo_ricorrenza: 110, origine_stima: 'suggerita', goal_id: null, stima_ignorata_con_n: null, ordine: 0 }` e una quota `{ slot: 1, display_name: 'Fabio', reddito_netto_mensile: 1800, reddito_irregolare: false, percentuale: null, in_casa_dal: null, esce_dal: null, quota_mensile: 777 }`) e ritorna gli id
- `'savePlan rilancia l\'errore dell\'RPC'`
Implementare `householdPlans.ts` (mappatura snake_case/camelCase come negli altri file di `src/lib/data`).

- [ ] **Step 4: Test dei componenti (falliscono)**

- `ComeSiCalcola.test.tsx`: `'è chiuso di default'`, `'il pulsante "Come si calcola?" mostra formula e ingredienti con i valori'`, `'un secondo tocco lo richiude'`, `'nessuna parola vietata'`.
- `PianoAttuale.test.tsx`: `'mostra la frase "Fabio versa 777 euro e Giulia 603 euro, entro il 5 di ogni mese."'`; `'con quote uguali mostra "Ognuno versa 690 euro entro il 5 di ogni mese."'`; `'mostra "Diventa attivo quando entra anche Giulia" se la posizione di Giulia non è legata'`; `'non mostra la bozza quando tutti sono legati'`; `'Come si calcola? del totale mostra spese comuni, cuscinetto e totale'`; `'Rivedi la quota chiama onRivedi'`; `'nessuna parola vietata'`.
- `QuotaWizard.test.tsx` (mock di `@/lib/data/householdPlans`, `@/lib/supabase/client`, `next/navigation`; `meseCorrente="2026-12-01"`, un membro Fabio legato, `meUserId` di Fabio):
  - `'parte dal passo 1 di 5 e Avanti porta al 2 di 5'`
  - `'il passo 1 chiede i redditi, "Aggiungi una persona" crea un segnaposto con nome e reddito e per ognuno "In casa dal"'`
  - `'con la spunta "il mio reddito cambia" l\'etichetta diventa "Reddito prudente" e compare la frase "Scrivi una cifra che incassi anche nei mesi magri..."'`
  - `'il passo 1 mostra "Il reddito che scrivi qui lo vede anche l\'altro."'`
  - `'il reddito di una persona legata a un altro membro è in sola lettura'`
  - `'il passo 2 mostra le voci tipiche con "= 55 al mese" per la luce e il totale al mese'`
  - `'cambiando l\'assicurazione a 96 l\'anno, il cuscinetto a 59 e i redditi a 1800 e 1400, il passo 4 mostra Totale da versare 1.380 € e le tre colonne: 690 e 690, 777 e 603, 890 e 490 con "Resta" 1.110 e 710, 1.023 e 797, 910 e 910'`
  - `'la colonna "Secondo il reddito" è selezionata di default e nessuna colonna è presentata come giusta'`
  - `'il passo 5 mostra "Fabio versa 777 euro e Giulia 603 euro, entro il 5 di ogni mese, da dicembre."'` e `'con parti uguali mostra "Ognuno versa 690 euro entro il 5 di ogni mese."'`
  - `'partenza non può essere prima di meseCorrente'` (le opzioni del mese partono da dicembre 2026)
  - `'Confermiamo chiama savePlan con le versioni di buildPlanVersions e poi onSaved'`
  - `'se la compagna è un segnaposto mostra "Diventa attivo quando entra anche Giulia"'`
  - `'con una sola persona (nessun segnaposto) il wizard calcola e salva con una quota'` (Review Focus 2)
  - `'redditi vuoti o negativi disabilitano Avanti e nel DOM non compare mai NaN'`; `'1800,5 è accettato'` (Review Focus 3)
  - `'se i membri non abitano tutti insieme compare "Per questo periodo" con le tre scelte e le percentuali che non sommano a 100 disabilitano Confermiamo'`
  - `'riparte dal piano attuale quando pianoAttuale è presente'`
  - `'un errore di salvataggio mostra "Salvataggio fallito, controlla la connessione e riprova."'`
  - `'nessuna parola vietata'` in ogni passo.
Run: `npx vitest run tests/ComeSiCalcola.test.tsx tests/PianoAttuale.test.tsx tests/QuotaWizard.test.tsx` Expected: FAIL.

- [ ] **Step 5: Implementare i componenti e le pagine**

- `ComeSiCalcola`: stato locale aperto o chiuso, pulsante con `aria-label="Come si calcola?"` (icona punto interrogativo), pannello con le righe di `formula` (separate da `\n`) e l'elenco `etichetta: valore` con `formatEuro`.
- `QuotaWizard`: cinque passi come in spec 8.3 (testi dei passi e delle frasi in spec 8.3 e 10); stato di bozza solo locale, nessuna scrittura prima di "Confermiamo"; persone iniziali dai membri (e dalle quote del `pianoAttuale` se presente, segnaposto compresi, `slot` nuovo = massimo esistente più 1); input `type="number"` con `inputMode="decimal"` come in `AccountRow`, valore letto con `parseImporto`; il mese di partenza propone da `meseCorrente` in avanti per 12 mesi, con nomi dei mesi da `date-fns/locale` `it`; al salvataggio `savePlan(supabase, householdId, buildPlanVersions(draft))` seguito da `onSaved()`. Valori iniziali del cuscinetto con `cuscinettoDefault` e opzione 1 o 2 mesi; "Sarà pieno tra circa N mesi" da `mesiAlPieno`.
- `PianoAttuale`: frase riassuntiva, stato bozza o attivo da `statoPiano` con il nome di chi manca (posizioni con quota maggiore di zero non legate), quote per persona con `ComeSiCalcola` (`spiegaQuotaPersona`), totale con `ComeSiCalcola` (`spiegaTotaleMensile`), pulsante "Rivedi la quota".
- `quota/page.tsx` (Server Component): utente, `getMyHousehold`, senza casa `redirect('/casa/inizia')`; `getPlanForMonth(supabase, casa.household.id, meseRomaISO())`; renderizza `<QuotaClient ... />`.
- `QuotaClient`: stato `modifica`; se esiste un piano e non si sta modificando mostra `PianoAttuale`, altrimenti `QuotaWizard`; `onSaved` fa `router.refresh()` e chiude la modifica.
- `CasaHome`: carta "La nostra quota" con il link a `/casa/quota` ("Calcolate la nostra quota" se non c'è piano; stato e totale se c'è); `casa/page.tsx` carica il piano con `getPlanForMonth` e lo passa a `CasaHome` come prop opzionale `piano?: PlanBundle | null` (aggiornare `tests/CasaHome.test.tsx` per i due casi).
Run: i test dello Step 4 e `npx vitest run tests/CasaHome.test.tsx` Expected: PASS.

- [ ] **Step 6: Aggiornare `docs/ROADMAP.md`**: nella riga "Stato" del blocco 1 aggiungere "Consegna 3 (la quota): fatta."

- [ ] **Step 7: Verifica, commit e push**

Run: `npm test` poi `npm run lint` poi `npx next build`. Controllo manuale in locale con la casa creata: il wizard percorre i cinque passi, il piano si salva come bozza con la compagna segnaposto, `/casa/quota` lo mostra con "Come si calcola?".
```bash
git add -A
git commit -m "feat: add the household quota wizard and plan saving"
git push origin master
```
Controllo di accettazione per Fabio (dopo il deploy): chi crea la casa conferma un piano in bozza; quando l'altra persona entra con il codice, vede il piano e questo risulta attivo.

---

## Self-review

**Copertura della spec (consegne 1 a 3).**
- 6.1 a 6.6 (colonne, tabelle, funzioni, RLS, trigger, migrazione, rollback commentato): T1.
- 6.7 (tipi, `Scope`, test statico con allowlist di `keepAlive.ts`, marcatore per le funzioni per id): T2. I file `transfers.ts`, `balanceChecks.ts`, `checkins.ts`, `calendarFeeds.ts` non sono in queste consegne (arrivano con T7, T11, T12, T8b).
- 7.1, 7.2, 7.10 per la quota (voci tipiche, mensilizzazione, cuscinetto, regole di divisione con `personalizzata`, spiegazioni della quota): T4. Il fuso `Europe/Rome` (13, 24): T4.
- 8.1, 8.2, 8.13 (navigazione, invito, ingresso, uscita, chiusura): T3. 8.3 (wizard in cinque schermate, versione di transizione, "Per questo periodo", bozza con segnaposto): T5.
- 11.1 punti 1 a 4 (test statico, recording, fakeDb, script SQL), 11.2 `quota`, `mensilizza`, `spiegazioni`, 11.3 data layer e componenti delle consegne 1 a 3: T1, T2, T3, T4, T5. `fakeRpcClient`: T2. Estensione di `fakeSupabase` con `.is()` come primo passo di T2: Step 1.
- Aggiornamento di `PRODUCT.md` (principio 3, Users, Capabilities) e `ROADMAP.md`: T3 e T5.
- Fuori ambito, volutamente: spese di casa, trasferimenti, riserva nel disponibile, promemoria, feed calendario, bollette, controlli (consegne 4 a 8). Lo schema SQL però li contiene già.

**Controllo dei passi.** Ogni test ha nome e asserzioni con i valori della spec (o con i valori divergenti dichiarati in "Divergenze"). I corpi di funzione compaiono solo per la migrazione (esatta per chi la esegue a mano) e per `buildPlanVersions` e `calcolaQuota`, i cui tie break i test non fissano.

**Coerenza dei tipi.** `Scope`, `PERSONALE`, `casa`, `applyScope`, `scopeHouseholdId` (T2) sono quelli usati dai test di T2; `CasaCorrente`, `getMyHousehold` (T3) sono consumati da T5; `Spiegazione`, `calcolaQuota`, `calcolaTotale`, `meseRomaISO`, `formatNumero` (T4) da T5; `PlanBundle`, `PlanVersionInput`, `statoPiano`, `buildPlanVersions` (T5) sono definiti solo in T5. I nomi dei parametri RPC (`p_nome`, `p_display_name`, `p_household`, `p_codice`, `p_payload`) coincidono con la migrazione.

**Proporzione.** Il corpo del piano è un elenco di firme, test e regole; il solo blocco lungo è l'SQL, richiesto esatto.

---

## Esecuzione

Il piano è pronto per l'esecuzione con **superpowers:subagent-driven-development**: un subagent per task, con revisione prima del successivo. Ordine obbligato: T1, poi la pausa per l'Azione di Fabio, poi T2, poi T3 e T4 (indipendenti fra loro dopo T2), infine T5.
