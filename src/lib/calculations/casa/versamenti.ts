import type { Transfer } from '../../types';
import type { PlanBundle } from '../../data/householdPlans';
import { meseRomaISO } from './oggi';

export interface RigaMese {
  mese: string;
  atteso: number;
  versato: number;
  mancano: number;
}

const arrotonda = (n: number): number => Math.round(n * 100) / 100;

function meseSuccessivo(mese: string): string {
  const anno = Number(mese.slice(0, 4));
  const m = Number(mese.slice(5, 7));
  return m === 12 ? `${anno + 1}-01-01` : `${anno}-${String(m + 1).padStart(2, '0')}-01`;
}

// Le quote mensili che un membro avrebbe dovuto versare, mese per mese, e quanto ha versato davvero.
// Rispecchia _casa_arretrati.
export function righeVersamento(input: {
  userId: string;
  oggi: string;
  piani: PlanBundle[];
  membri: { userId: string; joinedAt: string }[];
  transfers: Transfer[];
}): RigaMese[] {
  const { userId, oggi, membri, transfers } = input;
  const piani = [...input.piani].sort((a, b) => a.plan.validoDal.localeCompare(b.plan.validoDal));
  if (piani.length === 0) return [];

  const meseOggi = meseRomaISO(new Date(`${oggi}T12:00:00Z`));
  const meseDi = (iso: string): string => meseRomaISO(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
  const entratoDopo = (id: string | null, mese: string): boolean => {
    if (!id) return false;
    const m = membri.find((x) => x.userId === id);
    return !!m && meseRomaISO(new Date(m.joinedAt)) > mese;
  };

  const righe: RigaMese[] = [];
  for (let mese = meseDi(piani[0].plan.validoDal); mese <= meseOggi; mese = meseSuccessivo(mese)) {
    let piano: PlanBundle | null = null;
    for (const p of piani) if (p.plan.validoDal <= mese) piano = p;
    if (!piano) continue;

    const attivo = !piano.shares.some(
      (s) =>
        s.quotaMensile > 0 &&
        (s.esceDal === null || s.esceDal > mese) &&
        (s.userId === null || entratoDopo(s.userId, mese)),
    );
    if (!attivo) continue;

    const quota = piano.shares.find((s) => s.userId === userId);
    if (!quota) continue;
    if (quota.inCasaDal !== null && meseDi(quota.inCasaDal) > mese) continue;
    if (quota.esceDal !== null && quota.esceDal <= mese) continue;
    if (entratoDopo(userId, mese)) continue;

    const versato = transfers
      .filter(
        (t) =>
          t.causale === 'versamento' &&
          t.meseCompetenza === mese &&
          ((t.userId === userId && !t.perContoDiUserId && !t.beneficiarioUserId) || t.perContoDiUserId === userId),
      )
      .reduce((s, t) => s + t.importo, 0);
    const atteso = quota.quotaMensile;
    righe.push({ mese, atteso, versato: arrotonda(versato), mancano: Math.max(0, arrotonda(atteso - versato)) });
  }
  return righe;
}

export function riservaDaRighe(righe: RigaMese[]): number {
  return arrotonda(righe.reduce((s, r) => s + r.mancano, 0));
}
