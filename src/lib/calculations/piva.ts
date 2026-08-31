import { differenceInCalendarYears, parseISO } from 'date-fns';
import type { Transaction } from '../types';

export function computeFatturatoAnnuo(
  transactions: Transaction[],
  categoriaFatturatoId: string,
  anno: number
): number {
  return transactions
    .filter(
      (t) =>
        t.tipo === 'income' &&
        t.categoriaId === categoriaFatturatoId &&
        parseISO(t.data).getFullYear() === anno
    )
    .reduce((sum, t) => sum + t.importo, 0);
}

export function computeAliquotaSostitutiva(
  dataApertura: string | null,
  today: Date,
  override: number | null
): number {
  if (override !== null) return override;
  if (!dataApertura) return 15;

  const anniAttivita = differenceInCalendarYears(today, parseISO(dataApertura));
  return anniAttivita < 5 ? 5 : 15;
}

export function computeRedditoImponibile(
  fatturato: number,
  coefficienteRedditivita: number,
  contributiVersatiAnnoPrecedente: number
): number {
  const redditoLordo = (fatturato * coefficienteRedditivita) / 100;
  return Math.max(0, redditoLordo - contributiVersatiAnnoPrecedente);
}

export function computeImpostaSostitutiva(redditoImponibile: number, aliquota: number): number {
  return (redditoImponibile * aliquota) / 100;
}

export function computeContributoSoggettivo(
  redditoImponibile: number,
  aliquotaContributoSoggettivo: number,
  minimaleContributivoAnnuo: number
): number {
  return Math.max(
    (redditoImponibile * aliquotaContributoSoggettivo) / 100,
    minimaleContributivoAnnuo
  );
}

export function computeContributoIntegrativo(
  fatturato: number,
  aliquotaContributoIntegrativo: number
): number {
  return (fatturato * aliquotaContributoIntegrativo) / 100;
}

export function computeTotaleDaAccantonare(
  impostaSostitutiva: number,
  contributoSoggettivo: number,
  contributoIntegrativo: number
): number {
  return impostaSostitutiva + contributoSoggettivo + contributoIntegrativo;
}

export function computeQuotaMensileSuggerita(totale: number, today: Date): number {
  const mesiRimanenti = 12 - today.getMonth();
  return totale / mesiRimanenti;
}
