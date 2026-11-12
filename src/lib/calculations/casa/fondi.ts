import { addMonths, differenceInCalendarMonths, format, lastDayOfMonth, parseISO } from 'date-fns';
import { computeAccantonatoFinora, computeQuotaMensile } from '@/lib/calculations/accantonato';
import type { GoalForCalc } from '@/lib/calculations/types';
import { spiegaDaParte, type Spiegazione } from './spiegazioni';
import type { BudgetGoal, PlanItem } from '@/lib/types';

const arrotonda2 = (n: number) => Math.round(n * 100) / 100;

// Le possibili date della prossima rata: l'ultimo giorno di ciascun mese, da quello dopo oggi
// fino a `frequenzaMesi` mesi dopo.
export function scadenzeProposte(input: { oggi: string; frequenzaMesi: number }): string[] {
  const oggi = parseISO(input.oggi);
  const date: string[] = [];
  for (let k = 1; k <= input.frequenzaMesi; k++) {
    date.push(format(lastDayOfMonth(addMonths(oggi, k)), 'yyyy-MM-dd'));
  }
  return date;
}

function fondoPerCalcolo(
  input: { importoRicorrenza: number; frequenzaMesi: number; scadenza: string; oggi: string },
): GoalForCalc {
  return {
    importoTarget: input.importoRicorrenza,
    modalita: 'dilazionato',
    stato: 'aperto',
    scadenza: input.scadenza,
    createdAt: input.oggi,
    ricorrente: true,
    frequenzaMesi: input.frequenzaMesi,
    accantonaDa: input.oggi,
  };
}

// La prossima rata che si propone di default: l'ultima scadenza utile.
export function ultimaScadenza(item: PlanItem, oggi: string): string {
  const date = scadenzeProposte({ oggi, frequenzaMesi: item.frequenzaMesi });
  return date[date.length - 1];
}

// Cosa si avrà messo da parte alla prima scadenza, partendo da oggi (stesso motore degli obiettivi).
export function anteprimaDaParte(input: {
  importoRicorrenza: number;
  frequenzaMesi: number;
  scadenza: string;
  oggi: string;
}): { quotaMensile: number; allaPrimaScadenza: number; mancaAllaPrimaScadenza: number; mesiAllaScadenza: number } {
  const fondo = fondoPerCalcolo(input);
  const oggi = parseISO(input.oggi);
  const quotaMensile = arrotonda2(computeQuotaMensile(fondo, oggi) ?? 0);
  const allaPrimaScadenza = Math.min(
    input.importoRicorrenza,
    arrotonda2(computeAccantonatoFinora(fondo, parseISO(input.scadenza), 0))
  );
  return {
    quotaMensile,
    allaPrimaScadenza,
    mancaAllaPrimaScadenza: arrotonda2(input.importoRicorrenza - allaPrimaScadenza),
    mesiAllaScadenza: Math.max(0, differenceInCalendarMonths(parseISO(input.scadenza), oggi)),
  };
}

export interface StatoVoceDaParte {
  item: PlanItem;
  goal: BudgetGoal | null;
  stato: 'messa' | 'da_mettere';
}

// Per ogni voce che non è mensile: è già messa da parte? Lo è se il suo fondo è aperto, oppure se
// c'è un fondo aperto ricorrente con la stessa categoria e lo stesso nome (non ancora collegato alla voce).
export function statoVociDaParte(items: PlanItem[], goals: BudgetGoal[]): StatoVoceDaParte[] {
  const aperti = goals.filter((g) => g.stato === 'aperto');
  return items
    .filter((item) => item.frequenzaMesi > 1)
    .map((item) => {
      const collegato = item.goalId ? aperti.find((g) => g.id === item.goalId) : undefined;
      const omonimo =
        !item.goalId && item.categoriaId
          ? aperti.find(
              (g) =>
                g.ricorrente &&
                g.categoriaId === item.categoriaId &&
                g.nome.toLowerCase() === item.nome.toLowerCase()
            )
          : undefined;
      const goal = collegato ?? omonimo ?? null;
      return { item, goal, stato: goal ? ('messa' as const) : ('da_mettere' as const) };
    });
}

export type ObiettivoCasa = BudgetGoal & {
  quotaMensile: number | null;
  accantonato: number;
  spiegazione: Spiegazione;
};

// Gli obiettivi con quanto è messo da parte, la quota al mese e la spiegazione.
export function obiettiviCasaConSpiegazione(
  goals: BudgetGoal[],
  speso: Record<string, number>,
  today: Date
): ObiettivoCasa[] {
  return goals.map((g) => {
    const spesoCollegato = speso[g.id] ?? 0;
    return {
      ...g,
      quotaMensile: computeQuotaMensile(g, today),
      accantonato: computeAccantonatoFinora(g, today, spesoCollegato),
      spiegazione: spiegaDaParte({ goal: g, today, spesoCollegato }),
    };
  });
}
