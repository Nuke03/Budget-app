import { describe, it, expect } from 'vitest';
import { scegliConsiglio, obiettiviCorti } from '@/lib/calculations/supporto/consiglio';
import type { Andamento } from '@/lib/calculations/supporto/andamento';
import type { BudgetGoal } from '@/lib/types';
import { differenceInCalendarMonths } from 'date-fns';
import { computeAccantonatoFinora, computeFinestraGoal, computeQuotaMensile } from '@/lib/calculations/accantonato';
import { PAROLE_VIETATE } from '../../helpers/paroleVietate';

const andamento = (over: Partial<Andamento> = {}): Andamento => ({
  spesoFinora: 500,
  solito: 500,
  mesiConfronto: 3,
  curva: [],
  perCategoria: [],
  ...over,
});

const base = {
  spesoStime: 0,
  nomiCategorie: { cibo: 'Cibo', bollette: 'Bollette' } as Record<string, string>,
  obiettiviCorti: [] as { goalId: string; nome: string; mancano: number }[],
  oggi: '2026-11-11',
};

describe('scegliConsiglio', () => {
  it('stime al 25% -> senza_dettaglio con importo nel testo', () => {
    const c = scegliConsiglio({ ...base, andamento: andamento({ spesoFinora: 400 }), spesoStime: 100 });
    expect(c.tipo).toBe('senza_dettaglio');
    expect(c.testo).toContain('100 €');
  });

  it('stime al 20% esatto non bastano', () => {
    const c = scegliConsiglio({ ...base, andamento: andamento({ spesoFinora: 500 }), spesoStime: 100 });
    expect(c.tipo).not.toBe('senza_dettaglio');
  });

  it('categoria +25% e +30 euro -> categoria_sopra con il nome', () => {
    const a = andamento({ perCategoria: [{ categoriaId: 'cibo', mese: 150, solito: 120 }] });
    const c = scegliConsiglio({ ...base, andamento: a });
    expect(c.tipo).toBe('categoria_sopra');
    expect(c.testo).toContain('Cibo');
    expect(c.categoriaId).toBe('cibo');
  });

  it('+40% ma solo +20 euro -> non scatta', () => {
    const a = andamento({ perCategoria: [{ categoriaId: 'cibo', mese: 70, solito: 50 }] });
    expect(scegliConsiglio({ ...base, andamento: a }).tipo).toBe('in_linea');
  });

  it('solito null -> regola 2 saltata', () => {
    const a = andamento({ perCategoria: [{ categoriaId: 'cibo', mese: 500, solito: null }] });
    expect(scegliConsiglio({ ...base, andamento: a }).tipo).toBe('in_linea');
  });

  it('sceglie la categoria con scarto piu alto, a parita il categoriaId minore', () => {
    const a = andamento({
      perCategoria: [
        { categoriaId: 'cibo', mese: 200, solito: 100 },
        { categoriaId: 'bollette', mese: 200, solito: 100 },
        { categoriaId: null, mese: 200, solito: 100 },
      ],
    });
    expect(scegliConsiglio({ ...base, andamento: a }).categoriaId).toBe('bollette');
    const b = andamento({
      perCategoria: [
        { categoriaId: null, mese: 200, solito: 100 },
        { categoriaId: 'cibo', mese: 200, solito: 100 },
      ],
    });
    expect(scegliConsiglio({ ...base, andamento: b }).categoriaId).toBe('cibo');
  });

  it('categoria senza nome -> testo generico, niente crash', () => {
    const a = andamento({ perCategoria: [{ categoriaId: null, mese: 200, solito: 100 }] });
    const c = scegliConsiglio({ ...base, andamento: a });
    expect(c.tipo).toBe('categoria_sopra');
    expect(c.testo).not.toContain('undefined');
  });

  it('obiettivo corto -> obiettivo_corto sul primo', () => {
    const c = scegliConsiglio({
      ...base,
      andamento: andamento(),
      obiettiviCorti: [
        { goalId: 'g1', nome: 'Vacanza', mancano: 300 },
        { goalId: 'g2', nome: 'Auto', mancano: 50 },
      ],
    });
    expect(c.tipo).toBe('obiettivo_corto');
    expect(c.goalId).toBe('g1');
    expect(c.testo).toBe(
      "Per Vacanza mancano 300 €. Mettendone da parte un po' ogni mese ci arrivi senza fretta."
    );
  });

  it('niente -> in_linea, e la frase cambia col mese', () => {
    const c = scegliConsiglio({ ...base, andamento: andamento() });
    expect(c.tipo).toBe('in_linea');
    expect(c.testo).toContain('Il mese va come al solito.');
    const testi = new Set(
      ['2026-01-10', '2026-02-10', '2026-03-10', '2026-04-10'].map(
        (oggi) => scegliConsiglio({ ...base, andamento: andamento(), oggi }).testo
      )
    );
    expect(testi.size).toBe(4);
  });

  it('in_linea senza solito: dice che manca il confronto', () => {
    const c = scegliConsiglio({ ...base, andamento: andamento({ solito: null, mesiConfronto: 0 }) });
    expect(c.testo).toContain("Per ora non c'è un mese di prima con cui confrontare.");
    expect(c.testo).not.toContain('come al solito');
    expect(c.perche).not.toContain('sopra il solito');
  });

  it('in_linea con totale sopra il solito: non dice come al solito, cita i due numeri', () => {
    const c = scegliConsiglio({ ...base, andamento: andamento({ spesoFinora: 520, solito: 500 }) });
    expect(c.tipo).toBe('in_linea');
    expect(c.testo).not.toContain('come al solito');
    expect(c.testo).toContain('520 €');
    expect(c.testo).toContain('500 €');
  });

  it('nessun testo contiene parole vietate', () => {
    const vietate = [...PAROLE_VIETATE, 'hai speso troppo', 'in ritardo', 'sei indietro'];
    const casi = [
      scegliConsiglio({ ...base, andamento: andamento({ spesoFinora: 400 }), spesoStime: 100 }),
      scegliConsiglio({
        ...base,
        andamento: andamento({ perCategoria: [{ categoriaId: 'cibo', mese: 150, solito: 100 }] }),
      }),
      scegliConsiglio({ ...base, andamento: andamento({ solito: null }) }),
      scegliConsiglio({ ...base, andamento: andamento({ spesoFinora: 520, solito: 500 }) }),
      scegliConsiglio({ ...base, andamento: andamento(), obiettiviCorti: [{ goalId: 'g', nome: 'X', mancano: 10 }] }),
      ...Array.from({ length: 12 }, (_, i) =>
        scegliConsiglio({ ...base, andamento: andamento(), oggi: `2026-${String(i + 1).padStart(2, '0')}-10` })
      ),
    ];
    for (const c of casi) {
      const t = `${c.testo} ${c.perche}`.toLowerCase();
      expect(c.perche.length).toBeGreaterThan(0);
      for (const p of vietate) expect(t).not.toContain(p);
    }
  });
});

