-- 0012_pulizia.sql
-- Dopo la 0011. Pulizia prima del test da zero.
-- Funzioni nuove:
--   elimina_movimento e modifica_movimento (security invoker: la RLS resta il giudice): riga e saldi insieme, in una
--     sola transazione, con i conti bloccati in ordine di id. Stesso effetto sui saldi di crea_movimento (0010),
--     compresa la spesa della Casa pagata con una carta personale (D3, D4, C1).
--   crea_fondo_bolletta (security definer, come link_plan_item_goal: le voci del piano non sono scrivibili dal client):
--     cerca-o-crea il fondo ricorrente della voce con un blocco, e lo collega alla voce (C7).
-- Funzioni sostituite (create or replace, stessa firma e stessi grant):
--   crea_categorie_iniziali (blocco per utente, e niente se ci sono movimenti personali: p1),
--   get_calendar_feed (id dell'obiettivo: C2), incassa_fattura ("Incasso in studio" senza prefisso: P8),
--   ricomincia_da_zero (cancella anche goal_versamenti e piva_quote_scartate).
-- Tabelle nuove con RLS sulle proprie righe: piva_quote_scartate (P4), goal_versamenti (K1).
-- Colonne nuove: promemoria_utente.rimandati (B2-2), piva_settings.categoria_dal (P5).
-- Indice unico su piva_fatture(transaction_id) (P10), vincolo sulle date d'incasso (P11).
-- Idempotente: if not exists, create or replace, drop policy if exists, revoke/grant.
-- Rollback: in fondo al file.
begin;

-- =====================================================================
-- 1. COLONNE NUOVE
-- =====================================================================

-- B2-2: "Più tardi" dei promemoria vale su tutti i telefoni
alter table public.promemoria_utente add column if not exists rimandati jsonb not null default '{}';

-- P5: da quando vale la categoria del fatturato (null = da sempre, cioè da guidata_dal)
alter table public.piva_settings add column if not exists categoria_dal date;

-- =====================================================================
-- 2. TABELLE NUOVE
-- =====================================================================

-- P4: gli incassi la cui quota "da spostare" è stata scartata
create table if not exists public.piva_quote_scartate (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scartata_il date not null
);

-- K1: i versamenti confermati verso un obiettivo personale
create table if not exists public.goal_versamenti (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.budget_goals(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data date not null,
  importo numeric not null check (importo > 0),
  created_at timestamptz not null default now()
);

create index if not exists goal_versamenti_goal_idx on public.goal_versamenti (goal_id);

-- =====================================================================
-- 3. RLS: ognuno vede e scrive solo le proprie righe
-- =====================================================================

alter table public.piva_quote_scartate enable row level security;
alter table public.goal_versamenti enable row level security;

drop policy if exists piva_quote_scartate_proprie on public.piva_quote_scartate;
create policy piva_quote_scartate_proprie on public.piva_quote_scartate for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- un versamento si scrive solo su un obiettivo personale di chi lo scrive
drop policy if exists goal_versamenti_proprie on public.goal_versamenti;
create policy goal_versamenti_proprie on public.goal_versamenti for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.budget_goals g
      where g.id = goal_id and g.user_id = (select auth.uid()) and g.household_id is null
    )
  );

-- =====================================================================
-- 4. P10 e P11: un incasso collega una sola fattura; l'incasso non precede l'emissione
-- =====================================================================

-- P10: se due fatture puntano allo stesso incasso resta il collegamento della più vecchia;
-- le altre tornano aperte (come fa il trigger piva_su_elimina_movimento).
do $$
declare
  n int;
begin
  with d as (
    select id, row_number() over (partition by transaction_id order by created_at, id) as rn
    from public.piva_fatture
    where transaction_id is not null
  ), u as (
    update public.piva_fatture f
    set transaction_id = null, data_incasso = null
    from d
    where f.id = d.id and d.rn > 1
    returning f.id
  )
  select count(*) into n from u;
  raise notice 'P10: fatture riaperte perché puntavano a un incasso già collegato: %', n;
end $$;

create unique index if not exists piva_fatture_un_incasso
  on public.piva_fatture (transaction_id) where transaction_id is not null;

-- P11: il vincolo nasce not valid (protegge già le scritture nuove). Si valida solo se nessuna riga vecchia lo viola;
-- altrimenti resta not valid e le fatture da correggere compaiono in un NOTICE.
do $$
declare
  v_ids text;
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'piva_fatture_date_check' and conrelid = 'public.piva_fatture'::regclass
  ) then
    alter table public.piva_fatture add constraint piva_fatture_date_check
      check (data_incasso is null or data_incasso >= data_emissione) not valid;
  end if;
  select string_agg(id::text, ', ') into v_ids
  from public.piva_fatture where data_incasso is not null and data_incasso < data_emissione;
  if v_ids is null then
    alter table public.piva_fatture validate constraint piva_fatture_date_check;
  else
    raise notice 'P11: vincolo lasciato not valid, fatture con incasso prima dell''emissione: %', v_ids;
  end if;
