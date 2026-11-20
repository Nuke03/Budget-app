import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const sql = readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migrations', '0014_difese.sql'),
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

describe('migrazione 0014 (statica)', () => {
  it('è racchiusa tra begin; e commit;', () => {
    const attive = righe.filter((r) => !eComment(r) && r.trim() !== '');
    expect(attive[0].trim()).toBe('begin;');
    expect(attive[attive.length - 1].trim()).toBe('commit;');
  });

  it('goal_versamenti: trigger su insert e update con importo e data', () => {
    const f = corpo(codice, 'goal_versamenti_controlli');
    expect(f).toContain('security invoker');
    expect(f).toContain('set search_path = public');
    expect(f).toContain('new.importo is null or new.importo <= 0 or new.importo >= 1000000000');
    expect(f).toContain('new.data > public._casa_oggi()');
    expect(codice).toContain('drop trigger if exists goal_versamenti_controlli on public.goal_versamenti;');
    expect(codice).toMatch(
      /create trigger goal_versamenti_controlli before insert or update on public\.goal_versamenti\s+for each row execute function public\.goal_versamenti_controlli\(\);/,
    );
  });

  it('rientri: solo stato e fermato_il cambiano', () => {
    const f = corpo(codice, 'rientri_solo_stato');
    expect(f).toContain('security invoker');
    expect(f).toContain('set search_path = public');
    for (const c of ['goal_id', 'account_id', 'importo', 'mesi', 'creato_il', 'household_id', 'user_id']) {
      expect(f).toContain(`new.${c} is distinct from old.${c}`);
    }
    expect(f).not.toContain('new.stato is distinct');
    expect(f).not.toContain('new.fermato_il is distinct');
    expect(codice).toContain('drop trigger if exists rientri_solo_stato on public.rientri;');
    expect(codice).toMatch(
      /create trigger rientri_solo_stato before update on public\.rientri\s+for each row execute function public\.rientri_solo_stato\(\);/,
    );
  });

  it('modifica_movimento rifiuta le righe della riconciliazione e tiene il resto', () => {
    const f = corpo(codice, 'modifica_movimento');
    expect(f).toContain('p_id uuid, p_tipo text, p_importo numeric, p_data date, p_categoria uuid, p_account uuid, p_goal uuid');
    expect(f).toContain('security invoker');
    expect(f).toContain("t.origine = 'riconciliazione'");
    expect(f).toContain('raise exception');
    expect(f).toContain('saldo_attuale = saldo_attuale + (v_nuovo - v_vecchio)');
    // il rifiuto viene prima di ogni scrittura
    expect(f.indexOf("t.origine = 'riconciliazione'")).toBeLessThan(f.indexOf('update public.transactions'));
    expect(codice).toContain(
      'revoke execute on function public.modifica_movimento(uuid, text, numeric, date, uuid, uuid, uuid, text, text, boolean) from public, anon, authenticated;',
    );
    expect(codice).toContain(
      'grant execute on function public.modifica_movimento(uuid, text, numeric, date, uuid, uuid, uuid, text, text, boolean) to authenticated;',
    );
  });

  it('non tocca tabelle né migrazioni vecchie', () => {
    expect(codice).not.toMatch(/create table|drop table|alter table/);
  });
});
