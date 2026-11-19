import { describe, it, expect } from 'vitest';
import { piccoleSpese, divisioneMese, numeriLezione } from '@/lib/calculations/percorso/numeri';
import type { DatiRegole } from '@/lib/calculations/percorso/regole';
import type { BudgetGoal, Category, Transaction } from '@/lib/types';

const cat = (id: string, nome: string, ruolo: Category['ruolo'] = null): Category => ({
  id, nome, tipo: 'expense', colore: null, archiviata: false, ruolo,
});
const tr = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't', tipo: 'expense', importo: 10, data: '2026-11-05', categoriaId: null, accountId: 'c1',
  goalId: null, descrizione: '', nota: null, createdAt: '2026-01-01T00:00:00.000Z', stima: false, ...over,
});
const goal = (over: Partial<BudgetGoal & { accantonato: number }> = {}): BudgetGoal & { accantonato: number } => ({
  id: 'g1', nome: 'Fondo', importoTarget: 120, modalita: 'dilazionato', scadenza: '2027-11-30', categoriaId: null,
  ricorrente: false, frequenzaMesi: null, stato: 'aperto', createdAt: '2026-11-01', accantonato: 0, ...over,
});
const dati = (over: Partial<DatiRegole> = {}): DatiRegole => ({
  oggi: '2026-11-19', transazioni: [], categorie: [], goals: [], lezioni: {}, percorso: null,
  disponibileReale: 500, ultimaEntrataIl: '2026-11-10', primiPassiVisibili: false, ...over,
});

describe('piccoleSpese', () => {
  it('piccole spese: 3 caffè da 1,20 e una spesa da 5 → numero 3, totale 3,60', () => {
    const t = [
      tr({ id: 'a', importo: 1.2 }), tr({ id: 'b', importo: 1.2 }), tr({ id: 'c', importo: 1.2 }),
      tr({ id: 'd', importo: 5 }),
      tr({ id: 'e', importo: 1, data: '2026-10-05' }),
      tr({ id: 'f', importo: 1, tipo: 'income' }),
    ];
    const r = piccoleSpese(t, '2026-11');
    expect(r.numero).toBe(3);
    expect(r.totale).toBeCloseTo(3.6, 2);
  });
});

describe('divisioneMese', () => {
  it('divisioneMese somma le certe per ruolo', () => {
    const categorie = [cat('auto', 'Auto'), cat('cibo', 'Cibo'), cat('x', 'Altro', 'certa')];
    const t = [
      tr({ id: 'a', importo: 100, categoriaId: 'auto' }),
      tr({ id: 'b', importo: 50, categoriaId: 'x' }),
      tr({ id: 'c', importo: 30, categoriaId: 'cibo' }),
      tr({ id: 'd', importo: 20, categoriaId: null }),
      tr({ id: 'e', importo: 70, categoriaId: 'auto', data: '2026-10-05' }),
      tr({ id: 'f', importo: 500, tipo: 'income' }),
      tr({ id: 'g', importo: 40, goalId: 'g1', categoriaId: 'cibo' }),
    ];
    const r = divisioneMese(t, categorie, [goal({ accantonato: 25 }), goal({ id: 'g2', accantonato: 15 })], '2026-11');
    expect(r).toEqual({ certe: 150, altre: 90, daParte: 40 });
  });
});

describe('numeriLezione', () => {
  it('dove-vanno cita numero e totale', () => {
    const t = [tr({ id: 'a', importo: 2 }), tr({ id: 'b', importo: 3 })];
    const f = numeriLezione('dove-vanno', dati({ transazioni: t }));
    expect(f).toContain('2');
    expect(f).toContain('5 €');
  });
  it('dove-vanno senza piccole spese: null', () => {
    expect(numeriLezione('dove-vanno', dati())).toBeNull();
  });
  it('imprevisti: cifra nel fondo o non c\'è ancora', () => {
    expect(numeriLezione('imprevisti', dati())).toContain('non c’è ancora');
    expect(numeriLezione('imprevisti', dati({ goals: [goal({ ruolo: 'imprevisti', accantonato: 80 })] }))).toContain('80 €');
  });
  it('piano: il disponibile', () => {
    expect(numeriLezione('piano', dati({ disponibileReale: 315 }))).toContain('315 €');
  });
  it('spese-certe: quanti fondi e quota mensile', () => {
    const f = numeriLezione('spese-certe', dati({ goals: [goal(), goal({ id: 'g2' })] }));
    expect(f).toContain('2 fondi');
    expect(f).toContain('20 €');
  });
  it('bisogni-desideri: la divisione del mese', () => {
    const categorie = [cat('auto', 'Auto'), cat('cibo', 'Cibo')];
    const t = [tr({ id: 'a', importo: 100, categoriaId: 'auto' }), tr({ id: 'b', importo: 30, categoriaId: 'cibo' })];
    const f = numeriLezione('bisogni-desideri', dati({ transazioni: t, categorie }));
    expect(f).toContain('100 €');
    expect(f).toContain('30 €');
  });
  it('le altre danno null', () => {
    expect(numeriLezione('truffe', dati())).toBeNull();
    expect(numeriLezione('coppia', dati())).toBeNull();
  });
});
