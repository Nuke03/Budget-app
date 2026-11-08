import { formatNumero } from '@/lib/format';
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
}): Spiegazione {
  const { regola, persone, slot } = input;
  const totale = calcolaTotale(input.sottotot, input.cuscinettoQuotaMensile, input.arrotondamento);
  const risultato = calcolaQuota({ persone, totale, regola });
  const indice = persone.findIndex((p) => p.slot === slot);
  if (indice < 0) throw new Error('slot non trovato tra le persone');
  const persona = persone[indice];
  const valore = risultato.persone[indice].quota;
  const redditoPersona = persona.redditoNetto ?? 0;
  const redditoTutti = persone.reduce((s, p) => s + (p.redditoNetto ?? 0), 0);

  const prima = `Spese comuni ${formatNumero(input.sottotot)} euro + cuscinetto ${formatNumero(input.cuscinettoQuotaMensile)} euro = ${formatNumero(totale)} euro, ${FINE_PRIMA_RIGA[regola]}`;
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
          : `${persona.nome}: reddito ${formatNumero(redditoPersona)} euro, versa ${formatNumero(valore)} euro e gli restano ${formatNumero(resta)} euro.`;
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

  const reale = quoteReali(persone, totale, regola)[indice];
  const diff = arrotonda2(valore - reale);
  if (risultato.regolaDisponibile && diff !== 0) {
    ingredienti.push({ etichetta: 'Arrotondamento', valore: diff });
  }

  return { valore, formula: `${prima}\n${seconda}`, ingredienti };
}
