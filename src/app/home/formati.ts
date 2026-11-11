import { nomeMese } from '@/lib/format';

const DUE_DECIMALI = new Intl.NumberFormat('it-IT', {
  useGrouping: true,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// "1.240,50", senza simbolo: per le colonne del registro.
export const cifra = (n: number): string => DUE_DECIMALI.format(n);

// "11/11" da "2026-11-11".
export const giornoMese = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// "11 NOV" per il timbro.
export const giornoMeseTimbro = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${nomeMese(iso).slice(0, 3).toUpperCase()}`;

// "27 novembre"
export const giornoEMese = (iso: string): string => `${Number(iso.slice(8, 10))} ${nomeMese(iso)}`;
