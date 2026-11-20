-- 0014_difese.sql
-- Dopo la 0013. Difese in più nel database (il client non è l'unica guardia).
--   goal_versamenti: importo fra 0 e 1 miliardo (estremi esclusi) e data non nel futuro (trigger goal_versamenti_controlli).
--   rientri: dopo la creazione cambiano solo stato e fermato_il (trigger rientri_solo_stato).
--   modifica_movimento: rifiuta le righe con origine = 'riconciliazione' (create or replace, stessa firma e stessi grant).
-- Lanciare a mano, una volta. Nessuna tabella nuova. Idempotente: create or replace, drop trigger if exists.
-- Rollback: in fondo al file.
begin;

-- =====================================================================
-- 1. goal_versamenti: importo e data
-- La data si confronta con "oggi" di Roma (_casa_oggi, 0004): il server lavora in UTC.
-- =====================================================================

create or replace function public.goal_versamenti_controlli()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.importo is null or new.importo <= 0 or new.importo >= 1000000000 then
    raise exception 'importo del versamento non valido';
  end if;
  if new.data is null or new.data > public._casa_oggi() then
    raise exception 'data del versamento non valida';
  end if;
  return new;
end $$;

drop trigger if exists goal_versamenti_controlli on public.goal_versamenti;
create trigger goal_versamenti_controlli before insert or update on public.goal_versamenti
  for each row execute function public.goal_versamenti_controlli();

-- =====================================================================
-- 2. rientri: si cambiano solo stato e fermato_il
-- =====================================================================

create or replace function public.rientri_solo_stato()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.goal_id is distinct from old.goal_id
    or new.account_id is distinct from old.account_id
    or new.importo is distinct from old.importo
    or new.mesi is distinct from old.mesi
    or new.creato_il is distinct from old.creato_il
    or new.household_id is distinct from old.household_id
    or new.user_id is distinct from old.user_id then
    raise exception 'di un rientro si cambiano solo stato e data di stop';
  end if;
  return new;
end $$;

drop trigger if exists rientri_solo_stato on public.rientri;
create trigger rientri_solo_stato before update on public.rientri
  for each row execute function public.rientri_solo_stato();

-- =====================================================================
-- 3. modifica_movimento: non modifica le righe della riconciliazione
-- Stessa definizione della 0012 (security invoker: la RLS resta il giudice), più il rifiuto subito dopo la lettura.
-- =====================================================================

create or replace function public.modifica_movimento(
  p_id uuid, p_tipo text, p_importo numeric, p_data date, p_categoria uuid, p_account uuid, p_goal uuid,
  p_descrizione text, p_nota text, p_stima boolean
) returns void language plpgsql security invoker set search_path = public as $$
declare
  t public.transactions%rowtype;
  v_vecchio numeric;
  v_nuovo numeric;
begin
  if p_tipo is null or p_tipo not in ('expense', 'income') then raise exception 'tipo non valido'; end if;
  if p_importo is null or p_importo <= 0 then raise exception 'importo non valido'; end if;
  if p_data is null then raise exception 'data non valida'; end if;
  select * into t from public.transactions where id = p_id for update;
  if not found then raise exception 'movimento non trovato'; end if;
  -- le righe della riconciliazione sono la rettifica di un saldo: si possono eliminare, non modificare
  if t.origine = 'riconciliazione' then raise exception 'movimento di riconciliazione non modificabile'; end if;
  -- blocco in ordine di id: due modifiche in contemporanea non si incrociano
  perform 1 from public.accounts where id in (t.account_id, p_account) order by id for update;
  update public.transactions
  set tipo = p_tipo, importo = p_importo, data = p_data, categoria_id = p_categoria, account_id = p_account,
      goal_id = p_goal, descrizione = coalesce(p_descrizione, ''), nota = p_nota, stima = coalesce(p_stima, stima)
  where id = p_id;
  if not found then raise exception 'movimento non modificabile'; end if;
  v_vecchio := case when t.tipo = 'income' then t.importo else -t.importo end;
  v_nuovo := case when p_tipo = 'income' then p_importo else -p_importo end;
  if t.account_id is not distinct from p_account then
    if p_account is not null and v_nuovo - v_vecchio <> 0 then
      update public.accounts set saldo_attuale = saldo_attuale + (v_nuovo - v_vecchio) where id = p_account;
      if not found then raise exception 'conto non valido'; end if;
    end if;
  else
    if t.account_id is not null then
      update public.accounts set saldo_attuale = saldo_attuale - v_vecchio where id = t.account_id;
      if not found then raise exception 'conto non valido'; end if;
    end if;
    if p_account is not null then
      update public.accounts set saldo_attuale = saldo_attuale + v_nuovo where id = p_account;
      if not found then raise exception 'conto non valido'; end if;
    end if;
  end if;
end $$;

revoke execute on function public.modifica_movimento(uuid, text, numeric, date, uuid, uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.modifica_movimento(uuid, text, numeric, date, uuid, uuid, uuid, text, text, boolean) to authenticated;

commit;

-- ROLLBACK (solo se serve):
-- drop trigger if exists goal_versamenti_controlli on public.goal_versamenti;
-- drop function if exists public.goal_versamenti_controlli();
-- drop trigger if exists rientri_solo_stato on public.rientri;
-- drop function if exists public.rientri_solo_stato();
-- modifica_movimento si riporta alla versione della 0012 rieseguendo la sua definizione (sezione 7).
