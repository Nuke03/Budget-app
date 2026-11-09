import { describe, it, expect } from 'vitest';
import { creaFondoBolletta } from '@/lib/data/fondiCasa';
import { createFakeDb } from '../helpers/fakeDb';
import type { PlanItem } from '@/lib/types';

const item: PlanItem = {
  id: 'i1', planId: 'p1', nome: 'TARI', categoriaId: 'c1', frequenzaMesi: 12, importoRicorrenza: 300,
  importoMensile: 25, origineStima: 'utente', goalId: null, stimaIgnorataConN: null, ordine: 1,
};
const input = { householdId: 'H1', item, scadenza: '2027-03-31', oggi: '2026-11-09' };
const nuovoDb = () => createFakeDb({ budget_goals: [] }, { userId: 'U1', membri: { H1: ['U1'] } });

describe('creaFondoBolletta', () => {
  it('crea il fondo con i valori giusti', async () => {
    const db = nuovoDb();
    db.registerRpc('link_plan_item_goal', () => ({ data: 1 }));
    await creaFondoBolletta(db.client, input);
    expect(db.tables.budget_goals).toHaveLength(1);
    expect(db.tables.budget_goals[0]).toMatchObject({
      household_id: 'H1', nome: 'TARI', modalita: 'dilazionato', ricorrente: true, frequenza_mesi: 12,
      importo_target: 300, scadenza: '2027-03-31', categoria_id: 'c1', accantona_da: '2026-11-09',
    });
  });

  it('collega la voce', async () => {
    const db = nuovoDb();
    db.registerRpc('link_plan_item_goal', () => ({ data: 1 }));
    const fondo = await creaFondoBolletta(db.client, input);
    expect(db.rpcCalls).toEqual([
      { name: 'link_plan_item_goal', args: { p_household: 'H1', p_item: 'i1', p_goal: fondo.id } },
    ]);
  });

  it('se il collegamento fallisce l\'errore sale e il fondo resta', async () => {
    const db = nuovoDb();
    db.registerRpc('link_plan_item_goal', () => ({ error: { message: 'casa non scrivibile' } }));
    await expect(creaFondoBolletta(db.client, input)).rejects.toMatchObject({ message: 'casa non scrivibile' });
    expect(db.tables.budget_goals).toHaveLength(1);
  });

  it('voce senza categoria non scrive niente', async () => {
    const db = nuovoDb();
    db.registerRpc('link_plan_item_goal', () => ({ data: 1 }));
    await expect(creaFondoBolletta(db.client, { ...input, item: { ...item, categoriaId: null } })).rejects.toThrow(
      'voce senza categoria'
    );
    expect(db.tables.budget_goals).toHaveLength(0);
    expect(db.rpcCalls).toHaveLength(0);
  });
});
