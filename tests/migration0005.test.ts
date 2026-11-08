import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const sql = readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migrations', '0005_piano_sostituisce_futuro.sql'),
  'utf8',
);
const righe = sql.split('\n');
const eComment = (riga: string) => riga.trimStart().startsWith('--');
const codice = righe.filter((riga) => !eComment(riga)).join('\n');

describe('migrazione 0005 (statica)', () => {
  it('è racchiusa tra begin; e commit;', () => {
    const attive = righe.filter((r) => !eComment(r) && r.trim() !== '');
    expect(attive[0].trim()).toBe('begin;');
    expect(attive[attive.length - 1].trim()).toBe('commit;');
  });

  it('ridefinisce solo save_household_plan, con create or replace', () => {
    const funzioni = [...codice.matchAll(/create (or replace )?function ([\w.]+)\(/g)];
    expect(funzioni).toHaveLength(1);
    expect(funzioni[0][1]).toBe('or replace ');
    expect(funzioni[0][2]).toBe('public.save_household_plan');
    expect(codice).not.toMatch(/\bcreate table\b|\bdrop\b|\balter\b/i);
  });

  it('è security definer con search_path = public', () => {
    const intestazione = codice.slice(codice.indexOf('create or replace function'), codice.indexOf('$$'));
    expect(intestazione).toMatch(/\bsecurity definer\b/);
    expect(intestazione).toMatch(/set search_path = public\b/);
  });

  it('mantiene i controlli della 0004', () => {
    for (const frase of [
      'non autenticato',
      'casa non scrivibile',
      'payload non valido',
      'valido_dal deve essere il primo del mese',
      'valido_dal nel passato',
      'le percentuali devono sommare a 100',
      'il reddito di un altro membro non si modifica',
    ]) {
      expect(codice).toContain(frase);
    }
  });

  it('elimina le versioni successive non presenti nel payload, prima di salvare', () => {
    const iDelete = codice.indexOf('delete from public.household_plans');
    expect(iDelete).toBeGreaterThan(-1);
    expect(codice).toMatch(/valido_dal >= \(select min\(/);
    expect(codice).toMatch(/valido_dal <> all \(select/);
    expect(iDelete).toBeLessThan(codice.indexOf('insert into public.household_plans'));
  });

  it('rinnova i grant: revoke da public, anon, authenticated e grant a authenticated', () => {
    expect(codice).toContain(
      'revoke execute on function public.save_household_plan(uuid, jsonb) from public, anon, authenticated;',
    );
    expect(codice).toContain('grant execute on function public.save_household_plan(uuid, jsonb) to authenticated;');
  });

  it('il corpo della funzione coincide con la 0004 salvo il blocco di eliminazione', () => {
    const vecchia = readFileSync(
      path.resolve(__dirname, '..', 'supabase', 'migrations', '0004_casa_comune.sql'),
      'utf8',
    );
    const corpo = (s: string) => {
      const i = s.indexOf('create or replace function public.save_household_plan(');
      return s.slice(i, s.indexOf('end $$;', i)).replace(/\r/g, '');
    };
    const nuova = corpo(sql)
      .split('\n')
      .filter((r) => !r.trimStart().startsWith('--'))
      .join('\n');
    const da = nuova.indexOf('  delete from public.household_plans');
    const a = nuova.indexOf('  for v in select value');
    const senzaDelete = nuova.slice(0, da) + nuova.slice(a);
    const vecchiaPulita = corpo(vecchia)
      .split('\n')
      .filter((r) => !r.trimStart().startsWith('--'))
      .join('\n');
    expect(senzaDelete).toBe(vecchiaPulita);
  });
});
