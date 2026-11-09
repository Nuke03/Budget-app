import { describe, it, expect } from 'vitest';
import { obiettivoDaCategoria } from '@/lib/calculations/casa/preselezioneObiettivo';

const base = { stato: 'aperto' as const, categoriaId: 'luce' };

describe('obiettivoDaCategoria', () => {
  it('un solo obiettivo aperto con la categoria', () => {
    expect(obiettivoDaCategoria([{ id: 'g-luce', ...base }], 'luce')).toBe('g-luce');
  });
  it('due obiettivi con la stessa categoria', () => {
    expect(
      obiettivoDaCategoria(
        [
          { id: 'g1', ...base },
          { id: 'g2', ...base },
        ],
        'luce'
      )
    ).toBeNull();
  });
  it('obiettivo chiuso ignorato', () => {
    expect(obiettivoDaCategoria([{ id: 'g-luce', ...base, stato: 'chiuso' }], 'luce')).toBeNull();
  });
  it('categoria nulla', () => {
    expect(obiettivoDaCategoria([{ id: 'g-luce', ...base, categoriaId: null }], null)).toBeNull();
  });
});
