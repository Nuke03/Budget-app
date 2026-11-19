import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const sql = readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migrations', '0012_pulizia.sql'),
  'utf8',
).replace(/\r/g, '');
const righe = sql.split('\n');
const eComment = (riga: string) => riga.trimStart().startsWith('--');
const codice = righe.filter((riga) => !eComment(riga)).join('\n');

const corpo = (s: string, nome: string) => {
  const i = s.indexOf(`create or replace function public.${nome}(`);
  expect(i).toBeGreaterThan(-1);
  return s.slice(i, s.indexOf('end $$;', i));
};

describe('migrazione 0012 (statica)', () => {
  it('è racchiusa tra begin; e commit;', () => {
    const attive = righe.filter((r) => !eComment(r) && r.trim() !== '');
    expect(attive[0].trim()).toBe('begin;');
    expect(attive[attive.length - 1].trim()).toBe('commit;');
  });

  it('p1: crea_categorie_iniziali blocca per utente e non crea se ci sono movimenti personali', () => {
    const c = corpo(codice, 'crea_categorie_iniziali');
    expect(c).toContain('security invoker');
    expect(c).toContain("pg_advisory_xact_lock(hashtext(v_me::text || 'categorie'))");
    expect(c.indexOf('pg_advisory_xact_lock')).toBeLessThan(c.indexOf('if exists'));
    expect(c).toMatch(/from public\.transactions where user_id = v_me and household_id is null/);
    expect(codice).toMatch(/grant execute on function public\.crea_categorie_iniziali\(\) to authenticated;/);
  });

  it('C2: get_calendar_feed aggiunge l id degli obiettivi e mantiene i grant (anon compreso)', () => {
    const c = corpo(codice, 'get_calendar_feed');
    expect(c).toContain("'id', g.id");
    expect(c).toContain('security definer');
    expect(c).toContain('set search_path = public');
    expect(codice).toMatch(/grant execute on function public\.get_calendar_feed\(text\) to anon;/);
    expect(codice).toMatch(/revoke execute on function public\.get_calendar_feed\(text\) from public, anon, authenticated;/);
  });

  it('C7: crea_fondo_bolletta è definer, con blocco sulla voce, guardia, link e grant', () => {
    expect(codice).toContain(
      'create or replace function public.crea_fondo_bolletta(p_household uuid, p_item uuid, p_scadenza date, p_oggi date)',
    );
    const c = corpo(codice, 'crea_fondo_bolletta');
    expect(c).toContain('returns uuid');
    expect(c).toContain('security definer');
    expect(c).toContain('set search_path = public');
    expect(c).toMatch(/if v_me is null then raise exception 'non autenticato'/);
    expect(c).toContain('pg_advisory_xact_lock(hashtext(p_item::text))');
    expect(c).toContain('_casa_membro_attivo(p_household, v_me)');
    expect(c).toContain('lower(g.nome) = lower(');
    expect(c).toContain('public.link_plan_item_goal(p_household, p_item, v_goal)');
    expect(codice).toMatch(/revoke execute on function public\.crea_fondo_bolletta\(uuid, uuid, date, date\) from public, anon, authenticated;/);
    expect(codice).toMatch(/grant execute on function public\.crea_fondo_bolletta\(uuid, uuid, date, date\) to authenticated;/);
  });

  it('D3/D4/C1: elimina_movimento e modifica_movimento sono invoker, bloccano i conti in ordine di id', () => {
    const e = corpo(codice, 'elimina_movimento');
    const m = corpo(codice, 'modifica_movimento');
    for (const c of [e, m]) {
      expect(c).toContain('security invoker');
      expect(c).toContain('set search_path = public');
      expect(c).toMatch(/order by id for update/);
    }
    expect(codice).toContain('create or replace function public.elimina_movimento(p_id uuid)');
    expect(codice).toMatch(
      /create or replace function public\.modifica_movimento\(\s*p_id uuid, p_tipo text, p_importo numeric, p_data date, p_categoria uuid, p_account uuid, p_goal uuid,\s*p_descrizione text, p_nota text, p_stima boolean\s*\)/,
    );
    expect(codice).toMatch(/revoke execute on function public\.elimina_movimento\(uuid\) from public, anon, authenticated;/);
    expect(codice).toMatch(/grant execute on function public\.elimina_movimento\(uuid\) to authenticated;/);
    expect(codice).toMatch(
      /revoke execute on function public\.modifica_movimento\(uuid, text, numeric, date, uuid, uuid, uuid, text, text, boolean\) from public, anon, authenticated;/,
    );
    expect(codice).toMatch(
      /grant execute on function public\.modifica_movimento\(uuid, text, numeric, date, uuid, uuid, uuid, text, text, boolean\) to authenticated;/,
    );
  });

  it('elimina_movimento contiene il caso "riga assente" e non solleva', () => {
    const e = corpo(codice, 'elimina_movimento');
    expect(e).toMatch(/riga assente/);
    expect(e).toMatch(/if not found then[\s\S]*?return;/);
  });

  it('modifica_movimento applica l effetto inverso e poi quello nuovo sui saldi', () => {
    const m = corpo(codice, 'modifica_movimento');
    expect(m).toContain("'expense', 'income'");
    expect(m).toContain('update public.transactions');
    expect(m).toContain('update public.accounts');
    expect(m).toContain("raise exception 'conto non valido'");
  });

  it('P8: incassa_fattura non prefissa "Incasso in studio" e le righe vecchie si correggono', () => {
    const c = corpo(codice, 'incassa_fattura');
    expect(c).toContain("'Incasso in studio'");
    expect(c).toContain('security invoker');
    expect(codice).toMatch(
      /update public\.transactions\s+set descrizione = 'Incasso in studio'\s+where descrizione = 'Fattura Incasso in studio' and household_id is null/,
    );
  });

  it('P10: indice unico parziale su piva_fatture(transaction_id) dopo aver scollegato i doppioni', () => {
    expect(codice).toMatch(
      /create unique index if not exists piva_fatture_un_incasso\s+on public\.piva_fatture \(transaction_id\) where transaction_id is not null/,
    );
    const iDoppioni = codice.indexOf('row_number() over (partition by transaction_id');
    expect(iDoppioni).toBeGreaterThan(-1);
    expect(iDoppioni).toBeLessThan(codice.indexOf('piva_fatture_un_incasso'));
  });

  it('P11: vincolo not valid poi validate', () => {
    expect(codice).toMatch(/add constraint piva_fatture_date_check\s+check \(data_incasso is null or data_incasso >= data_emissione\) not valid/);
    expect(codice).toContain('validate constraint piva_fatture_date_check');
    expect(codice).toContain("raise notice 'P11:");
    expect(codice).toMatch(/if v_ids is null then\s+alter table public\.piva_fatture validate/);
  });

  it('P4, K1: le due tabelle nuove hanno RLS sulle proprie righe', () => {
    expect(codice).toMatch(/create table if not exists public\.piva_quote_scartate \(/);
    expect(codice).toMatch(/transaction_id uuid primary key references public\.transactions\(id\) on delete cascade/);
    expect(codice).toMatch(/scartata_il date not null/);
    expect(codice).toMatch(/create table if not exists public\.goal_versamenti \(/);
    expect(codice).toMatch(/goal_id uuid not null references public\.budget_goals\(id\) on delete cascade/);
    expect(codice).toMatch(/importo numeric not null check \(importo > 0\)/);
    expect(codice).toMatch(/create index if not exists goal_versamenti_goal_idx on public\.goal_versamenti \(goal_id\)/);
    for (const t of ['piva_quote_scartate', 'goal_versamenti']) {
      expect(codice).toContain(`alter table public.${t} enable row level security`);
      expect(codice).toMatch(new RegExp(String.raw`on public\.${t}[\s\S]*?auth\.uid\(\)\) = user_id`));
    }
  });

  it('K1: goal_versamenti accetta solo obiettivi personali di chi scrive', () => {
    expect(codice).toMatch(/exists \(\s*select 1 from public\.budget_goals g\s+where g\.id = goal_id and g\.user_id = \(select auth\.uid\(\)\) and g\.household_id is null/);
  });

  it('B2-2 e P5: colonne nuove', () => {
    expect(codice).toMatch(/alter table public\.promemoria_utente add column if not exists rimandati jsonb not null default '\{\}'/);
    expect(codice).toMatch(/alter table public\.piva_settings add column if not exists categoria_dal date/);
  });

  it('ricomincia_da_zero cancella anche le due tabelle nuove con v_me, prima di obiettivi e movimenti', () => {
    const c = corpo(codice, 'ricomincia_da_zero');
    expect(c).toContain('security definer');
    expect(c).toContain('set search_path = public');
    expect(c).toMatch(/delete from public\.goal_versamenti where user_id = v_me;/);
    expect(c).toMatch(/delete from public\.piva_quote_scartate where user_id = v_me;/);
    const iGoal = c.indexOf('delete from public.budget_goals');
    const iTx = c.indexOf('delete from public.transactions');
    for (const t of ['goal_versamenti', 'piva_quote_scartate']) {
      const i = c.indexOf(`delete from public.${t}`);
      expect(i).toBeLessThan(iGoal);
      expect(i).toBeLessThan(iTx);
    }
    expect(c.trimEnd().endsWith('perform public.crea_categorie_iniziali();')).toBe(true);
    expect(codice).toMatch(/revoke all on function public\.ricomincia_da_zero\(\) from public, anon;/);
    expect(codice).toMatch(/grant execute on function public\.ricomincia_da_zero\(\) to authenticated;/);
  });

  it('ricomincia_da_zero mantiene le regole della Casa della 0011', () => {
    const c = corpo(codice, 'ricomincia_da_zero');
    const dele = c.match(/delete from public\.[^;]*;/g) ?? [];
    expect(dele.length).toBeGreaterThanOrEqual(11);
    for (const d of dele) expect(d).toContain('v_me');
    for (const u of c.match(/update public\.[^;]*;/g) ?? []) expect(u).toContain('v_me');
    for (const d of c.match(/delete from public\.(transactions|accounts|categories|budget_goals|transfers)[^;]*;/g) ?? [])
      expect(d).toContain('household_id is null');
    expect(c).toContain('archiviato = true');
    expect(c).toContain('household_id is not null and t.account_id = a.id');
    expect(c).toContain('public.household_plan_items i where i.goal_id = g.id');
    expect(c).not.toMatch(/set\s+\w+\s*=\s*null/);
  });

  it('il rollback è in fondo e commentato', () => {
    const commentate = righe.filter(eComment).join('\n');
    expect(commentate).toContain('drop table if exists public.goal_versamenti');
    expect(commentate).toContain('drop function if exists public.elimina_movimento');
    expect(commentate).toContain('drop function if exists public.crea_fondo_bolletta');
    expect(righe.lastIndexOf('commit;')).toBeLessThan(
      righe.findIndex((r, i) => i > righe.lastIndexOf('commit;') && r.includes('drop table')),
    );
  });
});
