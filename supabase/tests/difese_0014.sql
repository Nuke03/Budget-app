-- supabase/tests/difese_0014.sql
-- Prova delle difese della 0014: versamenti degli obiettivi, rientri che cambiano solo stato,
-- modifica_movimento che rifiuta le righe della riconciliazione.
-- Si esegue a mano nel SQL editor di Supabase DOPO la migrazione 0014.
-- Non lascia nulla nel database: crea un utente finto e dati di prova, e termina con rollback.
-- Se un controllo fallisce, l'errore dice quale.
-- Esito atteso: "NOTICE: difese_0014: tutti i controlli OK" e nessun errore.
begin;

insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-0000000000f1', 'df-a@test.invalid');

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
  a constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000f1';
  oggi date := (now() at time zone 'Europe/Rome')::date;
  v_c1 uuid; v_c2 uuid; v_g uuid; v_r uuid; v_tx uuid; v_rc uuid; v_ok boolean; v_n int;
begin
  insert into public.accounts (user_id, nome, saldo_attuale, conta_in_disponibile) values (a, 'Conto 1', 500, true) returning id into v_c1;
  insert into public.accounts (user_id, nome, saldo_attuale, conta_in_disponibile) values (a, 'Conto 2', 200, true) returning id into v_c2;
  insert into public.budget_goals (user_id, nome, importo_target, modalita) values (a, 'Obiettivo A', 1000, 'bloccato') returning id into v_g;

  -- 1. versamento valido: accettato
  insert into public.goal_versamenti (goal_id, user_id, data, importo) values (v_g, a, oggi, 50);

  -- 2. data nel futuro: rifiutata
  v_ok := false;
  begin
    insert into public.goal_versamenti (goal_id, user_id, data, importo) values (v_g, a, oggi + 2, 50);
    v_ok := true;
  exception when others then
    assert sqlerrm = 'data del versamento non valida', 'data futura: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'versamento con data futura accettato';

  -- 3. importo oltre il tetto: rifiutato
  v_ok := false;
  begin
    insert into public.goal_versamenti (goal_id, user_id, data, importo) values (v_g, a, oggi, 1000000000);
    v_ok := true;
  exception when others then
    assert sqlerrm = 'importo del versamento non valido', 'importo enorme: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'versamento da un miliardo accettato';

  -- 4. update che porta la data nel futuro: rifiutato
  v_ok := false;
  begin
    update public.goal_versamenti set data = oggi + 5 where goal_id = v_g;
    v_ok := true;
  exception when others then
    assert sqlerrm = 'data del versamento non valida', 'update data futura: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'update con data futura accettato';

  -- 5. rientri: stato e fermato_il si cambiano, il resto no
  insert into public.rientri (user_id, account_id, importo, mesi, creato_il) values (a, v_c1, 50, 3, oggi) returning id into v_r;
  update public.rientri set stato = 'fermato', fermato_il = oggi where id = v_r;
  assert (select stato from public.rientri where id = v_r) = 'fermato', 'rientri: stato non cambiato';
  v_ok := false;
  begin
    update public.rientri set importo = 80 where id = v_r;
    v_ok := true;
  exception when others then
    assert sqlerrm like 'di un rientro si cambiano solo%', 'rientri/importo: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'importo di un rientro cambiato';
  v_ok := false;
  begin
    update public.rientri set account_id = v_c2 where id = v_r;
    v_ok := true;
  exception when others then
    assert sqlerrm like 'di un rientro si cambiano solo%', 'rientri/conto: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'conto di un rientro cambiato';
  v_ok := false;
  begin
    update public.rientri set mesi = 6 where id = v_r;
    v_ok := true;
  exception when others then
    assert sqlerrm like 'di un rientro si cambiano solo%', 'rientri/mesi: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'mesi di un rientro cambiati';

  -- 6. modifica_movimento: una riga normale si modifica, una di riconciliazione no
  insert into public.transactions (user_id, tipo, importo, data, account_id, descrizione) values (a, 'expense', 20, oggi, v_c1, 'normale') returning id into v_tx;
  insert into public.transactions (user_id, tipo, importo, data, account_id, descrizione, origine) values (a, 'expense', 30, oggi, v_c1, 'rettifica', 'riconciliazione') returning id into v_rc;
  perform public.zz_as(a);
  perform public.modifica_movimento(v_tx, 'expense', 25, oggi, null, v_c1, null, 'normale', null, null);
  perform public.zz_reset();
  assert (select importo from public.transactions where id = v_tx) = 25, 'modifica: riga normale non cambiata';
  v_ok := false;
  begin
    perform public.zz_as(a);
    perform public.modifica_movimento(v_rc, 'expense', 99, oggi, null, v_c1, null, 'rettifica', null, null);
    perform public.zz_reset();
    v_ok := true;
  exception when others then
    perform public.zz_reset();
    assert sqlerrm = 'movimento di riconciliazione non modificabile', 'riconciliazione: errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'riga di riconciliazione modificata';
  assert (select importo from public.transactions where id = v_rc) = 30, 'la riga di riconciliazione è cambiata';

  -- 7. la riga di riconciliazione si può ancora eliminare
  perform public.zz_as(a);
  perform public.elimina_movimento(v_rc);
  perform public.zz_reset();
  select count(*) into v_n from public.transactions where id = v_rc;
  assert v_n = 0, 'riga di riconciliazione non eliminata';

  raise notice 'difese_0014: tutti i controlli OK';
end $test$;

rollback;
