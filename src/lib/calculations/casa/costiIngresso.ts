import { differenceInCalendarMonths, parseISO } from 'date-fns';
import { formatNumero } from '@/lib/format';
import type { Spiegazione } from './spiegazioni';

// Unico punto da cambiare se cambiano le cifre di riferimento.
export const COSTI_INGRESSO = {
  depositoMesiMax: 3,
  registroAliquota: 0.02,
  registroMinimo: 67,
  bollo: 32,
  agenziaIva: 0.22,
  allaccioPerUtenza: 100,
  utenzeIniziali: 3,
};

export type ChiaveCosto = 'deposito' | 'registro' | 'bollo' | 'agenzia' | 'allacci' | 'arredo';

export interface VoceCosto {
  chiave: ChiaveCosto;
  nome: string;
  importo: number;
  nota: string;
  spiegazione: Spiegazione;
}

export const NOTE_COSTI = {
  deposito: 'Per legge al massimo 3 mensilità. Ve lo restituiscono a fine contratto, con gli interessi.',
  registro: 'Di solito si divide a metà con il proprietario. Se sceglie la cedolare secca non si paga.',
  bollo: 'Marca da bollo sul contratto: spesso la paga l\'inquilino, ma si può dividere con il proprietario. Non si paga con la cedolare secca.',
  allacci: 'Attivazione o subentro di luce, gas e acqua: circa 100 euro per utenza, è una stima.',
};

export const AVVISO_COSTI = 'Cifre indicative per orientarvi, non consulenza legale o fiscale.';