end $$;

-- =====================================================================
-- 5. P8: incassa_fattura. Un incasso diretto ("Incasso in studio") non ha il prefisso "Fattura"
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
  values ('income', f.importo, p_data, p_categoria, a.id,
          case when f.cliente = 'Incasso in studio' then 'Incasso in studio' else 'Fattura ' || f.cliente end)
  returning id into v_tx;
  update public.accounts set saldo_attuale = saldo_attuale + f.importo where id = a.id;
  update public.piva_fatture set data_incasso = p_data, transaction_id = v_tx where id = f.id;
  return v_tx;
end $$;

-- le righe già scritte "Fattura Incasso in studio"
update public.transactions
set descrizione = 'Incasso in studio'
where descrizione = 'Fattura Incasso in studio' and household_id is null;

-- =====================================================================
-- 6. elimina_movimento: riga e saldo insieme
-- Spesa: il saldo risale; entrata: scende (come il client di oggi). Idempotente: una riga già eliminata non
-- fa niente. Una riga che la RLS non lascia modificare (ad esempio la spesa pagata con la carta di un altro)
-- dà errore. Il saldo che non si riesce ad aggiornare annulla anche l'eliminazione.
-- =====================================================================

create or replace function public.elimina_movimento(p_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  t public.transactions%rowtype;
  n int;
begin
  select * into t from public.transactions where id = p_id for update;
  if not found then -- riga assente: già eliminata (o mai esistita), niente da fare
    if exists (select 1 from public.transactions where id = p_id) then
      raise exception 'movimento non modificabile';
    end if;
    return;
  end if;
  if t.account_id is not null then
    perform 1 from public.accounts where id = t.account_id order by id for update;
  end if;
  delete from public.transactions where id = p_id;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'movimento non modificabile'; end if;
  if t.account_id is not null then
    update public.accounts
    set saldo_attuale = saldo_attuale + case when t.tipo = 'expense' then t.importo else -t.importo end
    where id = t.account_id;
    if not found then raise exception 'conto non valido'; end if;
  end if;
end $$;

-- =====================================================================
-- 7. modifica_movimento: riga e saldi insieme
-- Si toglie l'effetto della riga vecchia dal suo conto e si applica quello della nuova al suo conto;
-- se il conto è lo stesso si applica solo la differenza. I conti si bloccano in ordine di id.
-- I trigger check_household_refs e forbid_household_change giudicano la riga, e la RLS chi può toccarla.
-- Il client deve mandare tutti i campi: categoria, obiettivo, nota e descrizione si sovrascrivono con quanto passato.
-- p_stima nullo lascia la colonna com'è. Casa, data di creazione e chi ha pagato non cambiano mai.
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

-- =====================================================================
-- 8. crea_fondo_bolletta: il fondo ricorrente della voce, una volta sola
-- Definer: il collegamento alla voce passa da link_plan_item_goal (anch'esso definer; le voci non sono
-- scrivibili dal client). Guardia: chi chiama è membro attivo della casa. Il blocco sulla voce regge due soci
-- che toccano "Metti da parte" insieme; quello sul nome regge due voci omonime di versioni diverse del piano.
-- Se esiste già un fondo ricorrente aperto della casa con la stessa categoria e lo stesso nome (senza
-- maiuscole) si collega quello, altrimenti se ne crea uno dilazionato con i valori della voce.
-- =====================================================================

create or replace function public.crea_fondo_bolletta(p_household uuid, p_item uuid, p_scadenza date, p_oggi date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_item public.household_plan_items%rowtype;
  v_goal uuid;
begin
  if v_me is null then raise exception 'non autenticato'; end if;
  if p_household is null or p_item is null or p_scadenza is null then raise exception 'dati mancanti'; end if;
  if not public._casa_membro_attivo(p_household, v_me) then raise exception 'casa non valida'; end if;
  perform pg_advisory_xact_lock(hashtext(p_item::text));
  select i.* into v_item from public.household_plan_items i
  join public.household_plans p on p.id = i.plan_id
  where i.id = p_item and p.household_id = p_household;
  if not found then raise exception 'voce non trovata'; end if;
  if v_item.categoria_id is null then raise exception 'voce senza categoria'; end if;
  perform pg_advisory_xact_lock(hashtext(p_household::text || v_item.categoria_id::text || lower(v_item.nome)));
  select g.id into v_goal from public.budget_goals g
  where g.household_id = p_household and g.stato = 'aperto' and g.ricorrente
    and g.categoria_id = v_item.categoria_id and lower(g.nome) = lower(v_item.nome)
  order by g.created_at, g.id
  limit 1;
  if v_goal is null then
    insert into public.budget_goals (
      user_id, nome, importo_target, modalita, scadenza, categoria_id, ricorrente, frequenza_mesi,
      stato, accantona_da, household_id)
    values (
      v_me, v_item.nome, v_item.importo_ricorrenza, 'dilazionato', p_scadenza, v_item.categoria_id, true,
      v_item.frequenza_mesi, 'aperto', coalesce(p_oggi, public._casa_oggi()), p_household)
    returning id into v_goal;
  end if;
  perform public.link_plan_item_goal(p_household, p_item, v_goal);
  return v_goal;
end $$;

-- =====================================================================
-- 9. crea_categorie_iniziali: con blocco, e solo per chi non ha movimenti personali (p1)
-- Non fa niente se l'utente ha già una categoria personale non archiviata o un movimento personale.
-- Torna quante categorie ha creato.
-- =====================================================================

create or replace function public.crea_categorie_iniziali()
returns int language plpgsql security invoker set search_path = public as $$
declare
  v_me uuid := auth.uid();
  n int;
begin
  if v_me is null then raise exception 'utente non valido'; end if;
  -- due prime aperture insieme: la seconda aspetta la prima e poi trova le categorie
  perform pg_advisory_xact_lock(hashtext(v_me::text || 'categorie'));
  if exists (
    select 1 from public.categories where user_id = v_me and household_id is null and not archiviata
  ) then return 0; end if;
  if exists (
    select 1 from public.transactions where user_id = v_me and household_id is null
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
-- 10. get_calendar_feed: l'id dell'obiettivo (C2), così rinominarlo non cambia l'UID dell'evento
-- Per il resto uguale alla 0004. Raggiungibile anche senza sessione (anon), solo con il token.
-- =====================================================================

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
               'id', g.id, 'nome', g.nome, 'scadenza', g.scadenza, 'importo', g.importo_target,
               'ricorrente', g.ricorrente, 'frequenza_mesi', g.frequenza_mesi) order by g.scadenza), '[]'::jsonb)
      from public.budget_goals g
      where g.household_id = hh.id and g.stato = 'aperto' and g.scadenza is not null),
    'credito_proprio', public._casa_credito_aperto(hh.id, f.user_id),
    'credito_altri', altri,
    'ultimo_controllo', (select max(b.data) from public.balance_checks b where b.household_id = hh.id),
    'ultimo_checkin', (select max(c.mese) from public.household_checkins c where c.household_id = hh.id));
