import type { PlanBundle } from '../../data/householdPlans';
import type { Transaction, Transfer } from '../../types';
import { creditiPerMembro } from './crediti';
import { debitiMembri, type DebitoMembro } from './debitiMembri';
import { righeVersamento, type RigaMese } from './versamenti';

export interface RegistriCasa {
  righe: Record<string, RigaMese[]>;
  crediti: Record<string, number>;
  debiti: DebitoMembro[];
}

// I tre registri della casa, calcolati una volta sola da righe già lette: le quote mese per mese,
// i crediti verso la casa e i debiti fra membri.
export function calcolaRegistriCasa(input: {
  piani: PlanBundle[];
  trasferimenti: Transfer[];
  spese: Pick<Transaction, 'tipo' | 'importo' | 'pagataDaUserId'>[];
  membri: { userId: string; joinedAt: string; attivo?: boolean }[];
  oggi: string;
}): RegistriCasa {
  const { piani, trasferimenti, spese, membri, oggi } = input;
  const attivi = membri.filter((m) => m.attivo !== false);
  const righe: Record<string, RigaMese[]> = {};
  for (const m of attivi) {
    righe[m.userId] = righeVersamento({ userId: m.userId, oggi, piani, membri: attivi, transfers: trasferimenti });
  }
  return {
    righe,
    crediti: creditiPerMembro(
      membri.map((m) => m.userId),
      spese,
      trasferimenti,
    ),
    debiti: debitiMembri(trasferimenti),
  };
}
