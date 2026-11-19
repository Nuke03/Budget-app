import { describe, it, expect } from 'vitest';
import { ruoloCategoria, eRata, normalizza } from '@/lib/calculations/percorso/ruoli';
import type { Category, Transaction } from '@/lib/types';

const cat = (id: string, nome: string, ruolo: Category['ruolo'] = null): Category => ({
  id, nome, tipo: 'expense', colore: null, archiviata: false, ruolo,
});

const tr = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't', tipo: 'expense', importo: 10, data: '2026-11-19', categoriaId: null, accountId: 'c1',
  goalId: null, descrizione: '', nota: null, createdAt: '2026-01-01T00:00:00.000Z', stima: false, ...over,
});

describe('normalizza', () => {
  it('minuscole e senza accenti', () => {
    expect(normalizza('Rèvisione')).toBe('revisione');
  });
});

describe('ruoloCategoria', () => {
  it('Auto e Assicurazione sono certe, Bar e ristoranti no, il ruolo salvato vince sul nome', () => {
    expect(ruoloCategoria(cat('a', 'Auto'))).toBe('certa');
    expect(ruoloCategoria(cat('b', 'Assicurazione'))).toBe('certa');
    expect(ruoloCategoria(cat('c', 'Bar e ristoranti'))).toBeNull();
    expect(ruoloCategoria(cat('d', 'Shopping'))).toBe('svago');
    expect(ruoloCategoria(cat('e', 'Auto', 'svago'))).toBe('svago');
    expect(ruoloCategoria(cat('f', 'Abbonamenti'))).toBe('certa');
    expect(ruoloCategoria(cat('g', 'Rèvisione'))).toBe('certa');
  });
});

describe('eRata', () => {
  it('Klarna e "rata telefono" sono rate, "pirata" no', () => {
    expect(eRata(tr({ descrizione: 'Klarna' }), [])).toBe(true);
    expect(eRata(tr({ descrizione: 'Rata telefono' }), [])).toBe(true);
    expect(eRata(tr({ descrizione: 'Cena pirata' }), [])).toBe(false);
    expect(eRata(tr({ descrizione: 'Spesa' }), [])).toBe(false);
  });
  it('anche dal nome della categoria', () => {
    expect(eRata(tr({ categoriaId: 'x' }), [cat('x', 'Finanziamento auto')])).toBe(true);
  });
  it('vede anche "rateale" e "rateizzo", sempre con i confini di parola', () => {
    expect(eRata(tr({ descrizione: 'Pagamento rateale' }), [])).toBe(true);
    expect(eRata(tr({ descrizione: 'Rateizzo cartella' }), [])).toBe(true);
    expect(eRata(tr({ descrizione: 'Rateizzazione tasse' }), [])).toBe(true);
    expect(eRata(tr({ descrizione: 'Moderatezza' }), [])).toBe(false);
    expect(eRata(tr({ descrizione: 'Orateizz' }), [])).toBe(false);
  });
});
