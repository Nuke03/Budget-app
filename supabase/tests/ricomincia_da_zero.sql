-- supabase/tests/ricomincia_da_zero.sql
-- Prova di ricomincia_da_zero() e crea_categorie_iniziali(). Si esegue a mano nel SQL editor di Supabase
-- DOPO le migrazioni 0004-0011. Non lascia nulla nel database: crea utenti finti e dati di prova,
-- e termina con rollback. Se un controllo fallisce, l'errore dice quale.
-- Esito atteso: "NOTICE: ricomincia_da_zero: tutti i controlli OK" e nessun errore.
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'rdz-a@test.invalid'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'rdz-b@test.invalid');

do $test$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000a1';
  b constant uuid := 'bbbbbbbb-0000-0000-0000-0000000000b1';
  h uuid;
  conto_a uuid; conto_a_vuoto uuid; conto_casa uuid; conto_b uuid;
  cat_a uuid; cat_b uuid; goal_a uuid; tx_b uuid;
  oggi date := (now() at time zone 'Europe/Rome')::date;
  mese date := date_trunc('month', now() at time zone 'Europe/Rome')::date;
  cred_a0 numeric; deb_a0 numeric; arr_a0 numeric; cred_b0 numeric; deb_b0 numeric; arr_b0 numeric;
  cred_a1 numeric; deb_a1 numeric; arr_a1 numeric; cred_b1 numeric; deb_b1 numeric; arr_b1 numeric;
  n int;
