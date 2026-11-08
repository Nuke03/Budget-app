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
