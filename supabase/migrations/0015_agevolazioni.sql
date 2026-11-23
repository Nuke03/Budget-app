-- 0015_agevolazioni.sql
-- Dopo la 0014. Agevolazioni e scadenze: la situazione di chi usa l'app e lo stato delle voci.
--   agevolazioni_situazione: una riga per utente (ISEE, data della DSU, comune, affitto, studente).
--   agevolazioni_stati: per utente e voce, "fatto" o "non-mi-riguarda", con la data.
--   Trigger agevolazioni_situazione_controlli: la data della DSU non è dopo oggi (Roma, _casa_oggi della 0004).
--   RLS: solo il proprietario, mai visibile in Casa.
--   ricomincia_da_zero (create or replace dalla 0013, stessi grant): cancella anche le due tabelle di chi chiama.
-- Lanciare a mano, una volta. Idempotente: create table if not exists, drop policy/trigger if exists.
-- Rollback: in fondo al file.
begin;

-- =====================================================================
-- 1. Tabelle
-- =====================================================================

create table if not exists public.agevolazioni_situazione (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  isee numeric(10,2) null check (isee >= 0 and isee < 1000000),
  dsu_data date null,
  comune text null check (char_length(comune) <= 80),
  in_affitto boolean null,
  studente boolean null,
  aggiornata_il timestamptz not null default now(),
  sezione_aperta_il date null
);

create table if not exists public.agevolazioni_stati (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  voce_id text not null check (char_length(voce_id) <= 40),
  stato text not null check (stato in ('fatto', 'non-mi-riguarda')),
  il date not null,
  primary key (user_id, voce_id)
);

-- =====================================================================
-- 2. RLS: solo il proprietario
-- =====================================================================

alter table public.agevolazioni_situazione enable row level security;
drop policy if exists agevolazioni_situazione_proprie on public.agevolazioni_situazione;
create policy agevolazioni_situazione_proprie on public.agevolazioni_situazione for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.agevolazioni_stati enable row level security;
drop policy if exists agevolazioni_stati_proprie on public.agevolazioni_stati;
create policy agevolazioni_stati_proprie on public.agevolazioni_stati for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- =====================================================================
-- 3. dsu_data: non dopo oggi
-- =====================================================================

create or replace function public.agevolazioni_situazione_controlli()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.dsu_data is not null and new.dsu_data > public._casa_oggi() then
    raise exception 'data della DSU non valida';
  end if;
  return new;
end $$;

drop trigger if exists agevolazioni_situazione_controlli on public.agevolazioni_situazione;
create trigger agevolazioni_situazione_controlli before insert or update on public.agevolazioni_situazione
  for each row execute function public.agevolazioni_situazione_controlli();

-- =====================================================================
-- 4. ricomincia_da_zero: cancella anche la situazione e gli stati delle agevolazioni
-- Come nella 0013 (security definer, la Casa non si tocca, ogni istruzione è filtrata da v_me, crea_categorie_iniziali per ultima).
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
  delete from public.piva_quote_scartate where user_id = v_me;
  delete from public.piva_scadenze where user_id = v_me;
  delete from public.piva_accantonamenti where user_id = v_me;
  delete from public.piva_fatture where user_id = v_me;
  delete from public.piva_settings where user_id = v_me;

  -- 2b. le agevolazioni (solo personali)
  delete from public.agevolazioni_stati where user_id = v_me;
  delete from public.agevolazioni_situazione where user_id = v_me;

  -- 3. rientri, spostamenti, versamenti degli obiettivi, trasferimenti e movimenti personali
  delete from public.rientri where user_id = v_me and household_id is null;
  delete from public.spostamenti where user_id = v_me;
  delete from public.goal_versamenti where user_id = v_me;
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

revoke all on function public.ricomincia_da_zero() from public, anon;
grant execute on function public.ricomincia_da_zero() to authenticated;

commit;

-- ROLLBACK (solo se serve; perde situazione e stati delle agevolazioni):
-- drop table if exists public.agevolazioni_stati;
-- drop trigger if exists agevolazioni_situazione_controlli on public.agevolazioni_situazione;
-- drop table if exists public.agevolazioni_situazione;
-- drop function if exists public.agevolazioni_situazione_controlli();
-- ricomincia_da_zero si riporta alla versione precedente rieseguendo la sua definizione dalla 0013.
