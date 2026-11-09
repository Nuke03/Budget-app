import { differenceInCalendarMonths, parseISO } from 'date-fns';
import { formatNumero, nomeMese } from '@/lib/format';
import { computeAccantonatoFinora, computeFinestraGoal } from '@/lib/calculations/accantonato';
import type { GoalForCalc } from '@/lib/calculations/types';
import type { RigaMese } from './versamenti';
import type { RegolaQuota } from '@/lib/types';
import {
  calcolaQuota,
  calcolaTotale,
  quoteReali,
  type PersonaQuotaInput,
} from './quota';

export interface Spiegazione {
  valore: number;
  formula: string;
  ingredienti: { etichetta: string; valore: number }[];
}

const arrotonda2 = (n: number) => Math.round(n * 100) / 100;

export function spiegaTotaleMensile(input: {
  sottotot: number;
  cuscinettoQuotaMensile: number;
  arrotondamento: number;
}): Spiegazione {
  const { sottotot, cuscinettoQuotaMensile, arrotondamento } = input;
  const valore = calcolaTotale(sottotot, cuscinettoQuotaMensile, arrotondamento);
  const ingredienti = [
    { etichetta: 'Spese comuni', valore: sottotot },
    { etichetta: 'Cuscinetto', valore: cuscinettoQuotaMensile },
  ];
  const diff = arrotonda2(valore - sottotot - cuscinettoQuotaMensile);
  if (diff !== 0) ingredienti.push({ etichetta: 'Arrotondamento', valore: diff });
  return {
    valore,
    formula: `Spese comuni ${formatNumero(sottotot)} euro + cuscinetto ${formatNumero(cuscinettoQuotaMensile)} euro = ${formatNumero(valore)} euro.`,
    ingredienti,
  };
}

const FINE_PRIMA_RIGA: Record<RegolaQuota, string> = {
  parti_uguali: 'divisi in parti uguali.',
  proporzionale: 'divisi secondo il reddito.',
  pari_residuo: 'divisi in modo che a tutti restino gli stessi soldi.',
  personalizzata: 'divisi con le percentuali scelte.',
};

