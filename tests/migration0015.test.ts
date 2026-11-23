import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const leggi = (f: string) =>
  readFileSync(path.resolve(__dirname, '..', 'supabase', 'migrations', f), 'utf8').replace(/\r/g, '');
const sql = leggi('0015_agevolazioni.sql');
const righe = sql.split('\n');
const eComment = (riga: string) => riga.trimStart().startsWith('--');
const codice = righe.filter((riga) => !eComment(riga)).join('\n');

const corpo = (s: string, nome: string) => {
  const i = s.indexOf(`create or replace function public.${nome}(`);
  expect(i).toBeGreaterThan(-1);
  return s.slice(i, s.indexOf('end $$;', i));
};

describe('migrazione 0015 (statica)', () => {
  it('è racchiusa tra begin; e commit;', () => {
    const attive = righe.filter((r) => !eComment(r) && r.trim() !== '');
    expect(attive[0].trim()).toBe('begin;');
    expect(attive[attive.length - 1].trim()).toBe('commit;');
  });

  it('agevolazioni_situazione: colonne e controlli', () => {
    expect(codice).toContain('create table if not exists public.agevolazioni_situazione');
    expect(codice).toContain('user_id uuid primary key default auth.uid() references auth.users on delete cascade');
    expect(codice).toContain('isee numeric(10,2) null check (isee >= 0 and isee < 1000000)');
    expect(codice).toContain('dsu_data date null');
    expect(codice).toContain('comune text null check (char_length(comune) <= 80)');
    expect(codice).toContain('in_affitto boolean null');
    expect(codice).toContain('studente boolean null');
    expect(codice).toContain('aggiornata_il timestamptz not null default now()');
    expect(codice).toContain('sezione_aperta_il date null');
  });

  it('agevolazioni_stati: colonne, chiave e controlli', () => {
    expect(codice).toContain('create table if not exists public.agevolazioni_stati');
    expect(codice).toContain('voce_id text not null check (char_length(voce_id) <= 40)');
    expect(codice).toContain("check (stato in ('fatto', 'non-mi-riguarda'))");
    expect(codice).toContain('il date not null');
    expect(codice).toContain('primary key (user_id, voce_id)');
  });

  it('RLS: solo il proprietario, su tutte e due', () => {
    for (const t of ['agevolazioni_situazione', 'agevolazioni_stati']) {
      expect(codice).toContain(`alter table public.${t} enable row level security;`);
      expect(codice).toContain(`drop policy if exists ${t}_proprie on public.${t};`);
      expect(codice).toMatch(
        new RegExp(
          String.raw`create policy ${t}_proprie on public\.${t} for all to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\)\s+with check \(user_id = \(select auth\.uid\(\)\)\);`,
        ),
      );
    }
  });

  it('trigger: dsu_data non dopo oggi', () => {
    const f = corpo(codice, 'agevolazioni_situazione_controlli');
    expect(f).toContain('security invoker');
    expect(f).toContain('set search_path = public');
    expect(f).toContain('new.dsu_data > public._casa_oggi()');
    expect(codice).toContain('drop trigger if exists agevolazioni_situazione_controlli on public.agevolazioni_situazione;');
    expect(codice).toMatch(
      /create trigger agevolazioni_situazione_controlli before insert or update on public\.agevolazioni_situazione\s+for each row execute function public\.agevolazioni_situazione_controlli\(\);/,
    );
  });

  it('ricomincia_da_zero: la versione della 0013 più le due tabelle', () => {
    const nuova = corpo(codice, 'ricomincia_da_zero');
    const vecchia = corpo(leggi('0013_rientri_spostamenti.sql'), 'ricomincia_da_zero');
    expect(nuova).toContain('security definer');
    expect(nuova).toContain('delete from public.agevolazioni_stati where user_id = v_me;');
    expect(nuova).toContain('delete from public.agevolazioni_situazione where user_id = v_me;');
    // tolte le due righe nuove e i commenti, è identica alla 0013
    const pulisci = (s: string) =>
      s
        .split('\n')
        .filter((r) => !eComment(r) && !r.includes('agevolazioni_') && r.trim() !== '')
        .join('\n');
    expect(pulisci(nuova)).toBe(pulisci(vecchia));
    expect(codice).toContain('revoke all on function public.ricomincia_da_zero() from public, anon;');
    expect(codice).toContain('grant execute on function public.ricomincia_da_zero() to authenticated;');
  });

  it('non tocca tabelle vecchie', () => {
    expect(codice).not.toMatch(/drop table|alter table public\.(?!agevolazioni_)/);
  });
});
