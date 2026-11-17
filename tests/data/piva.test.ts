import { describe, it, expect, vi } from 'vitest';
import {
  incassaFattura,
  creaFattura,
  pagaScadenza,
  accantonaTasse,
  assicuraScadenze,
  getFatture,
} from '@/lib/data/piva';

/* eslint-disable @typescript-eslint/no-explicit-any */
function clientRpc(result: { data: unknown; error: unknown }, riga: unknown = null) {
  const rpc = vi.fn().mockResolvedValue(result);
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: () => Promise.resolve({ data: riga, error: null }),
    single: () => Promise.resolve({ data: riga, error: null }),
  };
  return { client: { rpc, from: vi.fn(() => builder) } as any, rpc };
}

describe('incassaFattura', () => {
  it('chiama incassa_fattura con i parametri giusti', async () => {
    const { client, rpc } = clientRpc({ data: 'tx-1', error: null });
    const id = await incassaFattura(client, 'f1', { data: '2026-11-17', accountId: 'a1', categoriaId: 'c1' });
    expect(id).toBe('tx-1');
    expect(rpc).toHaveBeenCalledWith('incassa_fattura', {
      p_fattura: 'f1', p_data: '2026-11-17', p_account: 'a1', p_categoria: 'c1',
    });
  });

  it('su "fattura già incassata" torna l id esistente senza lanciare', async () => {
    const { client } = clientRpc({ data: null, error: { message: 'fattura già incassata' } }, { transaction_id: 'tx-esistente' });
    await expect(incassaFattura(client, 'f1', { data: '2026-11-17', accountId: 'a1', categoriaId: null })).resolves.toBe('tx-esistente');
  });

  it('lancia gli altri errori', async () => {
    const { client } = clientRpc({ data: null, error: { message: 'conto non valido' } });
    await expect(incassaFattura(client, 'f1', { data: '2026-11-17', accountId: 'a1', categoriaId: null })).rejects.toMatchObject({ message: 'conto non valido' });
  });
});

describe('pagaScadenza', () => {
  it('chiama paga_scadenza', async () => {
    const { client, rpc } = clientRpc({ data: 'tx-2', error: null });
    await pagaScadenza(client, 's1', { importo: 100, data: '2026-11-17', accountId: 'a1' });
    expect(rpc).toHaveBeenCalledWith('paga_scadenza', { p_scadenza: 's1', p_importo: 100, p_data: '2026-11-17', p_account: 'a1' });
  });

  it('su "scadenza già pagata" torna la transazione esistente', async () => {
    const { client } = clientRpc({ data: null, error: { message: 'scadenza già pagata' } }, { transaction_id: 'tx-vecchia' });
    await expect(pagaScadenza(client, 's1', { importo: 100, data: '2026-11-17', accountId: 'a1' })).resolves.toBe('tx-vecchia');
  });
});

describe('accantonaTasse', () => {
  const args = { importo: 50, data: '2026-11-17', daAccountId: 'a1', aAccountId: 'a2', transactionId: 'tx-9' };

  it('chiama accantona_tasse', async () => {
    const { client, rpc } = clientRpc({ data: 'acc-1', error: null });
    await expect(accantonaTasse(client, args)).resolves.toBe('acc-1');
    expect(rpc).toHaveBeenCalledWith('accantona_tasse', {
      p_importo: 50, p_data: '2026-11-17', p_da_account: 'a1', p_a_account: 'a2', p_transaction: 'tx-9',
    });
  });

  it('su "quota già spostata" torna l id dell accantonamento esistente', async () => {
    const { client } = clientRpc({ data: null, error: { message: 'quota già spostata' } }, { id: 'acc-vecchio' });
    await expect(accantonaTasse(client, args)).resolves.toBe('acc-vecchio');
  });
});

describe('creaFattura', () => {
  it('senza incassaSu passa solo i dati della fattura', async () => {
    const { client, rpc } = clientRpc({ data: 'f-1', error: null });
    await creaFattura(client, { cliente: 'Rossi', importo: 100, dataEmissione: '2026-11-01', nota: null });
    expect(rpc).toHaveBeenCalledWith('crea_fattura', {
      p_cliente: 'Rossi', p_importo: 100, p_data_emissione: '2026-11-01', p_nota: null,
      p_incassa_account: null, p_categoria: null,
    });
  });

  it('con incassaSu passa conto e categoria', async () => {
    const { client, rpc } = clientRpc({ data: 'f-1', error: null });
    await creaFattura(client, { cliente: 'Rossi', importo: 100, dataEmissione: '2026-11-01', nota: 'x', incassaSu: { accountId: 'a1', categoriaId: 'c1' } });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_incassa_account: 'a1', p_categoria: 'c1' });
  });
});

describe('assicuraScadenze', () => {
  it('usa upsert con ignoreDuplicates', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client: any = { from: vi.fn(() => ({ upsert })) };
    const righe = [{ anno: 2026, chiave: 'f24_giugno' as const, tipo: 'f24' as const, descrizione: 'F24', data: '2026-06-30' }];
    await assicuraScadenze(client, righe);
    expect(client.from).toHaveBeenCalledWith('piva_scadenze');
    expect(upsert).toHaveBeenCalledWith(
      [{ anno: 2026, chiave: 'f24_giugno', tipo: 'f24', descrizione: 'F24', data: '2026-06-30' }],
      { onConflict: 'user_id,anno,chiave', ignoreDuplicates: true }
    );
  });

  it('con zero righe non chiama il database', async () => {
    const client: any = { from: vi.fn() };
    await assicuraScadenze(client, []);
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe('getFatture', () => {
  it('mappa le colonne', async () => {
    const builder: any = {
      select: () => builder,
      order: () => builder,
      then: (r: any) => r({ data: [{ id: 'f1', cliente: 'R', importo: 10, data_emissione: '2026-01-01', data_incasso: null, transaction_id: null, nota: null }], error: null }),
    };
    const out = await getFatture({ from: () => builder } as any);
    expect(out).toEqual([{ id: 'f1', cliente: 'R', importo: 10, dataEmissione: '2026-01-01', dataIncasso: null, transactionId: null, nota: null }]);
  });
});
