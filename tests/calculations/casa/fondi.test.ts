import { describe, it, expect } from 'vitest';
import { scadenzeProposte, anteprimaDaParte, statoVociDaParte } from '@/lib/calculations/casa/fondi';
import type { BudgetGoal, PlanItem } from '@/lib/types';

describe('scadenzeProposte', () => {
  it('per una voce trimestrale', () => {
    expect(scadenzeProposte({ oggi: '2026-11-09', frequenzaMesi: 3 })).toEqual(['2026-12-31', '2027-01-31', '2027-02-28']);
  });
  it('per una voce annuale sono 12 date, l\'ultima a novembre dell\'anno dopo', () => {
    const d = scadenzeProposte({ oggi: '2026-11-09', frequenzaMesi: 12 });
    expect(d).toHaveLength(12);
    expect(d[11]).toBe('2027-11-30');
  });
});

describe('anteprimaDaParte', () => {
  it('TARI: 100 su 300 alla prima scadenza', () => {
    expect(anteprimaDaParte({ importoRicorrenza: 300, frequenzaMesi: 12, scadenza: '2027-03-31', oggi: '2026-11-09' })).toEqual({
      quotaMensile: 25, allaPrimaScadenza: 100, mancaAllaPrimaScadenza: 200, mesiAllaScadenza: 4,
    });
  });
  it('luce bimestrale', () => {
    expect(anteprimaDaParte({ importoRicorrenza: 110, frequenzaMesi: 2, scadenza: '2026-12-31', oggi: '2026-11-09' })).toMatchObject({
      quotaMensile: 55, allaPrimaScadenza: 55, mancaAllaPrimaScadenza: 55,
    });
  });
  it('con l\'ultima scadenza proposta è tutto messo da parte', () => {
    expect(anteprimaDaParte({ importoRicorrenza: 300, frequenzaMesi: 12, scadenza: '2027-11-30', oggi: '2026-11-09' })).toMatchObject({
      allaPrimaScadenza: 300, mancaAllaPrimaScadenza: 0,
    });
  });
});

describe('statoVociDaParte', () => {
  const voce = (over: Partial<PlanItem>): PlanItem => ({
    id: 'i1', planId: 'p1', nome: 'TARI', categoriaId: 'c1', frequenzaMesi: 12, importoRicorrenza: 300,
    importoMensile: 25, origineStima: 'utente', goalId: null, stimaIgnorataConN: null, ordine: 1, ...over,
  });
  const fondo = (over: Partial<BudgetGoal>): BudgetGoal => ({
    id: 'g1', nome: 'TARI', importoTarget: 300, modalita: 'dilazionato', scadenza: '2027-03-31', categoriaId: 'c1',
    ricorrente: true, frequenzaMesi: 12, stato: 'aperto', createdAt: '2026-11-09', ...over,
  });

  it('voce con il fondo aperto collegato: messa', () => {
    const r = statoVociDaParte([voce({ goalId: 'g1' })], [fondo({})]);
    expect(r[0]).toMatchObject({ stato: 'messa', goal: { id: 'g1' } });
  });
  it('fondo aperto ricorrente con stessa categoria e stesso nome (senza maiuscole), voce non collegata: messa', () => {
    const r = statoVociDaParte([voce({})], [fondo({ nome: 'tari' })]);
    expect(r[0].stato).toBe('messa');
  });
  it('stessa categoria ma nome diverso: da mettere', () => {
    const r = statoVociDaParte([voce({})], [fondo({ nome: 'Acqua' })]);
    expect(r[0]).toMatchObject({ stato: 'da_mettere', goal: null });
  });
  it('voce collegata a un fondo chiuso: il fondo omonimo non la copre', () => {
    const r = statoVociDaParte(
      [voce({ goalId: 'g0' })],
      [fondo({ id: 'g0', stato: 'chiuso' }), fondo({ id: 'g2' })]
    );
    expect(r[0].stato).toBe('da_mettere');
  });
  it('nessun fondo: da mettere; la voce mensile è esclusa', () => {
    const r = statoVociDaParte([voce({}), voce({ id: 'i2', frequenzaMesi: 1 })], []);
    expect(r).toHaveLength(1);
    expect(r[0].stato).toBe('da_mettere');
  });
  it('un fondo non ricorrente non copre', () => {
    const r = statoVociDaParte([voce({})], [fondo({ ricorrente: false })]);
    expect(r[0].stato).toBe('da_mettere');
  });
});
