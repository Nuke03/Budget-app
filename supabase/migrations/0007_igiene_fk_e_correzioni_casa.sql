-- 0007_igiene_fk_e_correzioni_casa.sql
-- Igiene dopo la 0006. Le colonne autore (households.created_by, household_plans.created_by,
-- household_invites.created_by, household_plan_shares.user_id) diventano nullable e passano a
-- on delete set null: eliminare l utente fondatore non cancella casa, piano o membership del socio.
-- join_household: un segnaposto con esce_dal valorizzato non si occupa piu.
-- record_transfer: nei rimborsi e nelle restituzioni senza rinuncia i conti restano null (una FK
-- restrict su un conto altrui non blocca piu quel conto).
-- save_household_plan: una voce con categoria_id e nome diverso rinomina la categoria collegata;
-- una quota di un uscito riprende user_id dall'ultima riga della posizione; l'ultima delete non
-- tocca le quote con esce_dal valorizzato.
-- Idempotente (drop/add constraint solo se serve, create or replace). Dopo la 0006.
begin;

do $do$
declare
  r record;
  cname text;
begin
  for r in select * from (values
    ('households', 'created_by'),
    ('household_plans', 'created_by'),
    ('household_invites', 'created_by'),
    ('household_plan_shares', 'user_id')
  ) as x(tab, col)
  loop
    execute format('alter table public.%I alter column %I drop not null', r.tab, r.col);
    if not exists (
      select 1 from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.conrelid = format('public.%I', r.tab)::regclass and c.contype = 'f'
        and a.attname = r.col and c.confrelid = 'auth.users'::regclass and c.confdeltype = 'n'
    ) then
      select c.conname into cname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.conrelid = format('public.%I', r.tab)::regclass and c.contype = 'f'
        and a.attname = r.col and c.confrelid = 'auth.users'::regclass;
      if cname is not null then
        execute format('alter table public.%I drop constraint %I', r.tab, cname);
      end if;
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null',
        r.tab, r.tab || '_' || r.col || '_fkey', r.col);
    end if;
  end loop;
end $do$;