const goal = (over: Partial<BudgetGoal & { specoCollegato: number }> = {}) => ({
  id: 'g1',
  nome: 'Vacanza',
  importoTarget: 1200,
  modalita: 'dilazionato' as const,
  scadenza: '2027-03-11',
  categoriaId: null,
  ricorrente: false,
  frequenzaMesi: null,
  stato: 'aperto' as const,
  createdAt: '2026-03-11',
  specoCollegato: 0,
  ...over,
});

describe('obiettiviCorti', () => {
  const oggi = new Date(2026, 10, 11);

  it('obiettivo in regola col piano non e corto', () => {
    expect(obiettiviCorti([goal()], 0, oggi)).toEqual([]);
  });

  it('spesa collegata che mangia l accantonato -> corto, con quanto manca', () => {
    // 12 mesi, quota 100; a nov accantonato teorico 800, speso 500 -> 300; mancano 900, quota*4=400
    const r = obiettiviCorti([goal({ specoCollegato: 500 })], 0, oggi);
    expect(r).toEqual([{ goalId: 'g1', nome: 'Vacanza', mancano: 900 }]);
  });

  it('ignora bloccati, chiusi e senza scadenza', () => {
    const g = [
      goal({ modalita: 'bloccato', specoCollegato: 500 }),
      goal({ id: 'g2', stato: 'chiuso', specoCollegato: 500 }),
      goal({ id: 'g3', scadenza: null, specoCollegato: 500 }),
    ];
    expect(obiettiviCorti(g, 0, oggi)).toEqual([]);
  });

  it('accantonaDa piu tardi -> stessi numeri di accantonato.ts', () => {
    const g = goal({ accantonaDa: '2026-09-11' });
    const quota = computeQuotaMensile(g, oggi)!;
    const mancano = g.importoTarget - computeAccantonatoFinora(g, oggi, g.specoCollegato);
    const { windowEnd } = computeFinestraGoal(g, oggi);
    const atteso = quota * differenceInCalendarMonths(windowEnd!, oggi) < mancano;
    const r = obiettiviCorti([g], 0, oggi);
    expect(r).toEqual(atteso ? [{ goalId: 'g1', nome: 'Vacanza', mancano }] : []);
    expect(atteso).toBe(true);
  });

  it('scaduto non ricorrente -> saltato', () => {
    expect(obiettiviCorti([goal({ scadenza: '2026-10-01', specoCollegato: 500 })], 0, oggi)).toEqual([]);
  });

  it('dati che fanno lanciare errore -> saltato', () => {
    expect(obiettiviCorti([goal({ ricorrente: true, frequenzaMesi: null })], 0, oggi)).toEqual([]);
  });
});
