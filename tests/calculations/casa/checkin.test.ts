import { describe, it, expect } from 'vitest';
import { computeCheckin, mesePrecedente, meseDaControllare } from '@/lib/calculations/casa/checkin';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { PlanItem, Transaction } from '@/lib/types';
import type { RigaMese } from '@/lib/calculations/casa/versamenti';
import { PAROLE_VIETATE } from '../../helpers/paroleVietate';

const MESE = '2026-10-01';
const riga = (mese: string, atteso: number, versato: number): RigaMese => ({
  mese,
  atteso,
  versato,
  mancano: Math.max(0, atteso - versato),
});
const voce = (nome: string, importoMensile: number, frequenzaMesi = 1, categoriaId: string | null = null, goalId: string | null = null): PlanItem => ({
  id: nome,
  planId: 'P1',
  nome,
  categoriaId,
  frequenzaMesi,
  importoRicorrenza: importoMensile * frequenzaMesi,
  importoMensile,
  origineStima: 'utente',
  goalId,
  stimaIgnorataConN: null,
  ordine: 0,
});
const piano = (items: PlanItem[]): PlanBundle => ({ plan: { id: 'P1', validoDal: '2026-01-01' }, items, shares: [] }) as unknown as PlanBundle;
const spesa = (importo: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${Math.random()}`,
  tipo: 'expense',
  importo,
  data: '2026-10-12',
  categoriaId: null,
  accountId: null,
  goalId: null,
  descrizione: '',
  nota: null,
  createdAt: '', stima: false,
  ...extra,
});
const membri = (atteso: [number, number], versato: [number, number]): Record<string, RigaMese[]> => ({
  u1: [riga(MESE, atteso[0], versato[0])],
  u2: [riga(MESE, atteso[1], versato[1])],
});
const mensili = (totale: number): PlanBundle =>
  piano([voce('Affitto', 750), voce('Spesa', 300), voce('Internet', 28), voce('Condominio', 50), voce('Manutenzione', 30), voce('Altre', totale - 1158)]);

describe('computeCheckin', () => {
  it('avanzo come somma dei due termini', () => {
    const c = computeCheckin({
      mese: MESE,
      righePerMembro: membri([776, 604], [776, 604]),
      piano: mensili(1288),
      spese: [spesa(1161), spesa(80, { origine: 'riconciliazione' })],
      precedente: null,
    });
    expect(c).toMatchObject({
      mese: MESE,
      attesoTotale: 1380,
      versatoTotale: 1380,
      previstoMensili: 1288,
      spesoMensili: 1161,
      nonRegistrate: 80,
      avanzo: 47,
      esito: 'avanzo',
    });
  });

  it('un versamento mancante pesa', () => {
    const c = computeCheckin({
      mese: MESE,
      righePerMembro: membri([776, 604], [472, 604]),
      piano: mensili(1288),
      spese: [spesa(1288)],
      precedente: null,
    });
    expect(c.versatoTotale).toBe(1076);
    expect(c.avanzo).toBe(-304);
    expect(c.esito).toBe('ammanco');
  });

  it("soglie dell'esito", () => {
    const con = (speso: number) =>
      computeCheckin({ mese: MESE, righePerMembro: {}, piano: piano([voce('A', 100)]), spese: [spesa(speso)], precedente: null });
    expect(con(99.5)).toMatchObject({ avanzo: 0.5, esito: 'in_pari' });
    expect(con(100.99)).toMatchObject({ avanzo: -0.99, esito: 'in_pari' });
    expect(con(99)).toMatchObject({ avanzo: 1, esito: 'avanzo' });
    expect(con(101)).toMatchObject({ avanzo: -1, esito: 'ammanco' });
  });

  it('esclusioni dalle spese', () => {
    const c = computeCheckin({
      mese: MESE,
      righePerMembro: {},
      piano: piano([voce('Affitto', 100), voce('Assicurazione', 50, 12, 'CAT-ANNUALE', 'G1')]),
      spese: [
        spesa(10),
        spesa(600, { goalId: 'G1', categoriaId: 'CAT-ANNUALE' }),
        spesa(700, { tipo: 'income' }),
        spesa(800, { data: '2026-09-30' }),
        spesa(80, { origine: 'riconciliazione' }),
      ],
      precedente: null,
    });
    expect(c.spesoMensili).toBe(10);
    expect(c.nonRegistrate).toBe(80);
  });

  it('una categoria condivisa con una voce da parte tiene la spesa non collegata', () => {
    const c = computeCheckin({
      mese: MESE,
      righePerMembro: {},
      piano: piano([voce('Bollette', 100, 1, 'CAT-X'), voce('Assicurazione', 50, 12, 'CAT-X', 'G1')]),
      spese: [spesa(40, { categoriaId: 'CAT-X' }), spesa(600, { categoriaId: 'CAT-X', goalId: 'G1' })],
      precedente: null,
    });
    expect(c.spesoMensili).toBe(40);
  });

  it('il primo mese in casa: la spesa del deposito, collegata al suo fondo, non dà un ammanco finto', () => {
    const c = computeCheckin({
      mese: MESE,
      righePerMembro: membri([500, 500], [500, 500]),
      piano: piano([voce('Affitto', 1000)]),
      spese: [spesa(1000), spesa(2000, { goalId: 'DEPOSITO' }), spesa(300, { goalId: 'ARREDO' })],
      precedente: null,
    });
    expect(c.spesoMensili).toBe(1000);
    expect(c.avanzo).toBe(0);
    expect(c.esito).toBe('in_pari');
  });

  it("un obiettivo di una voce mensile conta tra le spese del mese", () => {
    const c = computeCheckin({
      mese: MESE,
      righePerMembro: {},
      piano: piano([voce('Spesa', 100, 1, 'CAT-S', 'G-SPESA')]),
      spese: [spesa(70, { goalId: 'G-SPESA' })],
      precedente: null,
    });
    expect(c.spesoMensili).toBe(70);
  });

  it('senza piano il previsto è 0', () => {
    const c = computeCheckin({ mese: MESE, righePerMembro: {}, piano: null, spese: [spesa(30)], precedente: null });
    expect(c.previstoMensili).toBe(0);
    expect(c.avanzo).toBe(-30);
  });

  it('arrotonda a due decimali', () => {
    const c = computeCheckin({
      mese: MESE,
      righePerMembro: {},
      piano: piano([voce('A', 0.1), voce('B', 0.2)]),
      spese: [spesa(0.1), spesa(0.2)],
      precedente: null,
    });
    expect(c.previstoMensili).toBe(0.3);
    expect(c.spesoMensili).toBe(0.3);
    expect(c.avanzo).toBe(0);
  });

  it('secondo ammanco', () => {
    const ammanco = (p: 'ammanco' | 'avanzo') =>
      computeCheckin({ mese: MESE, righePerMembro: {}, piano: null, spese: [spesa(50)], precedente: { esito: p } }).secondoAmmanco;
    expect(ammanco('ammanco')).toBe(true);
    expect(ammanco('avanzo')).toBe(false);
    const avanzo = computeCheckin({
      mese: MESE, righePerMembro: {}, piano: piano([voce('A', 100)]), spese: [], precedente: { esito: 'ammanco' },
    });
    expect(avanzo.esito).toBe('avanzo');
    expect(avanzo.secondoAmmanco).toBe(false);
  });

  it('spiegazioneAvanzo', () => {
    const c = computeCheckin({
      mese: MESE, righePerMembro: membri([776, 604], [776, 604]), piano: mensili(1288),
      spese: [spesa(1161), spesa(80, { origine: 'riconciliazione' })], precedente: null,
    });
    expect(c.spiegazioneAvanzo.valore).toBe(c.avanzo);
    expect(c.spiegazioneAvanzo.formula).toBe(
      'Versamenti ricevuti meno attesi, più spese previste meno registrate meno non registrate.'
    );
    const somma = c.spiegazioneAvanzo.ingredienti.reduce((s, i) => s + i.valore, 0);
    expect(Math.round(somma * 100) / 100).toBe(47);
    const testo = JSON.stringify(c.spiegazioneAvanzo).toLowerCase();
    for (const p of PAROLE_VIETATE) expect(testo).not.toContain(p);
  });
});

describe('mesePrecedente', () => {
  it('scala di un mese e passa l anno', () => {
    expect(mesePrecedente('2026-11-01')).toBe('2026-10-01');
    expect(mesePrecedente('2026-01-01')).toBe('2025-12-01');
  });
});

describe('meseDaControllare', () => {
  const righeDa = (...mesi: string[]) => mesi.map((m) => riga(m, 100, 100));
  const ott = righeDa('2026-10-01');

  it("l'ultimo mese chiuso, mai controllato", () => {
    expect(meseDaControllare({ oggi: '2026-11-09', righe: ott, ultimoCheckinMese: null })).toBe('2026-10-01');
  });
  it('già controllato: niente', () => {
    expect(meseDaControllare({ oggi: '2026-11-09', righe: ott, ultimoCheckinMese: '2026-10-01' })).toBeNull();
  });
  it('righe solo dal mese corrente: niente', () => {
    expect(meseDaControllare({ oggi: '2026-11-09', righe: righeDa('2026-11-01'), ultimoCheckinMese: null })).toBeNull();
  });
  it('il mese dopo quello controllato', () => {
    expect(
      meseDaControllare({ oggi: '2026-12-01', righe: righeDa('2026-10-01', '2026-11-01', '2026-12-01'), ultimoCheckinMese: '2026-10-01' })
    ).toBe('2026-11-01');
  });
  it('solo l ultimo mese chiuso: i più vecchi si saltano', () => {
    expect(
      meseDaControllare({ oggi: '2026-11-09', righe: righeDa('2026-09-01', '2026-10-01', '2026-11-01'), ultimoCheckinMese: '2026-09-01' })
    ).toBe('2026-10-01');
    expect(
      meseDaControllare({ oggi: '2026-12-05', righe: righeDa('2026-10-01', '2026-11-01', '2026-12-01'), ultimoCheckinMese: null })
    ).toBe('2026-11-01');
  });
  it('righe vuote: niente', () => {
    expect(meseDaControllare({ oggi: '2026-11-09', righe: [], ultimoCheckinMese: null })).toBeNull();
  });
});
