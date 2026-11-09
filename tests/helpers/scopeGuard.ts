const TABELLE_GUARDATE = 'accounts|categories|budget_goals|transactions|transfers';
const FROM_GUARDATO = new RegExp(`\\.from\\(\\s*['"](?:${TABELLE_GUARDATE})['"]\\s*\\)`, 'g');
// Solo i ricevitori del client Supabase: esclude Array.from, Buffer.from, ecc.
// `\s*` prima del punto copre le catene con il punto a capo.
const FROM_DINAMICO = /\b(?:supabase|client|s)\s*\.from\(\s*(?!['"])/;
const SEGNI_DI_SCOPE = ['applyScope(', 'scopeHouseholdId(', ".is('household_id'", ".eq('household_id'"];
// Il marcatore vale solo come commento di riga su una riga a sé.
const MARCATORE = /^[ \t]*\/\/ household: per id[ \t]*$/m;
const COMMENTI_E_STRINGHE =
  /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g;

// Toglie i commenti e rende inerti le parentesi dentro le stringhe, così un
// segno di scope citato in un commento o in una stringa non conta.
function ripulisci(testo: string): string {
  return testo.replace(COMMENTI_E_STRINGHE, (m) =>
    m.startsWith('//') || m.startsWith('/*') ? '' : m.replaceAll('(', '\u0001'),
  );
}

const INIZIO_ISTRUZIONE =
  /^(?=(?:export\s+(?:default\s+)?)?(?:async\s+function|function|const|let|var|class)\b)/m;
const FUNZIONE = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)/;
// `const nome = [async] (params, anche su più righe): Tipo<Generico> =>` oppure `const nome = [async] x =>`.
const ARROW =
  /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:\w+\s*=>|\([\s\S]*?\)\s*(?::[^={]+)?=>)/;

function conta(testo: string, ago: string): number {
  return testo.split(ago).length - 1;
}

// Nomi delle funzioni che leggono/scrivono una tabella con household_id senza
// passare dallo scope e senza il marcatore `// household: per id`.
export function findUnscopedQueries(source: string): string[] {
  const nomi: string[] = [];
  for (const originale of source.split(INIZIO_ISTRUZIONE)) {
    const parte = ripulisci(originale);
    const nome = FUNZIONE.exec(parte)?.[1] ?? ARROW.exec(parte)?.[1];
    const letture = (parte.match(FROM_GUARDATO) ?? []).length;
    if (FROM_DINAMICO.test(parte)) {
      nomi.push(nome ? `${nome} (tabella dinamica)` : '<fuori da una funzione>');
      continue;
    }
    if (letture === 0) continue;
    if (!nome) {
      nomi.push('<fuori da una funzione>');
      continue;
    }
    if (MARCATORE.test(originale)) continue;
    const segni = SEGNI_DI_SCOPE.reduce((tot, s) => tot + conta(parte, s), 0);
    if (segni < letture) nomi.push(nome);
  }
  return nomi;
}
