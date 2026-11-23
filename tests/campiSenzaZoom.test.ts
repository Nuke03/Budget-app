import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Su iPhone un campo con testo sotto 16px fa ingrandire la pagina quando lo tocchi.
// Il test legge l'AST di src/app e controlla le classi di ogni input, select e textarea
// (anche quando arrivano da una costante) e delle costanti di stile dei campi.

const RADICE = path.resolve(process.cwd(), 'src/app');
const TIPI_SENZA_TESTO = ['checkbox', 'radio', 'hidden', 'range', 'color', 'file', 'submit', 'button', 'reset', 'image'];
const NOMI_COSTANTI_CAMPO = /CAMPO|fieldClass|classeCampo|inputClass/i;

function camminaFile(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return camminaFile(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const cacheSorgenti = new Map<string, ts.SourceFile>();
function sorgente(file: string): ts.SourceFile {
  let sf = cacheSorgenti.get(file);
  if (!sf) {
    sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    cacheSorgenti.set(file, sf);
  }
  return sf;
}

function risolviImport(file: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(RADICE, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(file), spec);
  else return null;
  for (const c of [base + '.tsx', base + '.ts', path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// Cerca la dichiarazione `const nome = ...` nel file o in un import relativo/alias.
function trovaCostante(file: string, nome: string, profondita = 0): { file: string; init: ts.Expression } | null {
  if (profondita > 4) return null;
  const sf = sorgente(file);
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === nome && d.initializer) return { file, init: d.initializer };
      }
    }
  }
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const nb = st.importClause.namedBindings;
    if (!nb || !ts.isNamedImports(nb)) continue;
    for (const el of nb.elements) {
      if (el.name.text !== nome) continue;
      const altro = risolviImport(file, (st.moduleSpecifier as ts.StringLiteral).text);
      if (altro) return trovaCostante(altro, (el.propertyName ?? el.name).text, profondita + 1);
    }
  }
  return null;
}

// Testo delle classi di un'espressione: stringhe, template, costanti; per i condizionali unisce i rami.
function testoClassi(expr: ts.Node, file: string, profondita = 0): string {
  if (profondita > 6) return '';
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  if (ts.isTemplateExpression(expr)) {
    return expr.head.text + expr.templateSpans.map((s) => testoClassi(s.expression, file, profondita + 1) + s.literal.text).join('');
  }
  if (ts.isParenthesizedExpression(expr)) return testoClassi(expr.expression, file, profondita + 1);
  if (ts.isConditionalExpression(expr)) {
    return testoClassi(expr.whenTrue, file, profondita + 1) + ' ' + testoClassi(expr.whenFalse, file, profondita + 1);
  }
  if (ts.isBinaryExpression(expr)) {
    return testoClassi(expr.left, file, profondita + 1) + ' ' + testoClassi(expr.right, file, profondita + 1);
  }
  if (ts.isIdentifier(expr)) {
    const c = trovaCostante(file, expr.text);
    return c ? testoClassi(c.init, c.file, profondita + 1) : '';
  }
  return '';
}

// Restituisce il token di dimensione del testo se sotto 16px, altrimenti null.
function testoPiccolo(classi: string): string | null {
  for (const token of classi.split(/\s+/)) {
    const base = token.replace(/^(?:[^\s]*:)/, '');
    if (/^text-(xs|sm)$/.test(base)) return token;
    const m = /^text-\[(\d*\.?\d+)(px|rem)\]$/.exec(base);
    if (m) {
      const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
      if (px < 16) return token;
    }
  }
  return null;
}

function trovaCampiSottoDimensione(): string[] {
  const problemi: string[] = [];
  for (const file of camminaFile(RADICE)) {
    const sf = sorgente(file);
    const rel = path.relative(RADICE, file);
    const posto = (n: ts.Node) => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;

    for (const st of sf.statements) {
      if (!ts.isVariableStatement(st)) continue;
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !NOMI_COSTANTI_CAMPO.test(d.name.text) || !d.initializer) continue;
        const tok = testoPiccolo(testoClassi(d.initializer, file));
        if (tok) problemi.push(`${posto(d)} costante ${d.name.text} con "${tok}"`);
      }
    }

    const visita = (n: ts.Node): void => {
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
        const tag = n.tagName.getText(sf);
        if (tag === 'input' || tag === 'select' || tag === 'textarea') {
          const attrs = n.attributes.properties.filter(ts.isJsxAttribute);
          const tipo = attrs.find((a) => a.name.getText(sf) === 'type');
          const tipoValore = tipo?.initializer && ts.isStringLiteral(tipo.initializer) ? tipo.initializer.text : null;
          const classe = attrs.find((a) => a.name.getText(sf) === 'className');
          const senzaTesto = tag === 'input' && tipoValore !== null && TIPI_SENZA_TESTO.includes(tipoValore);
          if (classe?.initializer && !senzaTesto) {
            const init = classe.initializer;
            const expr = ts.isStringLiteral(init) ? init : ts.isJsxExpression(init) ? init.expression : undefined;
            if (expr) {
              const tok = testoPiccolo(testoClassi(expr, file));
              if (tok) problemi.push(`${posto(n)} <${tag}> con "${tok}"`);
            }
          }
        }
      }
      ts.forEachChild(n, visita);
    };
    visita(sf);
  }
  return problemi;
}

describe('campi a 16px o più (niente zoom su iPhone)', () => {
  it('ogni input, select e textarea di src/app ha testo di almeno 16px', () => {
    expect(trovaCampiSottoDimensione()).toEqual([]);
  });

  it('riconosce una costante di campo sotto 16px', () => {
    expect(testoPiccolo('min-h-12 px-3 text-[15px] text-foreground')).toBe('text-[15px]');
    expect(testoPiccolo('px-3 text-sm')).toBe('text-sm');
    expect(testoPiccolo('px-3 text-base text-foreground')).toBeNull();
    expect(testoPiccolo('px-3 text-2xl font-serif')).toBeNull();
  });
});
