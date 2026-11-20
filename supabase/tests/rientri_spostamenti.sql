-- supabase/tests/rientri_spostamenti.sql
-- Prova di sposta_soldi, annulla_spostamento, della RLS di rientri e spostamenti, di ricomincia_da_zero
-- e delle difese della 0013. Si esegue a mano nel SQL editor di Supabase DOPO la migrazione 0013.
-- Non lascia nulla nel database: crea utenti finti e dati di prova, e termina con rollback.
-- Se un controllo fallisce, l'errore dice quale.
-- Esito atteso: "NOTICE: rientri_spostamenti: tutti i controlli OK" e nessun errore.
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'rs-a@test.invalid'),
  ('bbbbbbbb-0000-0000-0000-0000000000e2', 'rs-b@test.invalid');

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

do $test$
declare
  a constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000e1';
  b constant uuid := 'bbbbbbbb-0000-0000-0000-0000000000e2';
  oggi date := (now() at time zone 'Europe/Rome')::date;
  v_h uuid; v_c1 uuid; v_c2 uuid; v_cb uuid; v_casa uuid; v_vaso uuid; v_arch uuid;
  v_g uuid; v_gcasa uuid; v_sp uuid; v_sp2 uuid; v_r uuid; v_n int; v_tx uuid; v_arch2 uuid; v_ok boolean;
