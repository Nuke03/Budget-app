/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, unknown>;
type RpcResult = { data?: unknown; error?: { message: string } | null };

export interface FakeDbOptions {
  userId: string;
  // householdId -> userId dei membri
  membri?: Record<string, string[]>;
}

// Solo queste tabelle imitano la RLS di Postgres (riga personale visibile al
// proprietario, riga di casa visibile ai membri). Le altre sono filtrate solo
// dai filtri della query stessa.
const TABELLE_CON_RLS = new Set(['accounts', 'categories', 'budget_goals', 'transactions', 'transfers']);

function valore(row: Row, col: string): unknown {
  const v = row[col];
  return v === undefined ? null : v;
}

function confronta(a: unknown, b: unknown): number {
  if (a === b) return 0;
  return (a as number | string) < (b as number | string) ? -1 : 1;
}

function ilikeRegex(pattern: string): RegExp {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${esc}$`, 'i');
}

export function createFakeDb(seed: Record<string, Row[]>, opts: FakeDbOptions) {
  const tables: Record<string, Row[]> = {};
  for (const [nome, rows] of Object.entries(seed)) tables[nome] = rows.map((r) => ({ ...r }));
  const handlers = new Map<string, (args: any) => RpcResult>();
  const rpcCalls: { name: string; args: unknown }[] = [];
  let contatore = 0;

  const tabella = (nome: string) => (tables[nome] ??= []);

  function visibile(nome: string, row: Row): boolean {
    if (!TABELLE_CON_RLS.has(nome)) return true;
    const h = valore(row, 'household_id');
    if (h === null) return row.user_id === opts.userId;
    return (opts.membri?.[h as string] ?? []).includes(opts.userId);
  }

  function from(nome: string) {
    let modo: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row | Row[] = {};
    const filtri: ((r: Row) => boolean)[] = [];
    const ordine: { col: string; asc: boolean }[] = [];
    let limite: number | null = null;
    let inizio = 0;
    let eseguita: Row[] | null = null;

    function esegui(): { data: Row[]; error: null } {
      if (eseguita) return { data: eseguita, error: null };
      const righe = tabella(nome);
      const corrispondenti = () => righe.filter((r) => visibile(nome, r) && filtri.every((f) => f(r)));
      if (modo === 'insert') {
        const nuove = (Array.isArray(payload) ? payload : [payload]).map((p) => {
          const riga: Row = { ...p };
          if (riga.id === undefined) riga.id = `${nome}-${++contatore}`;
          if (TABELLE_CON_RLS.has(nome)) {
            if (riga.user_id === undefined) riga.user_id = opts.userId;
            if (riga.household_id === undefined) riga.household_id = null;
          }
          return riga;
        });
        righe.push(...nuove);
        eseguita = nuove;
        return { data: nuove, error: null };
      }
      if (modo === 'update') {
        const toccate = corrispondenti();
        for (const r of toccate) Object.assign(r, payload);
        eseguita = toccate;
        return { data: toccate, error: null };
      }
      if (modo === 'delete') {
        const toccate = corrispondenti();
        tables[nome] = righe.filter((r) => !toccate.includes(r));
        eseguita = toccate;
        return { data: toccate, error: null };
      }
      let out = corrispondenti();
      for (const { col, asc } of [...ordine].reverse()) {
        out = [...out].sort((a, b) => (asc ? 1 : -1) * confronta(valore(a, col), valore(b, col)));
      }
      out = out.slice(inizio, limite === null ? undefined : inizio + limite);
      eseguita = out;
      return { data: out, error: null };
    }

    const nonNullo = (r: Row, c: string) => valore(r, c) !== null;
    const builder: any = {
      select: () => builder,
      insert: (p: Row | Row[]) => {
        modo = 'insert';
        payload = p;
        return builder;
      },
      update: (p: Row) => {
        modo = 'update';
        payload = p;
        return builder;
      },
      delete: () => {
        modo = 'delete';
        return builder;
      },
      eq: (c: string, v: unknown) => (filtri.push((r) => valore(r, c) === v), builder),
      neq: (c: string, v: unknown) => (filtri.push((r) => nonNullo(r, c) && valore(r, c) !== v), builder),
      is: (c: string, v: unknown) => (filtri.push((r) => valore(r, c) === v), builder),
      in: (c: string, v: unknown[]) => (filtri.push((r) => v.includes(valore(r, c))), builder),
      gt: (c: string, v: unknown) => (filtri.push((r) => nonNullo(r, c) && confronta(valore(r, c), v) > 0), builder),
      gte: (c: string, v: unknown) => (filtri.push((r) => nonNullo(r, c) && confronta(valore(r, c), v) >= 0), builder),
      lt: (c: string, v: unknown) => (filtri.push((r) => nonNullo(r, c) && confronta(valore(r, c), v) < 0), builder),
      lte: (c: string, v: unknown) => (filtri.push((r) => nonNullo(r, c) && confronta(valore(r, c), v) <= 0), builder),
      ilike: (c: string, v: string) => {
        const re = ilikeRegex(v);
        filtri.push((r) => typeof valore(r, c) === 'string' && re.test(valore(r, c) as string));
        return builder;
      },
      order: (col: string, o?: { ascending?: boolean }) => {
        ordine.push({ col, asc: o?.ascending ?? true });
        return builder;
      },
      limit: (n: number) => {
        limite = n;
        return builder;
      },
      // Come PostgREST: estremi inclusi.
      range: (da: number, a: number) => {
        inizio = da;
        limite = a - da + 1;
        return builder;
      },
      not: (c: string, op: string, v: unknown) => {
        if (op !== 'is' || v !== null) throw new Error(`fakeDb: not(${op}) non supportato`);
        filtri.push((r) => nonNullo(r, c));
        return builder;
      },
      single: () => {
        const { data } = esegui();
        if (data.length !== 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'JSON object requested, multiple (or no) rows returned' },
          });
        }
        return Promise.resolve({ data: data[0], error: null });
      },
      maybeSingle: () => Promise.resolve({ data: esegui().data[0] ?? null, error: null }),
      // Come il query builder reale, la query è "thenable": awaitarla la esegue.
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(esegui()).then(resolve, reject),
    };
    return builder;
  }

  const client: any = {
    from,
    rpc(name: string, args?: unknown) {
      rpcCalls.push({ name, args });
      const h = handlers.get(name);
      if (!h) return Promise.resolve({ data: null, error: { message: `rpc non registrata: ${name}` } });
      const r = h(args);
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
    },
  };

  return {
    client,
    get tables() {
      return tables;
    },
    registerRpc(name: string, handler: (args: any) => RpcResult) {
      handlers.set(name, handler);
    },
    rpcCalls,
  };
}
