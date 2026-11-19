import { describe, it, expect } from 'vitest';
import { creaFondoBolletta, creaFondoUnaVolta, creaFondiIngresso } from '@/lib/data/fondiCasa';
import { createFakeDb } from '../helpers/fakeDb';
import type { PlanItem } from '@/lib/types';

const item: PlanItem = {
  id: 'i1', planId: 'p1', nome: 'TARI', categoriaId: 'c1', frequenzaMesi: 12, importoRicorrenza: 300,
  importoMensile: 25, origineStima: 'utente', goalId: null, stimaIgnorataConN: null, ordine: 1,
};
const input = { householdId: 'H1', item, scadenza: '2027-03-31', oggi: '2026-11-09' };
const nuovoDb = () => createFakeDb({ budget_goals: [] }, { userId: 'U1', membri: { H1: ['U1'] } });

// Il fondo si cerca-o-crea e si collega in una sola funzione del database (crea_fondo_bolletta), con un
// blocco: due soci che toccano "Metti da parte" insieme ottengono lo stesso fondo.
const fondoRiga = {
  id: 'g1', household_id: 'H1', user_id: 'U1', nome: 'TARI', importo_target: 300, modalita: 'dilazionato',
  scadenza: '2027-03-31', categoria_id: 'c1', ricorrente: true, frequenza_mesi: 12, stato: 'aperto',
  created_at: '2026-11-09T00:00:00Z', accantona_da: '2026-11-09', ruolo: null,
};

describe('creaFondoBolletta', () => {
  it('fa una sola chiamata rpc con i parametri giusti e non scrive altro dal client', async () => {
    const db = createFakeDb({ budget_goals: [fondoRiga] }, { userId: 'U1', membri: { H1: ['U1'] } });
    db.registerRpc('crea_fondo_bolletta', () => ({ data: 'g1' }));
    await creaFondoBolletta(db.client, input);
    expect(db.rpcCalls).toEqual([
      {
        name: 'crea_fondo_bolletta',
        args: { p_household: 'H1', p_item: 'i1', p_scadenza: '2027-03-31', p_oggi: '2026-11-09' },
      },
    ]);
    expect(db.tables.budget_goals).toHaveLength(1);
  });

  it('torna il fondo, letto per id', async () => {
    const db = createFakeDb({ budget_goals: [fondoRiga] }, { userId: 'U1', membri: { H1: ['U1'] } });
    db.registerRpc('crea_fondo_bolletta', () => ({ data: 'g1' }));
    const fondo = await creaFondoBolletta(db.client, input);
    expect(fondo).toMatchObject({
      id: 'g1', nome: 'TARI', importoTarget: 300, ricorrente: true, frequenzaMesi: 12, categoriaId: 'c1',
      scadenza: '2027-03-31', accantonaDa: '2026-11-09',
    });
  });

  it("se l'rpc fallisce l'errore sale e non si legge niente", async () => {
    const db = nuovoDb();
    db.registerRpc('crea_fondo_bolletta', () => ({ error: { message: 'casa non valida' } }));
    await expect(creaFondoBolletta(db.client, input)).rejects.toMatchObject({ message: 'casa non valida' });
    expect(db.tables.budget_goals).toHaveLength(0);
  });

  it('voce senza categoria non chiama il database', async () => {
    const db = nuovoDb();
    db.registerRpc('crea_fondo_bolletta', () => ({ data: 'g1' }));
    await expect(creaFondoBolletta(db.client, { ...input, item: { ...item, categoriaId: null } })).rejects.toThrow(
      'voce senza categoria'
    );
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('se il fondo non si legge dopo la creazione, errore (la voce è già collegata)', async () => {
    const db = nuovoDb();
    db.registerRpc('crea_fondo_bolletta', () => ({ data: 'g-introvabile' }));
    await expect(creaFondoBolletta(db.client, input)).rejects.toThrow();
  });
});

describe('fondi una volta', () => {
  const base = { householdId: 'H1', scadenza: '2027-03-01', oggi: '2026-11-09' };

  it('creaFondoUnaVolta scrive un fondo graduale con scadenza e accantona_da', async () => {
    const db = nuovoDb();
    await creaFondoUnaVolta(db.client, { ...base, nome: 'Divano', importo: 600 });
    expect(db.tables.budget_goals[0]).toMatchObject({
      household_id: 'H1', nome: 'Divano', modalita: 'dilazionato', ricorrente: false, importo_target: 600,
      scadenza: '2027-03-01', categoria_id: null, accantona_da: '2026-11-09',
    });
  });

  it('creaFondiIngresso crea un fondo per voce con importo', async () => {
    const db = nuovoDb();
    const r = await creaFondiIngresso(db.client, {
      ...base,
      esistenti: [],
      voci: [
        { nome: 'Deposito cauzionale', importo: 1500 },
        { nome: 'Agenzia immobiliare', importo: 0 },
        { nome: 'Allacci delle utenze', importo: 300 },
      ],
    });
    expect(r).toHaveLength(2);
    expect(db.tables.budget_goals).toHaveLength(2);
  });

  it('ripetuto non duplica', async () => {
    const db = nuovoDb();
    await creaFondiIngresso(db.client, {
      ...base,
      esistenti: ['Deposito cauzionale'],
      voci: [
        { nome: 'Deposito cauzionale', importo: 1500 },
        { nome: 'Allacci delle utenze', importo: 300 },
      ],
    });
    expect((db.tables.budget_goals as { nome: string }[]).map((g) => g.nome)).toEqual(['Allacci delle utenze']);
  });
});
