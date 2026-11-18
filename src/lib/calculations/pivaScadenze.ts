import type { ChiaveScadenza, PivaScadenza } from '../types';

type ScadenzaDaCreare = Pick<PivaScadenza, 'anno' | 'chiave' | 'tipo' | 'descrizione' | 'data'>;

// Le quattro scadenze dell'anno, con la data di partenza (la cifra e la data si correggono dopo).
const MODELLO: { chiave: ChiaveScadenza; tipo: 'f24' | 'cassa'; mmgg: string; descrizione: string }[] = [
  { chiave: 'cassa_acconto', tipo: 'cassa', mmgg: '03-01', descrizione: 'ENPAP: acconto' },
  {
    chiave: 'f24_giugno',
    tipo: 'f24',
    mmgg: '06-30',
    descrizione: "F24 di giugno: saldo dell'anno prima e primo acconto",
  },
  { chiave: 'cassa_saldo', tipo: 'cassa', mmgg: '10-01', descrizione: 'ENPAP: saldo' },
  { chiave: 'f24_novembre', tipo: 'f24', mmgg: '11-30', descrizione: 'F24 di novembre: secondo acconto' },
];

// Le scadenze da creare per l'anno: dopo il giorno della guida, mai prima.
export function scadenzeDaCreare(anno: number, guidataDal: string): ScadenzaDaCreare[] {
  return MODELLO.map((m) => ({
    anno,
    chiave: m.chiave,
    tipo: m.tipo,
    descrizione: m.descrizione,
    data: `${anno}-${m.mmgg}`,
  })).filter((s) => s.data >= guidataDal);
}

// La prima scadenza ancora da pagare, non tolta, da oggi in avanti.
export function prossimaScadenza(s: PivaScadenza[], oggi: string): PivaScadenza | null {
  return (
    [...s]
      .sort((a, b) => a.data.localeCompare(b.data))
      .find((x) => !x.pagataIl && !x.nascosta && x.data >= oggi) ?? null
  );
}

export function confrontoScadenza(saldoVaso: number, importo: number): { basta: boolean; mancano: number } {
  const mancano = Math.max(0, importo - saldoVaso);
  return { basta: mancano === 0, mancano };
}

export function eIlPrimoAnno(guidataDal: string, anno: number): boolean {
  return Number(guidataDal.slice(0, 4)) === anno;
}
