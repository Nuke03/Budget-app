import { describe, it, expect, vi } from 'vitest';
import { loadProposteStime, primoDelMeseDopo } from '@/lib/loadProposteStime';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { PlanItem } from '@/lib/types';
import { createFakeDb } from './helpers/fakeDb';

const NOW = new Date('2026-11-09T12:00:00Z');

const voce = (over: Partial<PlanItem>): PlanItem => ({
  id: 'i1', planId: 'P', nome: 'Luce', categoriaId: 'c1', frequenzaMesi: 2, importoRicorrenza: 110,
  importoMensile: 55, origineStima: 'suggerita', goalId: 'g1', stimaIgnorataConN: null, ordine: 0, ...over,
});
const piano = (validoDal: string, items: PlanItem[]): PlanBundle => ({
  plan: {
    id: `P-${validoDal}`, householdId: 'H1', validoDal, giornoVersamento: 5, regola: 'parti_uguali',
    cuscinettoObiettivo: 100, cuscinettoQuotaMensile: 10, arrotondamento: 10, totaleMensile: 80, createdAt: '2026-01-01T00:00:00Z',
  },
  items,
  shares: [],
});
const spesa = (id: string, importo: number, data: string, categoria: string, household: string | null = 'H1') => ({
  id, user_id: 'A', household_id: household, tipo: 'expense', importo, data, categoria_id: categoria,
  account_id: null, goal_id: null, descrizione: id, nota: null, created_at: `${data}T10:00:00Z`,
});
const goal = {
  id: 'g1', user_id: 'A', household_id: 'H1', nome: 'Luce', importo_target: 110, modalita: 'bloccato', scadenza: null,
  categoria_id: 'c1', ricorrente: true, frequenza_mesi: 2, stato: 'aperto', created_at: '2026-01-01T00:00:00Z', accantona_da: null,
};

function db(transactions: Record<string, unknown>[]) {
  const d = createFakeDb({ transactions, budget_goals: [goal] }, { userId: 'A', membri: { H1: ['A'] } });
  const from = vi.spyOn(d.client, 'from');
  return { d, from };
}

describe('loadProposteStime', () => {
  it('legge solo le categorie delle voci ancora stimate, dall’inizio del piano', async () => {
    const { d, from } = db([
      spesa('s1', 142, '2026-10-05', 'c1'),
      spesa('s2', 999, '2026-10-06', 'c9'),
      spesa('s3', 999, '2026-01-05', 'c1'),
      spesa('s4', 500, '2026-10-07', 'c1', null),
    ]);
    const piani = [
      piano('2026-10-01', [
        voce({}),
        voce({ id: 'i2', nome: 'Gas', categoriaId: 'c2', origineStima: 'reale' }),
        voce({ id: 'i3', nome: 'Affitto', categoriaId: null }),
      ]),
    ];
    const r = await loadProposteStime(d.client, 'H1', piani, NOW);
    expect(r.proposte).toHaveLength(1);
    expect(r.proposte[0]).toMatchObject({ itemId: 'i1', n: 1, mediaReale: 142, nuovoMensile: 71 });
    expect(r.fondiPerVoce.i1.id).toBe('g1');
    expect(r.validoDal).toBe('2026-12-01');
    expect(r.programmata).toBe(false);
    expect(from.mock.calls.map((c) => c[0])).toEqual(['transactions', 'budget_goals']);
  });

  it('senza voci con categoria non fa nessuna lettura', async () => {
    const { d, from } = db([spesa('s1', 142, '2026-10-05', 'c1')]);
    const r = await loadProposteStime(d.client, 'H1', [piano('2026-10-01', [voce({ categoriaId: null })])], NOW);
    expect(r.proposte).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('senza piano in vigore non legge nulla', async () => {
    const { d, from } = db([]);
    const r = await loadProposteStime(d.client, 'H1', [piano('2027-01-01', [voce({})])], NOW);
    expect(r.proposte).toEqual([]);
    expect(r.pianoAttuale).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('dopo una stima accettata (versione nuova in vigore) le altre restano proposte', async () => {
    const { d } = db([spesa('s1', 142, '2026-10-05', 'c1'), spesa('s2', 90, '2026-10-06', 'c2')]);
    const piani = [
      piano('2026-01-01', [voce({}), voce({ id: 'i2', nome: 'Gas', categoriaId: 'c2', goalId: null })]),
      piano('2026-11-01', [voce({ origineStima: 'reale' }), voce({ id: 'i2', nome: 'Gas', categoriaId: 'c2', goalId: null })]),
    ];
    const r = await loadProposteStime(d.client, 'H1', piani, NOW);
    expect(r.proposte.map((p) => p.itemId)).toEqual(['i2']);
  });

  it('segnala la modifica già programmata', async () => {
    const { d } = db([spesa('s1', 142, '2026-10-05', 'c1')]);
    const r = await loadProposteStime(
      d.client,
      'H1',
      [piano('2026-10-01', [voce({})]), piano('2026-12-01', [voce({})])],
      NOW,
    );
    expect(r.programmata).toBe(true);
    expect(r.pianoAttuale?.plan.validoDal).toBe('2026-10-01');
  });
});

describe('primoDelMeseDopo', () => {
  it('è il primo del mese dopo, a dicembre passa all’anno nuovo, nel giorno di Roma', () => {
    expect(primoDelMeseDopo(new Date('2026-11-09T12:00:00Z'))).toBe('2026-12-01');
    expect(primoDelMeseDopo(new Date('2026-12-15T12:00:00Z'))).toBe('2027-01-01');
    expect(primoDelMeseDopo(new Date('2026-10-31T23:30:00Z'))).toBe('2026-12-01');
  });
});
