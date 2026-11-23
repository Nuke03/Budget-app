import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { ICONA_IDS } from '../src/lib/categoryIcons';

const sql = readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migrations', '0016_icone_categorie.sql'),
  'utf8',
).replace(/\r/g, '');
const righe = sql.split('\n');
const eComment = (riga: string) => riga.trimStart().startsWith('--');
const codice = righe.filter((r) => !eComment(r)).join('\n');

describe('migrazione 0016 (statica)', () => {
  it('è racchiusa tra begin; e commit;', () => {
    const attive = righe.filter((r) => !eComment(r) && r.trim() !== '');
    expect(attive[0].trim()).toBe('begin;');
    expect(attive[attive.length - 1].trim()).toBe('commit;');
  });

  it('aggiunge categories.icona, null, in modo idempotente', () => {
    expect(codice).toContain('alter table public.categories add column if not exists icona text null;');
  });

  it('il controllo elenca gli stessi id di categoryIcons.ts', () => {
    const m = /icona is null or icona in \(([^)]*)\)/.exec(codice);
    expect(m).not.toBeNull();
    const idSql = [...m![1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
    expect(idSql).toEqual([...ICONA_IDS]);
  });

  it('non tocca altre tabelle', () => {
    expect(codice).not.toMatch(/drop table|alter table public\.(?!categories)/);
  });
});
