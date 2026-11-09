import { describe, it, expect } from 'vitest';
import {
  getTransfers,
  recordTransfer,
  deleteTransfer,
  messaggioErroreTrasferimento,
} from '@/lib/data/transfers';
import { casa } from '@/lib/data/scope';
import { createFakeDb } from '../helpers/fakeDb';
import { fakeRpcClient } from '../helpers/fakeRpc';
import { createRecordingClient, callsOf } from '../helpers/recordingSupabase';

const riga = (id: string, householdId: string | null, data: string, createdAt: string) => ({
  id,
  household_id: householdId,
  user_id: 'u1',
  da_account_id: 'a1',
  a_account_id: 'a2',
  importo: '603.50',
  data,
  causale: 'versamento',
  beneficiario_user_id: null,
  per_conto_di_user_id: 'u2',
  mese_competenza: '2026-10-01',
  solo_registrazione: false,
  nota: null,
  created_at: createdAt,
});

describe('getTransfers', () => {
  it('getTransfers con scope casa legge solo i trasferimenti della casa', async () => {
    const db = createFakeDb(
      {
        transfers: [
          riga('t1', 'h1', '2026-10-05', '2026-10-05T10:00:00Z'),
          riga('t2', 'h1', '2026-10-05', '2026-10-05T12:00:00Z'),
          riga('t3', 'h2', '2026-10-06', '2026-10-06T10:00:00Z'),
          riga('t4', null, '2026-10-07', '2026-10-07T10:00:00Z'),
          riga('t5', 'h1', '2026-11-01', '2026-11-01T10:00:00Z'),
        ],
      },
      { userId: 'u1', membri: { h1: ['u1'], h2: ['u1'] } },
    );
    const r = await getTransfers(db.client, casa('h1'));
    expect(r.map((t) => t.id)).toEqual(['t5', 't2', 't1']);
    expect(r[0]).toMatchObject({
      householdId: 'h1',
      userId: 'u1',
      daAccountId: 'a1',
      aAccountId: 'a2',
      importo: 603.5,
      causale: 'versamento',
      beneficiarioUserId: null,
      perContoDiUserId: 'u2',
      meseCompetenza: '2026-10-01',
      soloRegistrazione: false,
    });
  });

  it('getTransfers personale chiede household_id nullo', async () => {
    const { client, calls } = createRecordingClient([]);
    await getTransfers(client);
    expect(calls[0].table).toBe('transfers');
    expect(callsOf(calls[0], 'is')).toEqual([['household_id', null]]);
  });
});

describe('recordTransfer', () => {
  it('recordTransfer mappa i parametri sulle RPC con i nomi p_*', async () => {
    const { client, calls } = fakeRpcClient({ record_transfer: { data: 'new-id' } });
    const id = await recordTransfer(client, {
      householdId: 'h1',
      causale: 'versamento',
      importo: 603,
      data: '2026-10-05',
      daAccountId: 'a1',
      aAccountId: 'a2',
      perContoDiUserId: 'u2',
      meseCompetenza: '2026-10-01',
      nota: 'ottobre',
    });
    expect(id).toBe('new-id');
    expect(calls).toEqual([
      {
        name: 'record_transfer',
        args: {
          p_household: 'h1',
          p_causale: 'versamento',
          p_importo: 603,
          p_data: '2026-10-05',
          p_da_account: 'a1',
          p_a_account: 'a2',
          p_beneficiario: null,
          p_per_conto_di: 'u2',
          p_mese_competenza: '2026-10-01',
          p_solo_registrazione: false,
          p_nota: 'ottobre',
        },
      },
    ]);
  });

  it('recordTransfer lancia l errore della RPC', async () => {
    const { client } = fakeRpcClient({ record_transfer: { error: { message: 'importo non valido' } } });
    await expect(
      recordTransfer(client, { householdId: null, causale: 'altro', importo: 0, data: '2026-10-05' }),
    ).rejects.toMatchObject({ message: 'importo non valido' });
  });
});

describe('deleteTransfer', () => {
  it('deleteTransfer chiama delete_transfer con p_id', async () => {
    const { client, calls } = fakeRpcClient({ delete_transfer: { data: null } });
    await deleteTransfer(client, 't1');
    expect(calls).toEqual([{ name: 'delete_transfer', args: { p_id: 't1' } }]);
  });
});

describe('messaggioErroreTrasferimento', () => {
  it('messaggioErroreTrasferimento traduce i tre casi', () => {
    expect(messaggioErroreTrasferimento({ message: 'il beneficiario non ha conti' })).toBe(
      "Chi riceve il rimborso non ha ancora un conto nell'app: scegliete \"Già riflesso nei saldi\".",
    );
    expect(messaggioErroreTrasferimento(new Error('membro non valido'))).toBe('Quella persona non è più in casa.');
    expect(messaggioErroreTrasferimento(new Error('boh'))).toBe(
      'Salvataggio fallito, controlla la connessione e riprova.',
    );
    expect(messaggioErroreTrasferimento(null)).toBe('Salvataggio fallito, controlla la connessione e riprova.');
  });
});
