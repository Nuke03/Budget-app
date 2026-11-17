-- 0010_piva_guidata.sql
-- Dopo la 0009. Base dati della P.IVA guidata: conto tasse, fatture, spostamenti nel vaso, scadenze.
-- Nuove tabelle: piva_fatture, piva_accantonamenti, piva_scadenze (RLS: solo le righe di chi le possiede).
-- Nuove colonne: piva_settings (conto tasse, preset, stipendio, mese magro), promemoria_utente.ultima_scadenza_avvisata.
-- Sei funzioni RPC, tutte security invoker (la RLS resta il giudice): crea_movimento (aggiunta atomica di un
-- movimento e del saldo, per tutti i moduli), crea_fattura, incassa_fattura, accantona_tasse,
-- annulla_accantonamento, paga_scadenza. Le RPC della P.IVA rifiutano i conti e le categorie della casa.
-- Trigger piva_su_elimina_movimento: se si elimina un movimento, fattura e scadenza collegate tornano aperte.
-- Idempotente: if not exists, create or replace, drop policy/trigger if exists, revoke/grant.
-- Rollback: in fondo al file.
begin;

-- =====================================================================
-- 1. COLONNE NUOVE
-- =====================================================================

alter table public.piva_settings add column if not exists conto_tasse_id uuid references public.accounts(id) on delete set null;
alter table public.piva_settings add column if not exists preset text check (preset in ('enpap', 'altro'));
alter table public.piva_settings add column if not exists guidata_dal date;
alter table public.piva_settings add column if not exists stipendio_mensile numeric check (stipendio_mensile > 0);
alter table public.piva_settings add column if not exists stipendio_rivisto_il date;
alter table public.piva_settings add column if not exists incasso_mese_magro numeric check (incasso_mese_magro >= 0);

alter table public.promemoria_utente add column if not exists ultima_scadenza_avvisata uuid;

-- =====================================================================
-- 2. TABELLE
-- =====================================================================

create table if not exists public.piva_fatture (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente text not null,
  importo numeric not null check (importo > 0),
  data_emissione date not null,
  data_incasso date,
  transaction_id uuid references public.transactions(id) on delete set null,
  nota text,
  created_at timestamptz not null default now()
);

