-- 0013_rientri_spostamenti.sql
-- Dopo la 0012. Base dati dei rientri (rate automatiche verso un obiettivo o un conto) e di "Sposta tra i tuoi conti".
-- Tabelle nuove: rientri (personali o di casa), spostamenti (solo personali). RLS attiva su entrambe.
-- Funzioni nuove, tutte security invoker (la RLS resta il giudice): sposta_soldi, annulla_spostamento.
--   Entrambe lavorano solo su conti personali di chi chiama: non si fidano della sola visibilità.
-- Funzione sostituita (create or replace, stessa firma e stessi grant): ricomincia_da_zero
--   (cancella anche i rientri personali e gli spostamenti di chi la chiama, prima dei conti).
-- Tre difese: piva_quote_scartate accetta solo incassi di chi scrive, adjust_account_balance non è più
--   eseguibile dal client (nessuna funzione SQL e nessun codice dell'app la chiama), indice per le letture per data
--   dei versamenti degli obiettivi.
-- Idempotente: if not exists, create or replace, drop policy if exists, revoke/grant.
-- Rollback: in fondo al file.
begin;

-- =====================================================================
-- 1. TABELLE
-- =====================================================================

create table if not exists public.rientri (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  household_id uuid null references public.households(id) on delete restrict,
  goal_id uuid null references public.budget_goals(id) on delete cascade,
  account_id uuid null references public.accounts(id) on delete cascade,
  importo numeric(12,2) not null check (importo > 0 and importo < 1000000000),
  mesi int not null check (mesi in (2, 3, 4, 6, 12)),
  creato_il date not null,
  stato text not null default 'aperto' check (stato in ('aperto', 'fermato', 'chiuso')),
  fermato_il date null,
  created_at timestamptz default now(),
  -- un rientro punta a un obiettivo oppure a un conto, mai a tutti e due
  check ((goal_id is null) <> (account_id is null)),
  -- un rientro di casa punta sempre a un obiettivo
  check (household_id is null or account_id is null),
  -- fermato_il c'è se e solo se il rientro non è più aperto
  check ((stato = 'aperto') = (fermato_il is null))
);

-- come piva_accantonamenti: eliminare un conto non è bloccato dagli spostamenti
create table if not exists public.spostamenti (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  da_account_id uuid null references public.accounts(id) on delete set null,
  a_account_id uuid null references public.accounts(id) on delete set null,
  importo numeric(12,2) not null check (importo > 0 and importo < 1000000000),
  data date not null,
  created_at timestamptz default now(),
  check (da_account_id <> a_account_id)
);

create index if not exists rientri_user_idx on public.rientri (user_id);
create index if not exists rientri_household_idx on public.rientri (household_id);
create index if not exists spostamenti_user_data_idx on public.spostamenti (user_id, data);

-- =====================================================================
-- 2. RLS
-- =====================================================================

alter table public.rientri enable row level security;
alter table public.spostamenti enable row level security;

-- rientri personali: solo di chi li scrive. Quattro policy separate: chi crea un rientro verso un conto lo crea
-- con la destinazione giusta (obiettivo personale di chi scrive, oppure conto di chi scrive, personale,
-- non archiviato e fuori dal disponibile). Dopo, la destinazione può cambiare (il conto ora conta nel disponibile,
-- è archiviato, o è diventato il conto tasse): "Ferma" e "Lascia stare" devono funzionare lo stesso, quindi
-- modifica e cancellazione chiedono solo che il rientro sia personale e di chi scrive.
drop policy if exists rientri_personali on public.rientri;
drop policy if exists rientri_personali_select on public.rientri;
create policy rientri_personali_select on public.rientri for select to authenticated
  using (household_id is null and user_id = (select auth.uid()));

drop policy if exists rientri_personali_insert on public.rientri;
create policy rientri_personali_insert on public.rientri for insert to authenticated
  with check (
    household_id is null
    and user_id = (select auth.uid())
    and (
      (goal_id is not null and exists (
        select 1 from public.budget_goals g
        where g.id = rientri.goal_id and g.user_id = (select auth.uid()) and g.household_id is null
      ))
      or
      (account_id is not null and exists (
        select 1 from public.accounts a
        where a.id = rientri.account_id and a.user_id = (select auth.uid()) and a.household_id is null
          and not a.archiviato and a.conta_in_disponibile = false
      ))
    )
  );

drop policy if exists rientri_personali_update on public.rientri;
create policy rientri_personali_update on public.rientri for update to authenticated
  using (household_id is null and user_id = (select auth.uid()))
  with check (household_id is null and user_id = (select auth.uid()));

drop policy if exists rientri_personali_delete on public.rientri;
create policy rientri_personali_delete on public.rientri for delete to authenticated
  using (household_id is null and user_id = (select auth.uid()));

-- rientri di casa (stesso schema della 0004): li vedono i membri, li scrive chi può scrivere (casa non archiviata).
-- L'obiettivo deve appartenere a quella casa; chi inserisce è l'autore. Modifica e cancellazione: ogni socio
-- che può scrivere (user_id e household_id non cambiano mai: li garantisce il trigger qui sotto).
drop policy if exists rientri_casa_select on public.rientri;
create policy rientri_casa_select on public.rientri for select to authenticated
  using (household_id is not null and public.is_household_member(household_id));

drop policy if exists rientri_casa_insert on public.rientri;
create policy rientri_casa_insert on public.rientri for insert to authenticated
  with check (
    household_id is not null
    and user_id = (select auth.uid())
    and public.is_household_writer(household_id)
    and goal_id is not null
    and exists (
      select 1 from public.budget_goals g
      where g.id = rientri.goal_id and g.household_id = rientri.household_id
    )
  );

drop policy if exists rientri_casa_update on public.rientri;
create policy rientri_casa_update on public.rientri for update to authenticated
  using (household_id is not null and public.is_household_writer(household_id))
  with check (
    household_id is not null
    and public.is_household_writer(household_id)
    and goal_id is not null
    and exists (
      select 1 from public.budget_goals g
      where g.id = rientri.goal_id and g.household_id = rientri.household_id
    )
  );

drop policy if exists rientri_casa_delete on public.rientri;
create policy rientri_casa_delete on public.rientri for delete to authenticated
  using (household_id is not null and public.is_household_writer(household_id));

-- user_id e household_id di un rientro non cambiano (stessa funzione della 0004)
drop trigger if exists rientri_forbid_household_change on public.rientri;
create trigger rientri_forbid_household_change before update on public.rientri
  for each row execute function public.forbid_household_change();

-- spostamenti: solo i propri. Si scrivono con sposta_soldi (insert) e si tolgono con annulla_spostamento (delete),
-- entrambe security invoker: servono select, insert e delete. Nessuna policy di update (una riga non si
-- modifica, e un update diretto non toccherebbe i saldi): il privilegio si toglie anche dal grant.
drop policy if exists spostamenti_proprie on public.spostamenti;
drop policy if exists spostamenti_select on public.spostamenti;
create policy spostamenti_select on public.spostamenti for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists spostamenti_insert on public.spostamenti;
create policy spostamenti_insert on public.spostamenti for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists spostamenti_delete on public.spostamenti;
create policy spostamenti_delete on public.spostamenti for delete to authenticated
  using (user_id = (select auth.uid()));

revoke update on public.spostamenti from authenticated;

-- =====================================================================
-- 3. sposta_soldi: sposta l'importo da un conto personale a un altro e lo registra
-- Blocco in ordine di id: due spostamenti opposti in contemporanea non si incrociano.
-- Entrambi i conti devono essere personali di chi chiama e non archiviati (user_id e household_id si controllano qui,
-- non ci si affida alla sola visibilità: un conto di casa è visibile ai membri).
-- =====================================================================

create or replace function public.sposta_soldi(p_da uuid, p_a uuid, p_importo numeric, p_data date)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  n int;
  v_id uuid;
begin
  if p_importo is null or p_importo <= 0 or p_importo >= 1000000000 or p_importo <> round(p_importo, 2) then
    raise exception 'importo non valido';
  end if;
  if p_data is null or p_data > public._casa_oggi() then raise exception 'data non valida'; end if;
  if p_da is null or p_a is null or p_da = p_a then raise exception 'conto non valido'; end if;
  select count(*) into n from (
    select id from public.accounts
    where id in (p_da, p_a) and user_id = (select auth.uid()) and household_id is null and not archiviato
    order by id for update
  ) s;
  if n <> 2 then raise exception 'conto non valido'; end if;
  update public.accounts set saldo_attuale = saldo_attuale - p_importo where id = p_da;
  update public.accounts set saldo_attuale = saldo_attuale + p_importo where id = p_a;
  insert into public.spostamenti (da_account_id, a_account_id, importo, data)
  values (p_da, p_a, p_importo, p_data)
  returning id into v_id;
  return v_id;
end $$;

-- =====================================================================
-- 4. annulla_spostamento: cancella la riga e rimette i saldi dei conti che ci sono ancora
-- Torna le righe cancellate (0 se non c'era). I saldi si toccano solo sui conti personali di chi chiama.
-- =====================================================================

create or replace function public.annulla_spostamento(p_id uuid)
returns int language plpgsql security invoker set search_path = public as $$
declare
  r public.spostamenti%rowtype;
  n int;
begin
  delete from public.spostamenti where id = p_id returning * into r;
  get diagnostics n = row_count;
  if n = 0 then return 0; end if;
  perform 1 from public.accounts
  where id in (r.da_account_id, r.a_account_id) and user_id = (select auth.uid()) and household_id is null
  order by id for update;
  if r.da_account_id is not null then
    update public.accounts set saldo_attuale = saldo_attuale + r.importo
    where id = r.da_account_id and user_id = (select auth.uid()) and household_id is null;
  end if;
  if r.a_account_id is not null then
    update public.accounts set saldo_attuale = saldo_attuale - r.importo
    where id = r.a_account_id and user_id = (select auth.uid()) and household_id is null;
  end if;
  return n;
end $$;

-- =====================================================================
-- 5. ricomincia_da_zero: cancella anche i rientri personali e gli spostamenti
-- Come nella 0012 (la Casa non si tocca, ogni istruzione è filtrata da v_me, crea_categorie_iniziali per ultima).
-- I rientri e gli spostamenti vanno prima dei conti e degli obiettivi, per le chiavi esterne.
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

-- =====================================================================
-- 6. LE TRE DIFESE
-- =====================================================================

-- 6.1 piva_quote_scartate: si scarta solo la quota di un incasso proprio (prima bastava user_id)
drop policy if exists piva_quote_scartate_proprie on public.piva_quote_scartate;
create policy piva_quote_scartate_proprie on public.piva_quote_scartate for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = (select auth.uid()))
  );

