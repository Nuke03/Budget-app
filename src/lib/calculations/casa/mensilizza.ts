export function mensilizza(importoRicorrenza: number, frequenzaMesi: number): number {
  if (!(frequenzaMesi >= 1)) {
    throw new Error('frequenzaMesi deve essere almeno 1');
  }
  return importoRicorrenza / frequenzaMesi;
}

export function totaleVociMensili(
  voci: { importoRicorrenza: number; frequenzaMesi: number }[],
): number {
  return voci.reduce((somma, v) => somma + mensilizza(v.importoRicorrenza, v.frequenzaMesi), 0);
}

export function isVoceDaParte(frequenzaMesi: number): boolean {
  return frequenzaMesi > 1;
}
