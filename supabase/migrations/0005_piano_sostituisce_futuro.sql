-- 0005_piano_sostituisce_futuro.sql
-- save_household_plan: salvare una revisione elimina le versioni successive che il payload non
-- contiene piu (prima restavano e, con valido_dal piu avanti, continuavano a prevalere).
-- Idempotente (create or replace). Non tocca altro. Dopo la 0004.
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
begin
  if uid is null then raise exception 'non autenticato'; end if;
  if not public.is_household_writer(p_household) then raise exception 'casa non scrivibile'; end if;
  if jsonb_typeof(p_payload -> 'versioni') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'versioni') = 0 then
    raise exception 'payload non valido';
  end if;

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

revoke execute on function public.save_household_plan(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_household_plan(uuid, jsonb) to authenticated;

commit;

-- ROLLBACK (solo se serve): rieseguire la definizione di save_household_plan della 0004
-- (sezione 3.6 di 0004_casa_comune.sql) senza il blocco "delete from public.household_plans".
