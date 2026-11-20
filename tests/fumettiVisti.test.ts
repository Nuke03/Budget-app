import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  eVisto,
  segnaVisto,
  azzeraFumetti,
  segnaGiroInQuestaApertura,
  giroInQuestaApertura,
  VERSIONI_FUMETTI,
  _azzeraMemoriaPerTest,
} from '@/lib/fumetti/visti';

describe('fumetti visti', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    _azzeraMemoriaPerTest();
  });

  it('un fumetto mai visto non è visto; dopo segnaVisto sì', () => {
    expect(eVisto('u1', 'storico')).toBe(false);
    segnaVisto('u1', 'storico');
    expect(eVisto('u1', 'storico')).toBe(true);
  });

  it('ogni utente ha i suoi visti', () => {
    segnaVisto('u1', 'giro');
    expect(eVisto('u2', 'giro')).toBe(false);
  });

  it('alzare la versione di un fumetto lo fa ripartire, gli altri no', () => {
    segnaVisto('u1', 'giro');
    segnaVisto('u1', 'conti');
    const nuove = { ...VERSIONI_FUMETTI, conti: 2 };
    expect(eVisto('u1', 'conti', nuove)).toBe(false);
    expect(eVisto('u1', 'giro', nuove)).toBe(true);
  });

  it('azzeraFumetti toglie solo quelli di quell utente', () => {
    segnaVisto('u1', 'giro');
    segnaVisto('u2', 'giro');
    azzeraFumetti('u1');
    expect(eVisto('u1', 'giro')).toBe(false);
    expect(eVisto('u2', 'giro')).toBe(true);
  });

  it('senza localStorage ricorda per la sessione', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloccato');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloccato');
    });
    expect(eVisto('u1', 'impara')).toBe(false);
    segnaVisto('u1', 'impara');
    expect(eVisto('u1', 'impara')).toBe(true);
  });

  it('giroInQuestaApertura parte falso e diventa vero', () => {
    expect(giroInQuestaApertura()).toBe(false);
    segnaGiroInQuestaApertura();
    expect(giroInQuestaApertura()).toBe(true);
  });

  it('se solo setItem fallisce, il visto vale comunque per la sessione', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(eVisto('u1', 'casa')).toBe(false);
    segnaVisto('u1', 'casa');
    expect(eVisto('u1', 'casa')).toBe(true);
  });

  it('se solo sessionStorage.setItem fallisce, il giro vale comunque per la sessione', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    segnaGiroInQuestaApertura();
    expect(giroInQuestaApertura()).toBe(true);
  });

  it('azzeraFumetti svuota anche la memoria di sessione di quell utente', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    segnaVisto('u1', 'piva');
    segnaVisto('u2', 'piva');
    azzeraFumetti('u1');
    vi.restoreAllMocks();
    expect(eVisto('u1', 'piva')).toBe(false);
    expect(eVisto('u2', 'piva')).toBe(true);
  });
});
