import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const sql = readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migrations', '0011_percorso.sql'),
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

describe('migrazione 0011 (statica)', () => {
  it('è racchiusa tra begin; e commit;', () => {
    const attive = righe.filter((r) => !eComment(r) && r.trim() !== '');
    expect(attive[0].trim()).toBe('begin;');
    expect(attive[attive.length - 1].trim()).toBe('commit;');
  });

  it('crea le quattro tabelle con RLS sulle proprie righe', () => {
    for (const t of ['percorso_utente', 'percorso_lezioni', 'percorso_avvisi', 'lista_attesa']) {
      expect(codice).toContain(`create table if not exists public.${t}`);
      expect(codice).toContain(`alter table public.${t} enable row level security`);
      expect(codice).toMatch(new RegExp(String.raw`on public\.${t}[\s\S]*?auth\.uid\(\) = user_id`));
    }
  });

  it('aggiunge archiviato, ruolo delle categorie e ruolo degli obiettivi', () => {
    expect(codice).toMatch(/alter table public\.accounts add column if not exists archiviato boolean not null default false/);
    expect(codice).toMatch(/alter table public\.categories add column if not exists ruolo text check \(ruolo in \('certa', 'svago'\)\)/);
    expect(codice).toMatch(/alter table public\.budget_goals add column if not exists ruolo text check \(ruolo in \('imprevisti'\)\)/);
    expect(codice).toMatch(/create unique index if not exists \w+\s+on public\.budget_goals \(user_id\) where ruolo = 'imprevisti'/);
  });

  it('crea_categorie_iniziali è security invoker e crea le 11 categorie', () => {
    const c = corpo(codice, 'crea_categorie_iniziali');
    expect(c).toContain('security invoker');
    expect(c).toContain('household_id is null');
    for (const n of ['Spesa', 'Bar e ristoranti', 'Trasporti', 'Auto', 'Casa', 'Salute', 'Abbonamenti', 'Svago e acquisti', 'Regali', 'Altro', 'Entrate']) {
      expect(c).toContain(`'${n}'`);
    }
  });

  it('ricomincia_da_zero è security invoker', () => {
    const c = corpo(codice, 'ricomincia_da_zero');
    expect(c).toContain('security invoker');
    expect(c).toContain('set search_path = public');
  });

  it('ricomincia_da_zero non cancella mai righe con household_id', () => {
    const c = corpo(codice, 'ricomincia_da_zero');
    expect(c).not.toMatch(/delete from public\.transfers(?![^;]*household_id is null)/);
    const dele = c.match(/delete from public\.(transactions|accounts|categories|budget_goals|transfers)[^;]*;/g) ?? [];
    expect(dele.length).toBeGreaterThanOrEqual(5);
    for (const d of dele) expect(d).toContain('household_id is null');
    // nessun set null su righe della casa
    expect(c).not.toMatch(/set\s+\w+\s*=\s*null/);
  });

  it('ricomincia_da_zero archivia i conti usati dalla casa', () => {
    const c = corpo(codice, 'ricomincia_da_zero');
    expect(c).toContain('archiviato = true');
    expect(c).toContain('saldo_attuale = 0');
    expect(c).toContain('conta_in_disponibile = false');
  });

  it('ricomincia_da_zero chiama crea_categorie_iniziali alla fine', () => {
    const c = corpo(codice, 'ricomincia_da_zero');
    expect(c.trimEnd().endsWith('perform public.crea_categorie_iniziali();')).toBe(true);
  });

  it('il rollback è in fondo e commentato', () => {
    const commentate = righe.filter(eComment).join('\n');
    expect(commentate).toContain('drop table if exists public.percorso_utente');
    expect(commentate).toContain('drop function if exists public.ricomincia_da_zero');
    expect(commentate).toContain('drop column if exists archiviato');
    expect(righe.lastIndexOf('commit;')).toBeLessThan(righe.findIndex((r, i) => i > righe.lastIndexOf('commit;') && r.includes('drop table')));
  });
});
