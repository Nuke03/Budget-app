import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const sql = readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migrations', '0010_piva_guidata.sql'),
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

const RPC = ['crea_movimento', 'crea_fattura', 'incassa_fattura', 'accantona_tasse', 'annulla_accantonamento', 'paga_scadenza'];

describe('migrazione 0010 (statica)', () => {
  it('è racchiusa tra begin; e commit;', () => {
    const attive = righe.filter((r) => !eComment(r) && r.trim() !== '');
    expect(attive[0].trim()).toBe('begin;');
    expect(attive[attive.length - 1].trim()).toBe('commit;');
  });

  it('crea le tre tabelle con RLS sulle proprie righe', () => {
    for (const t of ['piva_fatture', 'piva_accantonamenti', 'piva_scadenze']) {
      expect(codice).toContain(`create table if not exists public.${t}`);
      expect(codice).toContain(`alter table public.${t} enable row level security`);
      expect(codice).toMatch(new RegExp(String.raw`on public\.${t}[\s\S]*?user_id = \(select auth\.uid\(\)\)`));
    }
  });

  it('piva_scadenze ha una riga sola per utente, anno e chiave', () => {
    expect(codice).toMatch(/unique \(user_id, anno, chiave\)/);
    for (const k of ['f24_giugno', 'f24_novembre', 'cassa_acconto', 'cassa_saldo']) {
      expect(codice).toContain(`'${k}'`);
    }
  });

  it('aggiunge le colonne a piva_settings e promemoria_utente', () => {
    for (const col of ['conto_tasse_id', 'preset', 'guidata_dal', 'stipendio_mensile', 'stipendio_rivisto_il', 'incasso_mese_magro', 'ultima_scadenza_avvisata']) {
      expect(codice).toContain(col);
    }
  });

  it('ogni RPC è security invoker con search_path', () => {
    for (const nome of RPC) {
      const c = corpo(codice, nome);
      expect(c).toContain('security invoker');
      expect(c).toContain('set search_path = public');
    }
  });

  it('ogni RPC ha revoke e grant', () => {
    for (const nome of RPC) {
      expect(codice).toMatch(new RegExp(String.raw`revoke execute on function public\.${nome}\([^)]*\) from public, anon`));
      expect(codice).toMatch(new RegExp(String.raw`grant execute on function public\.${nome}\([^)]*\) to authenticated`));
    }
  });

  it('incassa_fattura e paga_scadenza bloccano la riga e rifiutano il doppio', () => {
    const i = corpo(codice, 'incassa_fattura');
    expect(i).toContain('for update');
    expect(i).toContain("'fattura già incassata'");
    const p = corpo(codice, 'paga_scadenza');
    expect(p).toContain('for update');
    expect(p).toContain("'scadenza già pagata'");
  });

  it('le RPC rifiutano i conti della casa', () => {
    for (const nome of ['incassa_fattura', 'accantona_tasse', 'paga_scadenza', 'crea_fattura']) {
      const c = corpo(codice, nome);
      expect(c).toContain('household_id is not null');
      expect(c).toContain("'conto non valido'");
    }
  });

  it('accantona_tasse rifiuta il doppio spostamento dello stesso incasso', () => {
    expect(corpo(codice, 'accantona_tasse')).toContain("'quota già spostata'");
    expect(codice).toMatch(/create unique index if not exists \w+\s+on public\.piva_accantonamenti \(transaction_id\) where transaction_id is not null/);
  });

  it('annulla_accantonamento riporta i saldi e torna le righe cancellate', () => {
    const c = corpo(codice, 'annulla_accantonamento');
    expect(c).toContain('delete from public.piva_accantonamenti');
    expect(c).toContain('saldo_attuale');
    expect(c).toContain('get diagnostics');
  });

  it('il trigger riapre fattura e scadenza quando si elimina il movimento', () => {
    expect(codice).toContain('before delete on public.transactions');
    expect(codice).toMatch(/update public\.piva_fatture set data_incasso = null, transaction_id = null where transaction_id = old\.id/);
    expect(codice).toMatch(/update public\.piva_scadenze set pagata_il = null, transaction_id = null where transaction_id = old\.id/);
  });

  it('ha il rollback commentato', () => {
    const commentate = righe.filter(eComment).join('\n');
    expect(commentate).toContain('drop table if exists public.piva_fatture');
    expect(commentate).toContain('drop function if exists public.crea_movimento');
    expect(commentate).toContain('drop column if exists guidata_dal');
  });
});
