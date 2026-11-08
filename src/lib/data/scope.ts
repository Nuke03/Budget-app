// Ogni lettura di conti, categorie, obiettivi e transazioni passa da uno scope:
// `personale` (righe senza casa, il comportamento di sempre) oppure `casa`
// (righe della casa condivisa). Il default è sempre PERSONALE, così le
// schermate esistenti non vedono mai righe di casa.
export type Scope = { kind: 'personale' } | { kind: 'casa'; householdId: string };

export const PERSONALE: Scope = { kind: 'personale' };

export function casa(householdId: string): Scope {
  return { kind: 'casa', householdId };
}

export function scopeHouseholdId(scope: Scope): string | null {
  return scope.kind === 'casa' ? scope.householdId : null;
}

// Il vincolo generico `Q extends { is(): Q; eq(): Q }` manda in loop il
// compilatore sul query builder di Supabase (TS2589), quindi Q resta libero e
// la forma minima richiesta (is/eq) viene applicata solo qui dentro.
interface Filterable {
  is(c: string, v: null): unknown;
  eq(c: string, v: string): unknown;
}

export function applyScope<Q>(query: Q, scope: Scope): Q {
  const q = query as unknown as Filterable;
  return (
    scope.kind === 'casa' ? q.eq('household_id', scope.householdId) : q.is('household_id', null)
  ) as Q;
}
