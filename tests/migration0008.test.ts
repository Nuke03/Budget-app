import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const leggi = (nome: string) =>
  readFileSync(path.resolve(__dirname, '..', 'supabase', 'migrations', nome), 'utf8').replace(/\r/g, '');
const sql = leggi('0008_da_parte_e_controlli.sql');
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

const FUNZIONI = ['record_balance_check', 'save_household_checkin', 'link_plan_item_goal', 'set_plan_item_stima_ignorata'];
const DEFINER = ['link_plan_item_goal', 'set_plan_item_stima_ignorata'];
const FIRME = [
  'record_balance_check(uuid, numeric, date, boolean)',
  'save_household_checkin(uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, text, uuid, text)',
  'link_plan_item_goal(uuid, uuid, uuid)',
  'set_plan_item_stima_ignorata(uuid, uuid, integer)',
];

describe('migrazione 0008 (statica)', () => {
  it('è racchiusa tra begin; e commit;', () => {
    const attive = righe.filter((r) => !eComment(r) && r.trim() !== '');
    expect(attive[0].trim()).toBe('begin;');
    expect(attive[attive.length - 1].trim()).toBe('commit;');
  });

  it('definisce solo le quattro funzioni con create or replace', () => {
    const funzioni = [...codice.matchAll(/create (or replace )?function ([\w.]+)\(/g)];
    expect(funzioni.map((f) => f[2]).sort()).toEqual(
      FUNZIONI.map((n) => `public.${n}`).sort());
    for (const f of funzioni) expect(f[1]).toBe('or replace ');
    expect(codice).not.toMatch(/\bcreate table\b|\bdrop table\b/i);
  });

  it('le due funzioni sulle voci del piano sono security definer con search_path = public', () => {
    for (const nome of DEFINER) {
      const i = codice.indexOf(`create or replace function public.${nome}(`);
      const intestazione = codice.slice(i, codice.indexOf('$$', i));
      expect(intestazione).toMatch(/\bsecurity definer\b/);
      expect(intestazione).toMatch(/set search_path = public\b/);
    }
  });

  it('record_balance_check prende la riga con for update e valida saldo e data', () => {
    const c = corpo(sql, 'record_balance_check');
    expect(c).toContain('for update');
    expect(c).toContain('saldo mancante');
    expect(c).toContain('data non valida');
  });

  it('save_household_checkin rifiuta mese non chiuso e check-in doppio con messaggi ASCII', () => {
    const c = corpo(sql, 'save_household_checkin');
    for (const messaggio of [
      'mese non ancora chiuso',
      'check-in gia fatto',
      'when unique_violation',
      'avanzo non valido',
      'obiettivo mancante',
    ]) {
      expect(c).toContain(messaggio);
    }
  });

  it('save_household_checkin controlla l avanzo nullo come primo controllo', () => {
    const corpoFunzione = corpo(sql, 'save_household_checkin');
    const c = corpoFunzione.slice(corpoFunzione.indexOf('\nbegin\n'));
    const guardia = c.indexOf("raise exception 'avanzo non valido'");
    expect(guardia).toBeGreaterThan(-1);
    expect(guardia).toBeLessThan(c.indexOf('is_household_writer'));
    expect(c.indexOf('p_avanzo')).toBe(c.indexOf('p_avanzo is null'));
  });

  it('rinnova revoke e grant con le firme esatte', () => {
    for (const firma of FIRME) {
      expect(codice).toContain(`revoke execute on function public.${firma} from public, anon, authenticated;`);
      expect(codice).toContain(`grant execute on function public.${firma} to authenticated;`);
    }
  });

  it('solo ASCII', () => {
    const fuori = [...sql].filter((c) => c.charCodeAt(0) > 0x7f);
    expect(fuori).toEqual([]);
  });

  it('nessuna istruzione di primo livello modifica righe esistenti', () => {
    const vietate = righe.filter((r) => !eComment(r) && /^(update|delete|insert|truncate|drop table)\b/i.test(r));
    expect(vietate).toEqual([]);
  });
});
