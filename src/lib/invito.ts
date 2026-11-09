import { formatCodiceInvito } from '@/lib/data/households';

// Come legge il codice il modulo di ingresso: senza spazi né trattini, maiuscolo.
export function normalizzaCodice(valore: string | null | undefined): string {
  return (valore ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function linkInvito(origin: string, codice: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/casa/inizia?modo=entra&codice=${encodeURIComponent(normalizzaCodice(codice))}`;
}

export function testoInvito(origin: string, codice: string): string {
  return [
    `Entra nella nostra casa su Budget: ${linkInvito(origin, codice)}`,
    `Se il link non si apre, il codice è: ${formatCodiceInvito(normalizzaCodice(codice))}`,
  ].join('\n');
}
