// L'indirizzo pubblico dell'app: la variabile d'ambiente (anche vuota o con "/" finale) oppure l'host della richiesta.
export function origineSito(
  siteUrl: string | undefined,
  host: string | null | undefined,
  protoInoltrato: string | null | undefined
): string | undefined {
  const dallEnv = siteUrl?.trim().replace(/\/+$/, '');
  if (dallEnv) return dallEnv;
  if (!host) return undefined;
  const proto = protoInoltrato ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
