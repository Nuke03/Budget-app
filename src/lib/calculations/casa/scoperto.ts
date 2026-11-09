import type { Transaction, Transfer } from '../../types';

const arrotonda = (n: number): number => Math.round(n * 100) / 100;

// Quanto resterebbe "a vuoto" se un movimento sparisse: crediti e debiti si fermano a zero, ma
// rimborsi e restituzioni già fatti restano registrati. Chi li ha ricevuti terrebbe soldi che non gli spettano.
export interface Scoperto {
  // credito: la casa ha già rimborsato `userId` più del dovuto; debito: `userId` (il creditore) ha già
  // ricevuto indietro più di quanto aveva anticipato per `controparteId`.
  tipo: 'credito' | 'debito';
  userId: string;
  controparteId: string | null;
  importo: number;
}

function creditoGrezzo(
  userId: string,
  spese: Pick<Transaction, 'tipo' | 'importo' | 'pagataDaUserId'>[],
  transfers: Transfer[],
): number {
  let totale = 0;
  for (const s of spese) if (s.tipo === 'expense' && s.pagataDaUserId === userId) totale += s.importo;
  for (const t of transfers) {
    if (t.beneficiarioUserId !== userId) continue;
    if (t.causale === 'versamento') totale += t.importo;
    else if (t.causale === 'rimborso') totale -= t.importo;
  }
  return arrotonda(totale);
}

// Eliminare una spesa pagata di tasca propria toglie quell'importo dal credito di chi l'ha anticipata.
export function scopertoEliminandoSpesa(
  spesa: Pick<Transaction, 'id' | 'tipo' | 'importo' | 'pagataDaUserId'> & { id: string },
  spese: (Pick<Transaction, 'tipo' | 'importo' | 'pagataDaUserId'> & { id: string })[],
  transfers: Transfer[],
): Scoperto | null {
  const chi = spesa.pagataDaUserId;
  if (spesa.tipo !== 'expense' || !chi) return null;
  const prima = creditoGrezzo(chi, spese, transfers);
  const dopo = creditoGrezzo(
    chi,
    spese.filter((s) => s.id !== spesa.id),
    transfers,
  );
  const importo = arrotonda(Math.max(0, -dopo) - Math.max(0, -prima));
  return importo > 0 ? { tipo: 'credito', userId: chi, controparteId: null, importo } : null;
}

function restituitoDalDebitore(creditoreId: string, debitoreId: string, transfers: Transfer[]): number {
  let r = 0;
  for (const t of transfers) {
    if (t.causale === 'versamento') {
      if (!t.perContoDiUserId && t.userId === debitoreId && t.beneficiarioUserId === creditoreId) r += t.importo;
    } else if (t.causale === 'restituzione' && t.beneficiarioUserId) {
      if (!t.perContoDiUserId) {
        if (t.userId === debitoreId && t.beneficiarioUserId === creditoreId) r += t.importo;
      } else if (t.beneficiarioUserId === t.userId && t.userId === creditoreId && t.perContoDiUserId === debitoreId) {
        r += t.importo;
      }
    }
  }
  return r;
}

// Annullare un versamento fatto per conto di un altro toglie quell'importo dal debito verso chi l'ha anticipato.
export function scopertoAnnullandoVersamento(m: Transfer, transfers: Transfer[]): Scoperto | null {
  if (m.causale !== 'versamento' || !m.perContoDiUserId) return null;
  const creditoreId = m.userId;
  const debitoreId = m.perContoDiUserId;
  const prestato = transfers
    .filter((t) => t.causale === 'versamento' && t.userId === creditoreId && t.perContoDiUserId === debitoreId)
    .reduce((s, t) => s + t.importo, 0);
  const restituito = restituitoDalDebitore(creditoreId, debitoreId, transfers);
  const prima = arrotonda(prestato - restituito);
  const dopo = arrotonda(prestato - m.importo - restituito);
  const importo = arrotonda(Math.max(0, -dopo) - Math.max(0, -prima));
  return importo > 0 ? { tipo: 'debito', userId: debitoreId, controparteId: creditoreId, importo } : null;
}
