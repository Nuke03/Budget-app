import { describe, it, expect, vi } from 'vitest';
import { registraMovimento, rispostaPersa, MESSAGGIO_RISPOSTA_PERSA, type SpesaPayload } from '@/lib/registraSpesa';

const payload: SpesaPayload = {
  tipo: 'expense',
  importo: 30,
  categoriaId: 'cat',
  accountId: 'ap',
  goalId: null,
  descrizione: 'Pane',
};

function fakeRpc(result: { data: unknown; error: unknown } = { data: 'tx-1', error: null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const adjust = vi.fn();
  return { client: { rpc, from: adjust } as never, rpc, adjust };
}

describe('registraMovimento', () => {
  it('in casa con conto personale passa p_pagata_da', async () => {
    const { client, rpc } = fakeRpc();
    const id = await registraMovimento(
      client,
      payload,
      { tipo: 'casa', householdId: 'h1', meUserId: 'u1', contiPersonaliIds: ['ap'] },
      '2026-11-17'
    );
    expect(id).toBe('tx-1');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('crea_movimento', {
      p_tipo: 'expense',
      p_importo: 30,
      p_data: '2026-11-17',
      p_categoria: 'cat',
      p_account: 'ap',
      p_goal: null,
      p_descrizione: 'Pane',
      p_nota: null,
      p_household: 'h1',
      p_pagata_da: 'u1',
      p_stima: false,
    });
  });

  it('in casa con conto comune non passa p_pagata_da', async () => {
    const { client, rpc } = fakeRpc();
    await registraMovimento(client, { ...payload, accountId: 'ac' }, {
      tipo: 'casa', householdId: 'h1', meUserId: 'u1', contiPersonaliIds: ['ap'],
    });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_household: 'h1', p_pagata_da: null });
  });

  it('in casa con i contanti passa p_pagata_da', async () => {
    const { client, rpc } = fakeRpc();
    await registraMovimento(client, { ...payload, accountId: null }, {
      tipo: 'casa', householdId: 'h1', meUserId: 'u1', contiPersonaliIds: [],
    });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_account: null, p_pagata_da: 'u1' });
  });

  it('personale chiama una sola rpc e nessun adjust_account_balance', async () => {
    const { client, rpc, adjust } = fakeRpc();
    await registraMovimento(client, { ...payload, stima: true }, { tipo: 'personale' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe('crea_movimento');
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_household: null, p_pagata_da: null, p_stima: true });
    expect(rpc.mock.calls[0][1].p_data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(adjust).not.toHaveBeenCalled();
  });

  it('lancia se la rpc fallisce', async () => {
    const { client } = fakeRpc({ data: null, error: new Error('boom') });
    await expect(registraMovimento(client, payload, { tipo: 'personale' })).rejects.toThrow('boom');
  });
});

describe('risposta del server persa', () => {
  const spazio = { tipo: 'personale' } as const;

  it('rete caduta dopo l invio (TypeError lanciato): errore riconoscibile come risposta persa', async () => {
    const rpc = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const e = await registraMovimento({ rpc } as never, payload, spazio).catch((x) => x);
    expect(rispostaPersa(e)).toBe(true);
  });

  it('errore di rete restituito senza codice Postgres: risposta persa', async () => {
    const { client } = fakeRpc({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' } });
    const e = await registraMovimento(client, payload, spazio).catch((x) => x);
    expect(rispostaPersa(e)).toBe(true);
  });

  it('errore con codice Postgres: resta l errore di oggi, non una risposta persa', async () => {
    const errore = { message: 'violazione', code: '23514' };
    const { client } = fakeRpc({ data: null, error: errore });
    const e = await registraMovimento(client, payload, spazio).catch((x) => x);
    expect(e).toBe(errore);
    expect(rispostaPersa(e)).toBe(false);
  });

  it('il messaggio non dà colpa e manda allo Storico', () => {
    expect(MESSAGGIO_RISPOSTA_PERSA).toBe('Non so se è stato salvato. Controlla nello Storico prima di riprovare.');
  });
});
