-- supabase/tests/agevolazioni_0015.sql
-- Prova della 0015: RLS delle due tabelle, controlli sulla situazione, data della DSU, ricomincia_da_zero.
-- Si esegue a mano nel SQL editor di Supabase DOPO la migrazione 0015.
-- Non lascia nulla nel database: crea due utenti finti, e termina con rollback.
-- Se un controllo fallisce, l'errore dice quale.
-- Esito atteso: "NOTICE: agevolazioni_0015: tutti i controlli OK" e nessun errore.
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'ag-a@test.invalid'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'ag-b@test.invalid');

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
  a constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000a1';
  b constant uuid := 'aaaaaaaa-0000-0000-0000-0000000000a2';
  oggi date := (now() at time zone 'Europe/Rome')::date;
  v_ok boolean; v_n int;
begin
  -- 1. situazione valida: accettata (anche con dsu_data di oggi)
  perform public.zz_as(a);
  insert into public.agevolazioni_situazione (user_id, isee, dsu_data, comune, in_affitto, studente)
  values (a, 12345.67, oggi, 'Napoli', true, false);
  perform public.zz_reset();

  -- 2. dsu_data nel futuro: rifiutata, in insert e in update
  v_ok := false;
  begin
    insert into public.agevolazioni_situazione (user_id, dsu_data) values (b, oggi + 2);
    v_ok := true;
  exception when others then
    assert sqlerrm = 'data della DSU non valida', 'dsu futura (insert): errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'DSU con data futura accettata (insert)';
  v_ok := false;
  begin
    update public.agevolazioni_situazione set dsu_data = oggi + 2 where user_id = a;
    v_ok := true;
  exception when others then
    assert sqlerrm = 'data della DSU non valida', 'dsu futura (update): errore diverso: ' || sqlerrm;
  end;
  assert not v_ok, 'DSU con data futura accettata (update)';

  -- 3. isee fuori limite, comune troppo lungo: rifiutati
  v_ok := false;
  begin
    insert into public.agevolazioni_situazione (user_id, isee) values (b, 1000000);
    v_ok := true;
  exception when check_violation then null;
  end;
  assert not v_ok, 'ISEE da un milione accettato';
  v_ok := false;
  begin
    insert into public.agevolazioni_situazione (user_id, isee) values (b, -1);
    v_ok := true;
  exception when check_violation then null;
  end;
  assert not v_ok, 'ISEE negativo accettato';
  v_ok := false;
  begin
    insert into public.agevolazioni_situazione (user_id, comune) values (b, repeat('x', 81));
    v_ok := true;
  exception when check_violation then null;
  end;
  assert not v_ok, 'comune di 81 caratteri accettato';

  -- 4. stati: valido sì, stato inventato e voce lunga no
  insert into public.agevolazioni_stati (user_id, voce_id, stato, il) values (a, 'voce-1', 'fatto', oggi);
  v_ok := false;
  begin
    insert into public.agevolazioni_stati (user_id, voce_id, stato, il) values (a, 'voce-2', 'forse', oggi);
    v_ok := true;
  exception when check_violation then null;
  end;
  assert not v_ok, 'stato inventato accettato';
  v_ok := false;
  begin
    insert into public.agevolazioni_stati (user_id, voce_id, stato, il) values (a, repeat('v', 41), 'fatto', oggi);
    v_ok := true;
  exception when check_violation then null;
  end;
  assert not v_ok, 'voce_id di 41 caratteri accettato';
  v_ok := false;
  begin
    insert into public.agevolazioni_stati (user_id, voce_id, stato, il) values (a, 'voce-1', 'fatto', oggi);
    v_ok := true;
  exception when unique_violation then null;
  end;
  assert not v_ok, 'stessa voce due volte per lo stesso utente';
  insert into public.agevolazioni_stati (user_id, voce_id, stato, il) values (b, 'voce-1', 'non-mi-riguarda', oggi);

  -- 5. RLS: B non vede né tocca le righe di A, e non scrive a nome di A
  perform public.zz_as(b);
  select count(*) into v_n from public.agevolazioni_situazione;
  assert v_n = 0, 'B vede la situazione di A';
  select count(*) into v_n from public.agevolazioni_stati;
  assert v_n = 1, 'B vede gli stati di A';
  update public.agevolazioni_stati set stato = 'fatto' where user_id = a;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'B modifica uno stato di A';
  delete from public.agevolazioni_situazione where user_id = a;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'B cancella la situazione di A';
  v_ok := false;
  begin
    insert into public.agevolazioni_stati (user_id, voce_id, stato, il) values (a, 'voce-9', 'fatto', oggi);
    v_ok := true;
  exception when others then null;
  end;
  perform public.zz_reset();
  assert not v_ok, 'B scrive uno stato a nome di A';

  -- 6. ricomincia_da_zero: cancella solo le righe di chi chiama
  perform public.zz_as(a);
  perform public.ricomincia_da_zero();
  perform public.zz_reset();
  select count(*) into v_n from public.agevolazioni_situazione where user_id = a;
  assert v_n = 0, 'situazione di A non cancellata';
  select count(*) into v_n from public.agevolazioni_stati where user_id = a;
  assert v_n = 0, 'stati di A non cancellati';
  select count(*) into v_n from public.agevolazioni_stati where user_id = b;
  assert v_n = 1, 'ricomincia_da_zero ha toccato gli stati di B';

  raise notice 'agevolazioni_0015: tutti i controlli OK';
end $test$;

rollback;
