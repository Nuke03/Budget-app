-- 0008_da_parte_e_controlli.sql
-- Dopo la 0007. Solo quattro funzioni, tutte create or replace: nessuna tabella, colonna o dato cambia.
-- record_balance_check (invoker): la riga del conto si blocca con for update mentre si legge, cosi la
-- differenza non si perde se l altro membro registra una spesa nello stesso istante. Valida saldo e data.
-- save_household_checkin (invoker): la riga del check-in e l aumento del fondo "da parte" sono una sola
-- operazione. Un secondo check-in dello stesso mese annulla tutto (unique_violation).
-- link_plan_item_goal e set_plan_item_stima_ignorata (definer): le voci del piano non sono scrivibili dal
-- client; la 0005 e la 0006 le ricreano a ogni salvataggio, quindi l aggiornamento tocca anche le versioni
-- successive con la stessa voce.
-- Rollback: in fondo al file. Idempotente: create or replace e revoke/grant si rieseguono senza effetti.
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
  if p_avanzo is null then raise exception 'avanzo non valido'; end if;
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
revoke execute on function public.record_balance_check(uuid, numeric, date, boolean) from public, anon, authenticated;
grant execute on function public.record_balance_check(uuid, numeric, date, boolean) to authenticated;
revoke execute on function public.save_household_checkin(uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, text, uuid, text) from public, anon, authenticated;
grant execute on function public.save_household_checkin(uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, text, uuid, text) to authenticated;
revoke execute on function public.link_plan_item_goal(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_plan_item_goal(uuid, uuid, uuid) to authenticated;
revoke execute on function public.set_plan_item_stima_ignorata(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.set_plan_item_stima_ignorata(uuid, uuid, integer) to authenticated;
commit;

-- ROLLBACK (solo se serve): rieseguire la definizione di record_balance_check della 0004 (sezione 3.5);
-- poi drop function delle altre tre, con le firme:
-- drop function public.save_household_checkin(uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, text, uuid, text);
-- drop function public.link_plan_item_goal(uuid, uuid, uuid);
-- drop function public.set_plan_item_stima_ignorata(uuid, uuid, integer);
