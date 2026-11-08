/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { createFakeDb } from './fakeDb';
import { fakeRpcClient } from './fakeRpc';

const seed = () => ({
  accounts: [
    { id: 'a1', user_id: 'A', household_id: null, nome: 'Mio', saldo: 10 },
    { id: 'a2', user_id: 'A', household_id: null, nome: 'Altro', saldo: 20 },
    { id: 'b1', user_id: 'B', household_id: null, nome: 'Di B', saldo: 30 },
    { id: 'h1a', user_id: 'B', household_id: 'H1', nome: 'Casa', saldo: 40 },
  ],
});

describe('fakeDb', () => {
  it('eq e is filtrano come Postgres', async () => {
    const db = createFakeDb(seed(), { userId: 'A', membri: { H1: ['A', 'B'] } });
    const eq = await db.client.from('accounts').select('id').eq('nome', 'Mio');
    expect(eq.data.map((r: any) => r.id)).toEqual(['a1']);
    const personali = await db.client.from('accounts').select('id').is('household_id', null).order('nome');
    expect(personali.data.map((r: any) => r.id)).toEqual(['a2', 'a1']);
    const casa = await db.client.from('accounts').select('id').eq('household_id', 'H1');
    expect(casa.data.map((r: any) => r.id)).toEqual(['h1a']);
  });

  it('una riga personale di un altro utente non è visibile', async () => {
    const db = createFakeDb(seed(), { userId: 'A', membri: { H1: ['A', 'B'] } });
    const { data } = await db.client.from('accounts').select('id').eq('id', 'b1');
    expect(data).toEqual([]);
  });

  it('una riga di casa è visibile ai membri e non a chi è fuori', async () => {
    const membro = createFakeDb(seed(), { userId: 'A', membri: { H1: ['A', 'B'] } });
    const fuori = createFakeDb(seed(), { userId: 'D', membri: { H1: ['A', 'B'] } });
    expect((await membro.client.from('accounts').select('id').eq('id', 'h1a')).data).toHaveLength(1);
    expect((await fuori.client.from('accounts').select('id').eq('id', 'h1a')).data).toHaveLength(0);
  });

  it('insert assegna id, user_id e household_id nullo', async () => {
    const db = createFakeDb({}, { userId: 'A' });
    const { data } = await db.client.from('accounts').insert({ nome: 'Nuovo' }).select('*').single();
    expect(data.id).toBeTruthy();
    expect(data.user_id).toBe('A');
    expect(data.household_id).toBeNull();
    expect(db.tables.accounts).toHaveLength(1);
  });

  it('update ed eq modificano solo le righe visibili', async () => {
    const db = createFakeDb(seed(), { userId: 'A', membri: { H1: ['A', 'B'] } });
    await db.client.from('accounts').update({ saldo: 99 }).eq('id', 'a1');
    await db.client.from('accounts').update({ saldo: 99 }).eq('id', 'b1');
    expect(db.tables.accounts.find((r) => r.id === 'a1')!.saldo).toBe(99);
    expect(db.tables.accounts.find((r) => r.id === 'b1')!.saldo).toBe(30);
    await db.client.from('accounts').delete().eq('id', 'b1');
    await db.client.from('accounts').delete().eq('id', 'a2');
    expect(db.tables.accounts.map((r) => r.id)).toEqual(['a1', 'b1', 'h1a']);
  });

  it('rpc registrata ritorna il risultato e traccia la chiamata', async () => {
    const db = createFakeDb({}, { userId: 'A' });
    db.registerRpc('somma', (args: { a: number; b: number }) => ({ data: args.a + args.b }));
    const r = await db.client.rpc('somma', { a: 1, b: 2 });
    expect(r).toEqual({ data: 3, error: null });
    expect(db.rpcCalls).toEqual([{ name: 'somma', args: { a: 1, b: 2 } }]);
    expect((await db.client.rpc('boh', {})).error).not.toBeNull();
  });

  it('le tabelle senza RLS sono filtrate solo dai filtri della query', async () => {
    const db = createFakeDb({ households: [{ id: 'H1', nome: 'Casa' }] }, { userId: 'D' });
    expect((await db.client.from('households').select('id').eq('id', 'H1')).data).toHaveLength(1);
  });
});

describe('fakeRpcClient', () => {
  it('risponde per nome e registra le chiamate', async () => {
    const { client, calls } = fakeRpcClient({ ok: { data: 1 }, ko: { error: { message: 'no' } } });
    expect(await client.rpc('ok', { x: 1 })).toEqual({ data: 1, error: null });
    expect((await client.rpc('ko')).error).toEqual({ message: 'no' });
    expect(calls.map((c) => c.name)).toEqual(['ok', 'ko']);
  });
});