begin
  -- Preparazione come proprietario: tre conti di A (uno nel disponibile), uno di B, casa con A e B, conto comune
  insert into public.accounts (user_id, nome, saldo_attuale, conta_in_disponibile) values (a, 'Conto 1', 500, true) returning id into v_c1;
  insert into public.accounts (user_id, nome, saldo_attuale, conta_in_disponibile) values (a, 'Conto 2', 200, true) returning id into v_c2;
  insert into public.accounts (user_id, nome, saldo_attuale, conta_in_disponibile) values (a, 'Vaso', 0, false) returning id into v_vaso;
  insert into public.accounts (user_id, nome, saldo_attuale, conta_in_disponibile, archiviato) values (a, 'Vecchio', 0, false, true) returning id into v_arch;
  insert into public.accounts (user_id, nome, saldo_attuale) values (b, 'Conto B', 300) returning id into v_cb;
  insert into public.households (nome, created_by) values ('Casa rs', a) returning id into v_h;
  insert into public.household_members (household_id, user_id, display_name, slot) values (v_h, a, 'A', 1), (v_h, b, 'B', 2);
  insert into public.accounts (user_id, nome, saldo_attuale, household_id) values (a, 'Conto comune', 1000, v_h) returning id into v_casa;
  insert into public.budget_goals (user_id, nome, importo_target, modalita) values (a, 'Obiettivo A', 1000, 'bloccato') returning id into v_g;
  insert into public.budget_goals (user_id, nome, importo_target, modalita, household_id) values (a, 'Obiettivo casa', 1000, 'bloccato', v_h) returning id into v_gcasa;

  -- 1. A sposta soldi fra due conti suoi: saldi giusti e riga scritta
  perform public.zz_as(a);
  v_sp := public.sposta_soldi(v_c1, v_vaso, 100, oggi);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c1) = 400, 'sposta: conto 1 non è 400';
  assert (select saldo_attuale from public.accounts where id = v_vaso) = 100, 'sposta: vaso non è 100';
  assert (select importo from public.spostamenti where id = v_sp) = 100
     and (select user_id from public.spostamenti where id = v_sp) = a, 'sposta: riga sbagliata';

  -- 2. B non vede lo spostamento di A
  perform public.zz_as(b);
  select count(*) into v_n from public.spostamenti;
  perform public.zz_reset();
  assert v_n = 0, 'B vede gli spostamenti di A';

  -- 3. B non può annullare lo spostamento di A (la riga per lui non esiste: 0) né spostare i conti di A
  perform public.zz_as(b);
  v_n := public.annulla_spostamento(v_sp);
  perform public.zz_reset();
  assert v_n = 0, 'B ha annullato lo spostamento di A';
  assert (select saldo_attuale from public.accounts where id = v_vaso) = 100, 'B ha cambiato il saldo del vaso di A';
  v_ok := false;
  begin
    perform public.zz_as(b);
    perform public.sposta_soldi(v_c1, v_cb, 10, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when others then
    perform public.zz_reset();
    assert sqlerrm = 'conto non valido', 'B/conto altrui: errore diverso da conto non valido: ' || sqlerrm;
  end;
  assert not v_ok, 'B ha spostato soldi dal conto di A';
  assert (select saldo_attuale from public.accounts where id = v_c1) = 400, 'lo spostamento rifiutato ha cambiato il saldo';

  -- 4. conto di casa, stesso conto, importi e date non validi: tutti rifiutati e nessun saldo cambia
  v_ok := false;
  begin
    perform public.zz_as(a);
    perform public.sposta_soldi(v_c1, v_casa, 10, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when others then
    perform public.zz_reset();
    assert sqlerrm = 'conto non valido', 'conto di casa: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'spostamento verso un conto di casa accettato';
  v_ok := false;
  begin
    perform public.zz_as(a);
    perform public.sposta_soldi(v_c1, v_c1, 10, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when others then
    perform public.zz_reset();
    assert sqlerrm = 'conto non valido', 'stesso conto: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'spostamento sullo stesso conto accettato';
  v_ok := false;
  begin
    perform public.zz_as(a);
    perform public.sposta_soldi(v_c1, v_c2, 0, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when others then
    perform public.zz_reset();
    assert sqlerrm = 'importo non valido', 'importo zero: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'importo zero accettato';
  v_ok := false;
  begin
    perform public.zz_as(a);
    perform public.sposta_soldi(v_c1, v_c2, 10.005, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when others then
    perform public.zz_reset();
    assert sqlerrm = 'importo non valido', 'tre decimali: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'importo con tre decimali accettato';
  v_ok := false;
  begin
    perform public.zz_as(a);
    perform public.sposta_soldi(v_c1, v_c2, 1000000000, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when others then
    perform public.zz_reset();
    assert sqlerrm = 'importo non valido', 'un miliardo: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'importo da un miliardo accettato';
  v_ok := false;
  begin
    perform public.zz_as(a);
    perform public.sposta_soldi(v_c1, v_c2, 10, oggi + 1);
    perform public.zz_reset();
    v_ok := true;
  exception when others then
    perform public.zz_reset();
    assert sqlerrm = 'data non valida', 'data futura: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'data nel futuro accettata';
  assert (select saldo_attuale from public.accounts where id = v_c1) = 400
     and (select saldo_attuale from public.accounts where id = v_c2) = 200
     and (select saldo_attuale from public.accounts where id = v_casa) = 1000, 'un rifiuto ha cambiato dei saldi';

  -- 5. annulla rimette i saldi; secondo annulla: 0
  perform public.zz_as(a);
  v_n := public.annulla_spostamento(v_sp);
  perform public.zz_reset();
  assert v_n = 1, 'annulla: non ha cancellato una riga';
  assert (select saldo_attuale from public.accounts where id = v_c1) = 500, 'annulla: conto 1 non è tornato a 500';
  assert (select saldo_attuale from public.accounts where id = v_vaso) = 0, 'annulla: vaso non è tornato a 0';
  perform public.zz_as(a);
  v_n := public.annulla_spostamento(v_sp);
  perform public.zz_reset();
  assert v_n = 0, 'annulla due volte: non ha dato 0';

  -- 6. un conto eliminato non blocca l'annullo: il saldo dell'altro torna, quello eliminato non c'è più
  perform public.zz_as(a);
  v_sp2 := public.sposta_soldi(v_c2, v_arch, 20, oggi);
  perform public.zz_reset();
  delete from public.accounts where id = v_arch;
  assert (select a_account_id from public.spostamenti where id = v_sp2) is null, 'conto eliminato: a_account_id non è null';
  perform public.zz_as(a);
  v_n := public.annulla_spostamento(v_sp2);
  perform public.zz_reset();
  assert v_n = 1, 'annulla con conto eliminato: non ha cancellato';
  assert (select saldo_attuale from public.accounts where id = v_c2) = 200, 'annulla con conto eliminato: conto 2 non è 200';

  -- 7. rientri personali: verso un conto fuori dal disponibile sì, verso uno che conta nel disponibile no
  insert into public.accounts (user_id, nome, saldo_attuale, conta_in_disponibile, archiviato) values (a, 'Archiviato', 0, false, true) returning id into v_arch2;
  perform public.zz_as(a);
  insert into public.rientri (account_id, importo, mesi, creato_il) values (v_vaso, 50, 3, oggi) returning id into v_r;
  perform public.zz_reset();
  assert (select count(*) from public.rientri where id = v_r) = 1, 'rientro verso il vaso non scritto';

  v_ok := false;
  begin
    perform public.zz_as(a);
    insert into public.rientri (account_id, importo, mesi, creato_il) values (v_c1, 50, 3, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when insufficient_privilege then
    perform public.zz_reset();
  end;
  assert not v_ok, 'rientro verso un conto nel disponibile accettato';
  v_ok := false;
  begin
    perform public.zz_as(a);
    insert into public.rientri (account_id, importo, mesi, creato_il) values (v_arch2, 50, 3, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when others then
    perform public.zz_reset();
    assert sqlerrm like '%row-level security%' or sqlerrm like '%foreign key%', 'conto archiviato: errore inatteso: ' || sqlerrm;
  end;
  assert not v_ok, 'rientro verso un conto archiviato accettato';
  v_ok := false;
  begin
    perform public.zz_as(a);
    insert into public.rientri (account_id, importo, mesi, creato_il) values (v_casa, 50, 3, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when insufficient_privilege then
    perform public.zz_reset();
  end;
  assert not v_ok, 'rientro personale verso il conto comune accettato';
  v_ok := false;
  begin
    perform public.zz_as(b);
    insert into public.rientri (account_id, importo, mesi, creato_il) values (v_vaso, 50, 3, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when insufficient_privilege then
    perform public.zz_reset();
  end;
  assert not v_ok, 'B ha scritto un rientro sul conto di A';
  v_ok := false;
  begin
    perform public.zz_as(a);
    insert into public.rientri (goal_id, importo, mesi, creato_il) values (v_g, 50, 5, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when check_violation then
    perform public.zz_reset();
  end;
  assert not v_ok, 'mesi 5 accettati';
  v_ok := false;
  begin
    perform public.zz_as(a);
    insert into public.rientri (goal_id, account_id, importo, mesi, creato_il) values (v_g, v_vaso, 50, 3, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when check_violation then
    perform public.zz_reset();
  end;
  assert not v_ok, 'rientro con obiettivo e conto insieme accettato';
  v_ok := false;
  begin
    perform public.zz_as(a);
    insert into public.rientri (goal_id, importo, mesi, creato_il, stato) values (v_g, 50, 3, oggi, 'fermato');
    perform public.zz_reset();
    v_ok := true;
  exception when check_violation then
    perform public.zz_reset();
  end;
  assert not v_ok, 'rientro fermato senza fermato_il accettato';

  -- 8. un rientro personale verso un obiettivo di A; B non lo vede; A non lo scrive su un obiettivo di casa come personale
  perform public.zz_as(a);
  insert into public.rientri (goal_id, importo, mesi, creato_il) values (v_g, 50, 3, oggi);
  perform public.zz_reset();
  perform public.zz_as(b);
  select count(*) into v_n from public.rientri;
  perform public.zz_reset();
  assert v_n = 0, 'B vede i rientri personali di A';
  v_ok := false;
  begin
    perform public.zz_as(a);
    insert into public.rientri (goal_id, importo, mesi, creato_il) values (v_gcasa, 50, 3, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when insufficient_privilege then
    perform public.zz_reset();
  end;
  assert not v_ok, 'rientro personale verso un obiettivo di casa accettato';

  -- 9. rientri di casa: li vedono e li scrivono i due membri, verso un obiettivo di quella casa
  perform public.zz_as(a);
  insert into public.rientri (household_id, goal_id, importo, mesi, creato_il) values (v_h, v_gcasa, 80, 6, oggi);
  perform public.zz_reset();
  perform public.zz_as(b);
  select count(*) into v_n from public.rientri where household_id = v_h;
  perform public.zz_reset();
  assert v_n = 1, 'B non vede il rientro di casa';
  v_ok := false;
  begin
    perform public.zz_as(b);
    insert into public.rientri (household_id, goal_id, importo, mesi, creato_il) values (v_h, v_g, 80, 6, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when insufficient_privilege then
    perform public.zz_reset();
  end;
  assert not v_ok, 'rientro di casa verso un obiettivo personale accettato';
  v_ok := false;
  begin
    perform public.zz_as(a);
    insert into public.rientri (household_id, account_id, importo, mesi, creato_il) values (v_h, v_casa, 80, 6, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when others then
    perform public.zz_reset();
    assert sqlstate in ('23514', '42501'), 'rientro di casa verso un conto: errore inatteso: ' || sqlerrm;
  end;
  assert not v_ok, 'rientro di casa verso un conto accettato';

  -- 10. difese: adjust_account_balance non eseguibile dal client
  v_ok := false;
  begin
    perform public.zz_as(b);
    perform public.adjust_account_balance(v_casa, 50);
    perform public.zz_reset();
    v_ok := true;
  exception when insufficient_privilege then
    perform public.zz_reset();
  end;
  assert not v_ok, 'adjust_account_balance eseguibile dal client';

  -- 11. difese: piva_quote_scartate solo su incassi propri
  insert into public.transactions (user_id, tipo, importo, data, descrizione) values (b, 'income', 10, oggi, 'incasso B') returning id into v_tx;
  v_ok := false;
  begin
    perform public.zz_as(a);
    insert into public.piva_quote_scartate (transaction_id, scartata_il) values (v_tx, oggi);
    perform public.zz_reset();
    v_ok := true;
  exception when insufficient_privilege then
    perform public.zz_reset();
  end;
  assert not v_ok, 'A ha scartato la quota di un incasso di B';
  insert into public.transactions (user_id, tipo, importo, data, descrizione) values (a, 'income', 10, oggi, 'incasso A') returning id into v_tx;
  perform public.zz_as(a);
  insert into public.piva_quote_scartate (transaction_id, scartata_il) values (v_tx, oggi);
  perform public.zz_reset();

  -- 12. ricomincia da zero cancella rientri e spostamenti di A, non quelli di casa e non quelli di B
  perform public.zz_as(a);
  v_sp := public.sposta_soldi(v_c1, v_vaso, 30, oggi);
  perform public.zz_reset();
  perform public.zz_as(a);
  perform public.ricomincia_da_zero();
  perform public.zz_reset();
  assert (select count(*) from public.spostamenti where user_id = a) = 0, 'ricomincia: restano spostamenti di A';
  assert (select count(*) from public.rientri where user_id = a and household_id is null) = 0, 'ricomincia: restano rientri personali di A';
  assert (select count(*) from public.rientri where household_id = v_h) = 1, 'ricomincia: il rientro di casa è stato cancellato';
  assert (select count(*) from public.accounts where id = v_cb) = 1, 'ricomincia: ha toccato il conto di B';

  raise notice 'rientri_spostamenti: tutti i controlli OK';
end $test$;

rollback;
