-- supabase/tests/movimenti_atomici.sql
-- Prova di elimina_movimento, modifica_movimento, crea_fondo_bolletta e delle regole della fattura (P10, P11, P8).
-- Si esegue a mano nel SQL editor di Supabase DOPO la migrazione 0012. Non lascia nulla nel database:
-- crea utenti finti e dati di prova, e termina con rollback. Se un controllo fallisce, l'errore dice quale.
-- Esito atteso: "NOTICE: movimenti_atomici: tutti i controlli OK" e nessun errore.
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'mov-a@test.invalid'),
  ('bbbbbbbb-0000-0000-0000-0000000000d2', 'mov-b@test.invalid'),
  ('cccccccc-0000-0000-0000-0000000000d3', 'mov-c@test.invalid');

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
  a constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000d1';
  b constant uuid := 'bbbbbbbb-0000-0000-0000-0000000000d2';
  c constant uuid := 'cccccccc-0000-0000-0000-0000000000d3';
  oggi date := (now() at time zone 'Europe/Rome')::date;
  mese date := date_trunc('month', now() at time zone 'Europe/Rome')::date;
  v_h uuid; v_c1 uuid; v_c2 uuid; v_casa uuid; v_cat uuid;
  v_tx uuid; v_tx2 uuid; v_tx3 uuid; v_msg text;
  v_plan uuid; v_plan2 uuid; v_item uuid; v_item2 uuid; v_g1 uuid; v_g2 uuid; v_g3 uuid;
  v_f uuid; v_f2 uuid; v_n int;
