import { describe, it, expect } from 'vitest';
import { VOCI } from '@/lib/agevolazioni/voci';
import { assertNessunaParolaVietata } from '../helpers/paroleVietate';

function testi(v: (typeof VOCI)[number]): string[] {
  return [v.titolo, v.perche, ...v.cosaFare, v.cercare ?? '', v.link?.testo ?? ''];
}

describe('VOCI', () => {
  it('sono 9, con id unici', () => {
    expect(VOCI).toHaveLength(9);
    expect(new Set(VOCI.map((v) => v.id)).size).toBe(9);
  });
  it('nessuna frase vietata', () => {
    for (const v of VOCI) {
      for (const t of testi(v).map((x) => x.toLowerCase())) {
        expect(t).not.toContain('hai diritto');
        expect(t).not.toContain('ti spetta');
        expect(t).not.toContain('devi');
        expect(t).not.toContain('dovresti');
      }
    }
  });
  it('passano assertNessunaParolaVietata', () => {
    for (const v of VOCI) {
      const el = document.createElement('div');
      el.textContent = testi(v).join(' ');
      expect(() => assertNessunaParolaVietata(el)).not.toThrow();
    }
  });
  it('ogni soglia ha anno; link solo ufficiali o interni', () => {
    for (const v of VOCI) {
      if (v.soglia) expect(v.soglia.anno).toBeGreaterThan(2000);
      if (v.link) expect(v.link.href).toMatch(/^(\/|https:\/\/(www\.)?(inps\.it|arera\.it|agenziaentrate\.gov\.it))/);
    }
    expect(VOCI.find((v) => v.id === 'scadenze-piva')!.link!.href).toBe('/piva');
    expect(VOCI.find((v) => v.id === 'dedicata-a-te')!.validaFinoAl).toBe('2027-12-31');
  });
});