end $$;

-- =====================================================================
-- 11. ricomincia_da_zero: cancella anche i versamenti degli obiettivi e le quote scartate
-- Come nella 0011: la Casa non si tocca, ogni istruzione è filtrata da v_me, chiama crea_categorie_iniziali per ultima.
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

  -- 3. versamenti degli obiettivi, spostamenti e movimenti personali
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
-- 12. GRANT: solo gli utenti autenticati eseguono le funzioni (get_calendar_feed anche anon, come nella 0004)
-- =====================================================================

revoke execute on function public.elimina_movimento(uuid) from public, anon, authenticated;
grant execute on function public.elimina_movimento(uuid) to authenticated;
revoke execute on function public.modifica_movimento(uuid, text, numeric, date, uuid, uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.modifica_movimento(uuid, text, numeric, date, uuid, uuid, uuid, text, text, boolean) to authenticated;
revoke execute on function public.crea_fondo_bolletta(uuid, uuid, date, date) from public, anon, authenticated;
grant execute on function public.crea_fondo_bolletta(uuid, uuid, date, date) to authenticated;
revoke execute on function public.incassa_fattura(uuid, date, uuid, uuid) from public, anon, authenticated;
grant execute on function public.incassa_fattura(uuid, date, uuid, uuid) to authenticated;
revoke execute on function public.crea_categorie_iniziali() from public, anon, authenticated;
grant execute on function public.crea_categorie_iniziali() to authenticated;
revoke execute on function public.get_calendar_feed(text) from public, anon, authenticated;
grant execute on function public.get_calendar_feed(text) to authenticated;
grant execute on function public.get_calendar_feed(text) to anon;
revoke all on function public.ricomincia_da_zero() from public, anon;
grant execute on function public.ricomincia_da_zero() to authenticated;

commit;

-- ROLLBACK (solo se serve; perde i versamenti degli obiettivi, le quote scartate e i "Più tardi"):
-- Il rollback NON annulla la riscrittura delle descrizioni (P8) né la riapertura delle fatture doppione (P10).
-- Le quattro funzioni sostituite (incassa_fattura, crea_categorie_iniziali, get_calendar_feed, ricomincia_da_zero)
-- si riportano alla versione precedente rieseguendo la loro definizione dalla 0010, 0011 e 0004.
-- drop function if exists public.crea_fondo_bolletta(uuid, uuid, date, date);
-- drop function if exists public.modifica_movimento(uuid, text, numeric, date, uuid, uuid, uuid, text, text, boolean);
-- drop function if exists public.elimina_movimento(uuid);
-- drop table if exists public.goal_versamenti;
-- drop table if exists public.piva_quote_scartate;
-- drop index if exists public.piva_fatture_un_incasso;
-- alter table public.piva_fatture drop constraint if exists piva_fatture_date_check;
-- alter table public.piva_settings drop column if exists categoria_dal;
-- alter table public.promemoria_utente drop column if exists rimandati;
