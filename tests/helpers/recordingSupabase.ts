/* eslint-disable @typescript-eslint/no-explicit-any */
export interface RecordedCall {
  table: string;
  chain: { method: string; args: unknown[] }[];
}

const METHODS = [
  'select', 'insert', 'update', 'delete', 'eq', 'neq', 'is', 'in', 'gt', 'gte', 'lt', 'lte',
  'ilike', 'order', 'limit',
];

// Client finto che registra ogni catena di chiamate (una per `from`) e risolve
// sempre con le stesse righe: serve a verificare QUALI filtri una query applica.
export function createRecordingClient(rows: unknown[] = []) {
  const calls: RecordedCall[] = [];
  const client: any = {
    from(table: string) {
      const call: RecordedCall = { table, chain: [] };
      calls.push(call);
      const builder: any = {};
      for (const method of METHODS) {
        builder[method] = (...args: unknown[]) => {
          call.chain.push({ method, args });
          return builder;
        };
      }
      builder.single = (...args: unknown[]) => {
        call.chain.push({ method: 'single', args });
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      };
      builder.maybeSingle = builder.single;
      builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
        resolve({ data: rows, error: null });
      return builder;
    },
  };
  return { client, calls };
}

export function callsOf(call: RecordedCall, method: string): unknown[][] {
  return call.chain.filter((c) => c.method === method).map((c) => c.args);
}
