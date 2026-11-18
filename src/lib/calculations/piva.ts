import { differenceInCalendarYears, parseISO } from 'date-fns';
import type { PivaAccantonamento, PivaSettings, Transaction } from '../types';

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

export function computePercentualeIncasso(
  coefficiente: number,
  aliquotaSostitutiva: number,
  soggettivo: number,
  integrativo: number
): number {
  const valore = (coefficiente * (aliquotaSostitutiva + soggettivo)) / 100 + integrativo;
  return Math.round(valore * 10) / 10;
}

export function computeQuotaIncasso(importo: number, percentuale: number): number {
  return Math.round((importo * percentuale) / 100);
}

export function computeStimaAnno(
  settings: PivaSettings,
  fatturato: number,
  oggi: Date
): { imposta: number; soggettivo: number; integrativo: number; totale: number } {
  const reddito = computeRedditoImponibile(
    fatturato,
    settings.coefficienteRedditivita,
    settings.contributiVersatiAnnoPrecedente
  );
  const aliquota = computeAliquotaSostitutiva(
    settings.dataApertura,
    oggi,
    settings.aliquotaSostitutivaOverride
  );
  const imposta = computeImpostaSostitutiva(reddito, aliquota);
  const soggettivo = computeContributoSoggettivo(
    reddito,
    settings.aliquotaContributoSoggettivo,
    settings.minimaleContributivoAnnuo
  );
  const integrativo = computeContributoIntegrativo(fatturato, settings.aliquotaContributoIntegrativo);
  return {
    imposta,
    soggettivo,
    integrativo,
    totale: computeTotaleDaAccantonare(imposta, soggettivo, integrativo),
  };
}

// Se il contributo soggettivo della stima è salito al minimale della cassa (la percentuale darebbe meno),
// di quanti euro manca per arrivarci. null: la percentuale supera il minimo, o non c'è nulla da aggiungere.
export function differenzaMinimale(settings: PivaSettings, fatturato: number): number | null {
  const reddito = computeRedditoImponibile(
    fatturato,
    settings.coefficienteRedditivita,
    settings.contributiVersatiAnnoPrecedente
  );
  const daPercentuale = (reddito * settings.aliquotaContributoSoggettivo) / 100;
  const differenza = Math.round(settings.minimaleContributivoAnnuo - daPercentuale);
  return daPercentuale < settings.minimaleContributivoAnnuo && differenza > 0 ? differenza : null;
}

export function confrontoAnno(
  stimaTotale: number,
  messoDaParte: number
): { servono: number; messi: number; mancano: number } {
  return {
    servono: stimaTotale,
    messi: messoDaParte,
    mancano: Math.max(0, stimaTotale - messoDaParte),
  };
}

export interface QuotaInSospeso {
  transactionId: string;
  importo: number;
  quota: number;
}

export function quoteInSospeso(
  incassi: Transaction[],
  accantonamenti: PivaAccantonamento[],
  percentuale: number,
  categoriaFatturatoId: string,
  guidataDal: string | null
): QuotaInSospeso[] {
  if (guidataDal === null) return [];
  const gestiti = new Set(
    accantonamenti.map((a) => a.transactionId).filter((id): id is string => id !== null)
  );
  return incassi
    .filter(
      (t) =>
        t.tipo === 'income' &&
        t.categoriaId === categoriaFatturatoId &&
        t.data >= guidataDal &&
        !gestiti.has(t.id)
    )
    .map((t) => ({
      transactionId: t.id,
      importo: t.importo,
      quota: computeQuotaIncasso(t.importo, percentuale),
    }))
    // Una quota di 0 euro non c'è da spostare: non finisce in lista né nel totale.
    .filter((q) => q.quota > 0);
}

export function totaleInSospeso(q: QuotaInSospeso[]): number {
  return q.reduce((sum, x) => sum + x.quota, 0);
}
