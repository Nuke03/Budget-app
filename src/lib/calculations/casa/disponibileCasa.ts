import { computeAccantonatoFinora } from '../accantonato';
import type { AccountBalance, GoalForCalc } from '../types';
import type { Spiegazione } from './spiegazioni';

export interface DisponibileCasa {
  valore: number;
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  cuscinetto: number;
  spiegazione: Spiegazione;
}

const arrotonda2 = (n: number) => Math.round(n * 100) / 100;

// Quanto la casa può spendere davvero: i soldi sul conto comune meno quelli già
// messi da parte per gli obiettivi, meno i rimborsi e le spese del mese ancora
// da pagare. Il cuscinetto (fino all'obiettivo dato) si trattiene dal resto.
export function computeDisponibileCasa(input: {
  conti: AccountBalance[];
  obiettivi: GoalForCalc[];
  today: Date;
  crediti?: number;
  daPagareMese?: number;
  cuscinettoObiettivo?: number;
}): DisponibileCasa {
  const { conti, obiettivi, today } = input;
  const c = input.crediti ?? 0;
  const d = input.daPagareMese ?? 0;

  const a = arrotonda2(conti.filter((x) => x.contaInDisponibile).reduce((s, x) => s + x.saldoAttuale, 0));
  const b = arrotonda2(
    obiettivi
      .filter((g) => g.stato === 'aperto')
      .reduce((s, g) => s + computeAccantonatoFinora(g, today, g.specoCollegato ?? 0), 0)
  );
  const e = arrotonda2(a - b - c - d);
  const cuscinetto = Math.min(Math.max(e, 0), input.cuscinettoObiettivo ?? 0);
  const valore = arrotonda2(e - cuscinetto);

  const ingredienti = [
    { etichetta: 'Soldi sul conto comune', valore: a },
    { etichetta: 'Messi da parte', valore: -b },
    { etichetta: 'Rimborsi da fare', valore: -c },
    { etichetta: 'Spese del mese ancora da pagare', valore: -d },
  ];
  if (cuscinetto > 0) ingredienti.push({ etichetta: 'Cuscinetto', valore: -cuscinetto });

  return {
    valore,
    a,
    b,
    c,
    d,
    e,
    cuscinetto,
    spiegazione: {
      valore,
      formula:
        'Soldi sul conto comune, meno quelli già messi da parte, meno i rimborsi e le spese del mese ancora da pagare.',
      ingredienti,
    },
  };
}
