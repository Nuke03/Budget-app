import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const sql = readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migrations', '0013_rientri_spostamenti.sql'),
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

describe('migrazione 0013 (statica)', () => {
  it('è racchiusa tra begin; e commit;', () => {
    const attive = righe.filter((r) => !eComment(r) && r.trim() !== '');
    expect(attive[0].trim()).toBe('begin;');
    expect(attive[attive.length - 1].trim()).toBe('commit;');
  });

  it('rientri: colonne e check', () => {
    expect(codice).toMatch(/create table if not exists public\.rientri \(/);
    expect(codice).toContain('user_id uuid not null default auth.uid() references auth.users(id) on delete cascade');
    expect(codice).toContain('household_id uuid null references public.households(id)');
    expect(codice).toContain('goal_id uuid null references public.budget_goals(id) on delete cascade');
    expect(codice).toContain('account_id uuid null references public.accounts(id) on delete cascade');
    expect(codice).toContain('importo numeric(12,2) not null check (importo > 0 and importo < 1000000000)');
    expect(codice).toContain('mesi int not null check (mesi in (2, 3, 4, 6, 12))');
    expect(codice).toContain('creato_il date not null');
    expect(codice).toContain("stato text not null default 'aperto' check (stato in ('aperto', 'fermato', 'chiuso'))");
    expect(codice).toContain('fermato_il date null');
    expect(codice).toContain('check ((goal_id is null) <> (account_id is null))');
    expect(codice).toContain('check (household_id is null or account_id is null)');
    expect(codice).toContain("check ((stato = 'aperto') = (fermato_il is null))");
  });

  it('spostamenti: colonne e check', () => {
    expect(codice).toMatch(/create table if not exists public\.spostamenti \(/);
    expect(codice).toContain('da_account_id uuid null references public.accounts(id) on delete set null');
    expect(codice).toContain('a_account_id uuid null references public.accounts(id) on delete set null');
    expect(codice).toContain('data date not null');
    expect(codice).toContain('check (da_account_id <> a_account_id)');
  });

  it('RLS abilitata e policy sulle righe giuste', () => {
    for (const t of ['rientri', 'spostamenti'])
      expect(codice).toContain(`alter table public.${t} enable row level security`);
    for (const op of ['select', 'insert', 'update', 'delete'])
      expect(codice).toMatch(new RegExp(`create policy rientri_personali_${op} on public\.rientri for ${op} to authenticated`));
    expect(codice).not.toMatch(/create policy rientri_personali on/);
    // insert: destinazione completa; update/delete: solo il proprietario (Ferma e Lascia stare non si bloccano)
    const pers = (op: string, fine: string) =>
      codice.slice(codice.indexOf(`create policy rientri_personali_${op}`), codice.indexOf(fine));
    const insP = pers('insert', 'drop policy if exists rientri_personali_update');
    expect(insP).toContain('a.conta_in_disponibile = false');
    expect(insP).toContain('not a.archiviato');
    const updP = pers('update', 'drop policy if exists rientri_personali_delete');
    const delP = pers('delete', 'drop policy if exists rientri_casa_select');
    for (const p of [updP, delP]) {
      expect(p).toContain('household_id is null and user_id = (select auth.uid())');
      expect(p).not.toContain('conta_in_disponibile');
      expect(p).not.toContain('archiviato');
    }
    for (const op of ['select', 'insert', 'update', 'delete'])
      expect(codice).toMatch(new RegExp(`create policy rientri_casa_${op} on public\.rientri for ${op} to authenticated`));
    const ins = codice.slice(codice.indexOf('create policy rientri_casa_insert'), codice.indexOf('drop policy if exists rientri_casa_update'));
    expect(ins).toContain('user_id = (select auth.uid())');
    expect(ins).toContain('public.is_household_writer(household_id)');
    expect(ins).not.toContain('is_household_member');
    const sel = codice.slice(codice.indexOf('create policy rientri_casa_select'), codice.indexOf('drop policy if exists rientri_casa_insert'));
    expect(sel).toContain('public.is_household_member(household_id)');
    expect(codice).toMatch(/create trigger rientri_forbid_household_change before update on public\.rientri\s+for each row execute function public\.forbid_household_change\(\)/);
    // spostamenti: select/insert/delete, nessuna policy di update e privilegio revocato
    expect(codice).toMatch(/create policy spostamenti_select on public\.spostamenti for select to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\)/);
    expect(codice).toMatch(/create policy spostamenti_insert on public\.spostamenti for insert to authenticated\s+with check \(user_id = \(select auth\.uid\(\)\)\)/);
    expect(codice).toMatch(/create policy spostamenti_delete on public\.spostamenti for delete to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\)/);
    expect(codice).not.toMatch(/create policy spostamenti_\w+ on public\.spostamenti for (all|update)/);
    expect(codice).toMatch(/revoke update on public\.spostamenti from authenticated;/);
    expect(codice).toContain('g.household_id = rientri.household_id');
    for (const p of ['rientri_personali_select', 'rientri_personali_insert', 'rientri_personali_update', 'rientri_personali_delete', 'rientri_casa_insert', 'spostamenti_select', 'spostamenti_insert', 'spostamenti_delete'])
      expect(codice.indexOf(`drop policy if exists ${p}`)).toBeLessThan(codice.indexOf(`create policy ${p}`));
  });

  it('indici', () => {
    expect(codice).toMatch(/create index if not exists rientri_user_idx on public\.rientri \(user_id\)/);
    expect(codice).toMatch(/create index if not exists rientri_household_idx on public\.rientri \(household_id\)/);
    expect(codice).toMatch(
      /create index if not exists spostamenti_user_data_idx on public\.spostamenti \(user_id, data\)/,
    );
  });

  it('sposta_soldi: invoker, blocco in ordine di id, solo conti personali di chi chiama', () => {
    expect(codice).toContain(
      'create or replace function public.sposta_soldi(p_da uuid, p_a uuid, p_importo numeric, p_data date)',
    );
    const c = corpo(codice, 'sposta_soldi');
    expect(c).toContain('returns uuid');
    expect(c).toContain('security invoker');
    expect(c).toContain('set search_path = public');
    expect(c).toMatch(/order by id for update/);
    expect(c).toContain('household_id is null');
    expect(c).toContain('user_id = (select auth.uid())');
    expect(c).toContain('household_id is null and not archiviato');
    expect(c).toContain('p_data > public._casa_oggi()');
    expect(c).toContain('p_importo >= 1000000000');
    expect(c).toContain('update public.accounts');
    expect(c).toContain('insert into public.spostamenti');
  });

  it('annulla_spostamento: invoker, rimette i saldi, 0 se non c era', () => {
    const c = corpo(codice, 'annulla_spostamento');
    expect(c).toContain('returns int');
    expect(c).toContain('security invoker');
    expect(c).toContain('set search_path = public');
    expect(c).toMatch(/order by id for update/);
    expect(c).toContain('delete from public.spostamenti');
    expect(c).toMatch(/if n = 0 then return 0;/);
  });

  it('grant: solo authenticated', () => {
    expect(codice).toMatch(
      /revoke execute on function public\.sposta_soldi\(uuid, uuid, numeric, date\) from public, anon, authenticated;/,
    );
    expect(codice).toMatch(
      /grant execute on function public\.sposta_soldi\(uuid, uuid, numeric, date\) to authenticated;/,
    );
    expect(codice).toMatch(
      /revoke execute on function public\.annulla_spostamento\(uuid\) from public, anon, authenticated;/,
    );
    expect(codice).toMatch(/grant execute on function public\.annulla_spostamento\(uuid\) to authenticated;/);
  });

  it('ricomincia_da_zero cancella rientri e spostamenti personali prima dei conti', () => {
    const c = corpo(codice, 'ricomincia_da_zero');
    expect(c).toContain('security definer');
    expect(c).toContain('set search_path = public');
    expect(c).toMatch(/delete from public\.rientri where user_id = v_me and household_id is null;/);
    expect(c).toMatch(/delete from public\.spostamenti where user_id = v_me;/);
    const iAcc = c.indexOf('delete from public.accounts');
    expect(c.indexOf('delete from public.rientri')).toBeLessThan(iAcc);
    expect(c.indexOf('delete from public.spostamenti')).toBeLessThan(iAcc);
    expect(c).toContain('delete from public.goal_versamenti where user_id = v_me;');
    expect(c).toContain('delete from public.piva_quote_scartate where user_id = v_me;');
    expect(c.trimEnd().endsWith('perform public.crea_categorie_iniziali();')).toBe(true);
    for (const d of c.match(/delete from public\.[^;]*;/g) ?? []) expect(d).toContain('v_me');
    expect(codice).toMatch(/revoke all on function public\.ricomincia_da_zero\(\) from public, anon;/);
    expect(codice).toMatch(/grant execute on function public\.ricomincia_da_zero\(\) to authenticated;/);
  });

  it('difese: quote scartate, adjust_account_balance, indice versamenti', () => {
    expect(codice).toMatch(/drop policy if exists piva_quote_scartate_proprie/);
    expect(codice).toMatch(
      /create policy piva_quote_scartate_proprie[\s\S]*?exists \(select 1 from public\.transactions t where t\.id = transaction_id and t\.user_id = \(select auth\.uid\(\)\)\)/,
    );
    expect(codice).toMatch(
      /revoke execute on function public\.adjust_account_balance\(uuid, numeric\) from authenticated;/,
    );
    expect(codice).toMatch(
      /create index if not exists goal_versamenti_goal_data_idx on public\.goal_versamenti \(goal_id, data\)/,
    );
  });

  it('niente drop table', () => {
    expect(codice).not.toMatch(/drop table/i);
  });

  it('il rollback è in fondo e commentato', () => {
    const commentate = righe.filter(eComment).join('\n');
    expect(commentate).toContain('drop table if exists public.rientri');
    expect(commentate).toContain('drop function if exists public.sposta_soldi');
    expect(righe.lastIndexOf('commit;')).toBeLessThan(
      righe.findIndex((r, i) => i > righe.lastIndexOf('commit;') && r.includes('drop table')),
    );
  });
});
