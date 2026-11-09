import { describe, it, expect } from 'vitest';
import { getCheckin, saveCheckin, CheckinGiaFattoError, messaggioErroreCheckin } from '@/lib/data/checkins';
import { createFakeDb } from '../helpers/fakeDb';

const input = {
  householdId: 'H1',
  mese: '2026-10-01',
  attesoTotale: 1380,
  versatoTotale: 1380,
  previstoMensili: 1288,
  spesoMensili: 1161,
  nonRegistrate: 80,
  avanzo: 47,
};

describe('getCheckin', () => {
  it('mappa la riga in Checkin', async () => {
    const db = createFakeDb(
      {
        household_checkins: [
          {
            id: 'c1', household_id: 'H1', mese: '2026-10-01', user_id: 'U1', created_at: '2026-11-02T10:00:00Z',
            atteso_totale: '1380', versato_totale: 1380, previsto_mensili: 1288, speso_mensili: 1161,
            non_registrate: 80, avanzo: 47, esito: 'avanzo', destinazione_avanzo: 'cuscinetto', goal_id: null,
          },
          { id: 'c2', household_id: 'H1', mese: '2026-09-01' },
          { id: 'c3', household_id: 'H2', mese: '2026-10-01' },
        ],
      },
      { userId: 'U1', membri: { H1: ['U1'], H2: ['U2'] } }
    );
    expect(await getCheckin(db.client, 'H1', '2026-10-01')).toEqual({
      id: 'c1', householdId: 'H1', mese: '2026-10-01', userId: 'U1', createdAt: '2026-11-02T10:00:00Z',
      attesoTotale: 1380, versatoTotale: 1380, previstoMensili: 1288, spesoMensili: 1161,
      nonRegistrate: 80, avanzo: 47, esito: 'avanzo', destinazioneAvanzo: 'cuscinetto', goalId: null,
    });
  });

  it('senza riga restituisce null', async () => {
    const db = createFakeDb({ household_checkins: [] }, { userId: 'U1', membri: { H1: ['U1'] } });
    expect(await getCheckin(db.client, 'H1', '2026-10-01')).toBeNull();
  });
});

describe('saveCheckin', () => {
  it('chiama la rpc con i parametri p_* e restituisce l id', async () => {
    const db = createFakeDb({}, { userId: 'U1' });
    db.registerRpc('save_household_checkin', () => ({ data: 'ck-1' }));
    const id = await saveCheckin(db.client, { ...input, destinazione: 'da_parte', nuovaCosa: 'Vacanza' });
    expect(id).toBe('ck-1');
    expect(db.rpcCalls).toEqual([
      {
        name: 'save_household_checkin',
        args: {
          p_household: 'H1', p_mese: '2026-10-01', p_atteso_totale: 1380, p_versato_totale: 1380,
          p_previsto_mensili: 1288, p_speso_mensili: 1161, p_non_registrate: 80, p_avanzo: 47,
          p_destinazione: 'da_parte', p_goal_id: null, p_nuova_cosa: 'Vacanza',
        },
      },
    ]);
  });

  it('senza destinazione passa null', async () => {
    const db = createFakeDb({}, { userId: 'U1' });
    db.registerRpc('save_household_checkin', () => ({ data: 'ck-1' }));
    await saveCheckin(db.client, input);
    expect(db.rpcCalls[0].args).toMatchObject({ p_destinazione: null, p_goal_id: null, p_nuova_cosa: null });
  });

  it('check-in gia fatto lancia CheckinGiaFattoError', async () => {
    const db = createFakeDb({}, { userId: 'U1' });
    db.registerRpc('save_household_checkin', () => ({ error: { message: 'check-in gia fatto' } }));
    await expect(saveCheckin(db.client, input)).rejects.toBeInstanceOf(CheckinGiaFattoError);
  });

  it('un altro errore sale com è', async () => {
    const db = createFakeDb({}, { userId: 'U1' });
    db.registerRpc('save_household_checkin', () => ({ error: { message: 'obiettivo mancante' } }));
    await expect(saveCheckin(db.client, input)).rejects.toMatchObject({ message: 'obiettivo mancante' });
  });
});

describe('messaggioErroreCheckin', () => {
  it('check-in già fatto', () => {
    expect(messaggioErroreCheckin(new CheckinGiaFattoError())).toBe('Il check-in di questo mese è già stato fatto.');
    expect(messaggioErroreCheckin({ message: 'check-in gia fatto' })).toBe('Il check-in di questo mese è già stato fatto.');
  });
  it('errori del server: frasi semplici, senza consigli sulla connessione', () => {
    for (const m of ['casa non scrivibile', 'mese non valido', 'destinazione non valida']) {
      const frase = messaggioErroreCheckin({ message: m });
      expect(frase).not.toContain('connessione');
      expect(frase).not.toBe('Salvataggio fallito, controlla la connessione e riprova.');
    }
    expect(messaggioErroreCheckin({ message: 'casa non scrivibile' })).toBe('Non puoi modificare questa casa.');
  });
  it('errore sconosciuto: frase generica', () => {
    expect(messaggioErroreCheckin(new Error('boom'))).toBe('Salvataggio fallito, controlla la connessione e riprova.');
  });
});
