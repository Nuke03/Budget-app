import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Transaction, Transfer } from '../../types';

// Un movimento fra i soldi personali e la casa: non è una spesa né un'entrata,
// quindi nello storico personale sta fuori da totali, grafici e P.IVA.
export interface RigaNeutra {
  id: string;
  data: string;
  etichetta: string;
  importo: number;
  verso: 'esce' | 'entra';
}

function meseIt(iso: string | null): string {
  if (!iso) return '';
  return format(parseISO(`${iso.slice(0, 7)}-01`), 'LLLL', { locale: it }).toLowerCase();
}

function rigaDaTrasferimento(
  t: Transfer,
  userId: string,
  nomi: Record<string, string>
): RigaNeutra | null {
  const nome = (id: string | null): string => (id ? nomi[id] ?? 'un membro' : 'un membro');
  const base = { id: `tr-${t.id}`, data: t.data, importo: t.importo };

  if (t.causale === 'versamento') {
    if (t.userId !== userId) return null;
    const mese = meseIt(t.meseCompetenza);
    let etichetta = `Versamento alla casa${mese ? `, ${mese}` : ''}`;
    if (t.perContoDiUserId) {
      etichetta = `Versamento alla casa per conto di ${nome(t.perContoDiUserId)}${mese ? `, ${mese}` : ''}`;
    } else if (t.beneficiarioUserId) {
      etichetta = `Versamento alla casa a favore di ${nome(t.beneficiarioUserId)}`;
    }
    return { ...base, etichetta, verso: 'esce' };
  }

  if (t.causale === 'rimborso') {
    if (t.beneficiarioUserId !== userId || t.soloRegistrazione || !t.aAccountId) return null;
    return { ...base, etichetta: 'Rimborso dalla casa', verso: 'entra' };
  }

  if (t.causale === 'restituzione') {
    if (t.soloRegistrazione) return null;
    if (t.userId === userId && !t.perContoDiUserId) {
      return { ...base, etichetta: `Restituzione a ${nome(t.beneficiarioUserId)}`, verso: 'esce' };
    }
    if (t.beneficiarioUserId === userId && !t.perContoDiUserId) {
      return { ...base, etichetta: `Restituzione da ${nome(t.userId)}`, verso: 'entra' };
    }
  }
  return null;
}

export function righeNeutreStorico(input: {
  userId: string;
  transazioni: Transaction[];
  trasferimenti: Transfer[];
  nomi: Record<string, string>;
}): RigaNeutra[] {
  const righe: RigaNeutra[] = [];
  for (const t of input.trasferimenti) {
    const r = rigaDaTrasferimento(t, input.userId, input.nomi);
    if (r) righe.push(r);
  }
  for (const t of input.transazioni) {
    if (t.tipo === 'expense' && t.pagataDaUserId === input.userId) {
      righe.push({
        id: `tx-${t.id}`,
        data: t.data,
        etichetta: `Spesa di casa pagata da te: ${t.descrizione}`,
        importo: t.importo,
        verso: 'esce',
      });
    }
  }
  return righe.sort((a, b) => b.data.localeCompare(a.data));
}
