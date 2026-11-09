import { computeAccantonatoFinora } from '../accantonato';
import type { AccountBalance, GoalForCalc } from '../types';
import type { PlanItem, Transaction } from '@/lib/types';
import { formatNumero } from '@/lib/format';
import { mesiAlPieno } from './cuscinetto';
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

// Le spese del mese ancora da pagare: per ogni voce mensile, quanto manca al previsto
// dopo quello già speso nel mese in quella categoria (mai sotto zero).
export function computeDaPagareMese(input: {
  voci: (Pick<PlanItem, 'categoriaId' | 'importoMensile' | 'frequenzaMesi'> & { goalId?: string | null })[];
  spese: Pick<Transaction, 'tipo' | 'importo' | 'data' | 'categoriaId'>[];
  mese: string;
  // Obiettivi aperti: sono già contati tra i soldi messi da parte (B).
  obiettiviApertiIds?: string[];
}): number {
  const meseChiave = input.mese.slice(0, 7);
  // Le voci legate a un obiettivo aperto sono già contate tra i soldi messi da parte;
  // quelle legate a un obiettivo chiuso o scaduto restano da pagare.
  const aperti = new Set(input.obiettiviApertiIds ?? []);
  // Più voci nella stessa categoria condividono la stessa spesa: si sottrae una volta sola.
  const previstoPerCategoria = new Map<string, number>();
  for (const v of input.voci) {
    if (v.frequenzaMesi !== 1 || !v.categoriaId || (v.goalId && aperti.has(v.goalId))) continue;
    previstoPerCategoria.set(v.categoriaId, (previstoPerCategoria.get(v.categoriaId) ?? 0) + v.importoMensile);
  }
  let totale = 0;
  for (const [categoriaId, previsto] of previstoPerCategoria) {
    const speso = input.spese
      .filter((t) => t.tipo === 'expense' && t.categoriaId === categoriaId && t.data.slice(0, 7) === meseChiave)
      .reduce((x, t) => x + t.importo, 0);
    totale += Math.max(0, previsto - speso);
  }
  return arrotonda2(totale);
}

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
  cuscinettoQuotaMensile?: number;
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

  const obiettivoCusc = input.cuscinettoObiettivo ?? 0;
  let fraseCuscinetto = '';
  if (obiettivoCusc > 0) {
    const mesi = mesiAlPieno(Math.max(0, obiettivoCusc - cuscinetto), input.cuscinettoQuotaMensile ?? 0);
    const tempo = cuscinetto >= obiettivoCusc ? ', già pieno' : mesi === null ? '' : `, pieno tra circa ${mesi} mesi`;
    fraseCuscinetto = ` Cuscinetto ${formatNumero(cuscinetto)} di ${formatNumero(obiettivoCusc)} €${tempo}.`;
  }

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
        'Soldi sul conto comune, meno quelli già messi da parte, meno i rimborsi e le spese del mese ancora da pagare.' + fraseCuscinetto,
      ingredienti,
    },
  };
}
