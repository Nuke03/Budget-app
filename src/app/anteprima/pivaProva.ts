import { inizioMesiFa } from '@/lib/pivaHome';
import type { DatiPivaHub } from '../piva/PivaHub';
import type { Account, Category, PivaAccantonamento, PivaFattura, PivaScadenza, PivaSettings, Transaction } from '@/lib/types';

// Dati inventati di Miriam per l'anteprima P.IVA: nessuna lettura, nessun login.
// Quadrano: percentuale 13,7%, vaso 3.100 €, quest'anno servono 4.300 €, stipendio 1.300 € (te ne restano 640),
// cuscinetto 2.900 €, tre fatture in attesa (una da 90 giorni), prossima F24 il 30/11.

const giorniFa = (oggi: string, n: number): string => {
  const d = new Date(`${oggi}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

export const categoriePivaProva: Category[] = [
  { id: 'cat-fatture', nome: 'Fatture', tipo: 'income', colore: null, archiviata: false, ruolo: null },
  { id: 'cat-spesa', nome: 'Spesa', tipo: 'expense', colore: null, archiviata: false, ruolo: null },
];

export const contiPivaProva: Account[] = [
  { id: 'conto-principale', nome: 'Conto principale', saldoAttuale: 3730, contaInDisponibile: true, targetSaldo: null, archiviato: false },
  { id: 'conto-tasse', nome: 'Conto tasse', saldoAttuale: 3100, contaInDisponibile: false, targetSaldo: null, archiviato: false },
];

export function impostazioniPivaProva(oggi: string): PivaSettings {
  const anno = Number(oggi.slice(0, 4));
  return {
    id: 'piva-prova',
    attivo: true,
    dataApertura: `${anno - 1}-09-01`,
    categoriaFatturatoId: 'cat-fatture',
    coefficienteRedditivita: 78,
    aliquotaSostitutivaOverride: null,
    aliquotaContributoSoggettivo: 10,
    aliquotaContributoIntegrativo: 2,
    minimaleContributivoAnnuo: 856,
    contributiVersatiAnnoPrecedente: 0,
    contoTasseId: 'conto-tasse',
    preset: 'enpap',
    guidataDal: `${anno}-01-05`,
    stipendioMensile: 1300,
    stipendioRivistoIl: giorniFa(oggi, 20),
    incassoMeseMagro: null,
  };
}

export function scadenzePivaProva(oggi: string): PivaScadenza[] {
  const anno = Number(oggi.slice(0, 4));
  const base = { anno, transactionId: null, nascosta: false };
  return [
    { ...base, id: 's1', chiave: 'cassa_acconto', tipo: 'cassa', descrizione: 'ENPAP: acconto', data: `${anno}-03-01`, importo: 750, pagataIl: `${anno}-02-27` },
    { ...base, id: 's2', chiave: 'f24_giugno', tipo: 'f24', descrizione: "F24 di giugno: saldo dell'anno prima e primo acconto", data: `${anno}-06-30`, importo: null, pagataIl: null },
    { ...base, id: 's3', chiave: 'cassa_saldo', tipo: 'cassa', descrizione: 'ENPAP: saldo', data: `${anno}-10-01`, importo: 480, pagataIl: null },
    { ...base, id: 's4', chiave: 'f24_novembre', tipo: 'f24', descrizione: 'F24 di novembre: secondo acconto', data: `${anno}-11-30`, importo: 3400, pagataIl: null },
  ];
}

export function fatturePivaProva(oggi: string): PivaFattura[] {
  const base = { dataIncasso: null, transactionId: null, nota: null };
  return [
    { ...base, id: 'f1', cliente: 'Studio Verdi', importo: 800, dataEmissione: giorniFa(oggi, 90) },
    { ...base, id: 'f2', cliente: 'Cooperativa Alba', importo: 650, dataEmissione: giorniFa(oggi, 35) },
    { ...base, id: 'f3', cliente: 'Scuola Rodari', importo: 1200, dataEmissione: giorniFa(oggi, 8) },
  ];
}

export function datiPivaProva(oggi: string): DatiPivaHub {
  const anno = Number(oggi.slice(0, 4));
  const mesi = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, '0'));
  const base = { goalId: null, nota: null, createdAt: '2026-01-01T00:00:00.000Z', stima: false, accountId: 'conto-principale' };
  const incassi: Transaction[] = [
    ...mesi.map((m): Transaction => ({
      ...base,
      id: `inc-${m}`,
      tipo: 'income',
      importo: 3000,
      data: `${anno}-${m}-10`,
      categoriaId: 'cat-fatture',
      descrizione: 'Fattura incassata',
    })),
    { ...base, id: 'inc-recente', tipo: 'income', importo: 1387, data: giorniFa(oggi, 3), categoriaId: 'cat-fatture', descrizione: 'Fattura incassata' },
  ];
  // I dieci incassi dei mesi scorsi hanno già la loro quota sul conto tasse: resta da spostare solo l'ultimo.
  const accantonamenti: PivaAccantonamento[] = mesi.map((m) => ({
    id: `acc-${m}`,
    transactionId: `inc-${m}`,
    importo: 310,
    data: `${anno}-${m}-11`,
    daAccountId: 'conto-principale',
    aAccountId: 'conto-tasse',
  }));
  const spesa = (id: string, data: string, importo: number): Transaction => ({
    ...base,
    id,
    tipo: 'expense',
    importo,
    data,
    categoriaId: 'cat-spesa',
    descrizione: 'Spese del mese',
  });
  const spese: Transaction[] = [
    ...[1, 2, 3].map((k) => spesa(`sp-${k}`, `${inizioMesiFa(oggi, k).slice(0, 7)}-15`, 1500)),
    spesa('sp-mese', oggi, 660),
  ];
  return {
    acc: contiPivaProva,
    tx: incassi,
    accant: accantonamenti,
    scad: scadenzePivaProva(oggi),
    fatt: fatturePivaProva(oggi),
    stip: { spese, casa: null, goals: [] },
  };
}
