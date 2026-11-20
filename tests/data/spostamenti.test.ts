import { describe, it, expect, vi } from 'vitest';
import { getSpostamenti, sposta, annullaSpostamento } from '@/lib/data/spostamenti';

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakeRpc(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: any = {};
  for (const m of ['select', 'gte', 'order']) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return builder;
    };
  }
  builder.then = (res: (v: unknown) => void) => res(result);
  return { client: { rpc, from: vi.fn(() => builder) } as any, rpc, calls };
}

const OGGI = new Date('2026-11-20T10:00:00Z');
const input = { daAccountId: 'a1', aAccountId: 'a2', importo: 50, data: '2026-11-20' };

describe('getSpostamenti', () => {
  const riga = { id: 's1', da_account_id: 'a1', a_account_id: null, importo: '50.00', data: '2026-11-10', created_at: '2026-11-10T08:00:00Z' };
  it('mappa le colonne', async () => {
    const { client } = fakeRpc({ data: [riga], error: null });
    expect(await getSpostamenti(client)).toEqual([
      { id: 's1', daAccountId: 'a1', aAccountId: null, importo: 50, data: '2026-11-10', createdAt: '2026-11-10T08:00:00Z' },
    ]);
  });
  it('con da filtra per data', async () => {
    const { client, calls } = fakeRpc({ data: [], error: null });
    await getSpostamenti(client, '2026-11-01');
    expect(calls.find((c) => c.method === 'gte')!.args).toEqual(['data', '2026-11-01']);
  });
  it('rilancia l errore', async () => {
    const { client } = fakeRpc({ data: null, error: new Error('boom') });
    await expect(getSpostamenti(client)).rejects.toThrow('boom');
  });
});

describe('sposta', () => {
  it('manda i parametri giusti a sposta_soldi', async () => {
    const { client, rpc } = fakeRpc({ data: 's-1', error: null });
    await expect(sposta(client, input, OGGI)).resolves.toBe('s-1');
    expect(rpc).toHaveBeenCalledWith('sposta_soldi', { p_da: 'a1', p_a: 'a2', p_importo: 50, p_data: '2026-11-20' });
  });
  it.each([
    ['da = a', { ...input, aAccountId: 'a1' }],
    ['data futura', { ...input, data: '2026-11-21' }],
    ['data inesistente', { ...input, data: '2026-02-30' }],
    ['importo 0', { ...input, importo: 0 }],
    ['importo NaN', { ...input, importo: NaN }],
    ['importo 1e9', { ...input, importo: 1e9 }],
  ])('rifiuta %s senza chiamare la rpc', async (_n, i) => {
    const { client, rpc } = fakeRpc({ data: 'x', error: null });
    await expect(sposta(client, i, OGGI)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rilancia l errore del database', async () => {
    const { client } = fakeRpc({ data: null, error: new Error('conto non tuo') });
    await expect(sposta(client, input, OGGI)).rejects.toThrow('conto non tuo');
  });
});

describe('annullaSpostamento', () => {
  it('chiama annulla_spostamento e torna le righe', async () => {
    const { client, rpc } = fakeRpc({ data: 1, error: null });
    await expect(annullaSpostamento(client, 's1')).resolves.toBe(1);
    expect(rpc).toHaveBeenCalledWith('annulla_spostamento', { p_id: 's1' });
  });
  it('rilancia l errore', async () => {
    const { client } = fakeRpc({ data: null, error: new Error('no') });
    await expect(annullaSpostamento(client, 's1')).rejects.toThrow('no');
  });
});