export function spiegaQuotaPersona(input: {
  regola: RegolaQuota;
  sottotot: number;
  cuscinettoQuotaMensile: number;
  arrotondamento: number;
  persone: PersonaQuotaInput[];
  slot: number;
  // Chi sta per uscire e versa una quota fissa: si toglie dal totale prima di dividere.
  quoteFisse?: { nome: string; quota: number }[];
}): Spiegazione {
  const { regola, persone, slot } = input;
  const totaleCasa = calcolaTotale(input.sottotot, input.cuscinettoQuotaMensile, input.arrotondamento);
  const fisse = (input.quoteFisse ?? []).filter((f) => f.quota > 0);
  const parteFissa = fisse.reduce((s, f) => s + f.quota, 0);
  const totale = Math.max(0, totaleCasa - parteFissa);
  const risultato = calcolaQuota({ persone, totale, regola });
  const indice = persone.findIndex((p) => p.slot === slot);
  if (indice < 0) throw new Error('slot non trovato tra le persone');
  const persona = persone[indice];
  if (!risultato.regolaDisponibile) {
    const mancanti = risultato.avvisi.filter((a) => a.tipo === 'redditi_mancanti');
    const formula =
      mancanti.length > 0
        ? `Quota da completare: manca il reddito di ${mancanti.map((a) => a.nome).join(', ')}.`
        : 'Quota da completare: le percentuali devono fare 100.';
    return { valore: 0, formula, ingredienti: [] };
  }
  const valore = risultato.persone[indice].quota;
  const redditoPersona = persona.redditoNetto ?? 0;
  const redditoTutti = persone.reduce((s, p) => s + (p.redditoNetto ?? 0), 0);

  // Pari residuo: chi ha un reddito troppo basso non versa niente e gli altri restano alla pari.
  const reali = quoteReali(persone, totale, regola);
  const residuo = Math.max(...persone.map((p, i) => (p.redditoNetto ?? 0) - reali[i]));
  const azzerati =
    regola === 'pari_residuo'
      ? persone.filter((p, i) => reali[i] === 0 && (p.redditoNetto ?? 0) < residuo - 1e-9)
      : [];
  const fineRiga =
    azzerati.length > 0 ? 'divisi tra chi può versare, in modo che a loro restino gli stessi soldi.' : FINE_PRIMA_RIGA[regola];

  const elencoFisse = fisse.map((f) => `${f.nome} ${formatNumero(f.quota)} euro`).join(', ');
  const prima =
    fisse.length === 0
      ? `Spese comuni ${formatNumero(input.sottotot)} euro + cuscinetto ${formatNumero(input.cuscinettoQuotaMensile)} euro = ${formatNumero(totale)} euro, ${fineRiga}`
      : `Spese comuni ${formatNumero(input.sottotot)} euro + cuscinetto ${formatNumero(input.cuscinettoQuotaMensile)} euro = ${formatNumero(totaleCasa)} euro. Una parte fissa, ${elencoFisse}, la versa chi sta per uscire; gli altri ${formatNumero(totale)} euro sono ${fineRiga}`;
  let seconda: string;
  let ingredienti: { etichetta: string; valore: number }[];

  switch (regola) {
    case 'parti_uguali':
      seconda = `${persona.nome}: ${formatNumero(totale)} euro diviso ${persone.length}.`;
      ingredienti = [
        { etichetta: 'Totale da dividere', valore: totale },
        { etichetta: 'Numero di persone', valore: persone.length },
      ];
      break;
    case 'proporzionale': {
      const pct = redditoTutti > 0 ? Math.round((redditoPersona / redditoTutti) * 100) : 0;
      seconda = `${persona.nome}: ${formatNumero(redditoPersona)} su ${formatNumero(redditoTutti)} di reddito, cioè ${pct}%.`;
      ingredienti = [
        { etichetta: `Reddito di ${persona.nome}`, valore: redditoPersona },
        { etichetta: 'Reddito di tutti', valore: redditoTutti },
        { etichetta: 'Totale da dividere', valore: totale },
      ];
      break;
    }
    case 'pari_residuo': {
      const resta = risultato.persone[indice].resta;
      seconda =
        resta === null
          ? `${persona.nome}: la quota è ${formatNumero(valore)} euro.`
          : `${persona.nome}: reddito ${formatNumero(redditoPersona)} euro, versa ${formatNumero(valore)} euro e restano ${formatNumero(resta)} euro.`;
      if (azzerati.some((a) => a.slot === slot)) {
        seconda = `${persona.nome} non versa niente perché il reddito non basta; gli altri restano con la stessa cifra.`;
      } else if (azzerati.length > 0) {
        const nomi = azzerati.map((a) => a.nome);
        const elenco = nomi.length === 1 ? nomi[0] : `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
        seconda += ` ${elenco} ${nomi.length === 1 ? 'non versa' : 'non versano'} niente perché il reddito non basta.`;
      }
      ingredienti = [
        { etichetta: `Reddito di ${persona.nome}`, valore: redditoPersona },
        { etichetta: 'Reddito di tutti', valore: redditoTutti },
        { etichetta: 'Totale da dividere', valore: totale },
      ];
      break;
    }
    case 'personalizzata': {
      const pct = persona.percentuale ?? 0;
      seconda = `${persona.nome}: ${formatNumero(pct)}% di ${formatNumero(totale)} euro.`;
      ingredienti = [
        { etichetta: 'Percentuale scelta', valore: pct },
        { etichetta: 'Totale da dividere', valore: totale },
      ];
      break;
    }
  }

  if (fisse.length > 0) {
    ingredienti.unshift(...fisse.map((f) => ({ etichetta: `Parte fissa di ${f.nome}`, valore: f.quota })));
  }

  const reale = reali[indice];
  const diff = arrotonda2(valore - reale);
  if (risultato.regolaDisponibile && diff !== 0) {
    ingredienti.push({ etichetta: 'Arrotondamento', valore: diff });
  }

  return { valore, formula: `${prima}\n${seconda}`, ingredienti };
}

// Perché il disponibile personale è più basso: il versamento di ogni mese è riservato dall'inizio del mese,
// finché non lo registri, e a questo si aggiunge quello che devi ad altri membri.
export function spiegaRiserva(input: { righe: RigaMese[]; debitoDaRestituire: number }): Spiegazione {
  const { righe, debitoDaRestituire } = input;
  const ingredienti = righe
    .filter((r) => r.mancano > 0)
    .map((r) => ({ etichetta: `Versamento alla casa, ${nomeMese(r.mese)}`, valore: r.mancano }));
  if (debitoDaRestituire > 0) ingredienti.push({ etichetta: 'Da restituire', valore: debitoDaRestituire });
  return {
    valore: arrotonda2(ingredienti.reduce((s, i) => s + i.valore, 0)),
    formula: "Il versamento di ogni mese è riservato dall'inizio del mese, finché non lo registri.",
    ingredienti,
  };
}

// Quanto è già messo da parte per una bolletta: la somma dei mesi messi da parte, meno quanto è già stato speso.
export function spiegaDaParte(input: { goal: GoalForCalc; today: Date; spesoCollegato: number }): Spiegazione {
  const { goal, today } = input;
  const messo = arrotonda2(computeAccantonatoFinora(goal, today, 0));
  const spesoReale = Math.max(input.spesoCollegato, 0);
  const valore = arrotonda2(computeAccantonatoFinora(goal, today, input.spesoCollegato));

  let formula: string;
  if (goal.modalita === 'bloccato') {
    formula = `Questi ${formatNumero(goal.importoTarget)} euro sono già tutti messi da parte.`;
  } else {
    const { windowStart, windowEnd } = computeFinestraGoal(goal, today);
    const mesiCiclo = Math.max(1, differenceInCalendarMonths(windowEnd!, windowStart));
    const inizio =
      goal.accantonaDa && parseISO(goal.accantonaDa) > windowStart ? parseISO(goal.accantonaDa) : windowStart;
    const mesiMessi = Math.min(Math.max(differenceInCalendarMonths(today, inizio), 0), mesiCiclo);
    const alMese = arrotonda2(goal.importoTarget / mesiCiclo);
    formula = `Bolletta di ${formatNumero(goal.importoTarget)} euro in ${mesiCiclo} mesi: ${formatNumero(alMese)} euro al mese, per ${mesiMessi} ${mesiMessi === 1 ? 'mese' : 'mesi'} già messi da parte.`;
  }

  const ingredienti = [{ etichetta: 'Messo da parte finora', valore: messo }];
  if (spesoReale > 0) ingredienti.push({ etichetta: 'Già speso su questa bolletta', valore: -spesoReale });
  if (spesoReale > messo) {
    ingredienti.push({ etichetta: 'Speso oltre quanto messo da parte', valore: arrotonda2(spesoReale - messo) });
    formula += ' Avete speso più di quanto era messo da parte, quindi qui non resta niente.';
  }
  return { valore, formula, ingredienti };
}