create or replace function public.join_household(p_codice text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  normalizzato text := upper(regexp_replace(coalesce(p_codice, ''), '[^A-Za-z0-9]', '', 'g'));
  hid uuid;
  slot_n smallint;
  v_nome text := trim(coalesce(p_display_name, ''));
  mese_corrente date := date_trunc('month', public._casa_oggi()::timestamp)::date;
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

  -- un segnaposto (quota senza utente) della versione attiva questo mese o di quelle successive,
  -- mai appartenuto a un membro: si preferisce quello con lo stesso nome, poi la posizione piu bassa;
  -- altrimenti una posizione nuova. I segnaposto tolti dal piano (solo in versioni passate) non contano.
  select s.slot into slot_n
  from public.household_plan_shares s
  join public.household_plans p on p.id = s.plan_id
  where p.household_id = hid and s.user_id is null and s.esce_dal is null
    and (p.valido_dal > mese_corrente
         or p.id = (select p3.id from public.household_plans p3
                    where p3.household_id = hid and p3.valido_dal <= mese_corrente
                    order by p3.valido_dal desc limit 1))
    and not exists (
      select 1 from public.household_plan_shares s2
      join public.household_plans p2 on p2.id = s2.plan_id
      where p2.household_id = hid and s2.slot = s.slot and s2.user_id is not null)
    and not exists (
      select 1 from public.household_members m where m.household_id = hid and m.slot = s.slot)
  order by coalesce(lower(trim(s.display_name)) = lower(v_nome), false) desc, s.slot limit 1;
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
  where p.id = s.plan_id and p.household_id = hid and s.slot = slot_n and s.user_id is null and s.esce_dal is null;

  return hid;
end $$;

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
  trovato boolean;
  uscenti_slot smallint[] := '{}';
  uscenti_user uuid[] := '{}';
  u_prev uuid;
begin
  if uid is null then raise exception 'non autenticato'; end if;
  if not public.is_household_writer(p_household) then raise exception 'casa non scrivibile'; end if;
  if jsonb_typeof(p_payload -> 'versioni') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'versioni') = 0 then
    raise exception 'payload non valido';
  end if;

  -- Il reddito di un altro membro non si modifica: ogni quota del payload legata a un altro membro
  -- si confronta con l'ULTIMO valore salvato per quella posizione in tutte le versioni della casa.
  -- Si legge prima di qualunque eliminazione, cosi una revisione non cancella in silenzio la
  -- correzione fatta da un altro in una versione successiva.
  for v in select value from jsonb_array_elements(p_payload -> 'versioni') loop
    for q in select value from jsonb_array_elements(coalesce(v -> 'quote', '[]'::jsonb)) loop
      slot_n := (q ->> 'slot')::smallint;
      mem_user := null;
      select m.user_id into mem_user
      from public.household_members m
      where m.household_id = p_household and m.slot = slot_n and m.attivo;
      if mem_user is not null and mem_user <> uid then
        nuovo := coalesce((q ->> 'reddito_netto_mensile')::numeric, 0);
        prev := null;
        select s.reddito_netto_mensile into prev
        from public.household_plan_shares s
        join public.household_plans p on p.id = s.plan_id
        where p.household_id = p_household and s.slot = slot_n
        order by p.valido_dal desc limit 1;
        trovato := found;
        if trovato and prev is distinct from nuovo then
          raise exception 'il reddito di un altro membro non si modifica';
        end if;
      end if;
      if mem_user is null and nullif(q ->> 'esce_dal', '') is not null then
        u_prev := null;
        select s.user_id into u_prev
        from public.household_plan_shares s
        join public.household_plans p on p.id = s.plan_id
        where p.household_id = p_household and s.slot = slot_n and s.user_id is not null
        order by p.valido_dal desc limit 1;
        if u_prev is not null and not (slot_n = any (uscenti_slot)) then
          uscenti_slot := uscenti_slot || slot_n;
          uscenti_user := uscenti_user || u_prev;
        end if;
      end if;
    end loop;
  end loop;

  -- Una revisione sostituisce il futuro: le versioni della casa dal primo valido_dal del payload
  -- in poi che il payload non contiene piu vengono eliminate (voci e quote cadono a cascata).
  -- Le versioni precedenti restano com'erano.
  delete from public.household_plans
  where household_id = p_household
    and valido_dal >= (select min((x ->> 'valido_dal')::date)
                       from jsonb_array_elements(p_payload -> 'versioni') x)
    and valido_dal <> all (select (x ->> 'valido_dal')::date
                           from jsonb_array_elements(p_payload -> 'versioni') x);

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
      if cat is not null and not exists (
           select 1 from public.categories c where c.id = cat and c.household_id = p_household) then
        raise exception 'categoria non appartenente alla casa';
      end if;
      if cat is not null and coalesce(voce ->> 'categoria_nome', '') <> ''
         and not exists (select 1 from public.categories c
                         where c.id = cat and lower(c.nome) = lower(voce ->> 'categoria_nome')) then
        update public.categories set nome = voce ->> 'categoria_nome'
        where id = cat and household_id = p_household and tipo = 'expense';
      end if;
      if nullif(voce ->> 'goal_id', '') is not null and not exists (
           select 1 from public.budget_goals g
           where g.id = nullif(voce ->> 'goal_id', '')::uuid and g.household_id = p_household) then
        raise exception 'obiettivo non appartenente alla casa';
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
      if mem_user is null and slot_n = any (uscenti_slot) then
        mem_user := uscenti_user[array_position(uscenti_slot, slot_n)];
      end if;
      nuovo := coalesce((q ->> 'reddito_netto_mensile')::numeric, 0);
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
    delete from public.household_plan_shares where plan_id = pid and slot <> all(slots) and esce_dal is null;

    ids := ids || pid;
  end loop;
  return ids;
end $$;

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
          -- nessun conto resta collegato: una FK restrict su un conto altrui bloccherebbe quel conto
          v_da := null;
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
          -- nessun conto resta collegato: una FK restrict su un conto altrui bloccherebbe quel conto
          v_da := null;
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

revoke execute on function public.join_household(text, text) from public, anon, authenticated;
grant execute on function public.join_household(text, text) to authenticated;
revoke execute on function public.save_household_plan(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_household_plan(uuid, jsonb) to authenticated;
revoke execute on function public.record_transfer(uuid, text, numeric, date, uuid, uuid, uuid, uuid, date, boolean, text) from public, anon, authenticated;
grant execute on function public.record_transfer(uuid, text, numeric, date, uuid, uuid, uuid, uuid, date, boolean, text) to authenticated;

commit;

-- ROLLBACK (solo se serve): rieseguire le definizioni di save_household_plan e join_household della
-- 0006 e di record_transfer della 0004 (sezione 3.5). Per le FK, riportare on delete cascade con
-- alter table public.<tabella> drop constraint <tabella>_<colonna>_fkey, poi add constraint con
-- on delete cascade; le colonne restano nullable (rimettere not null solo se non ci sono null).
