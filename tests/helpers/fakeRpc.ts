/* eslint-disable @typescript-eslint/no-explicit-any */
type RpcResponse = { data?: unknown; error?: { message: string } | null };

// Client finto con la sola `rpc`: risponde con le risposte date per nome e
// registra ogni chiamata. Una rpc non prevista risponde con un errore.
export function fakeRpcClient(responses: Record<string, RpcResponse> = {}) {
  const calls: { name: string; args: unknown }[] = [];
  const client: any = {
    rpc(name: string, args?: unknown) {
      calls.push({ name, args });
      const r = responses[name];
      if (!r) return Promise.resolve({ data: null, error: { message: `rpc non prevista: ${name}` } });
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
    },
  };
  return { client, calls };
}
