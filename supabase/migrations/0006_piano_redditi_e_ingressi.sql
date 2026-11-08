-- 0006_piano_redditi_e_ingressi.sql
-- save_household_plan: il reddito di un altro membro si confronta con l'ultimo valore salvato in
-- tutte le versioni (letto prima di eliminare), e categorie/obiettivi delle voci devono essere della casa.
-- join_household: occupa solo un segnaposto presente nella versione attiva questo mese o in quelle
-- successive, preferendo quello con lo stesso nome; altrimenti una posizione nuova.
-- Idempotente (create or replace). Dopo la 0005.
begin;

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
    delete from public.household_plan_shares where plan_id = pid and slot <> all(slots);

    ids := ids || pid;
  end loop;
  return ids;
end $$;

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
  where p.household_id = hid and s.user_id is null
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
  where p.id = s.plan_id and p.household_id = hid and s.slot = slot_n and s.user_id is null;

  return hid;
end $$;

revoke execute on function public.save_household_plan(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_household_plan(uuid, jsonb) to authenticated;
revoke execute on function public.join_household(text, text) from public, anon, authenticated;
grant execute on function public.join_household(text, text) to authenticated;

commit;

-- ROLLBACK (solo se serve): rieseguire la definizione di save_household_plan della 0005 e di
-- join_household della 0004 (sezione relativa di 0004_casa_comune.sql).
