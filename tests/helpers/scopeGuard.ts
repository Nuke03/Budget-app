const TABELLE = /\.from\(\s*['"](accounts|categories|budget_goals|transactions)['"]\s*\)/;
const SEGNI_DI_SCOPE = [
  'applyScope(',
  'scopeHouseholdId(',
  ".is('household_id'",
  ".eq('household_id'",
  '// household: per id',
];

// Nomi delle funzioni che leggono/scrivono una tabella con household_id senza
// passare dallo scope e senza il marcatore `// household: per id`.
export function findUnscopedQueries(source: string): string[] {
  const parti = source.split(/^(?=(?:export )?(?:async )?function \w+)/m);
  const nomi: string[] = [];
  for (const parte of parti) {
    const nome = /^(?:export )?(?:async )?function (\w+)/.exec(parte)?.[1];
    if (!nome || !TABELLE.test(parte)) continue;
    if (!SEGNI_DI_SCOPE.some((s) => parte.includes(s))) nomi.push(nome);
  }
  return nomi;
}
