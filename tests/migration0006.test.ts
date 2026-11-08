import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const leggi = (nome: string) =>
  readFileSync(path.resolve(__dirname, '..', 'supabase', 'migrations', nome), 'utf8').replace(/\r/g, '');
const sql = leggi('0006_piano_redditi_e_ingressi.sql');
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

describe('migrazione 0006 (statica)', () => {
  it('è racchiusa tra begin; e commit;', () => {
    const attive = righe.filter((r) => !eComment(r) && r.trim() !== '');
    expect(attive[0].trim()).toBe('begin;');
    expect(attive[attive.length - 1].trim()).toBe('commit;');
  });

  it('ridefinisce solo save_household_plan e join_household, con create or replace', () => {
    const funzioni = [...codice.matchAll(/create (or replace )?function ([\w.]+)\(/g)];
    expect(funzioni.map((f) => f[2])).toEqual(['public.save_household_plan', 'public.join_household']);
    for (const f of funzioni) expect(f[1]).toBe('or replace ');
    expect(codice).not.toMatch(/\bcreate table\b|\bdrop\b|\balter\b/i);
  });

  it('ogni funzione è security definer con search_path = public', () => {
    for (const nome of ['save_household_plan', 'join_household']) {
      const i = codice.indexOf(`create or replace function public.${nome}(`);
      const intestazione = codice.slice(i, codice.indexOf('$$', i));
      expect(intestazione).toMatch(/\bsecurity definer\b/);
      expect(intestazione).toMatch(/set search_path = public\b/);
    }
  });

  it('rinnova i grant di entrambe le funzioni', () => {
    for (const firma of ['save_household_plan(uuid, jsonb)', 'join_household(text, text)']) {
      expect(codice).toContain(`revoke execute on function public.${firma} from public, anon, authenticated;`);
      expect(codice).toContain(`grant execute on function public.${firma} to authenticated;`);
    }
  });

  it('save_household_plan mantiene i controlli di identità e di payload', () => {
    const c = corpo(sql, 'save_household_plan');
    for (const frase of [
      'auth.uid()',
      'non autenticato',
      'casa non scrivibile',
      'payload non valido',
      'valido_dal deve essere il primo del mese',
      'valido_dal nel passato',
      'le percentuali devono sommare a 100',
      'il reddito di un altro membro non si modifica',
    ]) {
      expect(c).toContain(frase);
    }
    expect(c.indexOf('casa non scrivibile')).toBeLessThan(c.indexOf('delete from public.household_plans'));
  });

  it('save_household_plan confronta i redditi con l ultimo valore di tutte le versioni, prima del delete', () => {
    const c = corpo(sql, 'save_household_plan');
    const iGuardia = c.indexOf("raise exception 'il reddito di un altro membro non si modifica'");
    const iDelete = c.indexOf('delete from public.household_plans');
    expect(iGuardia).toBeGreaterThan(-1);
    expect(iGuardia).toBeLessThan(iDelete);
    const blocco = c.slice(0, iDelete);
    expect(blocco).toMatch(/order by p\.valido_dal desc limit 1/);
    expect(blocco).not.toMatch(/valido_dal <= vdal/);
    // la vecchia guida (solo versioni fino a vdal) non c'è più
    expect(c.slice(iDelete)).not.toContain('il reddito di un altro membro non si modifica');
  });

  it('save_household_plan controlla che categoria e obiettivo siano della casa', () => {
    const c = corpo(sql, 'save_household_plan');
    expect(c).toMatch(/c\.household_id = p_household/);
    expect(c).toMatch(/g\.household_id = p_household/);
    expect(c).toContain('categoria non appartenente alla casa');
    expect(c).toContain('obiettivo non appartenente alla casa');
  });

  it('save_household_plan coincide con la 0005 salvo le modifiche elencate', () => {
    const vecchia = corpo(leggi('0005_piano_sostituisce_futuro.sql'), 'save_household_plan');
    let nuova = corpo(sql, 'save_household_plan');
    // toglie i tre cambiamenti noti: variabile, guardia anticipata, controlli categoria/obiettivo
    nuova = nuova.replace('  trovato boolean;\n', '');
    const da = nuova.indexOf('  for v in select value from jsonb_array_elements(p_payload -> \'versioni\') loop\n    for q in');
    const a = nuova.indexOf('  delete from public.household_plans');
    nuova = nuova.slice(0, da) + nuova.slice(a);
    const c1 = nuova.indexOf('      if cat is not null and not exists (');
    const c2 = nuova.indexOf('      insert into public.household_plan_items (');
    nuova = nuova.slice(0, c1) + nuova.slice(c2);
    const vecchiaSenzaGuardia = vecchia.replace(/      if mem_user is not null and mem_user <> uid then[\s\S]*?\n      end if;\n(?=      insert into public\.household_plan_shares)/, '');
    expect(nuova).toBe(vecchiaSenzaGuardia);
  });

  it('join_household mantiene i controlli della 0004', () => {
    const c = corpo(sql, 'join_household');
    for (const frase of [
      'auth.uid()',
      'non autenticato',
      'Codice non valido o scaduto',
      'nome mancante',
      'hai gia una casa',
      "insert into public.household_members (household_id, user_id, display_name, slot)",
    ]) {
      expect(c).toContain(frase);
    }
  });

  it('join_household considera solo segnaposto della versione attiva o successive e preferisce il nome', () => {
    const c = corpo(sql, 'join_household');
    expect(c).toContain('_casa_oggi()');
    expect(c).toMatch(/p\.valido_dal > mese_corrente/);
    expect(c).toMatch(/p3\.valido_dal <= mese_corrente/);
    expect(c).toMatch(/lower\(trim\(s\.display_name\)\) = lower\(v_nome\)/);
    expect(c).toMatch(/s\.user_id is null/);
  });

  it('join_household coincide con la 0004 salvo la selezione del segnaposto', () => {
    const vecchia = corpo(leggi('0004_casa_comune.sql'), 'join_household');
    let nuova = corpo(sql, 'join_household');
    nuova = nuova.replace("  mese_corrente date := date_trunc('month', public._casa_oggi()::timestamp)::date;\n", '');
    const taglia = (s: string) => {
      const i = s.indexOf('  select s.slot into slot_n');
      const j = s.indexOf('  if slot_n is null then');
      return s.slice(0, i) + s.slice(j);
    };
    expect(taglia(nuova)).toBe(taglia(vecchia));
  });
});