const arrotonda2 = (n: number) => Math.round(n * 100) / 100;
const nonNegativo = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function calcolaCostiIngresso(input: {
  canoneMensile: number;
  mesiDeposito: number;
  cedolareSecca: boolean;
  agenzia: boolean;
  numeroUtenze: number;
  arredo: number;
}): VoceCosto[] {
  const canone = nonNegativo(input.canoneMensile);
  const mesiGrezzi = Number.isFinite(input.mesiDeposito) ? input.mesiDeposito : 1;
  const mesi = Math.min(Math.max(Math.round(mesiGrezzi), 1), COSTI_INGRESSO.depositoMesiMax);
  const utenze = Math.round(nonNegativo(input.numeroUtenze));
  const arredo = arrotonda2(nonNegativo(input.arredo));

  const depositoImporto = arrotonda2(canone * mesi);

  const annuo = arrotonda2(canone * 12);
  const impostaPercentuale = arrotonda2(annuo * COSTI_INGRESSO.registroAliquota);
  const minimoApplicato = canone > 0 && impostaPercentuale < COSTI_INGRESSO.registroMinimo;
  const imposta = minimoApplicato ? COSTI_INGRESSO.registroMinimo : impostaPercentuale;
  const quotaInquilino = arrotonda2(imposta / 2);
  const registroImporto = input.cedolareSecca ? 0 : quotaInquilino;

  const bolloImporto = input.cedolareSecca ? 0 : COSTI_INGRESSO.bollo;

  const agenziaImporto = input.agenzia ? arrotonda2(canone * (1 + COSTI_INGRESSO.agenziaIva)) : 0;

  const allacciImporto = arrotonda2(utenze * COSTI_INGRESSO.allaccioPerUtenza);

  return [
    {
      chiave: 'deposito',
      nome: 'Deposito cauzionale',
      importo: depositoImporto,
      nota: NOTE_COSTI.deposito,
      spiegazione: {
        valore: depositoImporto,
        formula: `Deposito di ${mesi} mensilità da ${formatNumero(canone)} euro: ${formatNumero(depositoImporto)} euro.`,
        ingredienti: [{ etichetta: 'Deposito', valore: depositoImporto }],
      },
    },
    {
      chiave: 'registro',
      nome: 'Imposta di registro',
      importo: registroImporto,
      nota: NOTE_COSTI.registro,
      spiegazione: input.cedolareSecca
        ? {
            valore: 0,
            formula: "Con la cedolare secca non si paga l'imposta di registro.",
            ingredienti: [],
          }
        : {
            valore: registroImporto,
            formula: minimoApplicato
              ? `Imposta minima di ${formatNumero(imposta)} euro, perché il 2% su ${formatNumero(annuo)} euro di canone in un anno ne fa meno: diviso a metà, ${formatNumero(quotaInquilino)} euro.`
              : `Imposta del 2% su ${formatNumero(annuo)} euro di canone in un anno: ${formatNumero(imposta)} euro, diviso a metà: ${formatNumero(quotaInquilino)} euro.`,
            ingredienti: [{ etichetta: "Quota dell'inquilino", valore: quotaInquilino }],
          },
    },
    {
      chiave: 'bollo',
      nome: 'Imposta di bollo',
      importo: bolloImporto,
      nota: NOTE_COSTI.bollo,
      spiegazione: input.cedolareSecca
        ? { valore: 0, formula: 'Con la cedolare secca non si paga il bollo.', ingredienti: [] }
        : {
            valore: bolloImporto,
            formula: `Imposta di bollo sul contratto: ${formatNumero(bolloImporto)} euro.`,
            ingredienti: [{ etichetta: 'Imposta di bollo', valore: bolloImporto }],
          },
    },
    {
      chiave: 'agenzia',
      nome: 'Agenzia immobiliare',
      importo: agenziaImporto,
      nota: '',
      spiegazione: input.agenzia
        ? {
            valore: agenziaImporto,
            formula: `Una mensilità di ${formatNumero(canone)} euro più IVA al 22%: ${formatNumero(agenziaImporto)} euro.`,
            ingredienti: [
              { etichetta: 'Una mensilità', valore: canone },
              { etichetta: 'IVA al 22%', valore: arrotonda2(agenziaImporto - canone) },
            ],
          }
        : { valore: 0, formula: "Senza agenzia non c'è questa spesa.", ingredienti: [] },
    },
    {
      chiave: 'allacci',
      nome: 'Allacci delle utenze',
      importo: allacciImporto,
      nota: NOTE_COSTI.allacci,
      spiegazione: {
        valore: allacciImporto,
        formula: `${utenze} ${utenze === 1 ? 'utenza' : 'utenze'} a ${formatNumero(COSTI_INGRESSO.allaccioPerUtenza)} euro ciascuna: ${formatNumero(allacciImporto)} euro.`,
        ingredienti: [{ etichetta: `Allaccio di ${utenze} utenze`, valore: allacciImporto }],
      },
    },
    {
      chiave: 'arredo',
      nome: 'Arredo',
      importo: arredo,
      nota: '',
      spiegazione: {
        valore: arredo,
        formula: `Arredo previsto: ${formatNumero(arredo)} euro.`,
        ingredienti: [{ etichetta: 'Arredo', valore: arredo }],
      },
    },
  ];
}

export function totaleCosti(voci: VoceCosto[], selezionate: ChiaveCosto[]): number {
  const scelte = new Set(selezionate);
  return arrotonda2(voci.filter((v) => scelte.has(v.chiave)).reduce((s, v) => s + v.importo, 0));
}

export function controllaDataIngresso(data: string, oggi: string): 'ok' | 'passata' {
  return data < oggi ? 'passata' : 'ok';
}

export function anteprimaGraduale(input: {
  importo: number;
  scadenza: string;
  oggi: string;
}): { mesi: number; quotaMensile: number } {
  const mesi = Math.max(1, differenceInCalendarMonths(parseISO(input.scadenza), parseISO(input.oggi)));
  return { mesi, quotaMensile: arrotonda2(nonNegativo(input.importo) / mesi) };
}

// Il canone si legge dalla voce 'Affitto' del piano, cercata per nome o per nome della categoria, senza distinguere maiuscole.
export function canoneDaPiano(
  voci: { nome: string; categoria?: string | null; importoMensile: number }[],
): number {
  const cerca = (s: string | null | undefined) => (s ?? '').trim().toLowerCase() === 'affitto';
  const trovata = voci.find((v) => cerca(v.nome) || cerca(v.categoria));
  return trovata ? nonNegativo(trovata.importoMensile) : 0;
}
