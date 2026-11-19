-- 0011_percorso.sql
-- Dopo la 0010. Base dati del percorso di apprendimento personale e di "Ricomincia da zero".
-- Nuove colonne: accounts.archiviato, categories.ruolo ('certa', 'svago'), budget_goals.ruolo ('imprevisti').
-- Un solo obiettivo 'imprevisti' aperto e personale per utente (indice unico parziale).
-- Nuove tabelle: percorso_utente, percorso_lezioni, percorso_avvisi, lista_attesa (RLS: solo le proprie righe).
-- Due funzioni:
--   crea_categorie_iniziali (security invoker: le 11 categorie di partenza, solo se non ne hai già) e
--   ricomincia_da_zero (security definer, come record_transfer: authenticated non può cancellare da transfers
--   e deve vedere TUTTE le righe della Casa per sapere cosa è referenziato. Ogni istruzione è filtrata
--   da user_id = auth.uid(); cancella solo dati personali, la Casa non si tocca mai).
-- Idempotente: if not exists, create or replace, drop policy if exists, revoke/grant.
-- Rollback: in fondo al file.
begin;

-- =====================================================================
-- 1. COLONNE NUOVE
-- =====================================================================

alter table public.accounts add column if not exists archiviato boolean not null default false;
alter table public.categories add column if not exists ruolo text check (ruolo in ('certa', 'svago'));
alter table public.budget_goals add column if not exists ruolo text check (ruolo in ('imprevisti'));

-- un solo obiettivo imprevisti aperto e personale per utente
create unique index if not exists budget_goals_un_imprevisti
  on public.budget_goals (user_id) where ruolo = 'imprevisti' and stato = 'aperto' and household_id is null;

-- =====================================================================
-- 2. TABELLE
-- =====================================================================

create table if not exists public.percorso_utente (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  entrate_tipo text check (entrate_tipo in ('fisse', 'irregolari', 'piva')),
  entrata_attesa numeric,
  entrata_attesa_il date,
  reddito_base numeric,
  settimana_dal date,
  settimana_fatta_il date,
  spese_certe_nessuna boolean not null default false,
  obiettivo_piu_avanti boolean not null default false,
  nascosti boolean not null default false,
  ultima_proposta_il date
);

create table if not exists public.percorso_lezioni (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lezione text not null,
  vista_il date,
  rimandata_al date,
  azione_il date,
  proposta_il date,
  primary key (user_id, lezione)
);

create table if not exists public.percorso_avvisi (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  risposta text check (risposta in ('imprevisto', 'normale', 'visto')),
  creato_il timestamptz not null default now()
);

create table if not exists public.lista_attesa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  importo numeric not null check (importo > 0),
  aggiunto_il date not null,
  rivedi_il date not null,
  stato text not null default 'in_attesa' check (stato in ('in_attesa', 'voluto', 'non_piu'))
);

-- =====================================================================
-- 3. RLS: ognuno vede e scrive solo le proprie righe
-- =====================================================================

alter table public.percorso_utente enable row level security;
alter table public.percorso_lezioni enable row level security;
alter table public.percorso_avvisi enable row level security;
alter table public.lista_attesa enable row level security;

drop policy if exists percorso_utente_proprie on public.percorso_utente;
create policy percorso_utente_proprie on public.percorso_utente for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists percorso_lezioni_proprie on public.percorso_lezioni;
create policy percorso_lezioni_proprie on public.percorso_lezioni for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists percorso_avvisi_proprie on public.percorso_avvisi;
create policy percorso_avvisi_proprie on public.percorso_avvisi for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists lista_attesa_proprie on public.lista_attesa;
create policy lista_attesa_proprie on public.lista_attesa for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- 4. crea_categorie_iniziali: le 11 categorie di partenza
-- Non fa niente se l'utente ha già una categoria personale non archiviata. Torna quante ne ha create.
-- =====================================================================

create or replace function public.crea_categorie_iniziali()
returns int language plpgsql security invoker set search_path = public as $$
declare
  v_me uuid := auth.uid();
  n int;
begin
  if v_me is null then raise exception 'utente non valido'; end if;
  if exists (
    select 1 from public.categories where user_id = v_me and household_id is null and not archiviata
  ) then return 0; end if;
  insert into public.categories (user_id, nome, tipo, ruolo)
  values
    (v_me, 'Spesa', 'expense', null),
    (v_me, 'Bar e ristoranti', 'expense', null),
    (v_me, 'Trasporti', 'expense', null),
    (v_me, 'Auto', 'expense', 'certa'),
    (v_me, 'Casa', 'expense', null),
    (v_me, 'Salute', 'expense', null),
    (v_me, 'Abbonamenti', 'expense', 'certa'),
    (v_me, 'Svago e acquisti', 'expense', 'svago'),
    (v_me, 'Regali', 'expense', null),
    (v_me, 'Altro', 'expense', null),
    (v_me, 'Entrate', 'income', null);
  get diagnostics n = row_count;
  return n;
