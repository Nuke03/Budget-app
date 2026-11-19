import { describe, it, expect, vi, afterEach } from 'vitest';
import * as transactions from '@/lib/data/transactions';
import * as households from '@/lib/data/households';
import * as casaStato from '@/lib/loadCasaStato';
import { loadHomeData, loadHomeBase } from '@/lib/loadHomeData';
import { createFakeDb } from './helpers/fakeDb';
import { computeMargineGiornaliero } from '@/lib/calculations/margine';
import { fineMese } from '@/lib/calculations/stipendio';

const TODAY = new Date('2026-11-15T12:00:00Z');

afterEach(() => vi.restoreAllMocks());

describe('loadHomeData: libretto', () => {
  it('legge le transazioni una volta sola', async () => {
    const spia = vi.spyOn(transactions, 'getTransactions');
    const db = createFakeDb({ accounts: [], budget_goals: [], transactions: [], categories: [] }, { userId: 'A', membri: {} });
    await loadHomeData(db.client, TODAY, null);
    expect(spia).toHaveBeenCalledTimes(1);
  });

  it('senza movimenti: righe vuote, solito null, nessun prossimo, notifiche sconosciute', async () => {
    const db = createFakeDb({ accounts: [], budget_goals: [], transactions: [], categories: [] }, { userId: 'A', membri: {} });
    const d = await loadHomeData(db.client, TODAY, null);
    expect(d.righe).toEqual([]);
    expect(d.andamento.solito).toBeNull();
    expect(d.prossimo).toBeNull();
    expect(d.notificheAttive).toBeNull();
    expect(d.consiglio.testo).toBeTruthy();
  });

  it('con una spesa vecchia di giorni propone "in pari" e legge le scelte', async () => {
    const db = createFakeDb(
      {
        accounts: [], budget_goals: [], categories: [],
        transactions: [{
          id: 't1', user_id: 'A', household_id: null, tipo: 'expense', importo: 12, data: '2026-11-10',
          categoria_id: null, account_id: null, goal_id: null, descrizione: 'Pizza', nota: null,
          created_at: '2026-11-10T10:00:00Z', stima: false,
        }],
        promemoria_utente: [{ user_id: 'A', notifiche_attive: true, nessuna_spesa_fino_al: null }],
      },
      { userId: 'A', membri: {} }
    );
    const d = await loadHomeData(db.client, TODAY, null);
    expect(d.righe[0]).toMatchObject({ id: 't1', nelMese: 12 });
    expect(d.prossimo?.tipo).toBe('in_pari');
    expect(d.notificheAttive).toBe(true);
  });

  it('una spesa recente in Casa conta per "in pari"', async () => {
    const db = createFakeDb(
      {
        accounts: [], budget_goals: [], categories: [],
        transactions: [
          {
            id: 't1', user_id: 'A', household_id: null, tipo: 'expense', importo: 12, data: '2026-11-10',
            categoria_id: null, account_id: null, goal_id: null, descrizione: 'Pizza', nota: null,
            created_at: '2026-11-10T10:00:00Z', stima: false,
          },
          {
            id: 't2', user_id: 'A', household_id: 'h1', tipo: 'expense', importo: 30, data: '2026-11-15',
            categoria_id: null, account_id: null, goal_id: null, descrizione: 'Spesa', nota: null,
            created_at: '2026-11-15T09:00:00Z', stima: false,
          },
        ],
      },
      { userId: 'A', membri: { h1: ['A'] } }
    );
    const d = await loadHomeData(db.client, TODAY, 'A');
    expect(d.inPari).toBeNull();
  });
});

const IMPOSTAZIONI_PIVA = {
  id: 'ps1', user_id: 'A', attivo: true, data_apertura: '2024-01-10', categoria_fatturato_id: 'cat-fatt',
  coefficiente_redditivita: 78, aliquota_sostitutiva_override: 5, aliquota_contributo_soggettivo: 10,
  aliquota_contributo_integrativo: 2, minimale_contributivo_annuo: 856, contributi_versati_anno_precedente: 0,
  conto_tasse_id: 'tasse', preset: 'enpap', guidata_dal: '2026-08-01', stipendio_mensile: null,
  stipendio_rivisto_il: null, incasso_mese_magro: null,
};

