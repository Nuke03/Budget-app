import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { findUnscopedQueries } from '../helpers/scopeGuard';

// pingDatabase legge `accounts` solo per tenere sveglio il progetto Supabase,
// non restituisce dati a nessuno; il marcatore resta riservato alle funzioni per id.
const FILE_ESENTI = ['keepAlive.ts'];

describe('scope guard', () => {
  it('findUnscopedQueries segnala una funzione con from(accounts) senza scope', () => {
    const src = `export async function leggi(supabase) {\n  return supabase.from('accounts').select('id');\n}\n`;
    expect(findUnscopedQueries(src)).toEqual(['leggi']);
  });

  it('accetta applyScope, scopeHouseholdId, .is(household_id) , .eq(household_id) e il marcatore // household: per id', () => {
    const src = [
      "export async function a(s) { return applyScope(s.from('accounts').select('id'), p); }",
      "export async function b(s) { return s.from('categories').insert({ household_id: scopeHouseholdId(p) }); }",
      "export async function c(s) { return s.from('transactions').select('id').is('household_id', null); }",
      "export async function d(s) { return s.from('budget_goals').select('id').eq('household_id', 'h'); }",
      "export async function e(s) {\n  // household: per id\n  return s.from('transactions').delete().eq('id', 1);\n}",
    ].join('\n');
    expect(findUnscopedQueries(src)).toEqual([]);
  });

  it('segnala una arrow function esportata con from(accounts) senza scope', () => {
    const src = `export const leggi = async (supabase) => {
  return supabase.from('accounts').select('id');
};
`;
    expect(findUnscopedQueries(src)).toEqual(['leggi']);
  });

  it('segnala una arrow function con parametri su più righe', () => {
    const src = `export const leggi = async (
  supabase: X,
  scope: Scope
): Promise<Y> => {
  return supabase.from('transactions').select('id');
};
`;
    expect(findUnscopedQueries(src)).toEqual(['leggi']);
  });

  it('accetta una arrow function con applyScope', () => {
    const src = `export const leggi = async (supabase) => {
  return applyScope(supabase.from('accounts').select('id'), p);
};
`;
    expect(findUnscopedQueries(src)).toEqual([]);
  });

  it('segnala .from( fuori da qualunque funzione', () => {
    const src = `const q = supabase.from('transactions').select('id');
`;
    expect(findUnscopedQueries(src)).toEqual(['<fuori da una funzione>']);
  });

  it('segnala una tabella dinamica', () => {
    const src = "export async function a(s, t) { return s.from(t).select('id'); }";
    expect(findUnscopedQueries(src)).toEqual(['a (tabella dinamica)']);
  });

  it('non segnala Array.from e Buffer.from', () => {
    const src = 'export function a(x) { return Array.from(x).concat(Array.from(Buffer.from(x))); }';
    expect(findUnscopedQueries(src)).toEqual([]);
  });

  it('segnala la seconda lettura quando la funzione ha un solo segno di scope', () => {
    const src = `export async function x(s) {
  const a = applyScope(s.from('accounts').select('id'), p);
  const b = await s.from('categories').select('id');
  return [a, b];
}
`;
    expect(findUnscopedQueries(src)).toEqual(['x']);
  });

  it('segnala transfers senza scope e accetta transfers con applyScope', () => {
    const senza = "export async function t(s) { return s.from('transfers').select('id'); }";
    const con = "export async function t(s) { return applyScope(s.from('transfers').select('id'), p); }";
    expect(findUnscopedQueries(senza)).toEqual(['t']);
    expect(findUnscopedQueries(con)).toEqual([]);
  });

  it('segnala una tabella dinamica in una catena con il punto a capo', () => {
    const src = `export async function a(supabase, t) {
  return supabase
    .from(t)
    .select('id');
}`;
    expect(findUnscopedQueries(src)).toEqual(['a (tabella dinamica)']);
  });

  it('un segno di scope in un commento o in una stringa non nasconde una lettura senza scope', () => {
    const commento = `export async function a(s) {
  // applyScope( qui non c'e'
  return s.from('accounts').select('id');
}`;
    const stringa = `export async function b(s) {
  const hint = 'applyScope(';
  return s.from('accounts').select('id');
}`;
    expect(findUnscopedQueries(commento)).toEqual(['a']);
    expect(findUnscopedQueries(stringa)).toEqual(['b']);
  });

  it('il marcatore vero esenta, citato in una stringa no', () => {
    const vero = `export async function a(s) {
  // household: per id
  return s.from('accounts').select('id');
}`;
    const finto = `export async function b(s) {
  const m = '// household: per id';
  return s.from('accounts').select('id');
}`;
    expect(findUnscopedQueries(vero)).toEqual([]);
    expect(findUnscopedQueries(finto)).toEqual(['b']);
  });

  it('ogni file in src/lib/data rispetta lo scope tranne la allowlist', () => {
    const dir = path.resolve(__dirname, '../../src/lib/data');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && !FILE_ESENTI.includes(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const source = fs.readFileSync(path.join(dir, f), 'utf8');
      expect({ file: f, nonScoped: findUnscopedQueries(source) }).toEqual({ file: f, nonScoped: [] });
    }
  });
});
