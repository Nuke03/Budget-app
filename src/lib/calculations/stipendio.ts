import { addMonths, endOfMonth, parseISO } from 'date-fns';
import { euroInFrase } from '@/lib/format';
import type { Transaction } from '@/lib/types';

function mesePrefisso(anno: number, meseIndex0: number): string {
  return `${anno}-${String(meseIndex0 + 1).padStart(2, '0')}`;
}

function media(valori: number[]): number {
  if (valori.length === 0) return 0;
  return valori.reduce((s, v) => s + v, 0) / valori.length;
}

// Arrotonda a 10 € per difetto.
function giu10(x: number): number {
  return Math.floor(x / 10) * 10;
}

// Gli ultimi `mesi` mesi solari interi (escluso quello in corso), dal più
// vecchio al più recente. `oggi` è 'YYYY-MM-DD' (Europe/Rome).
export function incassiPerMese(
  incassi: Transaction[],
  categoriaFatturatoId: string,
  oggi: string,
  mesi: number,
): number[] {
  const anno = Number(oggi.slice(0, 4));
  const mese0 = Number(oggi.slice(5, 7)) - 1;
  const risultato: number[] = [];
  for (let k = mesi; k >= 1; k--) {
    const totaleMesi = anno * 12 + mese0 - k;
    const prefisso = mesePrefisso(Math.floor(totaleMesi / 12), totaleMesi % 12);
    risultato.push(
      incassi
        .filter(
          (t) =>
            t.tipo === 'income' &&
            t.categoriaId === categoriaFatturatoId &&
            t.data.startsWith(prefisso),
        )
        .reduce((s, t) => s + t.importo, 0),
    );
  }
  return risultato;
}

// Uscite del mese ('YYYY-MM') dai conti del disponibile, non collegate a
// obiettivi. I conti del disponibile sono personali: i versamenti alla casa
// non passano di qui, si passano a parte (versatoCasaMese).
export function speseDelMese(
  t: Transaction[],
  contiDisponibile: Set<string>,
  mese: string,
): number {
  return t
    .filter(
      (x) =>
        x.tipo === 'expense' &&
        x.accountId !== null &&
        contiDisponibile.has(x.accountId) &&
        x.goalId === null &&
        x.data.startsWith(mese),
    )
    .reduce((s, x) => s + x.importo, 0);
}

// `incassiMensili` è la finestra già tagliata dal chiamante: parte dal primo
// mese con incassi, quindi la media non è diluita da mesi vuoti iniziali.
export function propostaStipendio(i: {
  incassiMensili: number[];
  mesiConIncassi: number;
  percentuale: number;
  speseMensili: number[];
  quotaCasaMensile: number;
  incassoMeseMagro: number | null;
}): { a: number | null; b: number; proposta: number | null; serveMeseMagro: boolean } {
  const netto = 1 - i.percentuale / 100;
  let a: number | null = null;
  let serveMeseMagro = false;
  if (i.mesiConIncassi >= 3) {
    a = giu10(media(i.incassiMensili) * netto);
  } else if (i.incassoMeseMagro !== null) {
    a = giu10(i.incassoMeseMagro * netto);
  } else {
    serveMeseMagro = true;
  }
  const b = giu10(media(i.speseMensili) + i.quotaCasaMensile);
  // b <= 0: spese non ancora abbastanza, B non c'è e si parte da A. Mai una proposta a 0.
  let proposta = a === null ? null : giu10(b <= 0 ? a : Math.min(a, b));
  if (proposta !== null && proposta <= 0) proposta = null;
  return { a, b, proposta, serveMeseMagro };
}

// Se le spese hanno superato lo stipendio: la frase calma con l'eccedenza, altrimenti null.
// È la sola regola: l'hub e la Home la usano entrambi, così dicono lo stesso numero e la stessa frase.
export function fraseEccedenza(rimasto: number): string | null {
  const eccedenza = Math.round(-rimasto * 100) / 100;
  return eccedenza > 0 ? `Hai già speso ${euroInFrase(eccedenza)} più dello stipendio di questo mese.` : null;
}

// Il disponibile vero è sotto zero: si mostra 0 e questa frase, con lo stesso tono della Home senza stipendio.
export const FRASE_DISPONIBILE_NEGATIVO = 'Fino al prossimo stipendio conviene spendere solo per il necessario.';

export function homeConStipendio(i: {
  disponibileLibero: number;
  stipendio: number;
  speseMese: number;
  versatoCasaMese: number;
  riservaVersamento: number;
}): {
  mostrato: number;
  rimasto: number;
  // Quanto resta dello stipendio, mai sotto zero: è il numero che si mostra.
  rimastoMostrato: number;
  // Quanto si è speso oltre lo stipendio (0 se non è successo) e la frase che lo dice.
  eccedenza: number;
  frase: string | null;
  cuscinetto: number;
  mesiCoperti: number;
} {
  const rimasto = i.stipendio - i.speseMese - i.versatoCasaMese - i.riservaVersamento;
  // Mai un numero negativo: sopra lo stipendio si mostra 0 e la frase dice di quanto.
  const mostrato = Math.max(0, Math.min(i.disponibileLibero, rimasto));
  const rimastoMostrato = Math.max(0, rimasto);
  const eccedenza = Math.max(0, Math.round(-rimasto * 100) / 100);
  // Con le spese oltre lo stipendio non c'è niente da togliere: il cuscinetto non supera mai quello che c'è.
  const cuscinetto = Math.max(0, i.disponibileLibero - rimastoMostrato);
  const mesiCoperti =
    i.stipendio > 0 ? Math.round((cuscinetto / i.stipendio) * 10) / 10 : 0;
  return { mostrato, rimasto, rimastoMostrato, eccedenza, frase: fraseEccedenza(rimasto) ?? (i.disponibileLibero < 0 ? FRASE_DISPONIBILE_NEGATIVO : null), cuscinetto, mesiCoperti };
}

export function revisioneStipendio(
  attuale: number,
  proposta: number | null,
  rivistoIl: string | null,
  oggi: string,
): string | null {
  if (proposta === null || rivistoIl === null || attuale <= 0) return null;
  if (parseISO(oggi) < addMonths(parseISO(rivistoIl), 3)) return null;
  if (Math.abs(proposta - attuale) / attuale <= 0.1) return null;
  return proposta > attuale
    ? `Negli ultimi mesi hai incassato di più: puoi alzare lo stipendio a ${euroInFrase(proposta)}`
    : `Negli ultimi mesi sono entrati meno soldi: conviene abbassare lo stipendio a ${euroInFrase(proposta)}`;
}

// Ultimo giorno del mese di `oggi`, mezzanotte locale: da usare come
// `dataTarget` di computeMargineGiornaliero.
export function fineMese(oggi: string): Date {
  return endOfMonth(parseISO(oggi));
}
