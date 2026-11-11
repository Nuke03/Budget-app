import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { testoSu, CATEGORY_COLORS } from '../src/lib/categoryColors';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

function blocco(apertura: RegExp): Record<string, string> {
  const m = apertura.exec(css);
  if (!m) throw new Error('blocco non trovato');
  let i = m.index + m[0].length;
  let livello = 1;
  const start = i;
  while (livello > 0 && i < css.length) {
    if (css[i] === '{') livello++;
    if (css[i] === '}') livello--;
    i++;
  }
  const corpo = css.slice(start, i - 1);
  const out: Record<string, string> = {};
  for (const r of corpo.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[r[1]] = r[2];
  }
  return out;
}

const chiaro = blocco(/:root\s*\{/);
const scuro = { ...chiaro, ...blocco(/prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{/) };

function luminanza(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrasto(a: string, b: string): number {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

type Coppia = [string, string] | [string, string, number];
const CHIARO: Coppia[] = [['foreground','background'],['foreground','surface'],['muted','surface'],['muted','background'],['brand-foreground','brand'],['brand','surface'],['stamp','surface',3],['on-cat','cat-sky']];
const SCURO: Coppia[] = [['foreground','background'],['foreground','surface'],['muted','surface'],['brand-dark','surface'],['stamp','surface',3],['brand-foreground','brand'],['on-cat','cat-sky']];

describe('contrasto dei token', () => {
  it.each(CHIARO)('chiaro %s su %s', (fg, bg, min = 4.5) => {
    expect(contrasto(chiaro[fg], chiaro[bg])).toBeGreaterThanOrEqual(min);
  });
  it.each(SCURO)('scuro %s su %s', (fg, bg, min = 4.5) => {
    expect(contrasto(scuro[fg], scuro[bg])).toBeGreaterThanOrEqual(min);
  });
  it('usa i valori del Libretto', () => {
    expect(chiaro.brand).toBe('#14306b');
    expect(chiaro.background).toBe('#eef2f8');
    expect(chiaro.stamp).toBe('#c8102e');
  });
});

describe('cifre', () => {
  it('body non ha tabular-nums, solo .num', () => {
    const body = /\nbody\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(body).not.toContain('tabular-nums');
    const num = /\.num\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(num).toContain('tabular-nums lining-nums');
  });
});

describe('testoSu', () => {
  it('inchiostro sui chiari, bianco sugli scuri', () => {
    expect(testoSu('#F5A524')).toBe('#14213d');
    expect(testoSu('#3B9AE1')).toBe('#14213d');
    expect(testoSu('#92400E')).toBe('#ffffff');
    expect(testoSu('#8452F5')).toBe('#ffffff');
    expect(testoSu('non-un-colore')).toBe('#ffffff');
  });
  it('ogni colore della palette ha almeno 4,5:1 col testo scelto', () => {
    for (const c of CATEGORY_COLORS) {
      const t = testoSu(c.value);
      expect(contrasto(t, c.value), c.name).toBeGreaterThanOrEqual(4.5);
    }
  });
});
