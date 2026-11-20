import { describe, it, expect, vi } from 'vitest';
import {
  getRientri,
  creaRientro,
  fermaRientro,
  chiudiRientro,
  eliminaRientro,
} from '@/lib/data/rientri';
import { casa } from '@/lib/data/scope';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Call = { method: string; args: unknown[] };
function fake(result: { data: unknown; error: unknown }) {
  const calls: Call[] = [];
  const builder: any = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'is', 'order']) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return builder;
    };
  }
  builder.single = () => Promise.resolve(result);
  builder.then = (res: (v: unknown) => void) => res(result);
  const from = vi.fn(() => builder);
  return { client: { from } as any, calls, from };
}
const arg = (calls: Call[], m: string) => calls.find((c) => c.method === m)?.args;

const riga = {
  id: 'r1', user_id: 'u1', household_id: null, goal_id: 'g1', account_id: null,
  importo: '120.50', mesi: 3, creato_il: '2026-11-01', stato: 'aperto', fermato_il: null,
};
const base = { goalId: 'g1', accountId: null, importo: 120, mesi: 3 as const, creatoIl: '2026-11-01' };

describe('getRientri', () => {
  it('mappa le colonne e filtra sul personale', async () => {
    const { client, calls } = fake({ data: [riga], error: null });
    const r = await getRientri(client);
    expect(r).toEqual([{
      id: 'r1', userId: 'u1', householdId: null, goalId: 'g1', accountId: null,
      importo: 120.5, mesi: 3, creatoIl: '2026-11-01', stato: 'aperto', fermatoIl: null,
    }]);
    expect(arg(calls, 'is')).toEqual(['household_id', null]);
  });
  it('con casa filtra sulla casa', async () => {
    const { client, calls } = fake({ data: [], error: null });
    await getRientri(client, casa('h1'));
    expect(arg(calls, 'eq')).toEqual(['household_id', 'h1']);
  });
  it('rilancia l errore', async () => {
    const { client } = fake({ data: null, error: new Error('boom') });
    await expect(getRientri(client)).rejects.toThrow('boom');
  });
});

describe('creaRientro', () => {
  it('scrive e torna l id; personale senza casa', async () => {
    const { client, calls } = fake({ data: { id: 'r9' }, error: null });
    await expect(creaRientro(client, base)).resolves.toBe('r9');
    expect(arg(calls, 'insert')![0]).toEqual({
      goal_id: 'g1', account_id: null, importo: 120, mesi: 3, creato_il: '2026-11-01', household_id: null,
    });
  });
  it('con casa imposta household_id', async () => {
    const { client, calls } = fake({ data: { id: 'r9' }, error: null });
    await creaRientro(client, base, casa('h1'));
    expect((arg(calls, 'insert')![0] as any).household_id).toBe('h1');
  });
  it.each([
    ['mesi 5', { ...base, mesi: 5 as any }],
    ['importo 0', { ...base, importo: 0 }],
    ['importo 0.001', { ...base, importo: 0.001 }],
    ['importo 1e9', { ...base, importo: 1e9 }],
    ['entrambi', { ...base, accountId: 'a1' }],
    ['nessuno', { ...base, goalId: null }],
    ['data storta', { ...base, creatoIl: '2026-02-30' }],
  ])('rifiuta %s senza scrivere', async (_n, input) => {
    const { client, from } = fake({ data: { id: 'x' }, error: null });
    await expect(creaRientro(client, input)).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
  it('rilancia l errore del database', async () => {
    const { client } = fake({ data: null, error: new Error('rls') });
    await expect(creaRientro(client, base)).rejects.toThrow('rls');
  });
});

describe('ferma / chiudi / elimina', () => {
  it('fermaRientro', async () => {
    const { client, calls } = fake({ data: null, error: null });
    await fermaRientro(client, 'r1', '2026-12-05');
    expect(arg(calls, 'update')![0]).toEqual({ stato: 'fermato', fermato_il: '2026-12-05' });
    expect(arg(calls, 'eq')).toEqual(['id', 'r1']);
  });
  it('chiudiRientro', async () => {
    const { client, calls } = fake({ data: null, error: null });
    await chiudiRientro(client, 'r1', '2026-12-05');
    expect(arg(calls, 'update')![0]).toEqual({ stato: 'chiuso', fermato_il: '2026-12-05' });
  });
  it('validano la data', async () => {
    const { client, from } = fake({ data: null, error: null });
    await expect(fermaRientro(client, 'r1', '5/12/2026')).rejects.toThrow();
    await expect(chiudiRientro(client, 'r1', '')).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
  it('rilanciano gli errori', async () => {
    const { client } = fake({ data: null, error: new Error('no') });
    await expect(fermaRientro(client, 'r1', '2026-12-05')).rejects.toThrow('no');
    await expect(eliminaRientro(client, 'r1')).rejects.toThrow('no');
  });
  it('eliminaRientro cancella per id', async () => {
    const { client, calls } = fake({ data: null, error: null });
    await eliminaRientro(client, 'r1');
    expect(calls.map((c) => c.method)).toEqual(['delete', 'eq']);
  });
});
