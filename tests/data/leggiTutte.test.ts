import { describe, it, expect } from 'vitest';
import { leggiTutte, RIGHE_PER_PAGINA } from '@/lib/data/leggiTutte';
import { getTransactions } from '@/lib/data/transactions';
import { createFakeDb } from '../helpers/fakeDb';

describe('leggiTutte', () => {
  it('chiede pagine finché ne arriva una non piena', async () => {
    const tutte = Array.from({ length: RIGHE_PER_PAGINA * 2 + 5 }, (_, i) => i);
    const chieste: [number, number][] = [];
    const out = await leggiTutte(async (da, a) => {
      chieste.push([da, a]);
      return { data: tutte.slice(da, a + 1), error: null };
    });
    expect(out).toEqual(tutte);
    expect(chieste).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('una sola richiesta se le righe stanno in una pagina', async () => {
    let chiamate = 0;
    const out = await leggiTutte(async () => {
      chiamate++;
      return { data: [1, 2], error: null };
    });
    expect(out).toEqual([1, 2]);
    expect(chiamate).toBe(1);
  });

  it("rilancia l'errore della pagina", async () => {
    const errore = new Error('rete');
    await expect(leggiTutte(async () => ({ data: null, error: errore }))).rejects.toBe(errore);
  });

  it('getTransactions legge oltre le 1000 righe e applica il filtro di date', async () => {
    const righe = Array.from({ length: 1203 }, (_, i) => ({
      id: `t${String(i).padStart(4, '0')}`,
      tipo: 'expense',
      importo: 1,
      data: i < 3 ? '2025-01-01' : '2026-10-01',
      household_id: null,
      user_id: 'u1',
      created_at: '2026-10-01T00:00:00Z',
    }));
    const db = createFakeDb({ transactions: righe }, { userId: 'u1' });
    expect(await getTransactions(db.client)).toHaveLength(1203);
    expect(await getTransactions(db.client, undefined, { da: '2026-01-01' })).toHaveLength(1200);
  });
});
