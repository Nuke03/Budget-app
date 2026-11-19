// /goals?nuovo=1&nome=...&importo=...: i valori che arrivano dall'indirizzo si controllano prima di
// finire nel modulo del nuovo obiettivo. Quello che non è valido si scarta, senza errori.
import type { GoalPayload } from '@/app/goals/CreateGoalForm';

const NOME_MASSIMO = 80;
const IMPORTO_MASSIMO = 1e9;

export function leggiPrecompilato(ricerca: string): GoalPayload | null {
  const params = new URLSearchParams(ricerca);
  if (!params.has('nuovo')) return null;
  const nome = (params.get('nome') ?? '').trim();
  const grezzo = (params.get('importo') ?? '').trim();
  const importo = grezzo === '' ? NaN : Number(grezzo);
  const nomeValido = nome.length > 0 && nome.length <= NOME_MASSIMO;
  const importoValido = Number.isFinite(importo) && importo > 0 && importo < IMPORTO_MASSIMO;
  if (!nomeValido && !importoValido) return null;
  return {
    nome: nomeValido ? nome : '',
    importoTarget: importoValido ? importo : 0,
    modalita: 'bloccato',
    scadenza: null,
    categoriaId: null,
    ricorrente: false,
    frequenzaMesi: null,
  };
}
