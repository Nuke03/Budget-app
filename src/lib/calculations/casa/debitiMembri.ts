import type { Transfer } from '../../types';

export interface DebitoMembro {
  debitoreId: string;
  creditoreId: string;
  importo: number;
  // importo: il residuo del mese; versato: quanto il creditore aveva coperto in quel mese.
  mesi: { mese: string; importo: number; versato: number }[];
}

const arrotonda = (n: number): number => Math.round(n * 100) / 100;
const primoDelMese = (iso: string): string => `${iso.slice(0, 7)}-01`;

// I debiti fra membri: chi ha versato per conto di un altro ha prestato, il debitore restituisce con una
// restituzione, con un proprio versamento a favore del creditore, o il creditore rinuncia.
// Il restituito copre prima il mese più vecchio. Solo le coppie con un residuo.
export function debitiMembri(transfers: Transfer[]): DebitoMembro[] {
  const coppie = new Map<string, { debitoreId: string; creditoreId: string; prestato: Map<string, number>; restituito: number }>();
  const coppia = (creditoreId: string, debitoreId: string) => {
    const chiave = `${creditoreId}>${debitoreId}`;
    let c = coppie.get(chiave);
    if (!c) {
      c = { debitoreId, creditoreId, prestato: new Map(), restituito: 0 };
      coppie.set(chiave, c);
    }
    return c;
  };

  for (const t of transfers) {
    if (t.causale === 'versamento') {
      if (t.perContoDiUserId) {
        const c = coppia(t.userId, t.perContoDiUserId);
        const mese = primoDelMese(t.meseCompetenza ?? t.data);
        c.prestato.set(mese, (c.prestato.get(mese) ?? 0) + t.importo);
      } else if (t.beneficiarioUserId && t.beneficiarioUserId !== t.userId) {
        coppia(t.beneficiarioUserId, t.userId).restituito += t.importo;
      }
    } else if (t.causale === 'restituzione' && t.beneficiarioUserId) {
      if (!t.perContoDiUserId) {
        if (t.beneficiarioUserId !== t.userId) coppia(t.beneficiarioUserId, t.userId).restituito += t.importo;
      } else if (t.beneficiarioUserId === t.userId) {
        // rinuncia del creditore
        coppia(t.userId, t.perContoDiUserId).restituito += t.importo;
      }
    }
  }

  const out: DebitoMembro[] = [];
  for (const c of coppie.values()) {
    const prestato = [...c.prestato.entries()].sort(([a], [b]) => a.localeCompare(b));
    const totale = arrotonda(prestato.reduce((s, [, v]) => s + v, 0) - c.restituito);
    if (totale <= 0) continue;
    let daCoprire = c.restituito;
    const mesi: DebitoMembro['mesi'] = [];
    for (const [mese, importo] of prestato) {
      const coperto = Math.min(importo, daCoprire);
      daCoprire -= coperto;
      const residuo = arrotonda(importo - coperto);
      if (residuo > 0) mesi.push({ mese, importo: residuo, versato: arrotonda(importo) });
    }
    out.push({ debitoreId: c.debitoreId, creditoreId: c.creditoreId, importo: totale, mesi });
  }
  return out;
}

export function debitoVersoMembri(userId: string, debiti: DebitoMembro[]): number {
  return arrotonda(debiti.filter((d) => d.debitoreId === userId).reduce((s, d) => s + d.importo, 0));
}