-- 6.2 adjust_account_balance: nessuna funzione SQL e nessun codice dell'app la chiama, il client non la esegue più
revoke execute on function public.adjust_account_balance(uuid, numeric) from authenticated;

-- 6.3 goal_versamenti: le letture per data (goal_id, data)
create index if not exists goal_versamenti_goal_data_idx on public.goal_versamenti (goal_id, data);

-- =====================================================================
-- 7. GRANT: solo gli utenti autenticati eseguono le funzioni
-- =====================================================================

revoke execute on function public.sposta_soldi(uuid, uuid, numeric, date) from public, anon, authenticated;
grant execute on function public.sposta_soldi(uuid, uuid, numeric, date) to authenticated;
revoke execute on function public.annulla_spostamento(uuid) from public, anon, authenticated;
grant execute on function public.annulla_spostamento(uuid) to authenticated;
revoke all on function public.ricomincia_da_zero() from public, anon;
grant execute on function public.ricomincia_da_zero() to authenticated;

commit;

-- ROLLBACK (solo se serve; perde rientri e spostamenti):
-- ricomincia_da_zero si riporta alla versione precedente rieseguendo la sua definizione dalla 0012.
-- piva_quote_scartate_proprie si riporta alla versione della 0012; adjust_account_balance si riabilita con
-- grant execute on function public.adjust_account_balance(uuid, numeric) to authenticated;
-- grant update on public.spostamenti to authenticated;
-- drop trigger if exists rientri_forbid_household_change on public.rientri;
-- drop function if exists public.annulla_spostamento(uuid);
-- drop function if exists public.sposta_soldi(uuid, uuid, numeric, date);
-- drop table if exists public.spostamenti;
-- drop table if exists public.rientri;
-- drop index if exists public.goal_versamenti_goal_data_idx;
