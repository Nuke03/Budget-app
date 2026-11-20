import { describe, it, expect, vi, afterEach } from 'vitest';
import * as versamenti from '@/lib/data/goalVersamenti';
import { loadHomeData } from '@/lib/loadHomeData';
import { createFakeDb } from './helpers/fakeDb';

// 1200 € da giugno a dicembre: 200 al mese. A metà novembre sono passati 5 mesi: 1000 a tempo.
const TODAY = new Date('2026-11-15T12:00:00Z');

afterEach(() => vi.restoreAllMocks());

const conto = { id: 'acc', user_id: 'A', household_id: null, nome: 'Conto', saldo_attuale: 3000, conta_in_disponibile: true, target_saldo: null };
const obiettivo = {
  id: 'g1', user_id: 'A', household_id: null, nome: 'Assicurazione', importo_target: 1200, modalita: 'dilazionato',
  scadenza: '2026-12-01', categoria_id: null, ricorrente: false, frequenza_mesi: null, stato: 'aperto',
  created_at: '2026-06-01T00:00:00Z', accantona_da: null,
};
const spesaRecente = {
  id: 't1', user_id: 'A', household_id: null, tipo: 'expense', importo: 5, data: '2026-11-14', categoria_id: null,
  account_id: null, goal_id: null, descrizione: 'Caffè', nota: null, created_at: '2026-11-14T10:00:00Z', stima: false,
};
const versamento = (id: string, data: string, importo: number) => ({ id, goal_id: 'g1', user_id: 'A', data, importo });

function db(righeVersamenti: ReturnType<typeof versamento>[]) {
  return createFakeDb(
    { accounts: [conto], budget_goals: [obiettivo], transactions: [spesaRecente], categories: [], goal_versamenti: righeVersamenti },
    { userId: 'A', membri: {} }
  );
}

describe('loadHomeData: conferma versamento', () => {
  it('senza conferme i numeri sono quelli di sempre (quota a tempo)', async () => {
    const d = await loadHomeData(db([]).client, TODAY, null);
    expect(d.riservati.obiettivi).toBe(1000);
    expect(d.disponibileReale).toBe(2000);
    expect(d.goals[0].accantonato).toBe(1000);
    expect(d.prossimo).toBeNull();
  });

  it('con una conferma sotto la quota il riservato è il confermato, ovunque nella Home', async () => {
    const d = await loadHomeData(db([versamento('v1', '2026-11-05', 400)]).client, TODAY, null);
    expect(d.riservati.obiettivi).toBe(400);
    expect(d.disponibileReale).toBe(2600);
    expect(d.disponibileLibero).toBe(2600);
    expect(d.goals[0].accantonato).toBe(400);
    expect(d.goals[0]).toMatchObject({ versatoNellaFinestra: 400, confermatoMese: 400 });
  });

  it('con una conferma sopra la quota resta la quota a tempo', async () => {
    const d = await loadHomeData(db([versamento('v1', '2026-11-05', 1500)]).client, TODAY, null);
    expect(d.riservati.obiettivi).toBe(1000);
    expect(d.disponibileReale).toBe(2000);
  });

  it("un versamento fuori finestra non conta, ma l'obiettivo resta in modalità conferma: riservato 0 e Da fare", async () => {
    const d = await loadHomeData(db([versamento('v1', '2026-05-20', 50)]).client, TODAY, null);
    expect(d.goals[0].versatoNellaFinestra).toBe(0);
    expect(d.riservati.obiettivi).toBe(0);
    expect(d.prossimo?.tipo).toBe('obiettivo');
  });

  it('ricorrente confermato nel ciclo prima: nel ciclo nuovo riservato 0 e Da fare; confermato ora: il minore', async () => {
    const ric = { ...obiettivo, ricorrente: true, frequenza_mesi: 12, scadenza: '2027-03-31', created_at: '2026-01-01T00:00:00Z' };
    const mk = (v: ReturnType<typeof versamento>[]) =>
      createFakeDb(
        { accounts: [conto], budget_goals: [ric], transactions: [spesaRecente], categories: [], goal_versamenti: v },
        { userId: 'A', membri: {} }
      );
    const prima = await loadHomeData(mk([versamento('v1', '2026-03-15', 100)]).client, TODAY, null);
    expect(prima.goals[0].accantonato).toBe(0);
    expect(prima.prossimo?.tipo).toBe('obiettivo');
    const ora = await loadHomeData(mk([versamento('v1', '2026-11-05', 300)]).client, TODAY, null);
    expect(ora.goals[0].accantonato).toBe(300);
    const mai = await loadHomeData(mk([]).client, TODAY, null);
    expect(mai.goals[0].versatoNellaFinestra).toBeNull();
    expect(mai.goals[0].accantonato).toBeGreaterThan(300);
  });

  it('Da fare: chiede la quota del mese a chi ha già confermato, non a chi no', async () => {
    const senza = await loadHomeData(db([]).client, TODAY, null);
    expect(senza.prossimo).toBeNull();
    const conferma = await loadHomeData(db([versamento('v1', '2026-10-05', 400)]).client, TODAY, null);
    expect(conferma.prossimo).toEqual({
      testo: 'Hai messo da parte i 200 € per Assicurazione questo mese?',
      href: '/goals#goal-g1',
      tipo: 'obiettivo',
    });
    const fatto = await loadHomeData(db([versamento('v1', '2026-11-05', 200)]).client, TODAY, null);
    expect(fatto.prossimo).toBeNull();
  });

  it('se la lettura dei versamenti fallisce la Home si apre con i numeri di sempre', async () => {
    vi.spyOn(versamenti, 'getConfermePerObiettivi').mockRejectedValue(new Error('giù'));
    const d = await loadHomeData(db([versamento('v1', '2026-11-05', 400)]).client, TODAY, null);
    expect(d.riservati.obiettivi).toBe(1000);
    expect(d.disponibileReale).toBe(2000);
    expect(d.prossimo).toBeNull();
  });
});
