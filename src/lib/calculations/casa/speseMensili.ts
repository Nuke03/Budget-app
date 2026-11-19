// Una sola regola per le spese collegate a un fondo, usata dal disponibile della Casa e dal check-in.
// Una spesa collegata a un obiettivo conta nel mese solo se l'obiettivo è quello di una voce mensile:
// i fondi di una tantum e quelli delle bollette non mensili sono già messi da parte.

export interface VoceConObiettivo {
  frequenzaMesi: number;
  goalId?: string | null;
}

// Gli obiettivi collegati alle voci mensili, aperti o chiusi.
export function obiettiviDelleVociMensili(voci: VoceConObiettivo[]): Set<string> {
  const ids = new Set<string>();
  for (const v of voci) if (v.frequenzaMesi === 1 && v.goalId) ids.add(v.goalId);
  return ids;
}

export function spesaContaNelMensile(spesa: { goalId?: string | null }, obiettiviMensili: Set<string>): boolean {
  return !spesa.goalId || obiettiviMensili.has(spesa.goalId);
}