begin
  -- Preparazione come proprietario (senza ruolo): casa con A e B
  insert into public.households (nome, created_by) values ('Casa rdz', a) returning id into h;
  insert into public.household_members (household_id, user_id, display_name, slot) values (h, a, 'A', 1), (h, b, 'B', 2);

  insert into public.accounts (user_id, nome, saldo_attuale) values (a, 'Conto A usato dalla casa', 500) returning id into conto_a;
  insert into public.accounts (user_id, nome, saldo_attuale) values (a, 'Conto A libero', 70) returning id into conto_a_vuoto;
  insert into public.accounts (user_id, nome, saldo_attuale, household_id) values (a, 'Conto comune', 1000, h) returning id into conto_casa;
  insert into public.accounts (user_id, nome, saldo_attuale) values (b, 'Conto B', 300) returning id into conto_b;
  insert into public.categories (user_id, nome, tipo) values (a, 'Vecchia A', 'expense') returning id into cat_a;
  insert into public.categories (user_id, nome, tipo) values (b, 'Vecchia B', 'expense') returning id into cat_b;
  insert into public.budget_goals (user_id, nome, importo_target, modalita) values (a, 'Obiettivo A', 500, 'bloccato') returning id into goal_a;

  -- movimenti personali di A e di B
  insert into public.transactions (user_id, tipo, importo, data, categoria_id, account_id, goal_id, descrizione)
    values (a, 'expense', 10, oggi, cat_a, conto_a_vuoto, goal_a, 'Personale A');
  insert into public.transfers (user_id, da_account_id, a_account_id, importo, data, causale)
    values (a, conto_a, conto_a_vuoto, 15, oggi, 'altro');
  insert into public.transactions (user_id, tipo, importo, data, categoria_id, account_id, descrizione)
    values (b, 'expense', 10, oggi, cat_b, conto_b, 'Personale B') returning id into tx_b;

  -- Casa: versamento dal conto personale di A, spesa anticipata da A con il suo conto, spesa sul conto comune
  insert into public.transfers (household_id, user_id, da_account_id, a_account_id, importo, data, causale, mese_competenza)
    values (h, a, conto_a, conto_casa, 40, oggi, 'versamento', mese);
  insert into public.transactions (user_id, tipo, importo, data, account_id, descrizione, household_id, pagata_da_user_id)
    values (a, 'expense', 20, oggi, conto_a, 'Carta A', h, a);
  insert into public.transactions (user_id, tipo, importo, data, account_id, descrizione, household_id)
    values (a, 'expense', 30, oggi, conto_casa, 'Spesa comune', h);

  -- Prima: numeri della casa e saldi dei conti della casa
  cred_a0 := public._casa_credito_aperto(h, a); deb_a0 := public._casa_debiti_aperti(h, a); arr_a0 := public._casa_arretrati(h, a);
  cred_b0 := public._casa_credito_aperto(h, b); deb_b0 := public._casa_debiti_aperti(h, b); arr_b0 := public._casa_arretrati(h, b);
  create temp table zz_prima as
    select id, saldo_attuale from public.accounts where household_id = h;
  create temp table zz_b_prima as
    select 'conto' as k, count(*) as n, coalesce(sum(saldo_attuale), 0) as s from public.accounts where user_id = b
    union all select 'cat', count(*), 0 from public.categories where user_id = b
    union all select 'tx', count(*), coalesce(sum(importo), 0) from public.transactions where user_id = b and household_id is null;
  create temp table zz_casa_prima as
    select (select count(*) from public.transactions where household_id = h) as tx,
           (select count(*) from public.transfers where household_id = h) as tr;

  -- Come A: ricomincia da zero
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  perform public.ricomincia_da_zero();
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  -- Dopo: crediti, debiti e arretrati identici
  cred_a1 := public._casa_credito_aperto(h, a); deb_a1 := public._casa_debiti_aperti(h, a); arr_a1 := public._casa_arretrati(h, a);
  cred_b1 := public._casa_credito_aperto(h, b); deb_b1 := public._casa_debiti_aperti(h, b); arr_b1 := public._casa_arretrati(h, b);
  assert (cred_a0, deb_a0, arr_a0, cred_b0, deb_b0, arr_b0) is not distinct from (cred_a1, deb_a1, arr_a1, cred_b1, deb_b1, arr_b1),
    'crediti, debiti o arretrati della casa sono cambiati';

  -- i saldi dei conti della casa sono identici
  assert not exists (
    select 1 from zz_prima p join public.accounts c on c.id = p.id where c.saldo_attuale is distinct from p.saldo_attuale),
    'saldo di un conto della casa cambiato';
  assert (select count(*) from public.accounts where household_id = h) = (select count(*) from zz_prima),
    'un conto della casa è sparito';

  -- le righe della casa sono tutte lì
  assert (select count(*) from public.transactions where household_id = h) = (select tx from zz_casa_prima), 'movimenti della casa cambiati';
  assert (select count(*) from public.transfers where household_id = h) = (select tr from zz_casa_prima), 'spostamenti della casa cambiati';

  -- il conto di A usato dalla casa è archiviato con saldo 0 e fuori dal disponibile
  assert exists (select 1 from public.accounts where id = conto_a and archiviato and saldo_attuale = 0 and not conta_in_disponibile),
    'il conto di A usato dalla casa non è archiviato a saldo 0';
  -- il conto personale non usato dalla casa è sparito
  assert not exists (select 1 from public.accounts where id = conto_a_vuoto), 'il conto libero di A è rimasto';

  -- nessuna riga personale di A oltre alle archiviate
  assert not exists (select 1 from public.accounts where user_id = a and household_id is null and not archiviato),
    'restano conti personali di A non archiviati';
  assert not exists (select 1 from public.transactions where user_id = a and household_id is null), 'restano movimenti personali di A';
  assert not exists (select 1 from public.transfers where user_id = a and household_id is null), 'restano spostamenti personali di A';
  assert not exists (select 1 from public.budget_goals where user_id = a and household_id is null and stato = 'aperto'),
    'restano obiettivi personali aperti di A';
  assert not exists (select 1 from public.categories where id = cat_a), 'la vecchia categoria di A è rimasta';

  -- nessuna riga di B toccata
  assert (select n from zz_b_prima where k = 'conto') = (select count(*) from public.accounts where user_id = b), 'conti di B cambiati';
  assert (select s from zz_b_prima where k = 'conto') = (select coalesce(sum(saldo_attuale), 0) from public.accounts where user_id = b), 'saldo di B cambiato';
  assert (select n from zz_b_prima where k = 'cat') = (select count(*) from public.categories where user_id = b), 'categorie di B cambiate';
  assert (select n from zz_b_prima where k = 'tx') = (select count(*) from public.transactions where user_id = b and household_id is null), 'movimenti di B cambiati';
  assert exists (select 1 from public.transactions where id = tx_b), 'il movimento di B è sparito';

  -- le categorie iniziali: 11 per A
  select count(*) into n from public.categories where user_id = a and household_id is null and not archiviata;
  assert n = 11, format('categorie iniziali di A: %s, attese 11', n);
  assert (select count(*) from public.categories where user_id = a and ruolo = 'certa') = 2, 'ruoli certa sbagliati';
  assert (select count(*) from public.categories where user_id = a and ruolo = 'svago') = 1, 'ruolo svago sbagliato';
  assert (select count(*) from public.categories where user_id = a and tipo = 'income') = 1, 'categoria entrate sbagliata';

  -- crea_categorie_iniziali non duplica
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  n := public.crea_categorie_iniziali();
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  assert n = 0, 'crea_categorie_iniziali ha duplicato le categorie';

  raise notice 'ricomincia_da_zero: tutti i controlli OK';
end $test$;

rollback;
