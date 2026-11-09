import { describe, it, expect } from 'vitest';
import {
  recordBalanceCheck,
  getControlliRecenti,
  messaggioErroreControllo,
} from '@/lib/data/balanceChecks';
import { createFakeDb } from '../helpers/fakeDb';

describe('recordBalanceCheck', () => {
  it('chiama la rpc con i parametri giusti e restituisce l id', async () => {
    const db = createFakeDb({}, { userId: 'U1' });
    db.registerRpc('record_balance_check', () => ({ data: 'bc-1' }));
    const id = await recordBalanceCheck(db.client, {
      accountId: 'A1', saldoDichiarato: 940, data: '2026-11-09', creaMovimento: true,
    });
    expect(id).toBe('bc-1');
    expect(db.rpcCalls).toEqual([
      {
        name: 'record_balance_check',
        args: { p_account: 'A1', p_saldo_dichiarato: 940, p_data: '2026-11-09', p_crea_movimento: true },
      },
    ]);
  });

  it('l errore della rpc sale', async () => {
    const db = createFakeDb({}, { userId: 'U1' });
    db.registerRpc('record_balance_check', () => ({ error: { message: 'conto non valido' } }));
    await expect(
      recordBalanceCheck(db.client, { accountId: 'A1', saldoDichiarato: 1, data: '2026-11-09', creaMovimento: false })
    ).rejects.toMatchObject({ message: 'conto non valido' });
  });
});

describe('getControlliRecenti', () => {
  it('restituisce la data del controllo e il mese del check-in più recenti', async () => {
    const db = createFakeDb(
      {
        balance_checks: [
          { id: 'b1', household_id: 'H1', data: '2026-10-02' },
          { id: 'b2', household_id: 'H1', data: '2026-11-05' },
          { id: 'b3', household_id: 'H2', data: '2026-11-08' },
        ],
        household_checkins: [
          { id: 'c1', household_id: 'H1', mese: '2026-08-01' },
          { id: 'c2', household_id: 'H1', mese: '2026-10-01' },
        ],
      },
      { userId: 'U1', membri: { H1: ['U1'], H2: ['U2'] } }
    );
    expect(await getControlliRecenti(db.client, 'H1')).toEqual({
      ultimoControllo: '2026-11-05',
      ultimoCheckinMese: '2026-10-01',
    });
  });

  it('senza controlli né check-in restituisce null', async () => {
    const db = createFakeDb({ balance_checks: [], household_checkins: [] }, { userId: 'U1', membri: { H1: ['U1'] } });
    expect(await getControlliRecenti(db.client, 'H1')).toEqual({ ultimoControllo: null, ultimoCheckinMese: null });
  });

  it('fa due sole query con limit 1', async () => {
    const db = createFakeDb({ balance_checks: [], household_checkins: [] }, { userId: 'U1', membri: { H1: ['U1'] } });
    const letture: string[] = [];
    const from = db.client.from.bind(db.client);
    db.client.from = (nome: string) => {
      letture.push(nome);
      return from(nome);
    };
    await getControlliRecenti(db.client, 'H1');
    expect(letture.sort()).toEqual(['balance_checks', 'household_checkins']);
  });
});

describe('messaggioErroreControllo', () => {
  it('conto non valido', () => {
    expect(messaggioErroreControllo(new Error('conto non valido'))).toBe('Quel conto non è più disponibile.');
  });

  it('data non valida', () => {
    expect(messaggioErroreControllo({ message: 'data non valida' })).toBe('Quella data non è valida.');
  });

  it('altri errori: salvataggio fallito', () => {
    expect(messaggioErroreControllo(new Error('boom'))).toBe('Salvataggio fallito, controlla la connessione e riprova.');
    expect(messaggioErroreControllo('stringa')).toBe('Salvataggio fallito, controlla la connessione e riprova.');
  });
});
