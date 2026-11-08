import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const leggi = (nome: string) =>
  readFileSync(path.resolve(__dirname, '..', 'supabase', 'migrations', nome), 'utf8').replace(/\r/g, '');
const sql = leggi('0007_igiene_fk_e_correzioni_casa.sql');
const righe = sql.split('\n');
const eComment = (riga: string) => riga.trimStart().startsWith('--');
const codice = righe.filter((riga) => !eComment(riga)).join('\n');

const corpo = (s: string, nome: string) => {
  const i = s.indexOf(`create or replace function public.${nome}(`);
  expect(i).toBeGreaterThan(-1);
  return s
    .slice(i, s.indexOf('end $$;', i))
    .split('\n')
    .filter((r) => !r.trimStart().startsWith('--'))
    .join('\n');
};

const FUNZIONI = ['join_household', 'save_household_plan', 'record_transfer'];
const FIRME = [
  'join_household(text, text)',
  'save_household_plan(uuid, jsonb)',
  'record_transfer(uuid, text, numeric, date, uuid, uuid, uuid, uuid, date, boolean, text)',
];

describe('migrazione 0007 (statica)', () => {
  it('è racchiusa tra begin; e commit;', () => {
    const attive = righe.filter((r) => !eComment(r) && r.trim() !== '');
    expect(attive[0].trim()).toBe('begin;');
    expect(attive[attive.length - 1].trim()).toBe('commit;');
  });

  it('ridefinisce solo join_household, save_household_plan e record_transfer con create or replace', () => {
    const funzioni = [...codice.matchAll(/create (or replace )?function ([\w.]+)\(/g)];
    expect(funzioni.map((f) => f[2]).sort()).toEqual(
      ['public.join_household', 'public.record_transfer', 'public.save_household_plan']);
    for (const f of funzioni) expect(f[1]).toBe('or replace ');
    expect(codice).not.toMatch(/\bcreate table\b|\bdrop table\b/i);
  });

  it('ogni funzione è security definer con search_path = public', () => {
    for (const nome of FUNZIONI) {
      const i = codice.indexOf(`create or replace function public.${nome}(`);
      const intestazione = codice.slice(i, codice.indexOf('$$', i));
      expect(intestazione).toMatch(/\bsecurity definer\b/);
      expect(intestazione).toMatch(/set search_path = public\b/);
    }
  });

  it('rinnova revoke e grant delle tre funzioni con le firme esatte', () => {
    for (const firma of FIRME) {
      expect(codice).toContain(`revoke execute on function public.${firma} from public, anon, authenticated;`);
      expect(codice).toContain(`grant execute on function public.${firma} to authenticated;`);
    }
  });

  it('le quattro colonne autore passano a on delete set null', () => {
    for (const coppia of [
      "'households', 'created_by'",
      "'household_plans', 'created_by'",
      "'household_invites', 'created_by'",
      "'household_plan_shares', 'user_id'",
    ]) {
      expect(sql).toContain(coppia);
    }
    expect(sql).toContain('on delete set null');
  });

  it('join_household salta i segnaposto con esce_dal', () => {
    const c = corpo(sql, 'join_household');
    expect(c.split('s.esce_dal is null').length - 1).toBeGreaterThanOrEqual(2);
  });

  it('record_transfer azzera i conti delle registrazioni senza rinuncia', () => {
    const c = corpo(sql, 'record_transfer');
    expect(c).toContain('v_da uuid := p_da_account;');
    expect(c.split('v_da := null;').length - 1).toBeGreaterThanOrEqual(2);
  });

  it('save_household_plan rinomina la categoria collegata e non cancella le quote degli usciti', () => {
    const c = corpo(sql, 'save_household_plan');
    expect(c).toContain('update public.categories set nome');
    expect(c).toContain('and esce_dal is null');
  });

  it('nessuna istruzione di primo livello cancella o modifica righe esistenti', () => {
    const vietate = righe.filter((r) => !eComment(r) && /^(update|delete|insert|truncate|drop table)\b/i.test(r));
    expect(vietate).toEqual([]);
  });
});
