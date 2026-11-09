-- supabase/tests/rls_casa.sql
-- Prova delle policy RLS e delle funzioni della casa comune. Si esegue a mano nel SQL editor
-- di Supabase DOPO le migrazioni 0004, 0005, 0006 e 0007. Non lascia nulla nel database: crea utenti finti e
-- dati di prova, poi termina con un errore voluto che annulla tutto e mostra il referto.
-- Esito atteso: "RISULTATO: ... 0 FAIL" e solo righe OK.
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'rls-a@test.invalid'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'rls-b@test.invalid'),
  ('cccccccc-0000-0000-0000-00000000000c', 'rls-c@test.invalid'),
  ('dddddddd-0000-0000-0000-00000000000d', 'rls-d@test.invalid'),
  ('eeeeeeee-0000-0000-0000-00000000000e', 'rls-e@test.invalid'),
  ('ffffffff-0000-0000-0000-00000000000f', 'rls-f@test.invalid'),
  ('77777777-0000-0000-0000-000000000007', 'rls-g@test.invalid'),
  ('88888888-0000-0000-0000-000000000008', 'rls-k@test.invalid'),
  ('11111111-0000-0000-0000-000000000011', 'rls-p1@test.invalid'),
  ('12121212-0000-0000-0000-000000000012', 'rls-q1@test.invalid'),
  ('13131313-0000-0000-0000-000000000013', 'rls-r1@test.invalid'),
  ('21212121-0000-0000-0000-000000000021', 'rls-n1@test.invalid'),
  ('22222222-0000-0000-0000-000000000022', 'rls-n2@test.invalid'),
  ('23232323-0000-0000-0000-000000000023', 'rls-n3@test.invalid'),
  ('24242424-0000-0000-0000-000000000024', 'rls-n4@test.invalid'),
  ('41414141-0000-0000-0000-000000000041', 'rls-x1@test.invalid'),
  ('42424242-0000-0000-0000-000000000042', 'rls-x2@test.invalid'),
  ('43434343-0000-0000-0000-000000000043', 'rls-x3@test.invalid'),
  ('44444444-0000-0000-0000-000000000044', 'rls-x4@test.invalid'),
  ('51515151-0000-0000-0000-000000000051', 'rls-t1@test.invalid'),
  ('52525252-0000-0000-0000-000000000052', 'rls-t2@test.invalid');

create table public.zz_esiti (n serial, nome text, ok boolean, dettaglio text);
grant all on public.zz_esiti to public;
grant all on sequence public.zz_esiti_n_seq to public;

create function public.zz_reset() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create function public.zz_as(u uuid) returns void language plpgsql as $$
begin
  perform public.zz_reset();
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  set local role authenticated;
end $$;

-- il comando deve riuscire
create function public.zz_ok(p_nome text, u uuid, p_stmt text) returns void language plpgsql as $$
begin
  perform public.zz_as(u);
  begin
    execute p_stmt;
    insert into public.zz_esiti (nome, ok) values (p_nome, true);
  exception when others then
    insert into public.zz_esiti (nome, ok, dettaglio) values (p_nome, false, sqlerrm);
  end;
  perform public.zz_reset();
end $$;

-- il comando deve fallire con un errore
create function public.zz_err(p_nome text, u uuid, p_stmt text) returns void language plpgsql as $$
begin
  perform public.zz_as(u);
  begin
    execute p_stmt;
    insert into public.zz_esiti (nome, ok, dettaglio) values (p_nome, false, 'doveva fallire e invece e riuscito');
  exception when others then
    insert into public.zz_esiti (nome, ok) values (p_nome, true);
  end;
  perform public.zz_reset();
end $$;

-- la query (select) deve restituire esattamente p_attese righe
create function public.zz_righe(p_nome text, u uuid, p_query text, p_attese int) returns void language plpgsql as $$
declare n int;
begin
  perform public.zz_as(u);
  begin
    execute 'select count(*) from (' || p_query || ') q' into n;
    insert into public.zz_esiti (nome, ok, dettaglio)
    values (p_nome, n = p_attese, case when n = p_attese then null else 'righe: ' || n || ', attese: ' || p_attese end);
  exception when others then
    insert into public.zz_esiti (nome, ok, dettaglio) values (p_nome, false, sqlerrm);
  end;
  perform public.zz_reset();
end $$;

-- il comando (update o delete) deve toccare esattamente p_attese righe
create function public.zz_tocca(p_nome text, u uuid, p_stmt text, p_attese int) returns void language plpgsql as $$
declare n int;
begin
  perform public.zz_as(u);
  begin
    execute p_stmt;
    get diagnostics n = row_count;
    insert into public.zz_esiti (nome, ok, dettaglio)
    values (p_nome, n = p_attese, case when n = p_attese then null else 'righe toccate: ' || n || ', attese: ' || p_attese end);
  exception when others then
    insert into public.zz_esiti (nome, ok, dettaglio) values (p_nome, false, sqlerrm);
  end;
  perform public.zz_reset();
end $$;

-- il comando deve fallire con questo messaggio esatto
create function public.zz_err_msg(p_nome text, u uuid, p_stmt text, p_messaggio text) returns void language plpgsql as $$
begin
  perform public.zz_as(u);
  begin
    execute p_stmt;
    insert into public.zz_esiti (nome, ok, dettaglio) values (p_nome, false, 'doveva fallire e invece e riuscito');
  exception when others then
    insert into public.zz_esiti (nome, ok, dettaglio)
    values (p_nome, sqlerrm = p_messaggio, case when sqlerrm = p_messaggio then null else 'errore: ' || sqlerrm end);
  end;
  perform public.zz_reset();
end $$;

-- come anon: la query (select) deve restituire esattamente p_attese righe
create function public.zz_anon_righe(p_nome text, p_query text, p_attese int) returns void language plpgsql as $$
declare n int;
begin
  perform public.zz_reset();
  set local role anon;
  begin
    execute 'select count(*) from (' || p_query || ') q' into n;
    insert into public.zz_esiti (nome, ok, dettaglio)
    values (p_nome, n = p_attese, case when n = p_attese then null else 'righe: ' || n || ', attese: ' || p_attese end);
  exception when others then
    insert into public.zz_esiti (nome, ok, dettaglio) values (p_nome, false, sqlerrm);
  end;
  perform public.zz_reset();
end $$;

-- come anon: il comando deve fallire con un errore
create function public.zz_anon_err(p_nome text, p_stmt text) returns void language plpgsql as $$
begin
  perform public.zz_reset();
  set local role anon;
  begin
    execute p_stmt;
    insert into public.zz_esiti (nome, ok, dettaglio) values (p_nome, false, 'doveva fallire e invece e riuscito');
  exception when others then
    insert into public.zz_esiti (nome, ok) values (p_nome, true);
  end;
  perform public.zz_reset();
end $$;

-- controllo fatto dal proprietario (senza ruolo): esito e dettaglio
create function public.zz_verifica(p_nome text, p_ok boolean, p_dettaglio text default null) returns void language plpgsql as $$
begin
  perform public.zz_reset();
  insert into public.zz_esiti (nome, ok, dettaglio)
  values (p_nome, coalesce(p_ok, false), case when coalesce(p_ok, false) then null else p_dettaglio end);
end $$;

-- frammenti di piano per i casi della 0006
create function public.zz_q(p_slot int, p_nome text, p_reddito numeric) returns text language sql as $$
  select json_build_object('slot', p_slot, 'display_name', p_nome, 'reddito_netto_mensile', p_reddito, 'quota_mensile', 0)::text $$;
create function public.zz_v(p_dal date, p_quote text[], p_voci text default '[]') returns text language sql as $$
  select '{"valido_dal": "' || p_dal || '", "giorno_versamento": 5, "regola": "parti_uguali", "totale_mensile": 0, "voci": '
    || p_voci || ', "quote": [' || array_to_string(p_quote, ', ') || ']}' $$;
