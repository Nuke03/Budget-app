import { describe, it, expect } from 'vitest';
import { righeDaRiepilogo, scegliConti } from '@/lib/calculations/supporto/inPari';

const base = { spazio: 'personale' as const, contoCarta: 'c1', contoContanti: 'k1' };

describe('righeDaRiepilogo', () => {
  it('solo carta', () => {
    expect(righeDaRiepilogo({ ...base, carta: 80, contanti: null })).toEqual([
      { importo: 80, accountId: 'c1', casa: false },
    ]);
  });
  it('solo contanti', () => {
    expect(righeDaRiepilogo({ ...base, carta: null, contanti: 20 })).toEqual([
      { importo: 20, accountId: 'k1', casa: false },
    ]);
  });
  it('tutti e due, in casa', () => {
    expect(righeDaRiepilogo({ ...base, spazio: 'casa', carta: 80, contanti: 20 })).toEqual([
      { importo: 80, accountId: 'c1', casa: true },
      { importo: 20, accountId: 'k1', casa: true },
    ]);
  });
  it('zero, negativo o nullo non produce la riga', () => {
    expect(righeDaRiepilogo({ ...base, carta: 0, contanti: null })).toEqual([]);
    expect(righeDaRiepilogo({ ...base, carta: -5, contanti: 0 })).toEqual([]);
  });
  it('senza conto per i contanti la riga resta, senza conto', () => {
    expect(righeDaRiepilogo({ ...base, contoContanti: null, carta: null, contanti: 50 })).toEqual([
      { importo: 50, accountId: null, casa: false },
    ]);
  });
});

describe('scegliConti', () => {
  const conti = [
    { id: 'k', nome: 'Contanti' },
    { id: 'a', nome: 'Carta' },
    { id: 'b', nome: 'Risparmio' },
  ];
  it('carta: l ultimo usato che non è dei contanti', () => {
    expect(scegliConti(conti, ['b']).contoCarta).toBe('b');
    expect(scegliConti(conti, ['k']).contoCarta).toBe('a');
    expect(scegliConti(conti, [undefined, 'zz']).contoCarta).toBe('a');
  });
  it('contanti: il conto con contanti nel nome, se c è', () => {
    expect(scegliConti(conti, []).contoContanti).toBe('k');
    expect(scegliConti([{ id: 'a', nome: 'Carta' }], []).contoContanti).toBeNull();
  });
  it('senza conti niente', () => {
    expect(scegliConti([], ['a'])).toEqual({ contoCarta: null, contoContanti: null });
  });
});
