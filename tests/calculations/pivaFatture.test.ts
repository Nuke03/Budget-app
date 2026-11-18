import { describe, it, expect } from 'vitest';
import { contoPerIncasso, fattureInAttesa, riassuntoInAttesa } from '@/lib/calculations/pivaFatture';
import type { Account, PivaFattura, Transaction } from '@/lib/types';

const fattura = (id: string, dataEmissione: string, importo: number, dataIncasso: string | null = null): PivaFattura => ({
  id, cliente: `Cliente ${id}`, importo, dataEmissione, dataIncasso, transactionId: dataIncasso ? `t-${id}` : null, nota: null,
});

describe('fattureInAttesa', () => {
  it('ordina dalla più vecchia e segna oltre 60 giorni', () => {
    const r = fattureInAttesa(
      [fattura('b', '2026-10-20', 300), fattura('a', '2026-08-18', 1000), fattura('c', '2026-09-18', 500)],
      '2026-11-17'
    );
    expect(r.righe.map((x) => x.id)).toEqual(['a', 'c', 'b']);
    expect(r.righe.map((x) => x.giorni)).toEqual([91, 60, 28]);
    // 60 giorni esatti non sono ancora "vecchia"
    expect(r.righe.map((x) => x.vecchia)).toEqual([true, false, false]);
    expect(r.totale).toBe(1800);
  });

  it('esclude le incassate', () => {
    const r = fattureInAttesa([fattura('a', '2026-08-18', 1000, '2026-09-01'), fattura('b', '2026-10-20', 300)], '2026-11-17');
    expect(r.righe.map((x) => x.id)).toEqual(['b']);
    expect(r.totale).toBe(300);
  });

  it('senza fatture: totale 0', () => {
    expect(fattureInAttesa([], '2026-11-17')).toEqual({ totale: 0, righe: [] });
  });
});

describe('riassuntoInAttesa', () => {
  it('una sola fattura, nessuna vecchia', () => {
    expect(riassuntoInAttesa(fattureInAttesa([fattura('b', '2026-10-20', 300)], '2026-11-17'))).toBe('1 fattura');
  });
  it('tre fatture, una vecchia', () => {
    const r = fattureInAttesa(
      [fattura('a', '2026-08-18', 1000), fattura('b', '2026-10-20', 300), fattura('c', '2026-11-01', 100)],
      '2026-11-17'
    );
    expect(riassuntoInAttesa(r)).toBe('3 fatture, 1 da 91 giorni');
  });
  it('più vecchie: dice quante e da quanto la più vecchia', () => {
    const r = fattureInAttesa([fattura('a', '2026-08-18', 1000), fattura('b', '2026-09-01', 300)], '2026-11-17');
    expect(riassuntoInAttesa(r)).toBe('2 fatture, 2 vecchie, la prima da 91 giorni');
  });
});

describe('contoPerIncasso', () => {
  const conti = [
    { id: 'tasse', nome: 'Tasse', contaInDisponibile: true },
    { id: 'risparmi', nome: 'Risparmi', contaInDisponibile: false },
    { id: 'corrente', nome: 'Corrente', contaInDisponibile: true },
    { id: 'altro', nome: 'Altro', contaInDisponibile: true },
  ] as Account[];
  const inc = (id: string, data: string, accountId: string | null, categoriaId = 'cat'): Transaction =>
    ({ id, tipo: 'income', importo: 10, data, categoriaId, accountId, createdAt: `${data}T10:00:00Z` }) as Transaction;

  it('il conto dell incasso più recente nella categoria del fatturato', () => {
    const r = contoPerIncasso([inc('1', '2026-10-01', 'corrente'), inc('2', '2026-11-01', 'altro'), inc('3', '2026-11-10', 'corrente', 'x')], conti, 'cat', 'tasse');
    expect(r).toBe('altro');
  });
  it('senza incassi: il primo personale nel disponibile, mai il conto tasse', () => {
    expect(contoPerIncasso([], conti, 'cat', 'tasse')).toBe('corrente');
  });
  it('mai il conto tasse neanche se è l ultimo usato', () => {
    expect(contoPerIncasso([inc('1', '2026-11-01', 'tasse')], conti, 'cat', 'tasse')).toBe('corrente');
  });
  it('nessun conto adatto: null', () => {
    expect(contoPerIncasso([], [conti[0]], 'cat', 'tasse')).toBeNull();
  });
});