create function public.zz_piano(p_versioni text[]) returns text language sql as $$
  select '{"versioni": [' || array_to_string(p_versioni, ', ') || ']}' $$;

-- CASI. Attori: A, B, C nella casa; D sempre fuori; E, F, G nella seconda casa; K entra nel piano.
do $test$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  b constant uuid := 'bbbbbbbb-0000-0000-0000-00000000000b';
  c constant uuid := 'cccccccc-0000-0000-0000-00000000000c';
  d constant uuid := 'dddddddd-0000-0000-0000-00000000000d';
  h uuid; codice text; conto_a uuid; conto_casa uuid; rep text;
  e constant uuid := 'eeeeeeee-0000-0000-0000-00000000000e';
  f constant uuid := 'ffffffff-0000-0000-0000-00000000000f';
  g constant uuid := '77777777-0000-0000-0000-000000000007';
  k constant uuid := '88888888-0000-0000-0000-000000000008';
  h2 uuid; codice2 text; codice3 text; codice4 text; pid2 uuid; pid_h uuid; tok_a text; tok_e text; bc uuid;
  tx_vuota uuid; mese2 date;
  conto_a2 uuid; conto_b uuid; conto_c uuid; conto_c2 uuid; conto_e uuid; conto_g uuid; conto_casa2 uuid;
  cat_a uuid; cat_b uuid; cat_casa uuid; goal_a uuid; goal_b uuid;
  tx_a_pers uuid; tx_b_pers uuid; tx_casa_a uuid; tx_carta_a uuid; tx_del_a uuid; tx_c uuid; tx_carta_c uuid;
  tr_pers_a uuid; tr_pers_c uuid; tr_pc uuid; tr_r uuid;
  oggi date := (now() at time zone 'Europe/Rome')::date;
  mese date := date_trunc('month', now() at time zone 'Europe/Rome')::date;
  s_pre numeric; s_casa0 numeric; s_a0 numeric; s_casa1 numeric; s_a1 numeric; v_c numeric; v_b numeric;
  vjson constant text := '{"valido_dal": "%s", "giorno_versamento": 5, "regola": "parti_uguali", "cuscinetto_obiettivo": 0, "cuscinetto_quota_mensile": 0, "arrotondamento": 10, "totale_mensile": 100, "voci": [{"nome": "Luce", "categoria_nome": "Luce", "frequenza_mesi": 2, "importo_ricorrenza": 110, "origine_stima": "suggerita", "ordine": 0}], "quote": [{"slot": 1, "display_name": "A", "reddito_netto_mensile": 1800, "quota_mensile": 50}, {"slot": 2, "display_name": "B", "reddito_netto_mensile": 1500, "quota_mensile": 40}, {"slot": 3, "display_name": "C", "reddito_netto_mensile": 1200, "quota_mensile": 30}, {"slot": 4, "display_name": "Ospite", "reddito_netto_mensile": 0, "quota_mensile": 0}]}';
  v1 text; v2 text; v3 text; pl1 text; pl2 text; pl_passato text; pl_reddito text;
