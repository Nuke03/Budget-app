export function fakeSelectClient(rows: unknown[]) {
  const builder: any = {
    select: () => builder,
    order: () => Promise.resolve({ data: rows, error: null }),
    eq: () => builder,
    single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
  };
  return { from: () => builder } as any;
}

export function fakeMutationClient(returnedRow: unknown) {
  const builder: any = {
    update: () => builder,
    insert: () => builder,
    delete: () => builder,
    eq: () => Promise.resolve({ data: null, error: null }),
    select: () => builder,
    single: () => Promise.resolve({ data: returnedRow, error: null }),
  };
  return { from: () => builder } as any;
}
