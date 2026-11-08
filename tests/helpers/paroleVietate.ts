// Parole che nella parte Casa non devono comparire mai nei testi visibili.
export const PAROLE_VIETATE: string[] = [
  'bloccato',
  'dilazionato',
  'sinking fund',
  'giroconto',
  'imputazione',
  'riconciliazione',
];

export function assertNessunaParolaVietata(container: HTMLElement): void {
  const testo = (container.textContent ?? '').toLowerCase();
  for (const parola of PAROLE_VIETATE) {
    if (testo.includes(parola)) {
      throw new Error(`Parola vietata trovata nel testo: "${parola}"`);
    }
  }
}
