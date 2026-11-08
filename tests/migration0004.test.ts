import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

// Controlli statici sulla migrazione 0004. Le righe che iniziano con "--" (commenti e
// blocco di rollback commentato) sono ignorate da tutti i controlli.
const sql = readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migrations', '0004_casa_comune.sql'),
  'utf8',
);
const righe = sql.split('\n');
const eComment = (riga: string) => riga.trimStart().startsWith('--');
const codice = righe.filter((riga) => !eComment(riga)).join('\n');

describe('migrazione 0004 (statica)', () => {
  it('inizia con begin; e ha un commit; prima del blocco di rollback commentato', () => {
    const prime = righe.filter((riga) => !eComment(riga) && riga.trim() !== '');
    expect(prime[0].trim()).toBe('begin;');
    const indiceCommit = righe.findIndex((riga) => !eComment(riga) && riga.trim() === 'commit;');
    const indiceRollback = righe.findIndex((riga) => riga.includes('ROLLBACK (solo se serve'));
    expect(indiceCommit).toBeGreaterThan(-1);
    expect(indiceRollback).toBeGreaterThan(indiceCommit);
  });

  it('ogni create table usa if not exists', () => {
    expect(codice.match(/\bcreate table\b/gi)?.length ?? 0).toBeGreaterThan(0);
    expect(codice.match(/\bcreate table\b(?!\s+if not exists\b)/gi) ?? []).toEqual([]);
  });

  it('ogni create policy di primo livello è preceduta da drop policy if exists con lo stesso nome e tabella', () => {
    const policy = [...codice.matchAll(/^create policy (\w+) on ([\w.]+)/gm)];
    expect(policy.length).toBeGreaterThan(0);
    for (const m of policy) {
      const [, nome, tabella] = m;
      const prima = codice.slice(0, m.index);
      expect(prima).toContain(`drop policy if exists ${nome} on ${tabella};`);
    }
  });

  it('ogni funzione security definer imposta search_path = public', () => {
    const intestazioni = codice
      .split(/create or replace function /)
      .slice(1)
      .map((blocco) => blocco.slice(0, blocco.indexOf('$$')));
    const definer = intestazioni.filter((h) => /\bsecurity definer\b/.test(h));
    expect(definer.length).toBeGreaterThan(0);
    for (const intestazione of definer) {
      expect(intestazione).toMatch(/set search_path = public\b/);
    }
  });

  it('nessuna istruzione di primo livello modifica o cancella righe esistenti', () => {
    const righeColonnaZero = codice.split('\n').filter((riga) => /^(update|delete|insert|truncate)\b/i.test(riga));
    expect(righeColonnaZero).toEqual([]);
    const drop = codice.split('\n').filter((riga) => /\bdrop\s+(table|column)\b/i.test(riga));
    expect(drop).toEqual([]);
  });

  it('le quattro tabelle esistenti perdono owner_full_access e nessuna policy con quel nome viene ricreata', () => {
    expect(codice).toContain("array['accounts', 'categories', 'budget_goals', 'transactions']");
    expect(codice).toContain('drop policy if exists "owner_full_access" on public.%I');
    expect(codice).not.toMatch(/create policy\s+"?owner_full_access"?/i);
  });

  it('ogni funzione public dichiarata compare nella revoke da public, anon e authenticated', () => {
    const nomi = [...codice.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);
    expect(nomi.length).toBeGreaterThan(0);
    const inizio = codice.indexOf('revoke execute on function');
    expect(inizio).toBeGreaterThan(-1);
    const fine = codice.indexOf('from public, anon, authenticated;', inizio);
    expect(fine).toBeGreaterThan(inizio);
    const blocco = codice.slice(inizio, fine);
    for (const nome of nomi) {
      expect(blocco, `revoke di ${nome}`).toMatch(new RegExp(`public\\.${nome}\\(`));
    }
  });

  it('solo get_calendar_feed è concessa ad anon', () => {
    expect(codice.match(/to anon;/g) ?? []).toHaveLength(1);
    const riga = codice.split('\n').find((r) => r.includes('to anon;')) ?? '';
    expect(riga).toMatch(/grant execute on function public\.get_calendar_feed\(text\) to anon;/);
  });

  it('save_household_plan è security definer con search_path = public', () => {
    expect(codice).toMatch(
      /create or replace function public\.save_household_plan\(p_household uuid, p_payload jsonb\)\s+returns uuid\[\] language plpgsql security definer set search_path = public as/,
    );
  });

  it('le tabelle del piano non si scrivono dal client (solo lettura per authenticated)', () => {
    expect(codice).toMatch(
      /revoke insert, update, delete, truncate on table\s+public\.household_plans, public\.household_plan_items, public\.household_plan_shares\s+from authenticated;/,
    );
  });

  it('contiene tutte le tabelle del modello', () => {
    const tabelle = [
      'households',
      'household_members',
      'household_invites',
      'household_plans',
      'household_plan_items',
      'household_plan_shares',
      'transfers',
      'balance_checks',
      'household_checkins',
      'calendar_feeds',
    ];
    for (const tabella of tabelle) {
      expect(codice).toMatch(new RegExp(`create table if not exists public\\.${tabella}\\s`));
    }
  });
});
