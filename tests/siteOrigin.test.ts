import { describe, it, expect } from 'vitest';
import { origineSito } from '@/lib/siteOrigin';

describe('origineSito', () => {
  it('usa la variabile e toglie la barra finale', () => {
    expect(origineSito('https://app.example.com/', 'x.it', 'https')).toBe('https://app.example.com');
    expect(origineSito('https://app.example.com//', null, null)).toBe('https://app.example.com');
  });
  it('una variabile vuota cade sull host', () => {
    expect(origineSito('', 'app.it', 'https')).toBe('https://app.it');
    expect(origineSito('  ', 'localhost:3000', null)).toBe('http://localhost:3000');
  });
  it('senza variabile né host non c è origine', () => {
    expect(origineSito(undefined, null, null)).toBeUndefined();
  });
});
