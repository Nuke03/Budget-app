-- 0009_supporto_e_notifiche.sql
-- Dopo la 0008. App di supporto: notifiche push, stato dei promemoria, spese stimate, saldo iniziale da Tricount.
-- Nuove tabelle: push_iscrizioni (una riga per dispositivo), promemoria_utente (una riga per utente).
-- Nuova colonna: transactions.stima (la spesa e una stima, non un importo reale).
-- transfers: la causale accetta anche 'saldo_iniziale' (il debito che i due coinquilini portano da Tricount).
-- record_saldo_iniziale (definer): lo registra una sola volta per casa, come sola registrazione, senza conti.
-- Idempotente: if not exists, create or replace, drop policy if exists, vincoli ricreati dal catalogo.
-- Rollback: in fondo al file.
begin;

-- =====================================================================
-- 1. TABELLE
-- =====================================================================

create table if not exists public.push_iscrizioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.promemoria_utente (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  notifiche_attive boolean,
  ultima_spese_il date,
  ultima_checkin_il date,
  ultimo_versamento_mese date,
  nessuna_spesa_fino_al date
);

create index if not exists push_iscrizioni_user_idx on public.push_iscrizioni (user_id);

-- =====================================================================
-- 2. RLS: ognuno vede e scrive solo le proprie righe
-- =====================================================================

alter table public.push_iscrizioni enable row level security;
alter table public.promemoria_utente enable row level security;

drop policy if exists push_iscrizioni_select on public.push_iscrizioni;
drop policy if exists push_iscrizioni_insert on public.push_iscrizioni;
drop policy if exists push_iscrizioni_update on public.push_iscrizioni;
drop policy if exists push_iscrizioni_delete on public.push_iscrizioni;
create policy push_iscrizioni_select on public.push_iscrizioni for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_iscrizioni_insert on public.push_iscrizioni for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy push_iscrizioni_update on public.push_iscrizioni for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_iscrizioni_delete on public.push_iscrizioni for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists promemoria_utente_select on public.promemoria_utente;
drop policy if exists promemoria_utente_insert on public.promemoria_utente;
drop policy if exists promemoria_utente_update on public.promemoria_utente;
drop policy if exists promemoria_utente_delete on public.promemoria_utente;
create policy promemoria_utente_select on public.promemoria_utente for select to authenticated
  using (user_id = (select auth.uid()));
create policy promemoria_utente_insert on public.promemoria_utente for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy promemoria_utente_update on public.promemoria_utente for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy promemoria_utente_delete on public.promemoria_utente for delete to authenticated
  using (user_id = (select auth.uid()));

-- =====================================================================
-- 3. COLONNA stima
-- =====================================================================

alter table public.transactions add column if not exists stima boolean not null default false;

-- =====================================================================
-- 4. transfers: causale 'saldo_iniziale'
-- I vincoli della 0004 non hanno un nome scelto da noi: si cercano nel catalogo per contenuto
-- (la lista delle causali, e i due vincoli su per_conto_di_user_id), poi si ricreano con nome fisso.
-- =====================================================================

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.transfers'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) like '%rimborso%'
        or pg_get_constraintdef(oid) like '%per_conto_di_user_id%')
  loop
    execute format('alter table public.transfers drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.transfers
  add constraint transfers_causale_check
  check (causale in ('versamento', 'rimborso', 'restituzione', 'altro', 'saldo_iniziale'));
alter table public.transfers
  add constraint transfers_per_conto_causale_check
  check (per_conto_di_user_id is null or causale in ('versamento', 'restituzione', 'saldo_iniziale'));
alter table public.transfers
  add constraint transfers_per_conto_beneficiario_check
  check (per_conto_di_user_id is null or beneficiario_user_id is null or causale in ('restituzione', 'saldo_iniziale'));

-- al massimo un saldo iniziale per casa (regge anche due richieste in contemporanea)
create unique index if not exists transfers_un_saldo_iniziale
  on public.transfers (household_id) where causale = 'saldo_iniziale';

-- =====================================================================
-- 5. FUNZIONE record_saldo_iniziale
-- p_creditore anticipa piu di quanto gli spetta, p_debitore gli deve p_importo (dato di Tricount).
-- =====================================================================

create or replace function public.record_saldo_iniziale(
  p_household uuid,
  p_creditore uuid,
  p_debitore uuid,
  p_importo numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  v_id uuid;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  if p_household is null or p_creditore is null or p_debitore is null then
    raise exception 'dati mancanti';
  end if;
  if p_importo is null or p_importo <= 0 then raise exception 'importo non valido'; end if;
  if p_creditore = p_debitore then raise exception 'persone uguali'; end if;
  if not public._casa_membro_attivo(p_household, uid) then raise exception 'casa non valida'; end if;
  if not public._casa_membro_attivo(p_household, p_creditore)
     or not public._casa_membro_attivo(p_household, p_debitore) then
    raise exception 'membro non valido';
  end if;
  if exists (select 1 from public.transfers
             where household_id = p_household and causale = 'saldo_iniziale') then
    raise exception 'saldo iniziale gia registrato';
  end if;

  insert into public.transfers (
    household_id, user_id, da_account_id, a_account_id, importo, data, causale,
    beneficiario_user_id, per_conto_di_user_id, solo_registrazione)
  values (
    p_household, uid, null, null, p_importo, (now() at time zone 'Europe/Rome')::date, 'saldo_iniziale',
    p_creditore, p_debitore, true)
  returning id into v_id;

  return v_id;
end $$;

revoke execute on function public.record_saldo_iniziale(uuid, uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.record_saldo_iniziale(uuid, uuid, uuid, numeric) to authenticated;

commit;

-- ROLLBACK (solo se serve; prima eliminare eventuali righe transfers con causale 'saldo_iniziale'):
-- drop function if exists public.record_saldo_iniziale(uuid, uuid, uuid, numeric);
-- drop index if exists public.transfers_un_saldo_iniziale;
-- alter table public.transfers drop constraint if exists transfers_causale_check;
-- alter table public.transfers drop constraint if exists transfers_per_conto_causale_check;
-- alter table public.transfers drop constraint if exists transfers_per_conto_beneficiario_check;
-- alter table public.transfers add check (causale in ('versamento', 'rimborso', 'restituzione', 'altro'));
-- alter table public.transfers add check (per_conto_di_user_id is null or causale in ('versamento', 'restituzione'));
-- alter table public.transfers add check (per_conto_di_user_id is null or beneficiario_user_id is null or causale = 'restituzione');
-- alter table public.transactions drop column if exists stima;
-- drop table if exists public.promemoria_utente;
-- drop table if exists public.push_iscrizioni;
