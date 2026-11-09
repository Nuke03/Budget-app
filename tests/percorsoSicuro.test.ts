import { describe, it, expect } from 'vitest';
import { percorsoInternoSicuro, nextPerLogin } from '@/lib/percorsoSicuro';

describe('percorsoInternoSicuro', () => {
  it('accetta percorsi interni con query', () => {
    expect(percorsoInternoSicuro('/casa/inizia?modo=entra&codice=K7M2QX9P')).toBe('/casa/inizia?modo=entra&codice=K7M2QX9P');
    expect(percorsoInternoSicuro('/goals')).toBe('/goals');
  });

  it.each([
    ['//evil.com'],
    ['///evil.com'],
    ['http://evil.com'],
    ['https://evil.com'],
    ['\\evil.com'],
    ['/\\evil.com'],
    ['evil.com'],
    ['javascript:alert(1)'],
    ['/a\nb'],
    [''],
  ])('rifiuta %j', (valore) => {
    expect(percorsoInternoSicuro(valore)).toBe('/');
  });

  it('senza valore torna a /', () => {
    expect(percorsoInternoSicuro(undefined)).toBe('/');
    expect(percorsoInternoSicuro(null)).toBe('/');
  });

  it('nextPerLogin codifica il percorso e omette la home', () => {
    expect(nextPerLogin('/casa/inizia?modo=entra&codice=AB')).toBe('next=%2Fcasa%2Finizia%3Fmodo%3Dentra%26codice%3DAB');
    expect(nextPerLogin('//evil.com')).toBe('');
    expect(nextPerLogin('/')).toBe('');
  });
});
