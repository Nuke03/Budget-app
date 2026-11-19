import { describe, it, expect } from 'vitest';
import { leggiPrecompilato } from '@/lib/goalPrecompilato';

describe('leggiPrecompilato', () => {
  it('senza "nuovo" non precompila', () => {
    expect(leggiPrecompilato('?nome=Cuffie&importo=50')).toBeNull();
    expect(leggiPrecompilato('')).toBeNull();
  });

  it('nome e importo validi riempiono il modulo, con il resto ai valori di partenza', () => {
    expect(leggiPrecompilato('?nuovo=1&nome=%20Cuffie%20&importo=89.9')).toEqual({
      nome: 'Cuffie', importoTarget: 89.9, modalita: 'bloccato', scadenza: null,
      categoriaId: null, ricorrente: false, frequenzaMesi: null,
    });
  });

  it('il nome più lungo di 80 caratteri si scarta, l importo valido resta', () => {
    const r = leggiPrecompilato(`?nuovo=1&nome=${'a'.repeat(81)}&importo=10`);
    expect(r).toMatchObject({ nome: '', importoTarget: 10 });
    expect(leggiPrecompilato(`?nuovo=1&nome=${'a'.repeat(80)}&importo=10`)?.nome).toHaveLength(80);
  });

  it('importi non validi si scartano: 0, negativo, enorme, testo, infinito', () => {
    for (const importo of ['0', '-3', '1e9', '2e9', 'abc', 'Infinity', '', '0x10', '1e3', '5.123', '1 000', '.5']) {
      expect(leggiPrecompilato(`?nuovo=1&nome=Cuffie&importo=${importo}`)).toMatchObject({ nome: 'Cuffie', importoTarget: 0 });
    }
  });

  it('accetta la virgola e al massimo due decimali', () => {
    expect(leggiPrecompilato('?nuovo=1&nome=A&importo=12,5')?.importoTarget).toBe(12.5);
    expect(leggiPrecompilato('?nuovo=1&nome=A&importo=7')?.importoTarget).toBe(7);
  });

  it('niente di valido: nessun precompilato', () => {
    expect(leggiPrecompilato('?nuovo=1&nome=&importo=0')).toBeNull();
    expect(leggiPrecompilato('?nuovo=1')).toBeNull();
  });
});
