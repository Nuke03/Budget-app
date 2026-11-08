import { describe, it, expect } from 'vitest';
import { fraseVersamento, fraseBozza, descriviStatoPiano } from '@/lib/calculations/casa/fraseVersamento';

describe('fraseVersamento', () => {
  it('quote diverse: nomi e cifre', () => {
    expect(
      fraseVersamento({ quote: [{ nome: 'Fabio', quota: 777 }, { nome: 'Giulia', quota: 603 }], giorno: 5 }),
    ).toBe('Fabio versa 777 euro e Giulia 603 euro, entro il 5 di ogni mese.');
  });
  it('con il mese di partenza', () => {
    expect(
      fraseVersamento({
        quote: [{ nome: 'Fabio', quota: 777 }, { nome: 'Giulia', quota: 603 }],
        giorno: 5,
        da: '2026-12-01',
      }),
    ).toBe('Fabio versa 777 euro e Giulia 603 euro, entro il 5 di ogni mese, da dicembre.');
  });
  it('quote uguali', () => {
    expect(
      fraseVersamento({ quote: [{ nome: 'Fabio', quota: 690 }, { nome: 'Giulia', quota: 690 }], giorno: 5 }),
    ).toBe('Ognuno versa 690 euro entro il 5 di ogni mese.');
  });
  it('con chi non versa niente non dice "Ognuno": nomina chi paga', () => {
    expect(
      fraseVersamento({
        quote: [{ nome: 'A', quota: 500 }, { nome: 'B', quota: 500 }, { nome: 'C', quota: 0 }],
        giorno: 5,
      }),
    ).toBe('A versa 500 euro e B 500 euro, entro il 5 di ogni mese.');
  });
  it('tre persone con la stessa quota: Ognuno', () => {
    expect(
      fraseVersamento({
        quote: [{ nome: 'A', quota: 460 }, { nome: 'B', quota: 460 }, { nome: 'C', quota: 460 }],
        giorno: 5,
      }),
    ).toBe('Ognuno versa 460 euro entro il 5 di ogni mese.');
  });
  it('tre persone', () => {
    expect(
      fraseVersamento({
        quote: [{ nome: 'A', quota: 1000 }, { nome: 'B', quota: 500 }, { nome: 'C', quota: 400 }],
        giorno: 10,
      }),
    ).toBe('A versa 1.000 euro, B 500 euro e C 400 euro, entro il 10 di ogni mese.');
  });
  it('chi ha quota 0 non compare; una sola persona', () => {
    expect(
      fraseVersamento({ quote: [{ nome: 'Fabio', quota: 1380 }, { nome: 'Giulia', quota: 0 }], giorno: 5 }),
    ).toBe('Fabio versa 1.380 euro, entro il 5 di ogni mese.');
  });
  it('nessun versamento', () => {
    expect(fraseVersamento({ quote: [{ nome: 'Fabio', quota: 0 }], giorno: 5 })).toBe(
      'Nessun versamento in questo periodo.',
    );
  });
});

describe('fraseBozza', () => {
  it('una persona', () => {
    expect(fraseBozza(['Giulia'])).toBe('Diventa attivo quando entra anche Giulia');
  });
  it('più persone', () => {
    expect(fraseBozza(['Giulia', 'Marco'])).toBe('Diventa attivo quando entrano anche Giulia e Marco');
  });
  it('nessuno: null', () => {
    expect(fraseBozza([])).toBeNull();
  });
});

describe('descriviStatoPiano', () => {
  const sh = (displayName: string, quotaMensile: number, userId: string | null) => ({
    displayName,
    quotaMensile,
    userId,
    esceDal: null,
  });
  it('bozza con il nome di chi manca', () => {
    expect(descriviStatoPiano([sh('Fabio', 777, 'u1'), sh('Giulia', 603, null)])).toEqual({
      stato: 'bozza',
      nomiMancanti: ['Giulia'],
      frase: 'Diventa attivo quando entra anche Giulia',
    });
  });
  it('attivo senza frase quando tutti sono legati', () => {
    expect(descriviStatoPiano([sh('Fabio', 777, 'u1'), sh('Giulia', 603, 'u2')])).toEqual({
      stato: 'attivo',
      nomiMancanti: [],
      frase: null,
    });
  });
});
