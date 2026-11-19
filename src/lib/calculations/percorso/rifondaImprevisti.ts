// Quando una spesa vera esce dal cuscinetto per gli imprevisti, il cuscinetto deve poter tornare al suo
// traguardo. L'accantonato è lineare fino al traguardo e la spesa collegata lo riduce: senza ritocchi il
// cuscinetto resterebbe a zero (spesa grande) o non risalirebbe più al traguardo (spesa piccola).
import { addMonths, format } from 'date-fns';
import { computeMesiGoal, computeQuotaMensile } from '../accantonato';
import { QUOTA_IMPREVISTI } from './soglie';
import { scadenzaImprevisti } from './primiPassiFondi';
import type { BudgetGoal } from '@/lib/types';

export type Rifondazione =
  // Stesso fondo, collegato alla spesa: traguardo più alto e scadenza più in là, la quota mensile resta.
  | { azione: 'estendi'; importoTarget: number; scadenza: string }
  // Il fondo si chiude con la spesa; ne parte uno nuovo, con lo stesso traguardo e la stessa quota.
  | { azione: 'ricomincia'; nuovo: { importoTarget: number; scadenza: string; accantonaDa: string } };

const arrotonda2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
// Per non far salire di un mese un rapporto che è intero a meno del rumore dei decimali.
const EPS = 1e-9;

export function rifondaImprevisti(input: {
  goal: BudgetGoal;
  // Quanto il fondo ha accantonato adesso, prima di collegare la spesa.
  accantonato: number;
  spesa: number;
  // 'YYYY-MM-DD'
  oggi: string;
}): Rifondazione {
  const { goal, accantonato, spesa, oggi } = input;
  const data = new Date(`${oggi}T12:00:00`);
  const T = goal.importoTarget;

  let mesi: { totale: number; trascorsi: number } | null = null;
  let quota: number | null = null;
  const estendibile = goal.modalita === 'dilazionato' && !goal.ricorrente && !!goal.scadenza;
  if (estendibile) {
    try {
      mesi = computeMesiGoal(goal, data);
      quota = computeQuotaMensile(goal, data);
    } catch {
      mesi = null;
    }
  }

  if (mesi && goal.scadenza && spesa < accantonato && T > 0) {
    // Pendenza del fondo: T per i mesi del ciclo. Oltre la scadenza il tetto è già scattato: la pendenza
    // si ricalcola sui mesi realmente passati, così l'accantonato di adesso (T) resta quello che è.
    const pendenza = T / Math.max(mesi.trascorsi, mesi.totale);
    const nuoviMesi = Math.ceil((T + spesa) / pendenza - EPS);
    return {
      azione: 'estendi',
      importoTarget: arrotonda2(pendenza * nuoviMesi),
      scadenza: format(addMonths(new Date(`${goal.scadenza}T12:00:00`), nuoviMesi - mesi.totale), 'yyyy-MM-dd'),
    };
  }

  const q = quota !== null && quota > 0 ? quota : Math.min(QUOTA_IMPREVISTI, T);
  return {
    azione: 'ricomincia',
    nuovo: { importoTarget: T, scadenza: scadenzaImprevisti(oggi, T, q), accantonaDa: oggi },
  };
}
