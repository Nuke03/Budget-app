import type { Household, HouseholdMember } from '@/lib/types';

// Chi gestisce la casa: il creatore se è ancora dentro, altrimenti il membro attivo entrato per primo.
// Null se non c'è nessun membro attivo.
export function chiGestisce(
  household: Pick<Household, 'createdBy'>,
  members: HouseholdMember[],
): string | null {
  const attivi = members.filter((m) => m.attivo);
  if (attivi.some((m) => m.userId === household.createdBy)) return household.createdBy;

  let primo: HouseholdMember | null = null;
  for (const m of attivi) {
    if (primo === null || Date.parse(m.joinedAt) < Date.parse(primo.joinedAt)) primo = m;
  }
  return primo ? primo.userId : null;
}
