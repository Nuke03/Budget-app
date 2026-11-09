import { describe, it, expect } from 'vitest';
import { normalizzaCodice, linkInvito, testoInvito } from '@/lib/invito';

describe('invito', () => {
  it('normalizza spazi, trattini e minuscole', () => {
    expect(normalizzaCodice('  k7m2-qx9p ')).toBe('K7M2QX9P');
    expect(normalizzaCodice('k7m2 qx9p')).toBe('K7M2QX9P');
    expect(normalizzaCodice(undefined)).toBe('');
  });

  it('il link porta alla pagina di ingresso con il codice', () => {
    expect(linkInvito('https://budget.example/', 'K7M2QX9P')).toBe(
      'https://budget.example/casa/inizia?modo=entra&codice=K7M2QX9P'
    );
  });

  it('il testo ha il link e il codice a parte', () => {
    const t = testoInvito('https://budget.example', 'K7M2QX9P');
    expect(t).toContain('Entra nella nostra casa su Budget: https://budget.example/casa/inizia?modo=entra&codice=K7M2QX9P');
    expect(t.split('\n')[1]).toContain('K7M2-QX9P');
  });
});
