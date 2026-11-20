import { describe, it, expect } from 'vitest';
import {
  confermaVersamento,
  getConfermePerObiettivi,
  getVersatoNelleFinestre,
} from '@/lib/data/goalVersamenti';
import type { BudgetGoal } from '@/lib/types';
import { createFakeDb } from '../helpers/fakeDb';
import { createRecordingClient, callsOf } from '../helpers/recordingSupabase';

const TODAY = new Date('2026-11-19T12:00:00Z');

const dilazionato: BudgetGoal = {
  id: 'G1',
  nome: 'Assicurazione',
  importoTarget: 1200,
  modalita: 'dilazionato',
  scadenza: '2027-05-01',
  categoriaId: null,
  ricorrente: false,
  frequenzaMesi: null,
  stato: 'aperto',
  createdAt: '2026-06-01T00:00:00Z',
};
const ricorrente: BudgetGoal = {
  ...dilazionato,
  id: 'G2',
  nome: 'TARI',
  importoTarget: 300,
  ricorrente: true,
  frequenzaMesi: 12,
  scadenza: '2027-03-31',
  createdAt: '2026-01-01T00:00:00Z',
};
const bloccato: BudgetGoal = { ...dilazionato, id: 'G3', modalita: 'bloccato', scadenza: null };

const riga = (id: string, goal: string, data: string, importo: number) => ({
  id, goal_id: goal, user_id: 'A', data, importo,
});

describe('getVersatoNelleFinestre', () => {
  it('somma i versamenti dentro la finestra di ciascun obiettivo, null dove non ce ne sono', async () => {
    const db = createFakeDb(
      {
        goal_versamenti: [
          riga('v1', 'G1', '2026-10-05', 100),
          riga('v2', 'G1', '2026-11-05', 150),
          riga('v3', 'G1', '2026-05-30', 999), // prima della creazione
        ],
      },
      { userId: 'A', membri: {} }
    );
    const r = await getVersatoNelleFinestre(db.client, [dilazionato, ricorrente, bloccato], TODAY);
    expect(r).toEqual({ G1: 250, G2: null, G3: null });
  });

  it('un ricorrente confermato solo nel ciclo prima resta in modalità conferma, con 0 nel ciclo nuovo', async () => {
    const db = createFakeDb(
      { goal_versamenti: [riga('v1', 'G2', '2026-03-15', 70)] },
      { userId: 'A', membri: {} }
    );
    const r = await getConfermePerObiettivi(db.client, [ricorrente], TODAY);
    expect(r.G2).toEqual({ versato: 0, mese: 0 });
  });

  it('un ricorrente non conta il versamento del ciclo prima (inizio escluso)', async () => {
    // Ciclo di novembre 2026: (31 mar 2026, 31 mar 2027]
    const db = createFakeDb(
      {
        goal_versamenti: [
          riga('v1', 'G2', '2026-03-31', 80), // del ciclo che finisce
          riga('v2', 'G2', '2026-03-15', 70), // ciclo prima
          riga('v3', 'G2', '2026-11-02', 20),
        ],
      },
      { userId: 'A', membri: {} }
    );
    const r = await getVersatoNelleFinestre(db.client, [ricorrente], TODAY);
    expect(r.G2).toBe(20);
  });

  it('un versamento dopo la fine della finestra non conta nella somma, ma tiene la modalità conferma', async () => {
    const db = createFakeDb(
      { goal_versamenti: [riga('v1', 'G1', '2027-06-01', 50)] },
      { userId: 'A', membri: {} }
    );
    const r = await getVersatoNelleFinestre(db.client, [dilazionato], TODAY);
    expect(r.G1).toBe(0);
  });

  it('due letture per tutti i dilazionati: chi ha confermato (solo goal_id) e le righe dal primo inizio finestra', async () => {
    const { client, calls } = createRecordingClient([]);
    await getVersatoNelleFinestre(client, [dilazionato, ricorrente, bloccato], TODAY);
    expect(calls).toHaveLength(2);
    expect(calls[0].table).toBe('goal_versamenti');
    expect(callsOf(calls[0], 'select')).toEqual([['goal_id']]);
    expect(callsOf(calls[0], 'in')).toContainEqual(['goal_id', ['G1', 'G2']]);
    expect(callsOf(calls[1], 'in')).toContainEqual(['goal_id', ['G1', 'G2']]);
    expect(callsOf(calls[1], 'gte')).toEqual([['data', '2026-03-31']]);
  });

  it('nessun dilazionato, nessuna query', async () => {
    const { client, calls } = createRecordingClient([]);
    expect(await getVersatoNelleFinestre(client, [bloccato], TODAY)).toEqual({ G3: null });
    expect(await getVersatoNelleFinestre(client, [], TODAY)).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it('se la lettura fallisce lancia: chi chiama decide (la Home mette tutto a null)', async () => {
    const client = {
      from: () => {
        const b: Record<string, unknown> = {};
        for (const m of ['select', 'in', 'gte']) b[m] = () => b;
        b.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: new Error('boom') });
        return b;
      },
    };
    await expect(getVersatoNelleFinestre(client as never, [dilazionato], TODAY)).rejects.toThrow('boom');
  });
});

describe('getConfermePerObiettivi', () => {
  it('dice anche quanto è stato confermato nel mese in corso', async () => {
    const db = createFakeDb(
      {
        goal_versamenti: [
          riga('v1', 'G1', '2026-10-05', 100),
          riga('v2', 'G1', '2026-11-05', 150),
          riga('v3', 'G1', '2026-11-18', 50),
        ],
      },
      { userId: 'A', membri: {} }
    );
    const r = await getConfermePerObiettivi(db.client, [dilazionato], TODAY);
    expect(r.G1).toEqual({ versato: 300, mese: 200 });
  });
});

describe('confermaVersamento', () => {
  const oggi = TODAY;

  it('scrive la riga con obiettivo, importo e data', async () => {
    const db = createFakeDb({ goal_versamenti: [] }, { userId: 'A', membri: {} });
    await confermaVersamento(db.client, 'G1', 200, '2026-11-19', oggi);
    expect(db.tables.goal_versamenti).toHaveLength(1);
    expect(db.tables.goal_versamenti[0]).toMatchObject({ goal_id: 'G1', importo: 200, data: '2026-11-19' });
  });

  it('rifiuta una data nel futuro, senza scrivere', async () => {
    const db = createFakeDb({ goal_versamenti: [] }, { userId: 'A', membri: {} });
    await expect(confermaVersamento(db.client, 'G1', 200, '2026-11-20', oggi)).rejects.toThrow();
    expect(db.tables.goal_versamenti).toHaveLength(0);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY, 1e9, 2e9])('rifiuta l\'importo %s', async (importo) => {
    const db = createFakeDb({ goal_versamenti: [] }, { userId: 'A', membri: {} });
    await expect(confermaVersamento(db.client, 'G1', importo, '2026-11-19', oggi)).rejects.toThrow();
    expect(db.tables.goal_versamenti).toHaveLength(0);
  });

  it.each(['', 'ieri', '2026-13-01', '2026-02-30', '19/11/2026'])('rifiuta la data %s', async (data) => {
    const db = createFakeDb({ goal_versamenti: [] }, { userId: 'A', membri: {} });
    await expect(confermaVersamento(db.client, 'G1', 10, data, oggi)).rejects.toThrow();
    expect(db.tables.goal_versamenti).toHaveLength(0);
  });
});
