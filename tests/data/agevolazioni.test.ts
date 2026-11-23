import { describe, it, expect, vi } from 'vitest';
import {
  getSituazione,
  getStatiVoci,
  salvaSituazioneDati,
  segnaVoceDati,
  segnaSezioneApertaDati,
} from '@/lib/data/agevolazioni';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Call = { table: string; method: string; args: unknown[] };
function fake(results: Record<string, { data: unknown; error: unknown }>) {
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    const result = results[table] ?? { data: null, error: null };
    const b: any = {};
    for (const m of ['select', 'upsert', 'delete', 'eq', 'order']) {
      b[m] = (...args: unknown[]) => {
        calls.push({ table, method: m, args });
        return b;
      };
    }
    b.maybeSingle = () => Promise.resolve(result);
    b.then = (res: (v: unknown) => void) => res(result);
    return b;
  });
  return { client: { from } as any, calls };
}
const arg = (calls: Call[], table: string, m: string) =>
  calls.find((c) => c.table === table && c.method === m)?.args;

const riga = {
  isee: '12345.60', dsu_data: '2026-02-10', comune: 'Roma', in_affitto: true, studente: false,
};

describe('getSituazione', () => {
  it('mappa le colonne e ricava la P.IVA dalla guida', async () => {
    const { client } = fake({
      agevolazioni_situazione: { data: riga, error: null },
      piva_settings: { data: { guidata_dal: '2026-01-05' }, error: null },
    });
    expect(await getSituazione(client)).toEqual({
      isee: 12345.6, dsuData: '2026-02-10', comune: 'Roma', inAffitto: true, studente: false, piva: true,
    });
  });
  it('senza riga: null', async () => {
    const { client } = fake({});
    expect(await getSituazione(client)).toBeNull();
  });
  it('isee null resta null, senza P.IVA guidata piva e false', async () => {
    const { client } = fake({
      agevolazioni_situazione: { data: { ...riga, isee: null }, error: null },
      piva_settings: { data: null, error: null },
    });
    const s = await getSituazione(client);
    expect(s?.isee).toBeNull();
    expect(s?.piva).toBe(false);
  });
  it('rilancia l errore', async () => {
    const { client } = fake({ agevolazioni_situazione: { data: null, error: new Error('boom') } });
    await expect(getSituazione(client)).rejects.toThrow('boom');
  });
});

describe('getStatiVoci', () => {
  it('mappa gli stati', async () => {
    const { client } = fake({
      agevolazioni_stati: { data: [{ voce_id: 'trasporto', stato: 'fatto', il: '2026-11-01' }], error: null },
    });
    expect(await getStatiVoci(client)).toEqual([{ voceId: 'trasporto', stato: 'fatto', il: '2026-11-01' }]);
  });
  it('rilancia l errore', async () => {
    const { client } = fake({ agevolazioni_stati: { data: null, error: new Error('boom') } });
    await expect(getStatiVoci(client)).rejects.toThrow('boom');
  });
});

describe('scritture', () => {
  it('salvaSituazione: upsert su user_id, aggiornata_il non nulla', async () => {
    const { client, calls } = fake({ agevolazioni_situazione: { data: null, error: null } });
    await salvaSituazioneDati(
      client,
      { isee: 10000, dsuData: null, comune: 'Roma', inAffitto: true, studente: null },
      '2026-11-23T10:00:00.000Z'
    );
    const [row, opts] = arg(calls, 'agevolazioni_situazione', 'upsert') as any[];
    expect(row).toEqual({
      isee: 10000, dsu_data: null, comune: 'Roma', in_affitto: true, studente: null,
      aggiornata_il: '2026-11-23T10:00:00.000Z',
    });
    expect(opts).toEqual({ onConflict: 'user_id' });
  });
  it('segnaVoce con stato: upsert; con null: delete', async () => {
    const a = fake({ agevolazioni_stati: { data: null, error: null } });
    await segnaVoceDati(a.client, 'trasporto', 'fatto', '2026-11-23');
    expect(arg(a.calls, 'agevolazioni_stati', 'upsert')).toEqual([
      { voce_id: 'trasporto', stato: 'fatto', il: '2026-11-23' },
      { onConflict: 'user_id,voce_id' },
    ]);
    const b = fake({ agevolazioni_stati: { data: null, error: null } });
    await segnaVoceDati(b.client, 'trasporto', null, '2026-11-23');
    expect(arg(b.calls, 'agevolazioni_stati', 'delete')).toEqual([]);
    expect(arg(b.calls, 'agevolazioni_stati', 'eq')).toEqual(['voce_id', 'trasporto']);
  });
  it('segnaSezioneAperta: upsert del solo campo', async () => {
    const { client, calls } = fake({ agevolazioni_situazione: { data: null, error: null } });
    await segnaSezioneApertaDati(client, '2026-11-23');
    expect(arg(calls, 'agevolazioni_situazione', 'upsert')).toEqual([
      { sezione_aperta_il: '2026-11-23' },
      { onConflict: 'user_id' },
    ]);
  });
  it('errori rilanciati', async () => {
    const e = new Error('boom');
    const { client } = fake({
      agevolazioni_situazione: { data: null, error: e },
      agevolazioni_stati: { data: null, error: e },
    });
    await expect(
      salvaSituazioneDati(client, { isee: null, dsuData: null, comune: null, inAffitto: null, studente: null }, 'x')
    ).rejects.toThrow('boom');
    await expect(segnaVoceDati(client, 'trasporto', 'fatto', '2026-11-23')).rejects.toThrow('boom');
    await expect(segnaVoceDati(client, 'trasporto', null, '2026-11-23')).rejects.toThrow('boom');
    await expect(segnaSezioneApertaDati(client, '2026-11-23')).rejects.toThrow('boom');
  });
});
