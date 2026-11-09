import { debitoVersoMembri, type DebitoMembro } from './debitiMembri';
import { riservaDaRighe, type RigaMese } from './versamenti';

// Quello che il disponibile personale deve mettere da parte per la casa: i versamenti dei mesi che
// mancano (dall'inizio del mese, finché non si registrano) e quanto si deve ad altri membri.
export function riservaPersonale(input: {
  righe: RigaMese[];
  userId: string;
  debiti: DebitoMembro[];
}): { riservaVersamento: number; riservaDebiti: number } {
  return {
    riservaVersamento: riservaDaRighe(input.righe),
    riservaDebiti: debitoVersoMembri(input.userId, input.debiti),
  };
}
