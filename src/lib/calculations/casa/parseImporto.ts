// Legge un importo scritto a mano: virgola o punto, mai negativo. Null se non è un numero.
export function parseImporto(testo: string): number | null {
  const t = testo.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