const entrata = (id: string, data: string, importo: number, categoria = 'cat-fatt') => ({
  id, user_id: 'A', household_id: null, tipo: 'income', importo, data, categoria_id: categoria,
  account_id: 'a1', goal_id: null, descrizione: id, nota: null, created_at: `${data}T10:00:00Z`, stima: false,
});

const contiPiva = [
  { id: 'a1', user_id: 'A', household_id: null, nome: 'Corrente', saldo_attuale: 1000, conta_in_disponibile: true, target_saldo: null },
  { id: 'tasse', user_id: 'A', household_id: null, nome: 'Tasse', saldo_attuale: 0, conta_in_disponibile: false, target_saldo: null },
];

describe('loadHomeData: percorso', () => {
  it('senza categorie chiama crea_categorie_iniziali una volta', async () => {
    const db = createFakeDb({ accounts: [], budget_goals: [], transactions: [], categories: [] }, { userId: 'A', membri: {} });
    db.registerRpc('crea_categorie_iniziali', () => ({ data: 0 }));
    await loadHomeData(db.client, TODAY, 'A');
    expect(db.rpcCalls.filter((c) => c.name === 'crea_categorie_iniziali')).toHaveLength(1);
  });

  it('senza categorie ma con movimenti personali non crea le categorie di partenza', async () => {
    const db = createFakeDb(
      {
        accounts: [], budget_goals: [], categories: [],
        // Anche un movimento vecchio, fuori dai 3 mesi della Home, vale.
        transactions: [{
          id: 't1', user_id: 'A', household_id: null, tipo: 'expense', importo: 12, data: '2025-01-10',
          categoria_id: null, account_id: null, goal_id: null, descrizione: 'Pizza', nota: null,
          created_at: '2025-01-10T10:00:00Z', stima: false,
        }],
      },
      { userId: 'A', membri: {} }
    );
    db.registerRpc('crea_categorie_iniziali', () => ({ data: 0 }));
    await loadHomeData(db.client, TODAY, 'A');
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('un movimento di casa non conta come movimento personale', async () => {
    const db = createFakeDb(
      {
        accounts: [], budget_goals: [], categories: [],
        transactions: [{
          id: 't1', user_id: 'A', household_id: 'h1', tipo: 'expense', importo: 12, data: '2026-11-10',
          categoria_id: null, account_id: null, goal_id: null, descrizione: 'Spesa', nota: null,
          created_at: '2026-11-10T10:00:00Z', stima: false,
        }],
      },
      { userId: 'A', membri: { h1: ['A'] } }
    );
    db.registerRpc('crea_categorie_iniziali', () => ({ data: 0 }));
    await loadHomeData(db.client, TODAY, 'A');
    expect(db.rpcCalls.filter((c) => c.name === 'crea_categorie_iniziali')).toHaveLength(1);
  });

  it('con categorie non chiama crea_categorie_iniziali', async () => {
    const db = createFakeDb(
      {
        accounts: [], budget_goals: [], transactions: [],
        categories: [{ id: 'c1', user_id: 'A', household_id: null, nome: 'Spesa', icona: null, ruolo: null }],
      },
      { userId: 'A', membri: {} }
    );
    db.registerRpc('crea_categorie_iniziali', () => ({ data: 0 }));
    await loadHomeData(db.client, TODAY, 'A');
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('senza conti i primi passi sono visibili e non c è lezione del giorno', async () => {
    const db = createFakeDb({ accounts: [], budget_goals: [], transactions: [], categories: [] }, { userId: 'A', membri: {} });
    const d = await loadHomeData(db.client, TODAY, 'A');
    expect(d.primiPassi.visibile).toBe(true);
    expect(d.primiPassi.fatti).toBe(0);
    expect(d.lezioneDelGiorno).toBeNull();
  });
});

describe('loadHomeData: P.IVA', () => {
  it('con P.IVA spenta: piva null e nessuna lettura di piva_accantonamenti', async () => {
    const db = createFakeDb(
      { accounts: [], budget_goals: [], transactions: [], categories: [], piva_settings: [{ ...IMPOSTAZIONI_PIVA, attivo: false }] },
      { userId: 'A', membri: {} }
    );
    const from = vi.spyOn(db.client, 'from');
    const d = await loadHomeData(db.client, TODAY, 'A');
    expect(d.piva).toBeNull();
    expect(from.mock.calls.map((c) => c[0])).not.toContain('piva_accantonamenti');
  });

  it('senza impostazioni: piva null', async () => {
    const db = createFakeDb({ accounts: [], budget_goals: [], transactions: [], categories: [] }, { userId: 'A', membri: {} });
    const d = await loadHomeData(db.client, TODAY, 'A');
    expect(d.piva).toBeNull();
  });

  it('con P.IVA guidata: inSospeso dalle entrate dal guidataDal, anche oltre la finestra di 3 mesi', async () => {
    // La finestra della home parte dal 1 agosto: un guidataDal di marzo la supera.
    const db = createFakeDb(
      {
        accounts: contiPiva, budget_goals: [], categories: [],
        transactions: [entrata('vecchia', '2026-03-10', 1000), entrata('recente', '2026-11-10', 600), entrata('altra', '2026-11-11', 50, 'cat-x')],
        piva_settings: [{ ...IMPOSTAZIONI_PIVA, guidata_dal: '2026-03-01' }],
        piva_accantonamenti: [],
      },
      { userId: 'A', membri: {} }
    );
    const d = await loadHomeData(db.client, TODAY, 'A');
    expect(d.piva?.contoTasseId).toBe('tasse');
    expect(d.piva?.categoriaFatturatoId).toBe('cat-fatt');
    expect(d.piva?.percentuale).toBe(13.7);
    expect(d.piva?.stipendio).toBeNull();
    expect(d.piva?.inSospeso.map((q) => q.transactionId).sort()).toEqual(['recente', 'vecchia']);
    expect(d.piva?.inSospeso.find((q) => q.transactionId === 'recente')?.quota).toBe(82);
  });

  it('sottrae totaleInSospeso dal disponibile come riservaPiva', async () => {
    const db = createFakeDb(
      {
        accounts: contiPiva, budget_goals: [], categories: [],
        transactions: [entrata('e1', '2026-11-10', 600), entrata('e2', '2026-11-11', 400)],
        piva_settings: [IMPOSTAZIONI_PIVA],
        // e2 è già stata spostata: resta in sospeso solo e1 (82)
        piva_accantonamenti: [{ id: 'pa1', user_id: 'A', transaction_id: 'e2', importo: 55, data: '2026-11-11', da_account_id: 'a1', a_account_id: 'tasse' }],
      },
      { userId: 'A', membri: {} }
    );
    const d = await loadHomeData(db.client, TODAY, 'A');
    expect(d.piva?.inSospeso).toEqual([{ transactionId: 'e1', importo: 600, quota: 82 }]);
    expect(d.disponibileLibero).toBe(1000 - 82);
  });

  it('riservati sommati più disponibileReale ricostruiscono il saldo dei conti nel disponibile', async () => {
    const obiettivo = {
      id: 'g1', user_id: 'A', household_id: null, nome: 'Vacanza', importo_target: 130, modalita: 'bloccato',
      scadenza: null, categoria_id: null, ricorrente: false, frequenza_mesi: null, stato: 'aperto',
      created_at: '2026-01-01T00:00:00Z', accantona_da: null,
    };
    const db = createFakeDb(
      {
        accounts: contiPiva, budget_goals: [obiettivo], categories: [],
        transactions: [entrata('e1', '2026-11-10', 600)],
        piva_settings: [IMPOSTAZIONI_PIVA], piva_accantonamenti: [],
      },
      { userId: 'A', membri: {} }
    );
    const d = await loadHomeData(db.client, TODAY, 'A');
    const { obiettivi, casa, debiti, tasse } = d.riservati;
    expect(obiettivi).toBe(130);
    expect(tasse).toBe(82);
    expect(d.disponibileReale).toBe(1000 - 130 - 82);
    expect(d.disponibileReale + obiettivi + casa + debiti + tasse).toBe(1000);
    expect(d.disponibileLibero).toBe(d.disponibileReale);
  });

  it('riservati: versamento alla casa e debiti entrano in casa e debiti', async () => {
    vi.spyOn(households, 'getMyHousehold').mockResolvedValue({ household: { id: 'H1' }, members: [], invite: null, me: { userId: 'A' } } as never);
    vi.spyOn(casaStato, 'loadCasaStato').mockResolvedValue({
      riservaVersamento: 200, debitoDaRestituire: 75, piano: null, righe: [], righeCasa: [], membri: [],
      crediti: [], debiti: [], me: { userId: 'A', joinedAt: '2026-01-01T00:00:00Z' },
      controlli: { ultimoControllo: null, ultimoCheckinMese: null },
    } as never);
    const db = createFakeDb(
      { accounts: contiPiva, budget_goals: [], categories: [], transactions: [] },
      { userId: 'A', membri: {} }
    );
    const d = await loadHomeData(db.client, TODAY, 'A');
    expect(d.riservati).toEqual({ obiettivi: 0, casa: 200, debiti: 75, tasse: 0 });
    expect(d.disponibileReale).toBe(1000 - 200 - 75);
  });

  it('il conto tasse non conta mai nel disponibile, nemmeno se flaggato: la Home e il dettaglio lo escludono', async () => {
    const conti = contiPiva.map((c) => (c.id === 'tasse' ? { ...c, saldo_attuale: 500, conta_in_disponibile: true } : c));
    const db = createFakeDb(
      { accounts: conti, budget_goals: [], categories: [], transactions: [], piva_settings: [IMPOSTAZIONI_PIVA], piva_accantonamenti: [] },
      { userId: 'A', membri: {} }
    );
    const d = await loadHomeData(db.client, TODAY, 'A');
    expect(d.disponibileLibero).toBe(1000);
    expect(d.accounts.find((a) => a.id === 'tasse')?.contaInDisponibile).toBe(false);
    expect(d.accounts.find((a) => a.id === 'a1')?.contaInDisponibile).toBe(true);
  });

  it('senza P.IVA guidata un conto flaggato resta nel disponibile', async () => {
    const conti = contiPiva.map((c) => (c.id === 'tasse' ? { ...c, saldo_attuale: 500, conta_in_disponibile: true } : c));
    const db = createFakeDb(
      { accounts: conti, budget_goals: [], categories: [], transactions: [] },
      { userId: 'A', membri: {} }
    );
    const d = await loadHomeData(db.client, TODAY, 'A');
    expect(d.disponibileLibero).toBe(1500);
  });

  it('le fatture ferme da più di 60 giorni entrano nel Da fare', async () => {
    const db = createFakeDb(
      {
        accounts: contiPiva, budget_goals: [], categories: [], transactions: [],
        piva_settings: [IMPOSTAZIONI_PIVA],
        piva_accantonamenti: [],
        piva_fatture: [
          { id: 'f1', user_id: 'A', cliente: 'Rossi', importo: 900, data_emissione: '2026-08-01', data_incasso: null, transaction_id: null, nota: null },
          { id: 'f2', user_id: 'A', cliente: 'Verdi', importo: 100, data_emissione: '2026-11-01', data_incasso: null, transaction_id: null, nota: null },
        ],
      },
      { userId: 'A', membri: {} }
    );
    const d = await loadHomeData(db.client, TODAY, 'A');
    const testo = JSON.stringify(d.prossimo);
    expect(testo).toContain('1 fattura aspetta da più di 60 giorni');
  });

  it('se le fatture non si leggono la home si apre lo stesso', async () => {
    const db = createFakeDb(
      {
        accounts: contiPiva, budget_goals: [], categories: [], transactions: [],
        piva_settings: [IMPOSTAZIONI_PIVA],
        piva_accantonamenti: [],
      },
      { userId: 'A', membri: {} }
    );
    const from = db.client.from.bind(db.client);
    vi.spyOn(db.client, 'from').mockImplementation(((t: string) => {
      if (t === 'piva_fatture') throw new Error('rete');
      return from(t);
    }) as typeof db.client.from);
    const d = await loadHomeData(db.client, TODAY, 'A');
    expect(d.piva?.contoTasseId).toBe('tasse');
  });
});

const spesa = (id: string, data: string, importo: number) => ({
  id, user_id: 'A', household_id: null, tipo: 'expense', importo, data, categoria_id: null,
  account_id: 'a1', goal_id: null, descrizione: id, nota: null, created_at: `${data}T10:00:00Z`, stima: false,
});

describe('loadHomeData: stipendio', () => {
  it('senza stipendio la Home è identica a prima', async () => {
    const seed = (piva: Record<string, unknown>[]) => ({
      accounts: contiPiva, budget_goals: [], categories: [],
      transactions: [spesa('s1', '2026-11-05', 300)],
      piva_settings: piva, piva_accantonamenti: [],
    });
    const spenta = await loadHomeData(
      createFakeDb(seed([{ ...IMPOSTAZIONI_PIVA, attivo: false }]), { userId: 'A', membri: {} }).client, TODAY, 'A'
    );
    const senzaStipendio = await loadHomeData(
      createFakeDb(seed([IMPOSTAZIONI_PIVA]), { userId: 'A', membri: {} }).client, TODAY, 'A'
    );
    expect(spenta.piva).toBeNull();
    expect(senzaStipendio.piva?.stipendio).toBeNull();
    for (const d of [spenta, senzaStipendio]) {
      expect(d.disponibileLibero).toBe(1000);
      expect(d.margineGiornaliero).toBe(computeMargineGiornaliero(1000, d.dataTarget, TODAY));
    }
    expect(senzaStipendio.dataTarget).toEqual(spenta.dataTarget);
    expect(senzaStipendio.margineGiornaliero).toBe(spenta.margineGiornaliero);
  });

  it('con stipendio il disponibile è il minore e il margine va a fine mese', async () => {
    const db = createFakeDb(
      {
        accounts: contiPiva, budget_goals: [], categories: [],
        transactions: [spesa('s1', '2026-11-05', 300)],
        piva_settings: [{ ...IMPOSTAZIONI_PIVA, stipendio_mensile: 800, stipendio_rivisto_il: '2026-11-01' }],
        piva_accantonamenti: [],
      },
      { userId: 'A', membri: {} }
    );
    const spia = vi.spyOn(transactions, 'getTransactions');
    const d = await loadHomeData(db.client, TODAY, 'A');
    // rimasto = 800 - 300 = 500; sul conto ci sono 1000
    expect(d.disponibileLibero).toBe(500);
    expect(d.piva?.stipendio).toEqual({ stipendio: 800, rimasto: 500, cuscinetto: 500, mesiCoperti: 0.6 });
    expect(d.dataTarget).toEqual(fineMese('2026-11-15'));
    expect(d.margineGiornaliero).toBe(computeMargineGiornaliero(500, fineMese('2026-11-15'), TODAY));
    // le entrate si leggono una volta sola, anche con la finestra più lunga
    expect(spia).toHaveBeenCalledTimes(2);
  });

  it('con stipendio più alto di quello che c è, il disponibile resta quello vero e il cuscinetto è 0', async () => {
    const db = createFakeDb(
      {
        accounts: contiPiva, budget_goals: [], categories: [], transactions: [],
        piva_settings: [{ ...IMPOSTAZIONI_PIVA, stipendio_mensile: 5000, stipendio_rivisto_il: '2026-11-01' }],
        piva_accantonamenti: [],
      },
      { userId: 'A', membri: {} }
    );
    const d = await loadHomeData(db.client, TODAY, 'A');
    expect(d.disponibileLibero).toBe(1000);
    expect(d.piva?.stipendio).toEqual({ stipendio: 5000, rimasto: 5000, cuscinetto: 0, mesiCoperti: 0 });
  });

  it('il conto tasse non conta fra le spese dello stipendio, anche se contaInDisponibile', async () => {
    const conti = contiPiva.map((c) => (c.id === 'tasse' ? { ...c, conta_in_disponibile: true } : c));
    const db = createFakeDb(
      {
        accounts: conti, budget_goals: [], categories: [],
        transactions: [spesa('s1', '2026-11-05', 300), { ...spesa('s2', '2026-11-06', 100), account_id: 'tasse' }],
        piva_settings: [{ ...IMPOSTAZIONI_PIVA, stipendio_mensile: 800, stipendio_rivisto_il: '2026-11-01' }],
        piva_accantonamenti: [],
      },
      { userId: 'A', membri: {} }
    );
    const d = await loadHomeData(db.client, TODAY, 'A');
    expect(d.piva?.stipendio?.rimasto).toBe(500);
  });

  it('dopo 3 mesi la Home propone di rivedere lo stipendio', async () => {
    const incassi = ['2026-05-10', '2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10'].map((d, i) =>
      entrata(`e${i}`, d, 1000)
    );
    const spese = ['2026-08-05', '2026-09-05', '2026-10-05'].map((d, i) => spesa(`s${i}`, d, 300));
    const db = createFakeDb(
      {
        accounts: contiPiva, budget_goals: [], categories: [],
        transactions: [...incassi, ...spese, spesa('oggi', '2026-11-15', 1)],
        piva_settings: [{ ...IMPOSTAZIONI_PIVA, guidata_dal: '2026-05-01', stipendio_mensile: 500, stipendio_rivisto_il: '2026-05-01' }],
        piva_accantonamenti: incassi.map((e, i) => ({
          id: `pa${i}`, user_id: 'A', transaction_id: e.id, importo: 100, data: e.data, da_account_id: 'a1', a_account_id: 'tasse',
        })),
      },
      { userId: 'A', membri: {} }
    );
    const d = await loadHomeData(db.client, TODAY, 'A');
    // A = 1000 al netto del 13,7% = 860; B = 300: proposta 300, 40% sotto lo stipendio
    expect(d.prossimo?.tipo).toBe('piva');
    expect(d.prossimo?.testo).toContain('conviene abbassare lo stipendio a 300 €');
  });
});

describe('loadHomeBase', () => {
  const dbVuoto = () =>
    createFakeDb(
      {
        accounts: [], budget_goals: [], categories: [], transactions: [{
          id: 't1', user_id: 'A', household_id: null, tipo: 'income', importo: 100, data: '2026-11-10',
          categoria_id: null, account_id: null, goal_id: null, descrizione: 'Stipendio', nota: null,
          created_at: '2026-11-10T10:00:00Z', stima: false,
        }],
      },
      { userId: 'A', membri: {} }
    );

  it('dà la home e le letture grezze; la home non porta le transazioni', async () => {
    const db = dbVuoto();
    const { home, grezzi } = await loadHomeBase(db.client, TODAY, 'A');
    expect(grezzi.transazioni.map((t) => t.id)).toEqual(['t1']);
    expect(grezzi.ultimaEntrata).not.toBeNull();
    expect(grezzi.percorso.lezioni).toEqual({});
    expect(grezzi.pivaSettings).toBeNull();
    expect(home.storico).toHaveLength(1);
    expect(Object.keys(home)).not.toContain('transazioni');
    expect(Object.keys(home)).not.toContain('grezzi');
  });

  it('loadHomeData tiene la forma di sempre', async () => {
    const d = await loadHomeData(dbVuoto().client, TODAY, 'A');
    expect(Object.keys(d)).not.toContain('home');
    expect(Object.keys(d)).not.toContain('grezzi');
    expect(d.disponibileLibero).toBe(0);
  });
});