end $$;

-- =====================================================================
-- 5. ricomincia_da_zero: cancella i dati personali, in una sola transazione
-- La Casa non si tocca: mai un delete di righe con household_id, mai un set null su righe della Casa.
-- Un conto, un obiettivo o una categoria personale a cui punta una riga della Casa non si cancella:
-- il conto si archivia (fuori dal disponibile, saldo a zero), l'obiettivo si chiude, la categoria si archivia.
-- =====================================================================

create or replace function public.ricomincia_da_zero()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'non autenticato'; end if;

  -- 1. il percorso
  delete from public.percorso_avvisi where user_id = v_me;
  delete from public.percorso_lezioni where user_id = v_me;
  delete from public.percorso_utente where user_id = v_me;
  delete from public.lista_attesa where user_id = v_me;

  -- 2. la P.IVA (solo personale)
  delete from public.piva_scadenze where user_id = v_me;
  delete from public.piva_accantonamenti where user_id = v_me;
  delete from public.piva_fatture where user_id = v_me;
  delete from public.piva_settings where user_id = v_me;

  -- 3. spostamenti e movimenti personali
  delete from public.transfers where user_id = v_me and household_id is null;
  delete from public.transactions where user_id = v_me and household_id is null;

  -- 4. conti personali: si cancellano quelli a cui la Casa non punta (transfers e balance_checks sono restrict)
  delete from public.accounts a
  where a.user_id = v_me and a.household_id is null
    and not exists (select 1 from public.transactions t where t.household_id is not null and t.account_id = a.id)
    and not exists (select 1 from public.transfers x
                    where x.household_id is not null and (x.da_account_id = a.id or x.a_account_id = a.id))
    and not exists (select 1 from public.balance_checks b where b.household_id is not null and b.account_id = a.id);
  -- quelli che restano sono usati dalla Casa: si archiviano
  update public.accounts
  set archiviato = true, conta_in_disponibile = false, saldo_attuale = 0
  where user_id = v_me and household_id is null;

  -- 5. obiettivi personali: stessa regola
  delete from public.budget_goals g
  where g.user_id = v_me and g.household_id is null
    and not exists (select 1 from public.transactions t where t.household_id is not null and t.goal_id = g.id)
    and not exists (select 1 from public.household_plan_items i where i.goal_id = g.id)
    and not exists (select 1 from public.household_checkins c where c.household_id is not null and c.goal_id = g.id);
  update public.budget_goals
  set stato = 'chiuso'
  where user_id = v_me and household_id is null;

  -- 6. categorie personali: stessa regola (anche un obiettivo rimasto può puntarci)
  delete from public.categories c
  where c.user_id = v_me and c.household_id is null
    and not exists (select 1 from public.transactions t where t.household_id is not null and t.categoria_id = c.id)
    and not exists (select 1 from public.household_plan_items i where i.categoria_id = c.id)
    and not exists (select 1 from public.budget_goals g where g.categoria_id = c.id);
  update public.categories
  set archiviata = true
  where user_id = v_me and household_id is null;

  -- 7. le categorie di partenza
  perform public.crea_categorie_iniziali();
end $$;

-- =====================================================================
-- 6. GRANT: solo gli utenti autenticati eseguono le funzioni
-- =====================================================================

revoke execute on function public.crea_categorie_iniziali() from public, anon, authenticated;
grant execute on function public.crea_categorie_iniziali() to authenticated;
revoke all on function public.ricomincia_da_zero() from public, anon;
grant execute on function public.ricomincia_da_zero() to authenticated;

commit;

-- ROLLBACK (solo se serve; perde il percorso, la lista d'attesa e i ruoli):
-- drop function if exists public.ricomincia_da_zero();
-- drop function if exists public.crea_categorie_iniziali();
-- drop table if exists public.lista_attesa;
-- drop table if exists public.percorso_avvisi;
-- drop table if exists public.percorso_lezioni;
-- drop table if exists public.percorso_utente;
-- drop index if exists public.budget_goals_un_imprevisti;
-- alter table public.budget_goals drop column if exists ruolo;
-- alter table public.categories drop column if exists ruolo;
-- alter table public.accounts drop column if exists archiviato;
