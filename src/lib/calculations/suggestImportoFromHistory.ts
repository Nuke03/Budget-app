export function suggestImportoFromHistory(
  importiPassati: number[],
  marginePercent: number
): number {
  if (importiPassati.length === 0) {
    throw new Error('Nessun importo storico su cui calcolare una media');
  }

  const media = importiPassati.reduce((sum, v) => sum + v, 0) / importiPassati.length;
  return media * (1 + marginePercent / 100);
}