begin
  -- Preparazione come proprietario: due conti per A, casa con A e B, conto comune
  insert into public.accounts (user_id, nome, saldo_attuale) values (a, 'Conto 1', 500) returning id into v_c1;
  insert into public.accounts (user_id, nome, saldo_attuale) values (a, 'Conto 2', 200) returning id into v_c2;
  insert into public.households (nome, created_by) values ('Casa mov', a) returning id into v_h;
  insert into public.household_members (household_id, user_id, display_name, slot) values (v_h, a, 'A', 1), (v_h, b, 'B', 2);
  insert into public.accounts (user_id, nome, saldo_attuale, household_id) values (a, 'Conto comune', 1000, v_h) returning id into v_casa;

  -- 1. spesa personale: modifica di importo e conto, saldi giusti
  perform public.zz_as(a);
  v_tx := public.crea_movimento('expense', 50, oggi, null, v_c1, null, 'Prova', null, null, null, false);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c1) = 450, 'crea: saldo conto 1 diverso da 450';

  perform public.zz_as(a);
  perform public.modifica_movimento(v_tx, 'expense', 80, oggi, null, v_c2, null, 'Prova', null, null);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c1) = 500, 'cambio conto: il conto 1 non è tornato a 500';
  assert (select saldo_attuale from public.accounts where id = v_c2) = 120, 'cambio conto: il conto 2 non è 120';
  assert (select importo from public.transactions where id = v_tx) = 80
     and (select account_id from public.transactions where id = v_tx) = v_c2, 'cambio conto: la riga non è aggiornata';

  perform public.zz_as(a);
  perform public.modifica_movimento(v_tx, 'expense', 100, oggi, null, v_c2, null, 'Prova', 'nota', null);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c2) = 100, 'solo importo: il conto 2 non è 100';
  assert (select nota from public.transactions where id = v_tx) = 'nota', 'solo importo: nota non salvata';

  perform public.zz_as(a);
  perform public.modifica_movimento(v_tx, 'income', 30, oggi, null, v_c2, null, 'Prova', null, null);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c2) = 230, 'spesa -> entrata: il conto 2 non è 230';

  perform public.zz_as(a);
  perform public.modifica_movimento(v_tx, 'expense', 30, oggi, null, v_c2, null, 'Prova', null, null);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c2) = 170, 'entrata -> spesa: il conto 2 non è 170';

  -- la modifica che fallisce non lascia mezzi saldi (tipo non valido: errore prima di toccare qualcosa)
  begin
    perform public.zz_as(a);
    perform public.modifica_movimento(v_tx, 'boh', 30, oggi, null, v_c1, null, 'Prova', null, null);
    perform public.zz_reset();
    assert false, 'un tipo non valido è stato accettato';
  exception when raise_exception then
    perform public.zz_reset();
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'tipo non valido', format('errore inatteso: %s', v_msg);
  end;
  -- B non vede la riga personale di A: errore, e riga e saldi restano come prima
  begin
    perform public.zz_as(b);
    perform public.modifica_movimento(v_tx, 'expense', 30, oggi, null, v_c1, null, 'Prova', null, null);
    perform public.zz_reset();
    assert false, 'B ha modificato la spesa di A';
  exception when others then
    perform public.zz_reset();
    assert sqlerrm not like 'B ha%', sqlerrm;
  end;
  assert (select saldo_attuale from public.accounts where id = v_c1) = 500
     and (select saldo_attuale from public.accounts where id = v_c2) = 170
     and (select account_id from public.transactions where id = v_tx) = v_c2, 'una modifica fallita ha lasciato tracce';

  -- 2. eliminazione: il saldo torna; la seconda volta non fa niente e non solleva
  perform public.zz_as(a);
  perform public.elimina_movimento(v_tx);
  perform public.zz_reset();
  assert not exists (select 1 from public.transactions where id = v_tx), 'la riga non è stata eliminata';
  assert (select saldo_attuale from public.accounts where id = v_c2) = 200, 'eliminazione spesa: il conto 2 non è tornato a 200';
  perform public.zz_as(a);
  perform public.elimina_movimento(v_tx);
  perform public.elimina_movimento(gen_random_uuid());
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c2) = 200 and (select saldo_attuale from public.accounts where id = v_c1) = 500,
    'la doppia eliminazione ha cambiato un saldo';

  -- eliminare un entrata toglie dal saldo
  perform public.zz_as(a);
  v_tx2 := public.crea_movimento('income', 70, oggi, null, v_c1, null, 'Entrata', null, null, null, false);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c1) = 570, 'crea entrata: il conto 1 non è 570';
  perform public.zz_as(a);
  perform public.elimina_movimento(v_tx2);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c1) = 500, 'eliminazione entrata: il conto 1 non è tornato a 500';

  -- una riga di un altro utente non si vede: nessun effetto e nessun errore
  perform public.zz_as(a);
  v_tx3 := public.crea_movimento('expense', 20, oggi, null, v_c1, null, 'Di A', null, null, null, false);
  perform public.zz_as(b);
  perform public.elimina_movimento(v_tx3);
  perform public.zz_reset();
  assert exists (select 1 from public.transactions where id = v_tx3), 'B ha eliminato la spesa personale di A';
  assert (select saldo_attuale from public.accounts where id = v_c1) = 480, 'il saldo di A è cambiato dopo il tentativo di B';
  perform public.zz_as(a);
  perform public.elimina_movimento(v_tx3);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c1) = 500, 'il conto 1 non è tornato a 500';

  -- 3. spesa di casa pagata con la carta personale di A
  perform public.zz_as(a);
  v_tx := public.crea_movimento('expense', 60, oggi, null, v_c1, null, 'Cena', null, v_h, a, false);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c1) = 440, 'carta personale: il conto 1 non è 440';
  assert public._casa_credito_aperto(v_h, a) = 60, 'carta personale: credito di A diverso da 60';

  perform public.zz_as(a);
  perform public.modifica_movimento(v_tx, 'expense', 90, oggi, null, v_c1, null, 'Cena', null, null);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c1) = 410, 'carta personale modificata: il conto 1 non è 410';
  assert public._casa_credito_aperto(v_h, a) = 90, 'carta personale modificata: credito di A diverso da 90';
  assert (select pagata_da_user_id from public.transactions where id = v_tx) = a, 'pagata_da_user_id è cambiato';

  -- B non può modificare né eliminare la spesa pagata da A con la sua carta
  begin
    perform public.zz_as(b);
    perform public.modifica_movimento(v_tx, 'expense', 10, oggi, null, v_c1, null, 'Cena', null, null);
    perform public.zz_reset();
    assert false, 'B ha modificato la spesa pagata da A';
  exception when others then
    perform public.zz_reset();
    assert sqlerrm not like 'B ha%', sqlerrm;
  end;
  begin
    perform public.zz_as(b);
    perform public.elimina_movimento(v_tx);
    perform public.zz_reset();
    assert false, 'B ha eliminato la spesa pagata da A';
  exception when others then
    perform public.zz_reset();
    assert sqlerrm not like 'B ha%', sqlerrm;
  end;
  assert exists (select 1 from public.transactions where id = v_tx and importo = 90), 'la spesa pagata da A è cambiata per mano di B';
  assert (select saldo_attuale from public.accounts where id = v_c1) = 410, 'il conto di A è cambiato per mano di B';

  -- A sposta la spesa sul conto comune: il conto personale torna, il comune scende
  perform public.zz_as(a);
  perform public.modifica_movimento(v_tx, 'expense', 90, oggi, null, v_casa, null, 'Cena', null, null);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c1) = 500, 'spostata sul comune: il conto 1 non è 500';
  assert (select saldo_attuale from public.accounts where id = v_casa) = 910, 'spostata sul comune: il comune non è 910';
  -- e la rimette sulla carta
  perform public.zz_as(a);
  perform public.modifica_movimento(v_tx, 'expense', 90, oggi, null, v_c1, null, 'Cena', null, null);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c1) = 410 and (select saldo_attuale from public.accounts where id = v_casa) = 1000,
    'rimessa sulla carta: saldi sbagliati';

  -- una spesa sul conto comune: ogni membro la modifica, il comune segue
  perform public.zz_as(b);
  v_tx2 := public.crea_movimento('expense', 25, oggi, null, v_casa, null, 'Spesa comune', null, v_h, null, false);
  perform public.zz_as(a);
  perform public.modifica_movimento(v_tx2, 'expense', 35, oggi, null, v_casa, null, 'Spesa comune', null, null);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_casa) = 965, 'spesa comune modificata: il comune non è 965';
  perform public.zz_as(b);
  perform public.elimina_movimento(v_tx2);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_casa) = 1000, 'spesa comune eliminata: il comune non è 1000';

  -- A elimina la sua spesa pagata con la carta: saldo e credito tornano
  perform public.zz_as(a);
  perform public.elimina_movimento(v_tx);
  perform public.zz_reset();
  assert (select saldo_attuale from public.accounts where id = v_c1) = 500, 'carta eliminata: il conto 1 non è 500';
  assert public._casa_credito_aperto(v_h, a) = 0, 'carta eliminata: credito di A diverso da 0';

  -- 4. crea_fondo_bolletta: due chiamate sulla stessa voce danno un solo fondo
  insert into public.categories (user_id, nome, tipo, household_id) values (a, 'Bollette', 'expense', v_h) returning id into v_cat;
  insert into public.household_plans (household_id, valido_dal, giorno_versamento, regola, created_by)
    values (v_h, mese, 5, 'parti_uguali', a) returning id into v_plan;
  insert into public.household_plans (household_id, valido_dal, giorno_versamento, regola, created_by)
    values (v_h, (mese + interval '1 month')::date, 5, 'parti_uguali', a) returning id into v_plan2;
  insert into public.household_plan_items (plan_id, nome, categoria_id, frequenza_mesi, importo_ricorrenza)
    values (v_plan, 'Luce', v_cat, 2, 120) returning id into v_item;
  insert into public.household_plan_items (plan_id, nome, categoria_id, frequenza_mesi, importo_ricorrenza)
    values (v_plan2, 'LUCE', v_cat, 2, 120) returning id into v_item2;

  perform public.zz_as(a);
  v_g1 := public.crea_fondo_bolletta(v_h, v_item, oggi + 60, oggi);
  perform public.zz_as(b);
  v_g2 := public.crea_fondo_bolletta(v_h, v_item, oggi + 60, oggi);
  perform public.zz_as(a);
  v_g3 := public.crea_fondo_bolletta(v_h, v_item2, oggi + 60, oggi);
  perform public.zz_reset();
  assert v_g1 is not null and v_g1 = v_g2, 'due chiamate sulla stessa voce hanno dato due fondi';
  assert v_g3 = v_g1, 'la voce omonima (maiuscole diverse) non ha riusato il fondo';
  select count(*) into v_n from public.budget_goals where household_id = v_h and lower(nome) = 'luce';
  assert v_n = 1, format('fondi della voce: %s, attesi 1', v_n);
  assert exists (
    select 1 from public.budget_goals g
    where g.id = v_g1 and g.modalita = 'dilazionato' and g.ricorrente and g.frequenza_mesi = 2 and g.importo_target = 120
      and g.categoria_id = v_cat and g.stato = 'aperto' and g.scadenza = oggi + 60 and g.accantona_da = oggi and g.household_id = v_h),
    'il fondo non ha i valori della voce';
  assert (select goal_id from public.household_plan_items where id = v_item) = v_g1
     and (select goal_id from public.household_plan_items where id = v_item2) = v_g1, 'il fondo non è collegato alle voci';
  -- chi non è nella casa non crea niente
  begin
    perform public.zz_as(c);
    perform public.crea_fondo_bolletta(v_h, v_item, oggi + 60, oggi);
    perform public.zz_reset();
    assert false, 'un estraneo ha creato il fondo';
  exception when others then
    perform public.zz_reset();
    assert sqlerrm = 'casa non valida', format('errore inatteso: %s', sqlerrm);
  end;

  -- 5. fatture: P11 (incasso prima dell emissione), P8 (descrizione), P10 (un incasso, una fattura)
  perform public.zz_as(a);
  v_f := public.crea_fattura('Cliente X', 100, oggi, null, null, null);
  perform public.zz_reset();
  begin
    perform public.zz_as(a);
    perform public.incassa_fattura(v_f, oggi - 5, v_c1, null);
    perform public.zz_reset();
    assert false, 'un incasso prima dell emissione è stato accettato';
  exception when check_violation then
    perform public.zz_reset();
  end;
  assert (select saldo_attuale from public.accounts where id = v_c1) = 500, 'l incasso rifiutato ha cambiato il saldo';
  assert (select data_incasso from public.piva_fatture where id = v_f) is null, 'la fattura risulta incassata';

  perform public.zz_as(a);
  v_tx := public.incassa_fattura(v_f, oggi, v_c1, null);
  v_f2 := public.crea_fattura('Incasso in studio', 30, oggi, null, v_c1, null);
  perform public.zz_reset();
  assert (select descrizione from public.transactions where id = v_tx) = 'Fattura Cliente X', 'descrizione della fattura sbagliata';
  assert (select t.descrizione from public.piva_fatture f join public.transactions t on t.id = f.transaction_id where f.id = v_f2) = 'Incasso in studio',
    'incasso diretto: la descrizione ha il prefisso Fattura';
  assert (select saldo_attuale from public.accounts where id = v_c1) = 630, 'incassi: il conto 1 non è 630';

  begin
    insert into public.piva_fatture (user_id, cliente, importo, data_emissione, data_incasso, transaction_id)
      values (a, 'Doppione', 10, oggi, oggi, v_tx);
    assert false, 'due fatture sullo stesso incasso sono state accettate';
  exception when unique_violation then
    null;
  end;
  begin
    insert into public.piva_fatture (user_id, cliente, importo, data_emissione, data_incasso)
      values (a, 'Date storte', 10, oggi, oggi - 1);
    assert false, 'una data d incasso prima dell emissione è stata accettata';
  exception when check_violation then
    null;
  end;

  raise notice 'movimenti_atomici: tutti i controlli OK';
end $test$;

rollback;
