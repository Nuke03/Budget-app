import { describe, it, expect, vi, afterEach } from 'vitest';
import * as households from '@/lib/data/households';
import * as casaStato from '@/lib/loadCasaStato';
import * as casaData from '@/lib/loadCasaData';
import { loadPercorsoData, loadPercorsoLeggero } from '@/lib/loadPercorsoData';
import { createFakeDb } from './helpers/fakeDb';

const TODAY = new Date('2026-11-15T12:00:00Z');

afterEach(() => vi.restoreAllMocks());

const IMPOSTAZIONI_PIVA = {
  id: 'ps1', user_id: 'A', attivo: true, data_apertura: '2024-01-10', categoria_fatturato_id: 'cat-fatt',
  coefficiente_redditivita: 78, aliquota_sostitutiva_override: 5, aliquota_contributo_soggettivo: 10,
  aliquota_contributo_integrativo: 2, minimale_contributivo_annuo: 856, contributi_versati_anno_precedente: 0,
  conto_tasse_id: 'tasse', preset: 'enpap', guidata_dal: '2026-08-01', stipendio_mensile: 800,
  stipendio_rivisto_il: '2026-11-01', incasso_mese_magro: null,
};

const tx = (id: string, tipo: 'income' | 'expense', data: string, importo: number, categoria: string | null) => ({
  id, user_id: 'A', household_id: null, tipo, importo, data, categoria_id: categoria,
  account_id: 'a1', goal_id: null, descrizione: id, nota: null, created_at: `${data}T10:00:00Z`, stima: false,
});

const obiettivo = {
  id: 'g1', user_id: 'A', household_id: null, nome: 'Vacanza', importo_target: 130, modalita: 'bloccato',
  scadenza: null, categoria_id: null, ricorrente: false, frequenza_mesi: null, stato: 'aperto',
  created_at: '2026-01-01T00:00:00Z', accantona_da: null,
};

function nuovoDb() {
  const db = createFakeDb(
    {
      accounts: [
        { id: 'a1', user_id: 'A', household_id: null, nome: 'Corrente', saldo_attuale: 1000, conta_in_disponibile: true, target_saldo: null },
        { id: 'tasse', user_id: 'A', household_id: null, nome: 'Tasse', saldo_attuale: 0, conta_in_disponibile: false, target_saldo: null },
      ],
      budget_goals: [obiettivo],
      categories: [{ id: 'cat-fatt', user_id: 'A', household_id: null, nome: 'Fatturato', icona: null, ruolo: null }],
      transactions: [
        tx('e1', 'income', '2026-11-10', 600, 'cat-fatt'),
        tx('s1', 'expense', '2026-11-12', 40, null),
      ],
      piva_settings: [IMPOSTAZIONI_PIVA],
      piva_accantonamenti: [],
    },
    { userId: 'A', membri: {} }
  );
  const tabelle: string[] = [];
  const from = db.client.from;
  db.client.from = (nome: string) => {
    tabelle.push(nome);
    return from(nome);
  };
  return { db, tabelle };
}

function conCasa() {
  vi.spyOn(households, 'getMyHousehold').mockResolvedValue({ household: { id: 'H1' }, members: [], invite: null, me: { userId: 'A' } } as never);
  vi.spyOn(casaStato, 'loadCasaStato').mockResolvedValue({
    riservaVersamento: 200, debitoDaRestituire: 75, piano: null, righe: [], righeCasa: [], membri: [],
    crediti: {}, debiti: [], me: { userId: 'A', joinedAt: '2026-01-01T00:00:00Z' },
    controlli: { ultimoControllo: null, ultimoCheckinMese: null },
  } as never);
  return vi.spyOn(casaData, 'loadCasaAggiunta').mockRejectedValue(new Error('non serve'));
}

describe('loadPercorsoLeggero', () => {
  it('stessi numeri di loadPercorsoData, con casa, P.IVA con stipendio e un obiettivo', async () => {
    conCasa();
    const a = nuovoDb();
    const piena = await loadPercorsoData(a.db.client, TODAY, 'A');
    const b = nuovoDb();
    const leggera = await loadPercorsoLeggero(b.db.client, TODAY, 'A');
    expect(leggera.riservati).toEqual({ obiettivi: 130, casa: 200, debiti: 75, tasse: 82 });
    expect(leggera.disponibileReale).toBe(piena.disponibileReale);
    expect(leggera.disponibileLibero).toBe(piena.disponibileLibero);
    expect(leggera.riservati).toEqual(piena.riservati);
    expect(leggera.primiPassi).toEqual(piena.primiPassi);
    expect(leggera.lezioni).toEqual(piena.lezioni);
    expect(leggera.percorso).toEqual(piena.percorso);
    expect(leggera.goals).toEqual(piena.goals);
    expect(leggera.conti).toEqual(piena.conti);
    expect(leggera.categorie).toEqual(piena.categorie);
    expect(leggera.transazioni).toEqual(piena.transazioni);
    expect(leggera.ultimaEntrataIl).toBe(piena.ultimaEntrataIl);
    expect(leggera.oggi).toBe(piena.oggi);
  });

  it('stessi numeri anche senza casa e senza P.IVA', async () => {
    const vuoto = () =>
      createFakeDb({ accounts: [], budget_goals: [], categories: [], transactions: [] }, { userId: 'A', membri: {} }).client;
    const piena = await loadPercorsoData(vuoto(), TODAY, 'A');
    const leggera = await loadPercorsoLeggero(vuoto(), TODAY, 'A');
    expect(leggera.disponibileReale).toBe(piena.disponibileReale);
    expect(leggera.riservati).toEqual(piena.riservati);
    expect(leggera.primiPassi).toEqual(piena.primiPassi);
  });

  it('legge meno: niente lista d\'attesa, scadenze, fatture, ultima creazione, aggiunta della casa', async () => {
    const aggiunta = conCasa();
    const a = nuovoDb();
    await loadPercorsoData(a.db.client, TODAY, 'A');
    const chiamatePiena = aggiunta.mock.calls.length;
    expect(chiamatePiena).toBeGreaterThan(0);
    const b = nuovoDb();
    await loadPercorsoLeggero(b.db.client, TODAY, 'A');
    expect(aggiunta.mock.calls.length).toBe(chiamatePiena);
    expect(b.tabelle.length).toBeLessThan(a.tabelle.length);
    for (const t of ['piva_scadenze', 'piva_fatture', 'lista_attesa']) {
      expect(b.tabelle).not.toContain(t);
    }
    // L'ultima creazione (una lettura di transactions) non serve alle lezioni.
    expect(b.tabelle.filter((t) => t === 'transactions').length).toBe(a.tabelle.filter((t) => t === 'transactions').length - 1);
  });
});
