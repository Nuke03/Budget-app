import { describe, it, expect } from 'vitest';
import { suggestImportoFromHistory } from '@/lib/calculations/suggestImportoFromHistory';

describe('suggestImportoFromHistory', () => {
  it('calcola la media semplice quando il margine è 0', () => {
    expect(suggestImportoFromHistory([100, 110, 90], 0)).toBeCloseTo(100, 5);
  });

  it('applica il margine percentuale sopra la media', () => {
    // media = 100, +10% = 110
    expect(suggestImportoFromHistory([100, 110, 90], 10)).toBeCloseTo(110, 5);
  });

  it('funziona con un solo importo storico', () => {
    expect(suggestImportoFromHistory([60], 10)).toBeCloseTo(66, 5);
  });

  it('lancia un errore se la lista di importi passati è vuota', () => {
    expect(() => suggestImportoFromHistory([], 10)).toThrow();
  });
});
