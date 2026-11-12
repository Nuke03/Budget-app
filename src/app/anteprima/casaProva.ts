import type { CasaData } from '@/lib/loadCasaData';
import type { CheckinCaricato } from '@/lib/loadCheckin';
import type { CasaCorrente } from '@/lib/data/households';
import type { PlanBundle } from '@/lib/data/householdPlans';
import { computeAccantonatoFinora } from '@/lib/calculations/accantonato';
import { computeCheckin, mesePrecedente } from '@/lib/calculations/casa/checkin';
import { computeDisponibileCasa } from '@/lib/calculations/casa/disponibileCasa';
import type { RigaMese } from '@/lib/calculations/casa/versamenti';
import type { Account, BudgetGoal, Category, HouseholdMember, Transaction } from '@/lib/types';

// Dati sintetici della casa, solo per /anteprima: nessuna lettura da Supabase.
// Due membri: Marta crea e gestisce la casa, Luca è il secondo. `io` dice da che parte si guarda.

const MARTA = 'prova-marta';
const LUCA = 'prova-luca';

const giorniFa = (oggi: string, n: number): string => {
  const d = new Date(`${oggi}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

export type IoProva = 'gestore' | 'altro';

export function datiCasaProva(oggi: string, io: IoProva): CasaData {
  const mese = `${oggi.slice(0, 7)}-01`;
  const mesePrima = mesePrecedente(mese);
  const inizio = mesePrecedente(mesePrima);
  const adesso = new Date(`${oggi}T12:00:00Z`);

  const membri: HouseholdMember[] = [
    { householdId: 'prova-casa', userId: MARTA, displayName: 'Marta', joinedAt: `${inizio}T09:00:00.000Z`, slot: 1, attivo: true },
    { householdId: 'prova-casa', userId: LUCA, displayName: 'Luca', joinedAt: `${inizio}T09:00:00.000Z`, slot: 2, attivo: true },
  ];
  const me = io === 'gestore' ? MARTA : LUCA;
  const altro = io === 'gestore' ? LUCA : MARTA;
  const casa: CasaCorrente = {
    household: { id: 'prova-casa', nome: 'Casa di prova', createdAt: `${inizio}T09:00:00.000Z`, archiviataIl: null, createdBy: MARTA },
    members: membri,
    invite: null,
    me: membri.find((m) => m.userId === me)!,
  };

  const categorie: Category[] = [
    { id: 'kp1', nome: 'Affitto', tipo: 'expense', colore: '#3B9AE1', archiviata: false },
    { id: 'kp2', nome: 'Spesa', tipo: 'expense', colore: '#0F9D6B', archiviata: false },
    { id: 'kp3', nome: 'Bollette', tipo: 'expense', colore: '#F5A524', archiviata: false },
    { id: 'kp4', nome: 'Internet', tipo: 'expense', colore: '#F97362', archiviata: false },
  ];
  const conti: Account[] = [{ id: 'cp1', nome: 'Conto comune', saldoAttuale: 2150, contaInDisponibile: true, targetSaldo: null }];

  const obiettivi: BudgetGoal[] = [
    {
      id: 'gp1',
      nome: 'Gas',
      importoTarget: 150,
      modalita: 'dilazionato',
      scadenza: giorniFa(oggi, -75),
      categoriaId: 'kp3',
      ricorrente: true,
      frequenzaMesi: 3,
      stato: 'aperto',
      createdAt: `${giorniFa(oggi, 40)}T09:00:00.000Z`,
      accantonaDa: null,
    },
    {
      id: 'gp2',
      nome: 'Vacanza',
      importoTarget: 600,
      modalita: 'bloccato',
      scadenza: null,
      categoriaId: null,
      ricorrente: false,
      frequenzaMesi: null,
      stato: 'aperto',
      createdAt: `${giorniFa(oggi, 40)}T09:00:00.000Z`,
      accantonaDa: null,
    },
  ];
  const obiettiviConAccantonato = obiettivi.map((g) => ({ ...g, accantonato: computeAccantonatoFinora(g, adesso, 0) }));

  const piano: PlanBundle = {
    plan: {
      id: 'pp1',
      householdId: 'prova-casa',
      validoDal: inizio,
      giornoVersamento: 1,
      regola: 'parti_uguali',
      cuscinettoObiettivo: 1000,
      cuscinettoQuotaMensile: 40,
      arrotondamento: 1,
      totaleMensile: 1280,
      createdAt: `${inizio}T09:00:00.000Z`,
    },
    items: [
      { id: 'pi1', planId: 'pp1', nome: 'Affitto', categoriaId: 'kp1', frequenzaMesi: 1, importoRicorrenza: 800, importoMensile: 800, origineStima: 'utente', goalId: null, stimaIgnorataConN: null, ordine: 1 },
      { id: 'pi2', planId: 'pp1', nome: 'Spesa', categoriaId: 'kp2', frequenzaMesi: 1, importoRicorrenza: 300, importoMensile: 300, origineStima: 'suggerita', goalId: null, stimaIgnorataConN: null, ordine: 2 },
      { id: 'pi3', planId: 'pp1', nome: 'Internet', categoriaId: 'kp4', frequenzaMesi: 1, importoRicorrenza: 30, importoMensile: 30, origineStima: 'utente', goalId: null, stimaIgnorataConN: null, ordine: 3 },
      { id: 'pi4', planId: 'pp1', nome: 'Gas', categoriaId: 'kp3', frequenzaMesi: 3, importoRicorrenza: 150, importoMensile: 50, origineStima: 'suggerita', goalId: 'gp1', stimaIgnorataConN: null, ordine: 4 },
      { id: 'pi5', planId: 'pp1', nome: 'Luce', categoriaId: 'kp3', frequenzaMesi: 2, importoRicorrenza: 120, importoMensile: 60, origineStima: 'suggerita', goalId: null, stimaIgnorataConN: null, ordine: 5 },
    ],
    shares: [
      { planId: 'pp1', slot: 1, userId: MARTA, displayName: 'Marta', redditoNettoMensile: 1600, redditoIrregolare: false, percentuale: 50, inCasaDal: null, esceDal: null, quotaMensile: 640 },
      { planId: 'pp1', slot: 2, userId: LUCA, displayName: 'Luca', redditoNettoMensile: 1600, redditoIrregolare: false, percentuale: 50, inCasaDal: null, esceDal: null, quotaMensile: 640 },
    ],
  };

  const spesa = (id: string, data: string, descrizione: string, importo: number, categoriaId: string, extra: Partial<Transaction> = {}): Transaction => ({
    id,
    tipo: 'expense',
    importo,
    data,
    categoriaId,
    accountId: 'cp1',
    goalId: null,
    descrizione,
    nota: null,
    createdAt: `${data}T10:00:00.000Z`,
    pagataDaUserId: null,
    stima: false,
    ...extra,
  });
  const transazioni: Transaction[] = [
    // Anticipo in contanti di chi guarda: nessun conto, pagata da me.
    spesa('tp1', oggi, 'Pane e latte', 6.4, 'kp2', { accountId: null, pagataDaUserId: me }),
    spesa('tp2', giorniFa(oggi, 1), 'Spesa al mercato', 52.3, 'kp2'),
    spesa('tp3', giorniFa(oggi, 2), 'Bolletta internet', 29.9, 'kp4', { pagataDaUserId: altro, accountId: null }),
    // Il mese chiuso, per il check-in: spese sotto il previsto.
    spesa('tp4', `${mesePrima.slice(0, 7)}-03`, 'Affitto', 800, 'kp1'),
    spesa('tp5', `${mesePrima.slice(0, 7)}-12`, 'Spesa del mese', 240, 'kp2'),
    spesa('tp6', `${mesePrima.slice(0, 7)}-20`, 'Internet', 30, 'kp4'),
  ];

  // Il mese chiuso è tutto versato; in quello corrente il versamento di chi guarda è solo in parte.
  const righe: Record<string, RigaMese[]> = {
    [MARTA]: [
      { mese: mesePrima, atteso: 640, versato: 640, mancano: 0 },
      { mese, atteso: 640, versato: io === 'gestore' ? 300 : 640, mancano: io === 'gestore' ? 340 : 0 },
    ],
    [LUCA]: [
      { mese: mesePrima, atteso: 640, versato: 640, mancano: 0 },
      { mese, atteso: 640, versato: io === 'gestore' ? 640 : 300, mancano: io === 'gestore' ? 0 : 340 },
    ],
  };
  const crediti: Record<string, number> = { [MARTA]: 0, [LUCA]: io === 'gestore' ? 0 : 60 };
  // Luca deve 45 € a Marta.
  const debiti = [{ debitoreId: LUCA, creditoreId: MARTA, importo: 45, mesi: [{ mese: mesePrima, importo: 45, versato: 0 }] }];

  const disponibile = computeDisponibileCasa({
    conti,
    obiettivi,
    today: adesso,
    crediti: Object.values(crediti).reduce((s, v) => s + v, 0),
    daPagareMese: 0,
    cuscinettoObiettivo: piano.plan.cuscinettoObiettivo,
    cuscinettoQuotaMensile: piano.plan.cuscinettoQuotaMensile,
  });

  return {
    casa,
    aggiunta: {
      householdId: 'prova-casa',
      meUserId: me,
      nomi: membri.map((m) => ({ userId: m.userId, nome: m.displayName })),
      conti,
      categorie,
      obiettivi,
    },
    transazioni,
    obiettiviConAccantonato,
    disponibile,
    cuscinetto: { attuale: disponibile.cuscinetto, obiettivo: piano.plan.cuscinettoObiettivo, quotaMensile: piano.plan.cuscinettoQuotaMensile },
    trasferimenti: [],
    crediti,
    piani: [piano],
    righe,
    debiti,
    controlli: { ultimoControllo: oggi, ultimoCheckinMese: mesePrima },
  };
}

// Il check-in del mese chiuso, in avanzo, come lo darebbe loadCheckin.
export function checkinProva(oggi: string): CheckinCaricato {
  const dati = datiCasaProva(oggi, 'gestore');
  const mese = mesePrecedente(`${oggi.slice(0, 7)}-01`);
  const piano = dati.piani[0];
  const calcolo = computeCheckin({ mese, righePerMembro: dati.righe, piano, spese: dati.transazioni, precedente: null });
  const nomi = Object.fromEntries(dati.aggiunta.nomi.map((n) => [n.userId, n.nome]));
  const prossimo = new Date(`${oggi.slice(0, 7)}-01T12:00:00Z`);
  prossimo.setUTCMonth(prossimo.getUTCMonth() + 1);
  return {
    stato: 'da_fare',
    householdId: 'prova-casa',
    mese,
    calcolo,
    fatto: null,
    chi: null,
    cuscinetto: dati.cuscinetto,
    conti: dati.aggiunta.conti,
    fondiPerAvanzo: dati.aggiunta.obiettivi.filter((g) => g.modalita === 'bloccato' && !g.ricorrente),
    nomi,
    versamenti: dati.casa.members.map((m) => {
      const riga = dati.righe[m.userId].find((r) => r.mese === mese)!;
      return { userId: m.userId, nome: m.displayName, atteso: riga.atteso, versato: riga.versato };
    }),
    serveControllo: false,
    proposte: [],
    pianoAttuale: piano,
    pianiFuturi: [],
    fondiPerVoce: {},
    validoDalStima: prossimo.toISOString().slice(0, 10),
  };
}
