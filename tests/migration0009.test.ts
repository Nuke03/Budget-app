import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const sql = readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migrations', '0009_supporto_e_notifiche.sql'),
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

describe('migrazione 0009 (statica)', () => {
  it('è racchiusa tra begin; e commit;', () => {
    const attive = righe.filter((r) => !eComment(r) && r.trim() !== '');
    expect(attive[0].trim()).toBe('begin;');
    expect(attive[attive.length - 1].trim()).toBe('commit;');
  });

  it('crea push_iscrizioni con endpoint unico e RLS sulle proprie righe', () => {
    expect(codice).toMatch(/create table if not exists public\.push_iscrizioni/);
    expect(codice).toMatch(/endpoint text not null unique/);
    expect(codice).toMatch(/alter table public\.push_iscrizioni enable row level security/);
    expect(codice).toMatch(/on public\.push_iscrizioni[\s\S]*?user_id = \(select auth\.uid\(\)\)/);
  });

  it('crea promemoria_utente con RLS sulle proprie righe', () => {
    expect(codice).toMatch(/create table if not exists public\.promemoria_utente/);
    expect(codice).toMatch(/alter table public\.promemoria_utente enable row level security/);
    expect(codice).toMatch(/on public\.promemoria_utente[\s\S]*?user_id = \(select auth\.uid\(\)\)/);
    expect(codice).toMatch(/ultima_notifica_il date/);
    for (const col of ['notifiche_attive', 'ultima_spese_il', 'ultima_checkin_il', 'ultimo_versamento_mese', 'nessuna_spesa_fino_al', 'ultima_notifica_il']) {
      expect(codice).toContain(col);
    }
  });

  it('ogni tabella nuova ha le quattro policy', () => {
    for (const t of ['push_iscrizioni', 'promemoria_utente']) {
      for (const op of ['select', 'insert', 'update', 'delete']) {
        expect(codice).toMatch(new RegExp(`create policy "?${t}_${op}"? on public\.${t} for ${op}`));
      }
    }
  });

  it('aggiunge transactions.stima false di default', () => {
    expect(codice).toMatch(
      /alter table public\.transactions add column if not exists stima boolean not null default false/);
  });

  it('estende la causale e il vincolo per_conto_di con saldo_iniziale, cercando i vincoli nel catalogo', () => {
    expect(codice).toMatch(/pg_constraint/);
    expect(codice).toMatch(/'versamento', 'rimborso', 'restituzione', 'altro', 'saldo_iniziale'/);
    expect(codice).toMatch(/causale in \('restituzione', 'saldo_iniziale'\)/);
    expect(codice).toMatch(/causale in \('versamento', 'restituzione', 'saldo_iniziale'\)/);
  });

  it('record_saldo_iniziale controlla membri attivi, persone diverse e un solo saldo per casa', () => {
    const f = corpo(codice, 'record_saldo_iniziale');
    expect(f).toMatch(/security definer/);
    expect(f).toMatch(/set search_path = public/);
    expect(f).toMatch(/p_creditore = p_debitore/);
    expect(f).toMatch(/attivo/);
    expect(f).toMatch(/causale = 'saldo_iniziale'/);
    expect(f).toMatch(/solo_registrazione/);
    expect(f).toMatch(/Europe\/Rome/);
    expect(f).toMatch(/p_importo := round\(p_importo, 2\)/);
    expect(f).toMatch(/p_importo <= 0/);
  });

  it('record_saldo_iniziale: revoke da public e anon, grant ad authenticated', () => {
    expect(codice).toMatch(
      /revoke execute on function public\.record_saldo_iniziale\(uuid, uuid, uuid, numeric\) from public, anon/);
    expect(codice).toMatch(
      /grant execute on function public\.record_saldo_iniziale\(uuid, uuid, uuid, numeric\) to authenticated/);
  });

  it('ha in fondo la parte per tornare indietro, commentata', () => {
    expect(sql).toMatch(/-- drop table if exists public\.push_iscrizioni/);
  });
});

describe('migrazione 0009: _casa_debiti_aperti con saldo_iniziale', () => {
  it('ridefinisce _casa_debiti_aperti con la stessa firma, definer, stable, search_path', () => {
    expect(codice).toMatch(
      /create or replace function public\._casa_debiti_aperti\(h uuid, u uuid\)\s+returns numeric language sql security definer stable set search_path = public/);
  });

  it('il saldo_iniziale e prestato dal beneficiario a per_conto_di, coppia compresa', () => {
    const inizio = codice.indexOf('create or replace function public._casa_debiti_aperti(');
    expect(inizio).toBeGreaterThan(-1);
    const f = codice.slice(inizio, codice.indexOf('commit;', inizio));
    expect(f).toMatch(/t\.causale = 'saldo_iniziale' and t\.beneficiario_user_id = p\.c and t\.per_conto_di_user_id = p\.d/);
    expect(f).toMatch(/select beneficiario_user_id, per_conto_di_user_id\s+from public\.transfers\s+where household_id = h and causale = 'saldo_iniziale'/);
    expect(f).toContain('union');
    // il restituito resta quello di 0004
    expect(f).toMatch(/t\.causale = 'restituzione' and t\.user_id = p\.d and t\.beneficiario_user_id = p\.c/);
  });

  it('non rifa revoke/grant (create or replace li mantiene)', () => {
    expect(codice).not.toMatch(/(revoke|grant)[^;]*_casa_debiti_aperti/);
  });
});
