import { describe, it, expect, beforeEach } from 'vitest';
import { aggiungiQuotaDaRiportare, quoteDaRiportare, togliQuotaDaRiportare } from '@/lib/quoteDaRiportare';

beforeEach(() => sessionStorage.clear());

describe('quoteDaRiportare', () => {
  it('la coda è per utente: un altro account non vede gli id altrui', () => {
    aggiungiQuotaDaRiportare('u1', { id: 'pa1', importo: 82 });
    expect(quoteDaRiportare('u1')).toEqual([{ id: 'pa1', importo: 82 }]);
    expect(quoteDaRiportare('u2')).toEqual([]);
  });
  it('non duplica lo stesso id e toglie solo quello indicato', () => {
    aggiungiQuotaDaRiportare('u1', { id: 'pa1', importo: 82 });
    aggiungiQuotaDaRiportare('u1', { id: 'pa1', importo: 82 });
    aggiungiQuotaDaRiportare('u1', { id: 'pa2', importo: 41 });
    togliQuotaDaRiportare('u1', 'pa1');
    expect(quoteDaRiportare('u1')).toEqual([{ id: 'pa2', importo: 41 }]);
  });
});
