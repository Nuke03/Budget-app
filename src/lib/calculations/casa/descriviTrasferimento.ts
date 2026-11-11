import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Transfer } from '../../types';

function meseIt(iso: string | null): string | null {
  if (!iso) return null;
  return format(parseISO(`${iso.slice(0, 7)}-01`), 'LLLL', { locale: it }).toLowerCase();
}

// Come si racconta un movimento fra membri: un titolo breve e, se serve, un dettaglio.
export function descriviTrasferimento(
  t: Transfer,
  nomi: Record<string, string>,
): { titolo: string; dettaglio: string | null } {
  const nome = (id: string | null): string => (id ? nomi[id] ?? 'un membro' : 'un membro');
  const autore = nome(t.userId);
  const mese = meseIt(t.meseCompetenza);

  if (t.causale === 'versamento') {
    const titolo = t.beneficiarioUserId
      ? `Versamento di ${autore} a favore di ${nome(t.beneficiarioUserId)}`
      : `Versamento di ${autore}`;
    const dettaglio = t.perContoDiUserId
      ? `per conto di ${nome(t.perContoDiUserId)}${mese ? `, ${mese}` : ''}`
      : mese;
    return { titolo, dettaglio };
  }

  if (t.causale === 'rimborso') {
    if (t.soloRegistrazione && t.beneficiarioUserId === t.userId) {
      return { titolo: `${autore} rinuncia a un rimborso`, dettaglio: null };
    }
    return { titolo: `Rimborso a ${nome(t.beneficiarioUserId ?? t.userId)}`, dettaglio: null };
  }

  if (t.causale === 'restituzione') {
    if (t.perContoDiUserId) {
      return { titolo: `${autore} rinuncia a una restituzione di ${nome(t.perContoDiUserId)}`, dettaglio: null };
    }
    return { titolo: `Restituzione di ${autore} a ${nome(t.beneficiarioUserId)}`, dettaglio: null };
  }

  if (t.causale === 'saldo_iniziale') {
    return {
      titolo: 'Saldo di partenza da Tricount',
      dettaglio: `${nome(t.perContoDiUserId)} deve a ${nome(t.beneficiarioUserId)}`,
    };
  }

  return { titolo: 'Movimento fra membri', dettaglio: null };
}
