import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RADICE = join(__dirname, '..');
const GLIFI = ['›', '‹'];

function file(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) return file(p);
    return /\.tsx?$/.test(nome) ? [p] : [];
  });
}

// Toglie i commenti (anche a blocco): i glifi lì non sono visibili.
function senzaCommenti(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w'"`])\/\/.*$/gm, '$1');
}

describe('icone', () => {
  const files = file(join(RADICE, 'src/app'));

  it('trova i file da controllare', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('nessun file in src/app usa i glifi › o ‹ come testo visibile: servono ChevronRight e ChevronLeft', () => {
    const trovati = files
      .filter((f) => GLIFI.some((g) => senzaCommenti(readFileSync(f, 'utf8')).includes(g)))
      .map((f) => relative(RADICE, f).replaceAll('\\', '/'));
    expect(trovati).toEqual([]);
  });
});
