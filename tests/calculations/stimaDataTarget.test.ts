import { describe, it, expect } from 'vitest';
import { stimaDataTarget } from '@/lib/calculations/stimaDataTarget';

describe('stimaDataTarget', () => {
  it('usa il mese successivo se non ci sono entrate storiche', () => {
    const result = stimaDataTarget(null, new Date(2026, 5, 10));
    expect(result).toEqual(new Date(2026, 6, 10));
  });

  it('rimane nel mese corrente se il giorno dell\'ultima entrata non è ancora passato', () => {
    const ultimaEntrata = new Date(2026, 4, 27); // 27 del mese scorso
    const result = stimaDataTarget(ultimaEntrata, new Date(2026, 5, 10));
    expect(result).toEqual(new Date(2026, 5, 27));
  });

  it('passa al mese successivo se il giorno dell\'ultima entrata è già passato questo mese', () => {
    const ultimaEntrata = new Date(2026, 4, 27);
    const result = stimaDataTarget(ultimaEntrata, new Date(2026, 5, 30));
    expect(result).toEqual(new Date(2026, 6, 27));
  });
});
