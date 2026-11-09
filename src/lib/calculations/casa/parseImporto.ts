// Legge un importo scritto a mano, all'italiana: "1.020,50", "1020,5", "1.020", "10.25". Mai negativo.
// Con la virgola i punti sono migliaia. Senza virgola, punti seguiti da esattamente tre cifre
// ("1.020", "12.500") sono migliaia; altrimenti il punto è decimale. Null se non è un numero.
export function parseImporto(testo: string): number | null {
  let t = testo.trim();
  if (t.includes(',')) {
    if (!/^[1-9]\d{0,2}(\.\d{3})*,\d+$|^\d+,\d+$/.test(t)) return null;
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
