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

// Confronto per riga: lo stesso euro nel vaso non basta due volte, quindi ogni scadenza si misura
// contro la somma di quelle ancora da pagare (con cifra, non tolte) fino a lei, in ordine di data.
export function confrontoCumulativo(
  saldoVaso: number,
  scadenze: PivaScadenza[],
  id: string
): { basta: boolean; mancano: number; totale: number; conPrecedenti: boolean } | null {
  const da = [...scadenze]
    .filter((s) => !s.pagataIl && !s.nascosta && s.importo != null)
    .sort((a, b) => a.data.localeCompare(b.data));
  const indice = da.findIndex((s) => s.id === id);
  if (indice === -1) return null;
  const totale = Math.round(da.slice(0, indice + 1).reduce((t, s) => t + (s.importo ?? 0), 0) * 100) / 100;
  const { basta, mancano } = confrontoScadenza(saldoVaso, totale);
  return { basta, mancano: Math.round(mancano * 100) / 100, totale, conPrecedenti: indice > 0 };
}

export function eIlPrimoAnno(guidataDal: string, anno: number): boolean {
  return Number(guidataDal.slice(0, 4)) === anno;
}

export interface DatiScadenzaVaso {
  scadenze: PivaScadenza[];
  saldoVaso: number;
  // Quote proposte e non ancora spostate, ESCLUSA quella dell'incasso di cui si parla.
  inSospeso: number;
  incassiMensili: number[]; // da finestraIncassi
}

// Il pezzo in più di un incasso per arrivare alla prima scadenza non coperta dal vaso.
export function pezzoInPiuScadenza(
  i: DatiScadenzaVaso & { importo: number; quotaBase: number; oggi: string }
): { importo: number; scadenza: PivaScadenza } | null {
  const da = [...i.scadenze]
    .filter((s) => !s.pagataIl && !s.nascosta && s.importo != null && s.data >= i.oggi)
    .sort((a, b) => a.data.localeCompare(b.data));
  const disponibile = i.saldoVaso + i.inSospeso + i.quotaBase;
  let cumulativo = 0;
  for (const s of da) {
    cumulativo += s.importo ?? 0;
    if (cumulativo <= disponibile) continue;
    const mancano = Math.round((cumulativo - disponibile) * 100) / 100;
    const mesi = Math.max(
      1,
      (Number(s.data.slice(0, 4)) - Number(i.oggi.slice(0, 4))) * 12 +
        (Number(s.data.slice(5, 7)) - Number(i.oggi.slice(5, 7))) +
        1
    );
    const media = i.incassiMensili.length
      ? i.incassiMensili.reduce((t, x) => t + x, 0) / i.incassiMensili.length
      : 0;
    const pezzo = media > 0 ? Math.round((i.importo * mancano) / (media * mesi)) : mancano;
    const risultato = Math.round(Math.min(pezzo, mancano, Math.round(i.importo / 2) - i.quotaBase));
    return risultato > 0 ? { importo: risultato, scadenza: s } : null;
  }
  return null;
}
