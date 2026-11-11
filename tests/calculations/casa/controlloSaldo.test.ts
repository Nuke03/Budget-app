import { describe, it, expect } from 'vitest';
import { riferimentoControllo, valutaControllo, speseNonRegistrate } from '@/lib/calculations/casa/controlloSaldo';

describe('valutaControllo', () => {
  it('banca sotto l app: mancano soldi', () => {
    expect(valutaControllo(1020, 940)).toEqual({
      differenza: -80,
      esito: 'mancano',
      frase: 'Mancano 80 €. Succede: nessuno ricorda ogni spesa.',
    });
  });

  it('banca sopra l app: in banca ci sono più soldi', () => {
    expect(valutaControllo(1020, 1100)).toEqual({
      differenza: 80,
      esito: 'in_piu',
      frase: 'In banca ci sono 80 € in più di quelli registrati.',
    });
  });

  it('differenza sotto un euro torna tutto', () => {
    expect(valutaControllo(1020, 1020.4)).toEqual({ differenza: 0.4, esito: 'torna', frase: 'Torna tutto.' });
    expect(valutaControllo(1020, 1020.99)).toEqual({ differenza: 0.99, esito: 'torna', frase: 'Torna tutto.' });
  });

  it('un euro esatto non torna: è in_piu', () => {
    expect(valutaControllo(1020, 1021)).toMatchObject({ differenza: 1, esito: 'in_piu' });
  });

  it('la differenza è arrotondata a due decimali', () => {
    expect(valutaControllo(0.1, 0.3).differenza).toBe(0.2);
    expect(valutaControllo(10, 9.98).differenza).toBe(-0.02);
  });
});

describe('speseNonRegistrate', () => {
  it('somma solo le spese di riconciliazione del mese richiesto', () => {
    const transazioni = [
      { tipo: 'expense' as const, importo: 80, data: '2026-11-09', origine: 'riconciliazione' as const },
      { tipo: 'expense' as const, importo: 50, data: '2026-10-30', origine: 'riconciliazione' as const },
      { tipo: 'expense' as const, importo: 30, data: '2026-11-03', origine: null },
    ];
    expect(speseNonRegistrate(transazioni, '2026-11-01')).toBe(80);
  });

  it('senza righe di riconciliazione nel mese vale 0', () => {
    expect(speseNonRegistrate([], '2026-11-01')).toBe(0);
  });
});

describe('speseNonRegistrate: arrotondamento', () => {
  it('la somma è arrotondata ai centesimi (0.1 + 0.2 fa 0.3)', () => {
    const transazioni = [
      { tipo: 'expense' as const, importo: 0.1, data: '2026-11-02', origine: 'riconciliazione' as const },
      { tipo: 'expense' as const, importo: 0.2, data: '2026-11-03', origine: 'riconciliazione' as const },
    ];
    expect(speseNonRegistrate(transazioni, '2026-11-01')).toBe(0.3);
  });
});

describe('riferimentoControllo', () => {
  it('senza date utili non lancia e parte da oggi', () => {
    expect(() => riferimentoControllo('', [])).not.toThrow();
    expect(riferimentoControllo('', [])).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('il più tardi fra ingresso e apertura del conto', () => {
    expect(riferimentoControllo('2026-01-10T10:00:00Z', [{ createdAt: '2026-03-05T10:00:00Z' }])).toBe('2026-03-05');
  });
});
