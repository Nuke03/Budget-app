import { describe, it, expect, beforeEach, vi } from 'vitest';
import { serveConferma, nonAvvisarePiu, riattivaConferme } from '@/lib/conferme';

describe('conferme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('di base si chiede', () => {
    expect(serveConferma('movimento_casa')).toBe(true);
  });
  it('dopo nonAvvisarePiu non si chiede, e solo per quel tipo', () => {
    nonAvvisarePiu('movimento_casa');
    expect(serveConferma('movimento_casa')).toBe(false);
    expect(serveConferma('revoca_invito')).toBe(true);
  });
  it('riattivaConferme rimette tutto', () => {
    nonAvvisarePiu('movimento_casa');
    nonAvvisarePiu('revoca_invito');
    nonAvvisarePiu('fondo_pagato');
    riattivaConferme();
    expect(serveConferma('fondo_pagato')).toBe(true);
    expect(serveConferma('movimento_casa')).toBe(true);
    expect(serveConferma('revoca_invito')).toBe(true);
  });
  it('chiudere e uscire dalla casa si chiedono sempre', () => {
    window.localStorage.setItem('conferme:chiudi_casa', 'no');
    nonAvvisarePiu('esci_casa');
    expect(serveConferma('chiudi_casa')).toBe(true);
    expect(serveConferma('esci_casa')).toBe(true);
  });
  it('con localStorage che non funziona si chiede e non si rompe', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('privato');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('privato');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('privato');
    });
    expect(serveConferma('movimento_casa')).toBe(true);
    expect(() => nonAvvisarePiu('movimento_casa')).not.toThrow();
    expect(() => riattivaConferme()).not.toThrow();
  });
});
