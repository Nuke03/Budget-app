import { describe, it, expect } from 'vitest';
import { statoPiano } from '@/lib/calculations/casa/statoPiano';

const s = (quotaMensile: number, userId: string | null, esceDal: string | null = null) => ({
  quotaMensile,
  userId,
  esceDal,
});

describe('statoPiano', () => {
  it('è bozza se una posizione con quota maggiore di zero non è legata', () => {
    expect(statoPiano([s(777, 'u1'), s(603, null)])).toBe('bozza');
  });
  it('è attivo quando tutte le posizioni con quota maggiore di zero sono legate', () => {
    expect(statoPiano([s(777, 'u1'), s(603, 'u2')])).toBe('attivo');
  });
  it('una posizione a quota 0 non legata non blocca il piano', () => {
    expect(statoPiano([s(1380, 'u1'), s(0, null)])).toBe('attivo');
  });
  it('una posizione con esceDal valorizzato è esclusa dal controllo', () => {
    expect(statoPiano([s(777, 'u1'), s(603, null, '2026-12-01')])).toBe('attivo');
  });
  it('senza posizioni è bozza', () => {
    expect(statoPiano([])).toBe('bozza');
  });
});
