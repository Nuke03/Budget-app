import { describe, it, expect } from 'vitest';
import { categorieCasaBase, creaContoComune, seedCategorieCasa } from '@/lib/data/casaSetup';
import { VOCI_CASA_TIPICHE } from '@/lib/calculations/casa/vociTipiche';
import { createFakeDb } from '../helpers/fakeDb';

const opts = { userId: 'A', membri: { H1: ['A', 'B'] } };

function categorieDi(db: ReturnType<typeof createFakeDb>, household: string | null) {
  return (db.tables.categories ?? []).filter((c) => c.household_id === household);
}

describe('categorieCasaBase', () => {
  it('categorieCasaBase contiene le voci tipiche, Altro e Altre entrate', () => {
    const base = categorieCasaBase();
    for (const v of VOCI_CASA_TIPICHE) expect(base).toContainEqual({ nome: v.nome, tipo: 'expense' });
    expect(base).toContainEqual({ nome: 'Altro', tipo: 'expense' });
    expect(base).toContainEqual({ nome: 'Altre entrate', tipo: 'income' });
    expect(base).toHaveLength(VOCI_CASA_TIPICHE.length + 2);
  });
});

describe('seedCategorieCasa', () => {
  it('seedCategorieCasa crea solo le mancanti, senza distinguere le maiuscole', async () => {
    const db = createFakeDb(
      {
        categories: [
          { id: 'c1', user_id: 'A', household_id: 'H1', nome: 'luce', tipo: 'expense', colore: null, archiviata: false },
          { id: 'c2', user_id: 'A', household_id: null, nome: 'Gas', tipo: 'expense', colore: null, archiviata: false },
        ],
      },
      opts
    );
    await seedCategorieCasa(db.client, 'H1');
    const nomi = categorieDi(db, 'H1').map((c) => String(c.nome).toLowerCase());
    expect(nomi.filter((n) => n === 'luce')).toHaveLength(1);
    expect(nomi.filter((n) => n === 'gas')).toHaveLength(1);
    expect(nomi).toHaveLength(categorieCasaBase().length);
    // la categoria personale non è toccata
    expect(categorieDi(db, null)).toHaveLength(1);
  });
});

describe('creaContoComune', () => {
  it('creaContoComune crea il conto di casa con contaInDisponibile e semina le categorie', async () => {
    const db = createFakeDb({ accounts: [], categories: [] }, opts);
    const conto = await creaContoComune(db.client, 'H1', { nome: 'Conto comune', saldoAttuale: 1000 });
    expect(conto).toMatchObject({ nome: 'Conto comune', saldoAttuale: 1000, contaInDisponibile: true, targetSaldo: null });
    expect(db.tables.accounts[0]).toMatchObject({ household_id: 'H1', conta_in_disponibile: true });
    expect(categorieDi(db, 'H1')).toHaveLength(categorieCasaBase().length);
  });
});