create table if not exists public.piva_accantonamenti (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  importo numeric not null check (importo > 0),
  data date not null,
  da_account_id uuid references public.accounts(id) on delete set null,
  a_account_id uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists piva_accantonamenti_user_data_idx on public.piva_accantonamenti (user_id, data);

-- una quota si sposta una volta sola per incasso (regge anche due richieste in contemporanea)
create unique index if not exists piva_accantonamenti_un_incasso
  on public.piva_accantonamenti (transaction_id) where transaction_id is not null;

create table if not exists public.piva_scadenze (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  anno int not null,
  chiave text not null check (chiave in ('f24_giugno', 'f24_novembre', 'cassa_acconto', 'cassa_saldo')),
  tipo text not null check (tipo in ('f24', 'cassa')),
  descrizione text not null,
  data date not null,
  importo numeric check (importo > 0),
  pagata_il date,
  transaction_id uuid references public.transactions(id) on delete set null,
  nascosta boolean not null default false,
  unique (user_id, anno, chiave)
);

-- =====================================================================
-- 3. RLS: ognuno vede e scrive solo le proprie righe
-- =====================================================================

alter table public.piva_fatture enable row level security;
alter table public.piva_accantonamenti enable row level security;
alter table public.piva_scadenze enable row level security;

drop policy if exists piva_fatture_select on public.piva_fatture;
drop policy if exists piva_fatture_insert on public.piva_fatture;
drop policy if exists piva_fatture_update on public.piva_fatture;
drop policy if exists piva_fatture_delete on public.piva_fatture;
create policy piva_fatture_select on public.piva_fatture for select to authenticated
  using (user_id = (select auth.uid()));
create policy piva_fatture_insert on public.piva_fatture for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy piva_fatture_update on public.piva_fatture for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy piva_fatture_delete on public.piva_fatture for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists piva_accantonamenti_select on public.piva_accantonamenti;
drop policy if exists piva_accantonamenti_insert on public.piva_accantonamenti;
drop policy if exists piva_accantonamenti_update on public.piva_accantonamenti;
drop policy if exists piva_accantonamenti_delete on public.piva_accantonamenti;
create policy piva_accantonamenti_select on public.piva_accantonamenti for select to authenticated
  using (user_id = (select auth.uid()));
create policy piva_accantonamenti_insert on public.piva_accantonamenti for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy piva_accantonamenti_update on public.piva_accantonamenti for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy piva_accantonamenti_delete on public.piva_accantonamenti for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists piva_scadenze_select on public.piva_scadenze;
drop policy if exists piva_scadenze_insert on public.piva_scadenze;
drop policy if exists piva_scadenze_update on public.piva_scadenze;
drop policy if exists piva_scadenze_delete on public.piva_scadenze;
create policy piva_scadenze_select on public.piva_scadenze for select to authenticated
  using (user_id = (select auth.uid()));
create policy piva_scadenze_insert on public.piva_scadenze for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy piva_scadenze_update on public.piva_scadenze for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy piva_scadenze_delete on public.piva_scadenze for delete to authenticated
  using (user_id = (select auth.uid()));

-- =====================================================================
-- 4. crea_movimento: movimento e saldo del conto in una sola operazione
-- Vale anche per la casa: i trigger e i vincoli di transactions restano i giudici. Con security invoker
-- l update del saldo di un conto non visibile tocca 0 righe, e allora si annulla tutto.
-- =====================================================================

create or replace function public.crea_movimento(
  p_tipo text, p_importo numeric, p_data date, p_categoria uuid, p_account uuid, p_goal uuid,
  p_descrizione text, p_nota text, p_household uuid, p_pagata_da uuid, p_stima boolean
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  if p_tipo is null or p_tipo not in ('expense', 'income') then raise exception 'tipo non valido'; end if;
  if p_importo is null or p_importo <= 0 then raise exception 'importo non valido'; end if;
  if p_data is null then raise exception 'data non valida'; end if;
  insert into public.transactions (
    tipo, importo, data, categoria_id, account_id, goal_id, descrizione, nota, household_id, stima, pagata_da_user_id)
  values (
    p_tipo, p_importo, p_data, p_categoria, p_account, p_goal, coalesce(p_descrizione, ''), p_nota, p_household,
    coalesce(p_stima, false), case when p_household is not null then p_pagata_da else null end)
  returning id into v_id;
  if p_account is not null then
    update public.accounts
    set saldo_attuale = saldo_attuale + case when p_tipo = 'income' then p_importo else -p_importo end
    where id = p_account;
    if not found then raise exception 'conto non valido'; end if;
  end if;
  return v_id;
end $$;

-- =====================================================================
-- 5. incassa_fattura: la fattura si incassa una volta sola, con entrata e saldo
-- =====================================================================

create or replace function public.incassa_fattura(
  p_fattura uuid, p_data date, p_account uuid, p_categoria uuid
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  f public.piva_fatture%rowtype;
  a public.accounts%rowtype;
  v_tx uuid;
begin
  if p_data is null then raise exception 'data non valida'; end if;
  select * into f from public.piva_fatture where id = p_fattura for update;
  if not found then raise exception 'fattura non valida'; end if;
  if f.data_incasso is not null then raise exception 'fattura già incassata'; end if;
  select * into a from public.accounts where id = p_account for update;
  if not found or a.household_id is not null then raise exception 'conto non valido'; end if;
  if p_categoria is not null and not exists (
    select 1 from public.categories where id = p_categoria and household_id is null and tipo = 'income'
  ) then raise exception 'categoria non valida'; end if;
  insert into public.transactions (tipo, importo, data, categoria_id, account_id, descrizione)
  values ('income', f.importo, p_data, p_categoria, a.id, 'Fattura ' || f.cliente)
  returning id into v_tx;
  update public.accounts set saldo_attuale = saldo_attuale + f.importo where id = a.id;
  update public.piva_fatture set data_incasso = p_data, transaction_id = v_tx where id = f.id;
  return v_tx;
end $$;

-- =====================================================================
-- 6. crea_fattura: con un conto la fattura nasce già incassata, alla data di emissione
-- =====================================================================

create or replace function public.crea_fattura(
  p_cliente text, p_importo numeric, p_data_emissione date, p_nota text,
  p_incassa_account uuid default null, p_categoria uuid default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  if nullif(btrim(p_cliente), '') is null then raise exception 'cliente mancante'; end if;
  if p_importo is null or p_importo <= 0 then raise exception 'importo non valido'; end if;
  if p_data_emissione is null then raise exception 'data non valida'; end if;
  if p_incassa_account is not null then
    if not exists (select 1 from public.accounts where id = p_incassa_account)
       or exists (select 1 from public.accounts where id = p_incassa_account and household_id is not null) then
      raise exception 'conto non valido';
    end if;
  end if;
  insert into public.piva_fatture (cliente, importo, data_emissione, nota)
  values (btrim(p_cliente), p_importo, p_data_emissione, p_nota)
  returning id into v_id;
  if p_incassa_account is not null then
    perform public.incassa_fattura(v_id, p_data_emissione, p_incassa_account, p_categoria);
  end if;
  return v_id;
end $$;

-- =====================================================================
-- 7. accantona_tasse: sposta la quota dal conto di partenza al conto tasse e la registra
-- =====================================================================

create or replace function public.accantona_tasse(
  p_importo numeric, p_data date, p_da_account uuid, p_a_account uuid, p_transaction uuid default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  n int;
  v_id uuid;
begin
  if p_importo is null or p_importo <= 0 then raise exception 'importo non valido'; end if;
  if p_data is null then raise exception 'data non valida'; end if;
  if p_da_account is null or p_a_account is null or p_da_account = p_a_account then
    raise exception 'conto non valido';
  end if;
  -- blocco in ordine di id: due spostamenti opposti in contemporanea non si incrociano
  select count(*) into n from (
    select id from public.accounts where id in (p_da_account, p_a_account) order by id for update
  ) s;
  if n <> 2 then raise exception 'conto non valido'; end if;
  if exists (
    select 1 from public.accounts where id in (p_da_account, p_a_account) and household_id is not null
  ) then raise exception 'conto non valido'; end if;
  if p_transaction is not null then
    if not exists (
      select 1 from public.transactions
      where id = p_transaction and user_id = (select auth.uid()) and tipo = 'income' and household_id is null
    ) then raise exception 'movimento non valido'; end if;
    if exists (select 1 from public.piva_accantonamenti where transaction_id = p_transaction) then
      raise exception 'quota già spostata';
    end if;
  end if;
  update public.accounts set saldo_attuale = saldo_attuale - p_importo where id = p_da_account;
  update public.accounts set saldo_attuale = saldo_attuale + p_importo where id = p_a_account;
  insert into public.piva_accantonamenti (transaction_id, importo, data, da_account_id, a_account_id)
  values (p_transaction, p_importo, p_data, p_da_account, p_a_account)
  returning id into v_id;
  return v_id;
end $$;

-- =====================================================================
-- 8. annulla_accantonamento: cancella la riga e riporta i saldi; torna le righe cancellate
-- =====================================================================

create or replace function public.annulla_accantonamento(p_id uuid)
returns int language plpgsql security invoker set search_path = public as $$
declare
  r public.piva_accantonamenti%rowtype;
  n int;
begin
  delete from public.piva_accantonamenti where id = p_id returning * into r;
  get diagnostics n = row_count;
  if n = 0 then return 0; end if;
  perform 1 from public.accounts
  where id in (r.da_account_id, r.a_account_id) order by id for update;
  if r.da_account_id is not null then
    update public.accounts set saldo_attuale = saldo_attuale + r.importo where id = r.da_account_id;
  end if;
  if r.a_account_id is not null then
    update public.accounts set saldo_attuale = saldo_attuale - r.importo where id = r.a_account_id;
  end if;
  return n;
end $$;

-- =====================================================================
-- 9. paga_scadenza: uscita dal conto, saldo e chiusura della scadenza
-- =====================================================================

create or replace function public.paga_scadenza(
  p_scadenza uuid, p_importo numeric, p_data date, p_account uuid
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  s public.piva_scadenze%rowtype;
  a public.accounts%rowtype;
  v_cat uuid;
  v_tx uuid;
begin
  if p_importo is null or p_importo <= 0 then raise exception 'importo non valido'; end if;
  if p_data is null then raise exception 'data non valida'; end if;
  select * into s from public.piva_scadenze where id = p_scadenza for update;
  if not found then raise exception 'scadenza non valida'; end if;
  if s.pagata_il is not null then raise exception 'scadenza già pagata'; end if;
  select * into a from public.accounts where id = p_account for update;
  if not found or a.household_id is not null then raise exception 'conto non valido'; end if;
  perform pg_advisory_xact_lock(hashtext((select auth.uid())::text || 'tasse'));
  select id into v_cat from public.categories
  where user_id = (select auth.uid()) and household_id is null and tipo = 'expense' and nome = 'Tasse e contributi'
    and not archiviata
  limit 1;
  if v_cat is null then
    insert into public.categories (nome, tipo) values ('Tasse e contributi', 'expense') returning id into v_cat;
  end if;
  insert into public.transactions (tipo, importo, data, categoria_id, account_id, descrizione)
  values ('expense', p_importo, p_data, v_cat, a.id, s.descrizione)
  returning id into v_tx;
  update public.accounts set saldo_attuale = saldo_attuale - p_importo where id = a.id;
  update public.piva_scadenze set importo = p_importo, pagata_il = p_data, transaction_id = v_tx where id = s.id;
  return v_tx;
end $$;

-- =====================================================================
-- 10. Trigger: eliminare il movimento riapre la fattura o la scadenza collegata
-- Lo spostamento nel vaso resta (in banca è avvenuto) ma perde il collegamento: lo fa la FK on delete set null.
-- =====================================================================

create or replace function public.piva_su_elimina_movimento()
returns trigger language plpgsql set search_path = public as $$
begin
  update public.piva_fatture set data_incasso = null, transaction_id = null where transaction_id = old.id;
  update public.piva_scadenze set pagata_il = null, transaction_id = null where transaction_id = old.id;
  return old;
end $$;

drop trigger if exists piva_su_elimina_movimento on public.transactions;
create trigger piva_su_elimina_movimento before delete on public.transactions
  for each row execute function public.piva_su_elimina_movimento();

-- =====================================================================
-- 11. GRANT: solo gli utenti autenticati eseguono le RPC
-- =====================================================================

revoke execute on function public.crea_movimento(text, numeric, date, uuid, uuid, uuid, text, text, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.crea_movimento(text, numeric, date, uuid, uuid, uuid, text, text, uuid, uuid, boolean) to authenticated;
revoke execute on function public.crea_fattura(text, numeric, date, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.crea_fattura(text, numeric, date, text, uuid, uuid) to authenticated;
revoke execute on function public.incassa_fattura(uuid, date, uuid, uuid) from public, anon, authenticated;
grant execute on function public.incassa_fattura(uuid, date, uuid, uuid) to authenticated;
revoke execute on function public.accantona_tasse(numeric, date, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.accantona_tasse(numeric, date, uuid, uuid, uuid) to authenticated;
revoke execute on function public.annulla_accantonamento(uuid) from public, anon, authenticated;
grant execute on function public.annulla_accantonamento(uuid) to authenticated;
revoke execute on function public.paga_scadenza(uuid, numeric, date, uuid) from public, anon, authenticated;
grant execute on function public.paga_scadenza(uuid, numeric, date, uuid) to authenticated;

commit;

-- ROLLBACK (solo se serve; perde fatture, spostamenti e scadenze):
-- drop trigger if exists piva_su_elimina_movimento on public.transactions;
-- drop function if exists public.piva_su_elimina_movimento();
-- drop function if exists public.paga_scadenza(uuid, numeric, date, uuid);
-- drop function if exists public.annulla_accantonamento(uuid);
-- drop function if exists public.accantona_tasse(numeric, date, uuid, uuid, uuid);
-- drop function if exists public.incassa_fattura(uuid, date, uuid, uuid);
-- drop function if exists public.crea_fattura(text, numeric, date, text, uuid, uuid);
-- drop function if exists public.crea_movimento(text, numeric, date, uuid, uuid, uuid, text, text, uuid, uuid, boolean);
-- drop table if exists public.piva_scadenze;
-- drop table if exists public.piva_accantonamenti;
-- drop table if exists public.piva_fatture;
-- alter table public.promemoria_utente drop column if exists ultima_scadenza_avvisata;
-- alter table public.piva_settings drop column if exists conto_tasse_id, drop column if exists preset,
--   drop column if exists guidata_dal, drop column if exists stipendio_mensile,
--   drop column if exists stipendio_rivisto_il, drop column if exists incasso_mese_magro;
