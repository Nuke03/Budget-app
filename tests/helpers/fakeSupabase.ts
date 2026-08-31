export function fakeSelectClient(rows: unknown[]) {
  const builder: any = {
    select: () => builder,
    order: () => Promise.resolve({ data: rows, error: null }),
    eq: () => builder,
    single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    limit: () => builder,
  };
  return { from: () => builder } as any;
}

export function fakeMutationClient(returnedRow: unknown) {
  const builder: any = {
    update: () => builder,
    insert: () => builder,
    delete: () => builder,
    eq: () => eqResult,
    select: () => builder,
    single: () => Promise.resolve({ data: returnedRow, error: null }),
  };
  // `.eq()` on a real Supabase query builder is both awaitable directly
  // (resolves like the old fake did, `{ data: null, error: null }`, for
  // callers that stop the chain right there) and further chainable with
  // `.select().single()` for callers that want the row back.
  const eqResult: any = {
    ...builder,
    then: (resolve: (value: { data: null; error: null }) => void) =>
      resolve({ data: null, error: null }),
  };
  return { from: () => builder } as any;
}
