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
-- Security definer: le tabelle del piano non sono scrivibili dal client (vedi revoke in sezione 5).
-- L'identita viene solo da auth.uid(); la scrittura richiede una casa non archiviata con un
-- membro attivo (is_household_writer), prima di ogni altro controllo.
create or replace function public.save_household_plan(p_household uuid, p_payload jsonb)
returns uuid[] language plpgsql security definer set search_path = public as $$
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

-- il piano si scrive solo tramite save_household_plan (security definer): dal client resta lettura
revoke insert, update, delete, truncate on table
  public.household_plans, public.household_plan_items, public.household_plan_shares
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