begin
  -- Preparazione come proprietario (senza ruolo): casa, membri, conti
  insert into public.households (nome, created_by) values ('Casa prova', a) returning id into h;
  insert into public.household_members (household_id, user_id, display_name, slot)
    values (h, a, 'A', 1), (h, b, 'B', 2);
  insert into public.accounts (user_id, nome, saldo_attuale) values (a, 'Conto personale A', 500)
    returning id into conto_a;
  insert into public.accounts (user_id, nome, saldo_attuale, household_id) values (a, 'Conto comune', 1000, h)
    returning id into conto_casa;

  -- Isolamento
  perform public.zz_righe('B non legge i conti personali di A', b,
    format('select 1 from public.accounts where id = %L', conto_a), 0);
  perform public.zz_righe('B legge il conto comune creato da A', b,
    format('select 1 from public.accounts where id = %L', conto_casa), 1);
  perform public.zz_righe('D (fuori) non legge il conto comune', d,
    format('select 1 from public.accounts where id = %L', conto_casa), 0);
  perform public.zz_err('D non puo scrivere nella casa', d,
    format('insert into public.accounts (nome, household_id) values (''x'', %L)', h));
  perform public.zz_err('insert di casa con user_id altrui fallisce', b,
    format('insert into public.accounts (nome, household_id, user_id) values (''x'', %L, %L)', h, a));
  perform public.zz_ok('B aggiorna il saldo del conto comune creato da A', b,
    format('select public.adjust_account_balance(%L, 50)', conto_casa));
  perform public.zz_err('household_id non si cambia', b,
    format('update public.accounts set household_id = null where id = %L', conto_casa));
  perform public.zz_err('niente scrittura diretta su transfers', b,
    format('insert into public.transfers (household_id, importo, data, causale) values (%L, 1, current_date, ''versamento'')', h));

  -- Invito e ingresso
  perform public.zz_as(a);
  select public.create_invite(h) into codice;
  perform public.zz_reset();
  perform public.zz_err('codice errato', c, 'select public.join_household(''ZZZZZZZZ'', ''C'')');
  perform public.zz_ok('codice valido anche in minuscolo con trattino', c,
    format('select public.join_household(%L, ''C'')', lower(substr(codice, 1, 4) || '-' || substr(codice, 5))));

  -- Dati di prova come proprietario: conti, categorie, obiettivi e movimenti personali e di casa
  insert into public.accounts (user_id, nome, saldo_attuale) values (a, 'Conto personale A2', 0) returning id into conto_a2;
  insert into public.accounts (user_id, nome, saldo_attuale) values (b, 'Conto personale B', 300) returning id into conto_b;
  insert into public.accounts (user_id, nome, saldo_attuale) values (c, 'Conto personale C', 100) returning id into conto_c;
  insert into public.accounts (user_id, nome, saldo_attuale) values (c, 'Conto personale C2', 0) returning id into conto_c2;
  insert into public.categories (user_id, nome, tipo) values (a, 'Cibo A', 'expense') returning id into cat_a;
  insert into public.categories (user_id, nome, tipo) values (b, 'Cibo B', 'expense') returning id into cat_b;
  insert into public.categories (user_id, nome, tipo, household_id) values (a, 'Spesa casa', 'expense', h) returning id into cat_casa;
  insert into public.budget_goals (user_id, nome, importo_target, modalita) values (a, 'Obiettivo A', 500, 'bloccato') returning id into goal_a;
  insert into public.budget_goals (user_id, nome, importo_target, modalita) values (b, 'Obiettivo B', 500, 'bloccato') returning id into goal_b;
  insert into public.transactions (user_id, tipo, importo, data, categoria_id, account_id, descrizione)
    values (a, 'expense', 10, oggi, cat_a, conto_a, 'Personale A') returning id into tx_a_pers;
  insert into public.transactions (user_id, tipo, importo, data, account_id, descrizione)
    values (b, 'expense', 10, oggi, conto_b, 'Personale B') returning id into tx_b_pers;
  insert into public.transfers (user_id, da_account_id, a_account_id, importo, data, causale)
    values (a, conto_a, conto_a2, 15, oggi, 'altro') returning id into tr_pers_a;
  insert into public.transfers (user_id, da_account_id, a_account_id, importo, data, causale)
    values (c, conto_c, conto_c2, 15, oggi, 'altro') returning id into tr_pers_c;
  insert into public.transactions (user_id, tipo, importo, data, categoria_id, account_id, descrizione, household_id)
    values (a, 'expense', 30, oggi, cat_casa, conto_casa, 'Casa A', h) returning id into tx_casa_a;
  insert into public.transactions (user_id, tipo, importo, data, account_id, descrizione, household_id, pagata_da_user_id)
    values (a, 'expense', 20, oggi, conto_a, 'Carta A', h, a) returning id into tx_carta_a;
  insert into public.transactions (user_id, tipo, importo, data, account_id, descrizione, household_id)
    values (a, 'expense', 5, oggi, conto_casa, 'Da cancellare', h) returning id into tx_del_a;
  insert into public.transactions (user_id, tipo, importo, data, account_id, descrizione, household_id)
    values (c, 'expense', 7, oggi, conto_casa, 'Casa C', h) returning id into tx_c;
  insert into public.transactions (user_id, tipo, importo, data, account_id, descrizione, household_id, pagata_da_user_id)
    values (c, 'expense', 9, oggi, conto_c, 'Carta C', h, c) returning id into tx_carta_c;

  -- 1. Isolamento dei dati personali
  perform public.zz_righe('A non legge i conti personali di B', a,
    format('select 1 from public.accounts where id = %L', conto_b), 0);
  perform public.zz_righe('A non legge le categorie personali di B', a,
    format('select 1 from public.categories where id = %L', cat_b), 0);
  perform public.zz_righe('A non legge gli obiettivi personali di B', a,
    format('select 1 from public.budget_goals where id = %L', goal_b), 0);
  perform public.zz_righe('A non legge le transazioni personali di B', a,
    format('select 1 from public.transactions where id = %L', tx_b_pers), 0);
  perform public.zz_righe('B non legge le categorie personali di A', b,
    format('select 1 from public.categories where id = %L', cat_a), 0);
  perform public.zz_righe('B non legge gli obiettivi personali di A', b,
    format('select 1 from public.budget_goals where id = %L', goal_a), 0);
  perform public.zz_righe('B non legge le transazioni personali di A', b,
    format('select 1 from public.transactions where id = %L', tx_a_pers), 0);
  perform public.zz_righe('A legge le proprie transazioni personali', a,
    format('select 1 from public.transactions where id = %L', tx_a_pers), 1);
  perform public.zz_righe('D non legge la casa', d,
    format('select 1 from public.households where id = %L', h), 0);
  perform public.zz_righe('D non legge i membri della casa', d,
    format('select 1 from public.household_members where household_id = %L', h), 0);
  perform public.zz_righe('D non legge le spese di casa', d,
    format('select 1 from public.transactions where household_id = %L', h), 0);

  -- 2. Lettura e scrittura delle righe di casa
  perform public.zz_righe('B legge la categoria di casa creata da A', b,
    format('select 1 from public.categories where id = %L', cat_casa), 1);
  perform public.zz_ok('B crea una categoria di casa', b,
    format('insert into public.categories (user_id, nome, tipo, household_id) values (%L, ''Casa B'', ''expense'', %L)', b, h));
  perform public.zz_err('insert di categoria di casa con user_id altrui fallisce', b,
    format('insert into public.categories (user_id, nome, tipo, household_id) values (%L, ''Altrui'', ''expense'', %L)', a, h));
  perform public.zz_err('D non puo creare categorie di casa', d,
    format('insert into public.categories (user_id, nome, tipo, household_id) values (%L, ''Intrusa'', ''expense'', %L)', d, h));

  -- 3. Campi che non si cambiano
  -- qui fallisce prima il controllo dei riferimenti (la categoria e di casa): il comando deve comunque fallire
  perform public.zz_err('household_id non si cambia sulla spesa di casa', a,
    format('update public.transactions set household_id = null where id = %L', tx_casa_a));
  perform public.zz_err_msg('user_id non si cambia sulla spesa di casa', a,
    format('update public.transactions set user_id = %L where id = %L', b, tx_casa_a), 'user_id non modificabile');
  perform public.zz_err_msg('pagata_da_user_id non si cambia sulla spesa di casa', a,
    format('update public.transactions set pagata_da_user_id = %L where id = %L', a, tx_casa_a), 'pagata_da_user_id non modificabile');

  -- 4. Riferimenti di una riga di casa
  perform public.zz_err_msg('una spesa di casa non riferisce una categoria personale', a,
    format('insert into public.transactions (user_id, tipo, importo, data, categoria_id, household_id, descrizione) values (%L, ''expense'', 1, %L, %L, %L, ''x'')', a, oggi, cat_a, h),
    'categoria non valida per questa casa');
  perform public.zz_err_msg('una spesa di casa non riferisce un obiettivo personale', a,
    format('insert into public.transactions (user_id, tipo, importo, data, goal_id, household_id, descrizione) values (%L, ''expense'', 1, %L, %L, %L, ''x'')', a, oggi, goal_a, h),
    'obiettivo non valido per questa casa');
  perform public.zz_err_msg('una spesa di casa non riferisce un conto personale senza carta', a,
    format('insert into public.transactions (user_id, tipo, importo, data, account_id, household_id, descrizione) values (%L, ''expense'', 1, %L, %L, %L, ''x'')', a, oggi, conto_a, h),
    'conto non valido per questa casa');
  perform public.zz_ok('una spesa di casa con carta personale riferisce il conto personale', a,
    format('insert into public.transactions (user_id, tipo, importo, data, account_id, household_id, pagata_da_user_id, descrizione) values (%L, ''expense'', 4, %L, %L, %L, %L, ''Carta A ok'')', a, oggi, conto_a, h, a));

  -- 5. Spese di casa pagate con la carta personale
  perform public.zz_tocca('B non modifica una spesa di casa pagata con la carta di A', b,
    format('update public.transactions set descrizione = ''Modificata da B'' where id = %L', tx_carta_a), 0);
  perform public.zz_tocca('B non cancella una spesa di casa pagata con la carta di A', b,
    format('delete from public.transactions where id = %L', tx_carta_a), 0);
  perform public.zz_tocca('B modifica una spesa di casa normale scritta da A', b,
    format('update public.transactions set descrizione = ''Modificata da B'' where id = %L', tx_casa_a), 1);
  perform public.zz_tocca('B cancella una spesa di casa normale scritta da A', b,
    format('delete from public.transactions where id = %L', tx_del_a), 1);

  -- 6. Conti di casa
  perform public.zz_tocca('B non cancella un conto di casa', b,
    format('delete from public.accounts where id = %L', conto_casa), 0);

  -- 7. Trasferimenti personali e scritture dirette
  perform public.zz_righe('B non legge il trasferimento personale di A', b,
    format('select 1 from public.transfers where id = %L', tr_pers_a), 0);
  perform public.zz_righe('A legge il proprio trasferimento personale', a,
    format('select 1 from public.transfers where id = %L', tr_pers_a), 1);
  perform public.zz_err('A non inserisce transfers direttamente', a,
    format('insert into public.transfers (user_id, importo, data, causale, household_id) values (%L, 1, %L, ''versamento'', %L)', a, oggi, h));
  perform public.zz_err('A non modifica transfers direttamente', a,
    format('update public.transfers set importo = 1 where id = %L', tr_pers_a));
  perform public.zz_err('A non cancella transfers direttamente', a,
    format('delete from public.transfers where id = %L', tr_pers_a));

  -- 8. Codici di invito
  perform public.zz_as(a);
  select public.create_invite(h) into codice2;
  perform public.zz_reset();
  perform public.zz_err_msg('il codice revocato dalla rigenerazione non vale piu', d,
    format('select public.join_household(%L, ''D'')', codice), 'Codice non valido o scaduto');
  perform public.zz_err_msg('un codice inesistente non entra', d,
    'select public.join_household(''ZZZZZZZZ'', ''D'')', 'Codice non valido o scaduto');
  update public.household_invites set scade_il = now() - interval '1 day' where household_invites.codice = codice2;
  perform public.zz_err_msg('un codice scaduto non entra', d,
    format('select public.join_household(%L, ''D'')', codice2), 'Codice non valido o scaduto');
  -- seconda casa: E la fonda, F e G entrano con lo stesso codice (una volta in minuscolo con trattino)
  perform public.zz_as(e);
  select public.create_household('Casa due', 'E') into h2;
  select public.create_invite(h2) into codice3;
  perform public.zz_reset();
  perform public.zz_ok('F entra con il codice valido', f,
    format('select public.join_household(%L, ''F'')', codice3));
  perform public.zz_ok('G entra con il codice in minuscolo con trattino', g,
    format('select public.join_household(%L, ''G'')', lower(substr(codice3, 1, 4) || '-' || substr(codice3, 5))));
  insert into public.accounts (user_id, household_id, nome, saldo_attuale) values (e, h2, 'Conto comune due', 500) returning id into conto_casa2;
  insert into public.accounts (user_id, nome, saldo_attuale) values (e, 'Conto personale E', 300) returning id into conto_e;
  insert into public.accounts (user_id, nome, saldo_attuale) values (g, 'Conto personale G', 300) returning id into conto_g;

  -- 9. Tre membri: A con C, un per conto di fra A e B, un quarto utente fuori
  perform public.zz_tocca('A modifica una spesa di casa scritta da C', a,
    format('update public.transactions set descrizione = ''Modificata da A'' where id = %L', tx_c), 1);
  perform public.zz_tocca('A non modifica una spesa di casa pagata con la carta di C', a,
    format('update public.transactions set descrizione = ''Modificata da A'' where id = %L', tx_carta_c), 0);
  perform public.zz_tocca('A non cancella una spesa di casa pagata con la carta di C', a,
    format('delete from public.transactions where id = %L', tx_carta_c), 0);
  perform public.zz_righe('A non legge il trasferimento personale di C', a,
    format('select 1 from public.transfers where id = %L', tr_pers_c), 0);
  perform public.zz_as(a);
  select public.record_transfer(h, 'versamento', 40, oggi, conto_a, conto_casa, null, b, mese, false, null) into tr_pc;
  perform public.zz_reset();
  select public._casa_debiti_aperti(h, c) into v_c;
  select public._casa_debiti_aperti(h, b) into v_b;
  perform public.zz_verifica('un per conto di fra A e B non coinvolge C',
    v_c = 0 and v_b = 40, format('debiti di C %s, debiti di B %s', v_c, v_b));
  perform public.zz_righe('D non legge i trasferimenti di casa', d,
    format('select 1 from public.transfers where household_id = %L', h), 0);
  perform public.zz_righe('D non legge i conti di casa', d,
    format('select 1 from public.accounts where household_id = %L', h), 0);
  perform public.zz_righe('D non legge le categorie di casa', d,
    format('select 1 from public.categories where household_id = %L', h), 0);

  -- 10. Uscita dalla casa
  perform public.zz_err_msg('A non esce con credito aperto (spesa con carta personale)', a,
    'select public.leave_household()', 'CREDITO_APERTO');
  perform public.zz_err_msg('B non esce con debito aperto come debitore', b,
    'select public.leave_household()', 'DEBITO_APERTO');
  -- seconda casa: E paga per F (F debitore, E creditore); G deve una quota del mese
  insert into public.household_plans (household_id, valido_dal, giorno_versamento, regola, totale_mensile, created_by)
    values (h2, mese, 5, 'parti_uguali', 100, e) returning id into pid2;
  insert into public.household_plan_shares (plan_id, slot, user_id, display_name, quota_mensile)
    values (pid2, 1, e, 'E', 0), (pid2, 2, f, 'F', 0), (pid2, 3, g, 'G', 50);
  perform public.zz_ok('E versa per conto di F', e,
    format('select public.record_transfer(%L, ''versamento'', 40, %L, %L, %L, null, %L, %L, false, null)', h2, oggi, conto_e, conto_casa2, f, mese));
  perform public.zz_err_msg('F non esce con debito aperto come debitore', f,
    'select public.leave_household()', 'DEBITO_APERTO');
  perform public.zz_err_msg('E non esce con debito aperto come creditore', e,
    'select public.leave_household()', 'DEBITO_APERTO');
  perform public.zz_err_msg('G non esce con arretrati aperti', g,
    'select public.leave_household()', 'ARRETRATI_APERTI');
  perform public.zz_ok('G versa la quota del mese corrente', g,
    format('select public.record_transfer(%L, ''versamento'', 50, %L, %L, %L, null, null, %L, false, null)', h2, oggi, conto_g, conto_casa2, mese));
  perform public.zz_ok('G esce quando non ha registri aperti', g, 'select public.leave_household()');
  perform public.zz_righe('G non legge piu la casa che ha lasciato', g,
    format('select 1 from public.households where id = %L', h2), 0);
  perform public.zz_righe('G non legge piu i trasferimenti della casa che ha lasciato', g,
    format('select 1 from public.transfers where household_id = %L', h2), 0);
  perform public.zz_as(f);
  select public.record_transfer(h2, 'restituzione', 40, oggi, null, null, e, null, null, true, null) into tr_r;
  perform public.zz_reset();
  perform public.zz_ok('F esce quando il debito e stato restituito', f, 'select public.leave_household()');
  perform public.zz_err_msg('l ultimo membro non puo uscire', e,
    'select public.leave_household()', 'ULTIMO_MEMBRO');

  -- 11. Chiusura della casa
  perform public.zz_as(e);
  select public.rotate_calendar_feed() into tok_e;
  perform public.zz_reset();
  perform public.zz_ok('l ultimo membro chiude la casa', e, 'select public.close_household()');
  perform public.zz_righe('dopo la chiusura la casa resta leggibile', e,
    format('select 1 from public.households where id = %L', h2), 1);
  perform public.zz_err('dopo la chiusura non si scrive una spesa di casa', e,
    format('insert into public.transactions (user_id, tipo, importo, data, household_id, descrizione) values (%L, ''expense'', 1, %L, %L, ''x'')', e, oggi, h2));
  perform public.zz_tocca('dopo la chiusura il nome della casa non cambia', e,
    format('update public.households set nome = ''Altro'' where id = %L', h2), 0);
  perform public.zz_ok('dopo la chiusura il membro crea una nuova casa', e,
    'select public.create_household(''Casa nuova'', ''E'')');

  -- 13. Feed del calendario
  perform public.zz_as(a);
  select public.rotate_calendar_feed() into tok_a;
  perform public.zz_reset();
  perform public.zz_anon_righe('il token valido restituisce solo dati di casa',
    format('select 1 where public.get_calendar_feed(%L) ?& array[''nome_casa'', ''membro'', ''giorno_versamento'', ''quota_mensile'', ''obiettivi'', ''credito_proprio'', ''credito_altri'', ''ultimo_controllo'', ''ultimo_checkin''] and (select count(*) from jsonb_object_keys(public.get_calendar_feed(%L))) = 9', tok_a, tok_a), 1);
  perform public.zz_anon_righe('un token errato restituisce nullo',
    format('select 1 where public.get_calendar_feed(%L) is null', repeat('0', 64)), 1);
  perform public.zz_anon_righe('il token di una casa archiviata restituisce nullo',
    format('select 1 where public.get_calendar_feed(%L) is null', tok_e), 1);
  update public.calendar_feeds set revocato_il = null where token = tok_e;
  perform public.zz_anon_righe('il token di una casa archiviata non vale anche se non revocato',
    format('select 1 where public.get_calendar_feed(%L) is null', tok_e), 1);
  perform public.zz_ok('A revoca il feed', a, 'select public.revoke_calendar_feed()');
  perform public.zz_anon_righe('un token revocato restituisce nullo',
    format('select 1 where public.get_calendar_feed(%L) is null', tok_a), 1);
  perform public.zz_righe('un membro non legge il feed di un altro', b,
    format('select 1 from public.calendar_feeds where user_id = %L', a), 0);
  perform public.zz_anon_err('anon non puo creare una casa', 'select public.create_household(''X'', ''X'')');
  perform public.zz_anon_err('anon non legge transfers', 'select 1 from public.transfers');
  perform public.zz_anon_err('anon non legge calendar_feeds', 'select 1 from public.calendar_feeds');

  -- 12. Trasferimenti: regole e saldi
  perform public.zz_err_msg('un versamento per conto di un non membro fallisce', a,
    format('select public.record_transfer(%L, ''versamento'', 10, %L, %L, %L, null, %L, %L, false, null)', h, oggi, conto_a, conto_casa, d, mese),
    'membro non valido');
  perform public.zz_err_msg('un versamento per conto di se stessi fallisce', a,
    format('select public.record_transfer(%L, ''versamento'', 10, %L, %L, %L, null, %L, %L, false, null)', h, oggi, conto_a, conto_casa, a, mese),
    'combinazione non valida');
  perform public.zz_err_msg('un rimborso del beneficiario verso se stesso senza registrazione fallisce', a,
    format('select public.record_transfer(%L, ''rimborso'', 5, %L, null, null, %L, null, null, false, null)', h, oggi, a),
    'rinuncia non valida');
  select saldo_attuale into s_casa0 from public.accounts where id = conto_casa;
  select saldo_attuale into s_a0 from public.accounts where id = conto_a;
  perform public.zz_as(b);
  select public.record_transfer(h, 'rimborso', 5, oggi, conto_casa, null, a, null, null, false, null) into tr_r;
  perform public.zz_reset();
  select saldo_attuale into s_casa1 from public.accounts where id = conto_casa;
  select saldo_attuale into s_a1 from public.accounts where id = conto_a;
  perform public.zz_verifica('il rimborso registrato da B aggiorna entrambi i saldi',
    s_casa1 = s_casa0 - 5 and s_a1 = s_a0 + 5,
    format('casa %s -> %s, A %s -> %s', s_casa0, s_casa1, s_a0, s_a1));
  perform public.zz_err_msg('solo l autore cancella un trasferimento', a,
    format('select public.delete_transfer(%L)', tr_r), 'movimento non trovato');
  perform public.zz_ok('l autore cancella il rimborso', b, format('select public.delete_transfer(%L)', tr_r));
  select saldo_attuale into s_casa1 from public.accounts where id = conto_casa;
  select saldo_attuale into s_a1 from public.accounts where id = conto_a;
  perform public.zz_verifica('la cancellazione del rimborso ripristina i saldi',
    s_casa1 = s_casa0 and s_a1 = s_a0,
    format('casa %s (atteso %s), A %s (atteso %s)', s_casa1, s_casa0, s_a1, s_a0));

  -- 14. Piano della quota
  v1 := format(vjson, to_char(mese, 'YYYY-MM-DD'));
  v2 := format(vjson, to_char(mese + interval '1 month', 'YYYY-MM-DD'));
  pl1 := '{"versioni": [' || v1 || ']}';
  pl2 := '{"versioni": [' || v1 || ', ' || v2 || ']}';
  pl_passato := '{"versioni": [' || replace(v1, to_char(mese, 'YYYY-MM-DD'), '2020-01-01') || ']}';
  pl_reddito := '{"versioni": [' || replace(v1,
    '"slot": 2, "display_name": "B", "reddito_netto_mensile": 1500',
    '"slot": 2, "display_name": "B", "reddito_netto_mensile": 1600') || ']}';
  perform public.zz_ok('A salva il piano con voci e quote', a,
    format('select public.save_household_plan(%L, %L::jsonb)', h, pl1));
  perform public.zz_err_msg('un piano con valido_dal nel passato non si salva', a,
    format('select public.save_household_plan(%L, %L::jsonb)', h, pl_passato), 'valido_dal nel passato');
  perform public.zz_err_msg('il reddito di un altro membro non si cambia', a,
    format('select public.save_household_plan(%L, %L::jsonb)', h, pl_reddito), 'il reddito di un altro membro non si modifica');
  perform public.zz_ok('A salva due versioni del piano in una chiamata', a,
    format('select public.save_household_plan(%L, %L::jsonb)', h, pl2));
  perform public.zz_verifica('le due versioni del piano sono salvate',
    (select count(*) from public.household_plans where household_id = h and valido_dal in (mese, (mese + interval '1 month')::date)) = 2,
    'versioni salvate diverse da 2');

  -- 14b. Una revisione sostituisce il futuro (migrazione 0005)
  v3 := format(vjson, to_char(mese + interval '3 month', 'YYYY-MM-DD'));
  perform public.zz_ok('A salva tre versioni (mese, +1, +3)', a,
    format('select public.save_household_plan(%L, %L::jsonb)', h,
      '{"versioni": [' || v1 || ', ' || v2 || ', ' || v3 || ']}'));
  perform public.zz_verifica('le tre versioni sono salvate',
    (select count(*) from public.household_plans where household_id = h
       and valido_dal in (mese, (mese + interval '1 month')::date, (mese + interval '3 month')::date)) = 3,
    'versioni salvate diverse da 3');
  perform public.zz_ok('A rivede dal mese +1 con una sola versione', a,
    format('select public.save_household_plan(%L, %L::jsonb)', h, '{"versioni": [' || v2 || ']}'));
  perform public.zz_verifica('la versione successiva non piu nel payload e sparita',
    not exists (select 1 from public.household_plans where household_id = h
                and valido_dal = (mese + interval '3 month')::date),
    'la versione a +3 mesi e ancora presente');
  perform public.zz_verifica('la versione precedente al payload resta',
    exists (select 1 from public.household_plans where household_id = h and valido_dal = mese),
    'la versione del mese corrente e sparita');
  perform public.zz_verifica('la versione nel payload resta',
    exists (select 1 from public.household_plans where household_id = h
            and valido_dal = (mese + interval '1 month')::date),
    'la versione a +1 mese e sparita');
  perform public.zz_verifica('voci e quote della versione eliminata cadono a cascata',
    not exists (select 1 from public.household_plan_items i
                where i.plan_id not in (select id from public.household_plans))
    and not exists (select 1 from public.household_plan_shares s
                where s.plan_id not in (select id from public.household_plans)),
    'righe orfane');

  -- 15. Ingresso nel segnaposto del piano; un ex membro non riprende la sua posizione
  perform public.zz_as(a);
  select public.create_invite(h) into codice4;
  perform public.zz_reset();
  perform public.zz_ok('K entra e occupa il segnaposto del piano', k,
    format('select public.join_household(%L, ''K'')', codice4));
  perform public.zz_verifica('K ha lo slot 4 del segnaposto',
    (select slot from public.household_members where household_id = h and user_id = k) = 4, 'slot diverso da 4');
  perform public.zz_ok('K esce', k, 'select public.leave_household()');
  perform public.zz_ok('K rientra con lo stesso codice', k,
    format('select public.join_household(%L, ''K'')', codice4));
  perform public.zz_verifica('K rientra in uno slot nuovo',
    (select slot from public.household_members where household_id = h and user_id = k) = 5, 'slot diverso da 5');

  -- 16. Controllo del saldo del conto comune
  select saldo_attuale into s_pre from public.accounts where id = conto_casa;
  perform public.zz_as(b);
  select public.record_balance_check(conto_casa, s_pre - 50, oggi) into bc;
  perform public.zz_reset();
  perform public.zz_verifica('il controllo del saldo crea la spesa non registrata',
    exists (select 1 from public.transactions where household_id = h and descrizione = 'Spese non registrate'
            and origine = 'riconciliazione' and importo = 50),
    'spesa di riconciliazione mancante');
  perform public.zz_verifica('il controllo del saldo allinea il conto',
    (select saldo_attuale from public.accounts where id = conto_casa) = s_pre - 50, 'saldo non allineato');

  -- 17. Colonne di households
  perform public.zz_err('A non archivia la casa', a,
    format('update public.households set archiviata_il = now() where id = %L', h));
  perform public.zz_err('A non cambia il creatore della casa', a,
    format('update public.households set created_by = %L where id = %L', b, h));
  perform public.zz_tocca('A rinomina la casa', a,
    format('update public.households set nome = ''Casa rinominata'' where id = %L', h), 1);

  -- 18. Immutabilita di household_id: il messaggio e quello del trigger forbid_household_change.
  -- Righe costruite in modo che solo quel trigger possa fallire (nessuna categoria, nessun conto).
  perform public.zz_err_msg('household_id non si cambia su un conto personale portato in casa', a,
    format('update public.accounts set household_id = %L where id = %L', h, conto_a2),
    'household_id non modificabile');
  insert into public.transactions (user_id, tipo, importo, data, descrizione, household_id)
    values (a, 'expense', 3, oggi, 'Senza conto ne categoria', h) returning id into tx_vuota;
  perform public.zz_err_msg('household_id non si cambia su una spesa di casa senza conto ne categoria', a,
    format('update public.transactions set household_id = null where id = %L', tx_vuota),
    'household_id non modificabile');

  -- 19. Piano della quota: si scrive solo con save_household_plan
  mese2 := (mese + interval '2 months')::date;
  select id into pid_h from public.household_plans where household_id = h and valido_dal = mese;
  perform public.zz_err('A non inserisce una versione del piano direttamente', a,
    format('insert into public.household_plans (household_id, valido_dal, giorno_versamento, regola, created_by) values (%L, %L, 5, ''parti_uguali'', %L)', h, mese2, a));
  perform public.zz_err('A non aggiorna una versione del piano direttamente', a,
    format('update public.household_plans set totale_mensile = 1 where id = %L', pid_h));
  perform public.zz_err('A non cancella una versione del piano direttamente', a,
    format('delete from public.household_plans where id = %L', pid_h));
  perform public.zz_err('A non inserisce una voce del piano direttamente', a,
    format('insert into public.household_plan_items (plan_id, nome, frequenza_mesi, importo_ricorrenza) values (%L, ''Voce'', 1, 1)', pid_h));
  perform public.zz_err('A non cambia una voce del piano direttamente', a,
    format('update public.household_plan_items set nome = ''X'' where plan_id = %L', pid_h));
  perform public.zz_err('A non cancella una voce del piano direttamente', a,
    format('delete from public.household_plan_items where plan_id = %L', pid_h));
  perform public.zz_err('A non inserisce una quota direttamente', a,
    format('insert into public.household_plan_shares (plan_id, slot, display_name, quota_mensile) values (%L, 9, ''Intruso'', 0)', pid_h));
  perform public.zz_err('A non cambia la quota di B direttamente', a,
    format('update public.household_plan_shares set quota_mensile = 0 where plan_id = %L and slot = 2', pid_h));
  perform public.zz_err('A non assegna un membro a una quota direttamente', a,
    format('update public.household_plan_shares set user_id = %L where plan_id = %L and slot = 4', a, pid_h));
  perform public.zz_err('A non cancella una quota direttamente', a,
    format('delete from public.household_plan_shares where plan_id = %L', pid_h));
  perform public.zz_err_msg('D non salva un piano tramite la funzione', d,
    format('select public.save_household_plan(%L, %L::jsonb)', h, pl1), 'casa non scrivibile');
  perform public.zz_err_msg('E non salva il piano di una casa archiviata', e,
    format('select public.save_household_plan(%L, %L::jsonb)', h2, pl1), 'casa non scrivibile');
  perform public.zz_ok('A salva il piano tramite la funzione dopo i tentativi diretti', a,
    format('select public.save_household_plan(%L, %L::jsonb)', h, pl1));
  perform public.zz_verifica('la quota di B resta quella salvata dalla funzione',
    (select quota_mensile from public.household_plan_shares where plan_id = pid_h and slot = 2) = 40,
    'quota di B diversa da 40');

  -- 20. Redditi di altri membri (0006): si confrontano con l'ultimo valore di tutte le versioni
  declare
    p1 constant uuid := '11111111-0000-0000-0000-000000000011';
    q1 constant uuid := '12121212-0000-0000-0000-000000000012';
    r1 constant uuid := '13131313-0000-0000-0000-000000000013';
    n1 constant uuid := '21212121-0000-0000-0000-000000000021';
    n2 constant uuid := '22222222-0000-0000-0000-000000000022';
    n3 constant uuid := '23232323-0000-0000-0000-000000000023';
    n4 constant uuid := '24242424-0000-0000-0000-000000000024';
    h3 uuid; h4 uuid; cd text; cat_h3 uuid; goal_h3 uuid; pid_p uuid;
    m2 date := (mese + interval '2 months')::date;
    m1p date := (mese + interval '1 month')::date;
  begin
    perform public.zz_as(p1);
    select public.create_household('Casa redditi', 'P') into h3;
    select public.create_invite(h3) into cd;
    perform public.zz_reset();
    perform public.zz_ok('Q entra nella casa dei redditi', q1, format('select public.join_household(%L, ''Q'')', cd));
    perform public.zz_ok('P salva il piano con Q a 800', p1, format('select public.save_household_plan(%L, %L::jsonb)', h3,
      public.zz_piano(array[public.zz_v(mese, array[public.zz_q(1, 'P', 1000), public.zz_q(2, 'Q', 800)])])));
    perform public.zz_ok('Q corregge il proprio reddito in una versione successiva', q1, format('select public.save_household_plan(%L, %L::jsonb)', h3,
      public.zz_piano(array[
        public.zz_v(mese, array[public.zz_q(1, 'P', 1000), public.zz_q(2, 'Q', 800)]),
        public.zz_v(m2, array[public.zz_q(1, 'P', 1000), public.zz_q(2, 'Q', 900)])])));
    perform public.zz_err_msg('P dal mese corrente col vecchio reddito di Q viene rifiutato', p1,
      format('select public.save_household_plan(%L, %L::jsonb)', h3,
        public.zz_piano(array[public.zz_v(mese, array[public.zz_q(1, 'P', 1000), public.zz_q(2, 'Q', 800)])])),
      'il reddito di un altro membro non si modifica');
    perform public.zz_verifica('la correzione di Q nella versione successiva non e stata cancellata',
      exists (select 1 from public.household_plans pl join public.household_plan_shares sh on sh.plan_id = pl.id
              where pl.household_id = h3 and pl.valido_dal = m2 and sh.slot = 2 and sh.reddito_netto_mensile = 900),
      'versione successiva mancante o cambiata');
    perform public.zz_ok('P salva col reddito aggiornato di Q', p1, format('select public.save_household_plan(%L, %L::jsonb)', h3,
      public.zz_piano(array[
        public.zz_v(mese, array[public.zz_q(1, 'P', 1000), public.zz_q(2, 'Q', 900)]),
        public.zz_v(m2, array[public.zz_q(1, 'P', 1000), public.zz_q(2, 'Q', 900)])])));
    -- una posizione presente solo in una versione successiva
    perform public.zz_as(p1);
    select public.create_invite(h3) into cd;
    perform public.zz_reset();
    perform public.zz_ok('R entra nella casa dei redditi', r1, format('select public.join_household(%L, ''R'')', cd));
    perform public.zz_verifica('R ha la posizione 3',
      (select slot from public.household_members where household_id = h3 and user_id = r1) = 3, 'slot diverso da 3');
    perform public.zz_ok('R salva la propria quota solo dalla versione successiva', r1, format('select public.save_household_plan(%L, %L::jsonb)', h3,
      public.zz_piano(array[
        public.zz_v(mese, array[public.zz_q(1, 'P', 1000), public.zz_q(2, 'Q', 900)]),
        public.zz_v(m2, array[public.zz_q(1, 'P', 1000), public.zz_q(2, 'Q', 900), public.zz_q(3, 'R', 700)])])));
    perform public.zz_err_msg('il reddito di R presente solo in una versione successiva e protetto', p1,
      format('select public.save_household_plan(%L, %L::jsonb)', h3,
        public.zz_piano(array[public.zz_v(m1p, array[public.zz_q(1, 'P', 1000), public.zz_q(2, 'Q', 900), public.zz_q(3, 'R', 500)])])),
      'il reddito di un altro membro non si modifica');
    perform public.zz_verifica('la versione con R non e stata cancellata dal rifiuto',
      exists (select 1 from public.household_plans where household_id = h3 and valido_dal = m2), 'versione a +2 mesi sparita');

    -- 21. Voci del piano: categoria e obiettivo devono essere della casa (0006)
    insert into public.categories (user_id, nome, tipo, household_id) values (p1, 'Luce casa redditi', 'expense', h3) returning id into cat_h3;
    insert into public.budget_goals (user_id, nome, importo_target, modalita, household_id)
      values (p1, 'Obiettivo casa redditi', 500, 'bloccato', h3) returning id into goal_h3;
    perform public.zz_err_msg('una voce con la categoria personale di A non si salva', p1,
      format('select public.save_household_plan(%L, %L::jsonb)', h3,
        public.zz_piano(array[public.zz_v(mese, array[public.zz_q(1, 'P', 1000), public.zz_q(2, 'Q', 900)],
          format('[{"nome": "X", "categoria_id": "%s", "frequenza_mesi": 1, "importo_ricorrenza": 10}]', cat_a))])),
      'categoria non appartenente alla casa');
    perform public.zz_err_msg('una voce con l obiettivo personale di A non si salva', p1,
      format('select public.save_household_plan(%L, %L::jsonb)', h3,
        public.zz_piano(array[public.zz_v(mese, array[public.zz_q(1, 'P', 1000), public.zz_q(2, 'Q', 900)],
          format('[{"nome": "X", "goal_id": "%s", "frequenza_mesi": 1, "importo_ricorrenza": 10}]', goal_a))])),
      'obiettivo non appartenente alla casa');
    perform public.zz_ok('una voce con categoria e obiettivo della casa si salva', p1,
      format('select public.save_household_plan(%L, %L::jsonb)', h3,
        public.zz_piano(array[public.zz_v(mese, array[public.zz_q(1, 'P', 1000), public.zz_q(2, 'Q', 900)],
          format('[{"nome": "X", "categoria_id": "%s", "goal_id": "%s", "frequenza_mesi": 1, "importo_ricorrenza": 10}]', cat_h3, goal_h3))])));

    -- 22. Ingresso nel segnaposto giusto (0006)
    perform public.zz_as(n1);
    select public.create_household('Casa segnaposto', 'N1') into h4;
    perform public.zz_reset();
    perform public.zz_ok('N1 salva il piano con i segnaposto Giulia e Marco', n1,
      format('select public.save_household_plan(%L, %L::jsonb)', h4,
        public.zz_piano(array[public.zz_v(mese, array[public.zz_q(1, 'N1', 1000), public.zz_q(2, 'Giulia', 800), public.zz_q(3, 'Marco', 900)])])));
    -- un segnaposto tolto: esiste solo in una versione passata
    insert into public.household_plans (household_id, valido_dal, giorno_versamento, regola, created_by)
      values (h4, (mese - interval '1 month')::date, 5, 'parti_uguali', n1) returning id into pid_p;
    insert into public.household_plan_shares (plan_id, slot, display_name, quota_mensile) values (pid_p, 4, 'Ospite', 0);
    perform public.zz_as(n1);
    select public.create_invite(h4) into cd;
    perform public.zz_reset();
    perform public.zz_ok('Marco entra per primo', n2, format('select public.join_household(%L, ''  marco '')', cd));
    perform public.zz_verifica('Marco prende la posizione di Marco',
      (select slot from public.household_members where household_id = h4 and user_id = n2) = 3, 'slot diverso da 3');
    perform public.zz_verifica('la quota di Marco e legata a lui con il suo reddito',
      exists (select 1 from public.household_plan_shares sh join public.household_plans pl on pl.id = sh.plan_id
              where pl.household_id = h4 and pl.valido_dal = mese and sh.slot = 3 and sh.user_id = n2 and sh.reddito_netto_mensile = 900),
      'quota di Marco non legata');
    perform public.zz_verifica('Giulia resta un segnaposto',
      exists (select 1 from public.household_plan_shares sh join public.household_plans pl on pl.id = sh.plan_id
              where pl.household_id = h4 and pl.valido_dal = mese and sh.slot = 2 and sh.user_id is null),
      'Giulia non e piu un segnaposto');
    perform public.zz_ok('Giulia entra', n3, format('select public.join_household(%L, ''GIULIA'')', cd));
    perform public.zz_verifica('Giulia prende la posizione di Giulia',
      (select slot from public.household_members where household_id = h4 and user_id = n3) = 2, 'slot diverso da 2');
    perform public.zz_ok('Ospite entra', n4, format('select public.join_household(%L, ''Ospite'')', cd));
    perform public.zz_verifica('un segnaposto tolto (solo in una versione passata) non si collega',
      (select slot from public.household_members where household_id = h4 and user_id = n4) = 5, 'slot diverso da 5');
    perform public.zz_verifica('la quota tolta resta senza utente',
      not exists (select 1 from public.household_plan_shares where plan_id = pid_p and user_id is not null),
      'la quota del segnaposto tolto e stata collegata');
  end;

  -- 23. Migrazione 0007: fondatore uscito, segnaposto con uscita, categorie rinominate, uscenti del piano.
  -- La casa e del fondatore x1, che esce per ultimo: gli altri casi la usano prima.
  declare
    x1 constant uuid := '41414141-0000-0000-0000-000000000041';
    x2 constant uuid := '42424242-0000-0000-0000-000000000042';
    x3 constant uuid := '43434343-0000-0000-0000-000000000043';
    x4 constant uuid := '44444444-0000-0000-0000-000000000044';
    hx uuid; cx text; pid_x uuid; cat_x uuid; n_cat_prima int;
    m1 date := (mese + interval '1 month')::date;
  begin
    perform public.zz_as(x1);
    select public.create_household('Casa fondatore', 'X1') into hx;
    select public.create_invite(hx) into cx;
    perform public.zz_reset();

    -- segnaposto con uscita: join_household non lo occupa (il piano si inserisce come proprietario)
    insert into public.household_plans (household_id, valido_dal, giorno_versamento, regola, created_by)
      values (hx, mese, 5, 'parti_uguali', x1) returning id into pid_x;
    insert into public.household_plan_shares (plan_id, slot, user_id, display_name, quota_mensile, esce_dal)
      values (pid_x, 1, x1, 'X1', 0, null), (pid_x, 2, null, 'Giulia', 0, m1);
    perform public.zz_ok('x3 entra col nome di un segnaposto con uscita', x3,
      format('select public.join_household(%L, ''Giulia'')', cx));
    perform public.zz_verifica('join_household non lega un segnaposto con esce_dal',
      coalesce((select slot from public.household_members where household_id = hx and user_id = x3) <> 2, false),
      'x3 ha preso lo slot 2 del segnaposto uscito');

    -- rinominare una voce con categoria_id rinomina la categoria, non ne crea una nuova
    perform public.zz_ok('x1 salva una voce Palestra', x1,
      format('select public.save_household_plan(%L, %L::jsonb)', hx,
        public.zz_piano(array[public.zz_v(mese, array[public.zz_q(1, 'X1', 1000), public.zz_q(3, 'Giulia', 800)],
          '[{"nome": "Palestra", "categoria_nome": "Palestra", "frequenza_mesi": 1, "importo_ricorrenza": 30}]')])));
    select id into cat_x from public.categories where household_id = hx and nome = 'Palestra';
    select count(*) into n_cat_prima from public.categories where household_id = hx;
    perform public.zz_ok('x1 rinomina la stessa voce con categoria_id e nome Yoga', x1,
      format('select public.save_household_plan(%L, %L::jsonb)', hx,
        public.zz_piano(array[public.zz_v(mese, array[public.zz_q(1, 'X1', 1000), public.zz_q(3, 'Giulia', 800)],
          format('[{"nome": "Palestra", "categoria_id": "%s", "categoria_nome": "Yoga", "frequenza_mesi": 1, "importo_ricorrenza": 30}]', cat_x))])));
    perform public.zz_verifica('la categoria collegata si chiama Yoga',
      (select nome from public.categories where id = cat_x) = 'Yoga', 'la categoria non e stata rinominata');
    perform public.zz_verifica('la rinomina non crea una categoria nuova',
      (select count(*) from public.categories where household_id = hx) = n_cat_prima, 'numero di categorie di casa cambiato');

    -- uscito: la sua posizione nel piano conserva user_id ed esce_dal
    perform public.zz_ok('x1 aggiunge il segnaposto Ospite al piano', x1,
      format('select public.save_household_plan(%L, %L::jsonb)', hx,
        public.zz_piano(array[public.zz_v(mese, array[public.zz_q(1, 'X1', 1000), public.zz_q(3, 'Giulia', 800),
          public.zz_q(4, 'Ospite', 0)])])));
    perform public.zz_ok('x4 entra nel segnaposto Ospite', x4,
      format('select public.join_household(%L, ''Ospite'')', cx));
    perform public.zz_verifica('x4 occupa lo slot 4',
      coalesce((select slot from public.household_members where household_id = hx and user_id = x4) = 4, false),
      'slot diverso da 4');
    perform public.zz_ok('x4 esce senza registri aperti', x4, 'select public.leave_household()');
    perform public.zz_ok('x1 rivede il piano: la posizione di x4 esce dal mese successivo', x1,
      format('select public.save_household_plan(%L, %L::jsonb)', hx,
        public.zz_piano(array[public.zz_v(mese, array[public.zz_q(1, 'X1', 1000), public.zz_q(3, 'Giulia', 800),
          json_build_object('slot', 4, 'display_name', 'Ospite', 'reddito_netto_mensile', 0, 'quota_mensile', 0,
            'esce_dal', to_char(m1, 'YYYY-MM-DD'))::text])])));
    perform public.zz_verifica('la posizione uscita conserva user_id ed esce_dal',
      exists (select 1 from public.household_plan_shares s
              join public.household_plans p on p.id = s.plan_id
              where p.household_id = hx and p.valido_dal = mese and s.slot = 4
                and s.user_id = x4 and s.esce_dal is not null),
      'user_id o esce_dal della posizione di x4 non conservati');

    -- il fondatore eliminato: la casa e la membership del socio restano (per ultimo)
    perform public.zz_ok('x2 entra nella casa del fondatore', x2,
      format('select public.join_household(%L, ''Socio'')', cx));
    perform public.zz_reset();
    delete from auth.users where id = x1;
    perform public.zz_verifica('eliminare l utente fondatore non cancella la casa',
      exists (select 1 from public.households where id = hx), 'la casa e stata cancellata');
    perform public.zz_verifica('eliminare l utente fondatore non cancella la membership del socio',
      exists (select 1 from public.household_members where household_id = hx and user_id = x2),
      'la membership del socio e sparita');
  end;

  -- 24. Trasferimenti del caso 12 (0007): rinunce, rimborsi da conti non della casa, conti non collegati.
  -- Casa dedicata: t1 resta, t2 esce dopo le prove e rimane ex membro.
  declare
    t1 constant uuid := '51515151-0000-0000-0000-000000000051';
    t2 constant uuid := '52525252-0000-0000-0000-000000000052';
    h5 uuid; c5 text; t1_pers uuid; t2_pers uuid; conto_casa5 uuid; tr5 uuid;
  begin
    perform public.zz_as(t1);
    select public.create_household('Casa trasferimenti', 'T1') into h5;
    select public.create_invite(h5) into c5;
    perform public.zz_reset();
    perform public.zz_ok('t2 entra nella casa dei trasferimenti', t2,
      format('select public.join_household(%L, ''T2'')', c5));
    insert into public.accounts (user_id, nome, saldo_attuale) values (t1, 'Conto personale t1', 300)
      returning id into t1_pers;
    insert into public.accounts (user_id, nome, saldo_attuale) values (t2, 'Conto personale t2', 300)
      returning id into t2_pers;
    insert into public.accounts (user_id, nome, saldo_attuale, household_id) values (t1, 'Conto comune t', 500, h5)
      returning id into conto_casa5;

    perform public.zz_err_msg('una rinuncia a una restituzione non registrata dal creditore fallisce', t1,
      format('select public.record_transfer(%L, ''restituzione'', 10, %L, null, null, %L, %L, null, true, null)', h5, oggi, t2, t2),
      'rinuncia non valida');
    perform public.zz_err_msg('una rinuncia a un credito con importo e conti fallisce', t1,
      format('select public.record_transfer(%L, ''rimborso'', 10, %L, %L, null, %L, null, null, false, null)', h5, oggi, conto_casa5, t1),
      'rinuncia non valida');
    perform public.zz_err_msg('una rinuncia a un credito con un conto collegato fallisce anche in solo registrazione', t1,
      format('select public.record_transfer(%L, ''rimborso'', 10, %L, %L, null, %L, null, null, true, null)', h5, oggi, conto_casa5, t1),
      'rinuncia non valida');
    perform public.zz_err_msg('un rimborso da un conto che non e della casa fallisce', t1,
      format('select public.record_transfer(%L, ''rimborso'', 10, %L, %L, null, %L, null, null, false, null)', h5, oggi, t1_pers, t2),
      'conto della casa non valido');

    perform public.zz_as(t2);
    select public.record_transfer(h5, 'restituzione', 10, oggi, t1_pers, conto_casa5, t1, null, null, true, null) into tr5;
    perform public.zz_reset();
    perform public.zz_verifica('una restituzione solo registrazione con un conto altrui non lascia conti collegati',
      exists (select 1 from public.transfers where id = tr5 and da_account_id is null and a_account_id is null),
      'la restituzione ha lasciato conti collegati');

    perform public.zz_as(t1);
    select public.record_transfer(h5, 'rimborso', 5, oggi, t2_pers, t2_pers, t2, null, null, true, null) into tr5;
    perform public.zz_reset();
    perform public.zz_verifica('un rimborso solo registrazione non lascia conti collegati',
      exists (select 1 from public.transfers where id = tr5 and da_account_id is null and a_account_id is null),
      'il rimborso ha lasciato conti collegati');
    perform public.zz_verifica('le restituzioni e i rimborsi solo registrazione non toccano i saldi',
      (select saldo_attuale from public.accounts where id = t1_pers) = 300
        and (select saldo_attuale from public.accounts where id = t2_pers) = 300
        and (select saldo_attuale from public.accounts where id = conto_casa5) = 500,
      'un saldo e cambiato');

    perform public.zz_ok('t2 esce senza registri aperti', t2, 'select public.leave_household()');
    perform public.zz_err_msg('una rinuncia a una restituzione con debitore ex membro fallisce', t1,
      format('select public.record_transfer(%L, ''restituzione'', 10, %L, null, null, %L, %L, null, true, null)', h5, oggi, t1, t2),
      'membro non valido');
  end;

  -- Referto
  perform public.zz_reset();
  select 'RISULTATO: ' || count(*) filter (where ok) || ' OK, ' || count(*) filter (where not ok) || ' FAIL' || E'\n' ||
         coalesce((select string_agg('FAIL: ' || nome || ' (' || coalesce(dettaglio, '') || ')', E'\n' order by n)
                   from public.zz_esiti where not ok), '') || E'\n' ||
         (select string_agg('OK: ' || nome, E'\n' order by n) from public.zz_esiti where ok)
    into rep from public.zz_esiti;
  raise exception E'\n%', rep;
end $test$;
