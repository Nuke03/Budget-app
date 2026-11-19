// /goals?nuovo=1&nome=...&importo=...: i valori che arrivano dall'indirizzo si controllano prima di
// finire nel modulo del nuovo obiettivo. Quello che non è valido si scarta, senza errori.
import type { GoalPayload } from '@/app/goals/CreateGoalForm';

const NOME_MASSIMO = 80;
const IMPORTO_MASSIMO = 1e9;
const FORMATO_IMPORTO = /^\d+([.,]\d{1,2})?$/;

export function leggiPrecompilato(ricerca: string): GoalPayload | null {
  const params = new URLSearchParams(ricerca);
  if (!params.has('nuovo')) return null;
  const nome = (params.get('nome') ?? '').trim();
  const grezzo = (params.get('importo') ?? '').trim();
  // Solo cifre, con al massimo due decimali: niente esadecimali, esponenti o spazi.
  const importo = FORMATO_IMPORTO.test(grezzo) ? Number(grezzo.replace(',', '.')) : NaN;
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
