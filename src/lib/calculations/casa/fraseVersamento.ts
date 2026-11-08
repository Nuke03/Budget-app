import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatNumero } from '@/lib/format';
import type { PlanShare } from '@/lib/types';
import { nomiMancanti, statoPiano } from './statoPiano';

// L'unica frase che dice chi versa quanto: la usano il wizard e la pagina del piano.
export function fraseVersamento(input: {
  quote: { nome: string; quota: number }[];
  giorno: number;
  da?: string;
}): string {
  const chiPaga = input.quote.filter((q) => q.quota > 0);
  if (chiPaga.length === 0) return 'Nessun versamento in questo periodo.';

  const euro = (n: number) => `${formatNumero(n)} euro`;
  const tutteUguali = chiPaga.length > 1 && chiPaga.every((q) => q.quota === chiPaga[0].quota);
  if (tutteUguali) {
    return `Ognuno versa ${euro(chiPaga[0].quota)} entro il ${input.giorno} di ogni mese.`;
  }

  const pezzi = chiPaga.map((q, i) => (i === 0 ? `${q.nome} versa ${euro(q.quota)}` : `${q.nome} ${euro(q.quota)}`));
  const elenco = pezzi.length === 1 ? pezzi[0] : `${pezzi.slice(0, -1).join(', ')} e ${pezzi[pezzi.length - 1]}`;
  const da = input.da ? `, da ${format(parseISO(input.da), 'LLLL', { locale: it })}` : '';
  return `${elenco}, entro il ${input.giorno} di ogni mese${da}.`;
}

// Stato di bozza: lo stesso testo ovunque. Null quando non manca nessuno.
export function fraseBozza(nomiMancanti: string[]): string | null {
  if (nomiMancanti.length === 0) return null;
  if (nomiMancanti.length === 1) return `Diventa attivo quando entra anche ${nomiMancanti[0]}`;
  const ultimo = nomiMancanti[nomiMancanti.length - 1];
  return `Diventa attivo quando entrano anche ${nomiMancanti.slice(0, -1).join(', ')} e ${ultimo}`;
}

// Lo stato di un piano (bozza o attivo) e la frase che lo spiega: unico punto per tutte le schermate.
export function descriviStatoPiano(
  shares: Pick<PlanShare, 'quotaMensile' | 'userId' | 'esceDal' | 'displayName'>[],
): { stato: 'bozza' | 'attivo'; nomiMancanti: string[]; frase: string | null } {
  const mancanti = nomiMancanti(shares);
  return { stato: statoPiano(shares), nomiMancanti: mancanti, frase: fraseBozza(mancanti) };
}
