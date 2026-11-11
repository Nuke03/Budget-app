import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PAROLE_VIETATE } from './helpers/paroleVietate';

const RADICE = join(__dirname, '..');
const CARTELLE = ['src/app/casa', 'src/app/altro', 'src/lib/calculations/casa', 'src/lib/calculations/supporto'];

const FRASI_VIETATE = ['hai speso troppo', 'in ritardo', 'sei indietro'];

// Valori di database che portano il nome vecchio: non sono testo che l'utente legge.
const VALORI_DB = ['bloccato', 'dilazionato', 'riconciliazione'];

// Una voce per riga: "percorso relativo|parola" e il motivo.
const ALLOWLIST: Record<string, string> = {};

function file(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) return file(p);
    return /\.tsx?$/.test(nome) ? [p] : [];
  });
}

// Toglie i commenti e i letterali interi dei valori di database, rispettando le stringhe:
// un "//" dentro una stringa non è un commento. Le espressioni dentro ${...} di un template
// sono codice e si leggono come tale (con le loro stringhe e i loro template).
function scansiona(src: string, da: number, dentroTemplate: boolean): { out: string; fine: number } {
  let out = '';
  let i = da;
  let graffe = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (dentroTemplate) {
      if (c === '{') graffe++;
      if (c === '}') {
        if (graffe === 0) return { out, fine: i };
        graffe--;
      }
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') j++;
        j++;
      }
      const lett = src.slice(i, j + 1);
      out += VALORI_DB.includes(lett.slice(1, -1)) ? '""' : lett;
      i = j + 1;
      continue;
    }
    if (c === '`') {
      out += c;
      i++;
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') {
          out += src.slice(i, i + 2);
          i += 2;
        } else if (src[i] === '$' && src[i + 1] === '{') {
          const interno = scansiona(src, i + 2, true);
          out += '${' + interno.out + '}';
          i = interno.fine + 1;
        } else {
          out += src[i];
          i++;
        }
      }
      out += '`';
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return { out, fine: i };
}

export function ripulisci(src: string): string {
  return scansiona(src, 0, false).out;
}

describe('ripulisci', () => {
  it('toglie i commenti ma non tocca le stringhe con // dentro', () => {
    const r = ripulisci('const a = "http://x"; // giroconto\nconst b = `x // y`; /* sinking fund */');
    expect(r).toContain('http://x');
    expect(r).toContain('x // y');
    expect(r).not.toMatch(/giroconto|sinking/);
  });

  it('toglie i soli valori interi di database, anche con apici doppi', () => {
    expect(ripulisci("modalita === 'bloccato'")).not.toContain('bloccato');
    expect(ripulisci('modalita === "dilazionato"')).not.toContain('dilazionato');
    expect(ripulisci("'Non è bloccato per sempre'")).toContain('bloccato');
    expect(ripulisci('`bloccato`')).toContain('bloccato');
  });

  it('legge le espressioni dentro un template come codice', () => {
    const r = ripulisci('const t = `a ${x ? `giroconto` : "//"} b ${y /* sinking fund */}`; // imputazione');
    expect(r).toContain('giroconto');
    expect(r).not.toMatch(/sinking|imputazione/);
  });
});

describe('testi della parte Casa', () => {
  const files = CARTELLE.flatMap((c) => file(join(RADICE, c)));

  it('trova i file da controllare', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [relative(RADICE, f).replace(/\\/g, '/'), f]))('%s: nessuna parola o frase vietata', (rel, f) => {
    const testo = ripulisci(readFileSync(f, 'utf8')).toLowerCase();
    const trovate = [...PAROLE_VIETATE, ...FRASI_VIETATE].filter(
      (p) => testo.includes(p.toLowerCase()) && !(`${rel}|${p}` in ALLOWLIST),
    );
    expect(trovate).toEqual([]);
  });
});
