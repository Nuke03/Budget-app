import type { Transfer } from '../../types';

export interface DebitoMembro {
  debitoreId: string;
  creditoreId: string;
  importo: number;
  // importo: il residuo della voce; versato: quanto il creditore aveva coperto con quella voce.
  // Un mese può avere due voci: origine 'tricount' è il saldo di partenza, l'altra è la quota versata.
  mesi: { mese: string; importo: number; versato: number; origine?: 'tricount' }[];
}

const arrotonda = (n: number): number => Math.round(n * 100) / 100;
const primoDelMese = (iso: string): string => `${iso.slice(0, 7)}-01`;

// I debiti fra membri: chi ha versato per conto di un altro ha prestato, il debitore restituisce con una
// restituzione, con un proprio versamento a favore del creditore, o il creditore rinuncia.
// Il restituito copre prima la voce più vecchia (a parità di mese, Tricount). Solo le coppie con un residuo.
export function debitiMembri(transfers: Transfer[]): DebitoMembro[] {
  const coppie = new Map<string, { debitoreId: string; creditoreId: string; prestato: Map<string, number>; daTricount: Map<string, number>; restituito: number }>();
  const coppia = (creditoreId: string, debitoreId: string) => {
    const chiave = `${creditoreId}>${debitoreId}`;
    let c = coppie.get(chiave);
    if (!c) {
      c = { debitoreId, creditoreId, prestato: new Map(), daTricount: new Map(), restituito: 0 };
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
    } else if (t.causale === 'saldo_iniziale') {
      // il debito che i due portano da Tricount: prestato dal creditore (beneficiario) al debitore, nel mese di data
      if (t.beneficiarioUserId && t.perContoDiUserId) {
        const c = coppia(t.beneficiarioUserId, t.perContoDiUserId);
        const mese = primoDelMese(t.data);
        c.prestato.set(mese, (c.prestato.get(mese) ?? 0) + t.importo);
        c.daTricount.set(mese, (c.daTricount.get(mese) ?? 0) + t.importo);
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
    // Per mese due voci: il saldo da Tricount e la quota versata per conto dell'altro.
    const voci: { mese: string; importo: number; tricount: boolean }[] = [];
    for (const [mese, importo] of c.prestato) {
      const daTricount = arrotonda(c.daTricount.get(mese) ?? 0);
      const quota = arrotonda(importo - daTricount);
      if (daTricount > 0) voci.push({ mese, importo: daTricount, tricount: true });
      if (quota > 0) voci.push({ mese, importo: quota, tricount: false });
    }
    // Il restituito copre prima il mese più vecchio; a parità, prima Tricount.
    voci.sort((x, y) => x.mese.localeCompare(y.mese) || Number(y.tricount) - Number(x.tricount));
    const totale = arrotonda(voci.reduce((sum, v) => sum + v.importo, 0) - c.restituito);
    if (totale <= 0) continue;
    let daCoprire = c.restituito;
    const mesi: DebitoMembro['mesi'] = [];
    for (const v of voci) {
      const coperto = Math.min(v.importo, daCoprire);
      daCoprire -= coperto;
      const residuo = arrotonda(v.importo - coperto);
      if (residuo <= 0) continue;
      mesi.push({ mese: v.mese, importo: residuo, versato: arrotonda(v.importo), ...(v.tricount ? { origine: 'tricount' as const } : {}) });
    }
    out.push({ debitoreId: c.debitoreId, creditoreId: c.creditoreId, importo: totale, mesi });
  }
  return out;
}

export function debitoVersoMembri(userId: string, debiti: DebitoMembro[]): number {
  return arrotonda(debiti.filter((d) => d.debitoreId === userId).reduce((s, d) => s + d.importo, 0));
}

// Da dove viene un debito, in poche parole: "quota di novembre", "saldo di partenza da Tricount" o entrambi.
export function descriviOrigineDebito(
  mesi: DebitoMembro['mesi'],
  elencoMesi: (mesi: string[]) => string,
): string {
  const quote = mesi.filter((m) => m.origine !== 'tricount').map((m) => m.mese);
  const haTricount = mesi.some((m) => m.origine === 'tricount');
  if (!haTricount) return `quota di ${elencoMesi(quote)}`;
  if (quote.length === 0) return 'saldo di partenza da Tricount';
  return `quota di ${elencoMesi(quote)} e saldo di partenza da Tricount`;
}
