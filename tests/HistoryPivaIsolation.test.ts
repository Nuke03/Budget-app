import { describe, it, expect } from 'vitest';
import { getTransactions } from '@/lib/data/transactions';
import { getCategories } from '@/lib/data/categories';
import { aggregateByCategory } from '@/lib/calculations/aggregateByCategory';
import { computeFatturatoAnnuo } from '@/lib/calculations/piva';
import { createFakeDb } from './helpers/fakeDb';

const MEMBRI = { H1: ['A', 'B', 'C'] };
const FATTURATO = 'cat-fatturato';

function tx(id: string, household: string | null, tipo: 'income' | 'expense', importo: number, categoria: string) {
  return {
    id,
    user_id: 'A',
    household_id: household,
    tipo,
    importo,
    data: '2026-05-10',
    categoria_id: categoria,
    account_id: null,
    goal_id: null,
    descrizione: id,
    nota: null,
    created_at: '2026-05-10T10:00:00Z',
  };
}

const cat = (id: string, nome: string, household: string | null) => ({
  id,
  user_id: 'A',
  household_id: household,
  nome,
  tipo: id === FATTURATO ? 'income' : 'expense',
  colore: null,
  archiviata: false,
});

const personali = {
  transactions: [
    tx('t1', null, 'income', 4000, FATTURATO),
    tx('t2', null, 'income', 2000, FATTURATO),
    tx('t3', null, 'expense', 50, 'cat-spesa'),
  ],
  categories: [cat(FATTURATO, 'Fatturato', null), cat('cat-spesa', 'Spesa', null)],
};

const diCasa = {
  transactions: [
    tx('h1', 'H1', 'income', 9000, FATTURATO),
    tx('h2', 'H1', 'expense', 700, 'cat-spesa'),
  ],
  categories: [cat('cat-affitto', 'Affitto', 'H1')],
  transfers: [
    { id: 'tr1', user_id: 'B', household_id: 'H1', importo: 300, data: '2026-05-01', causale: 'versamento' },
  ],
};

async function calcola(seed: Record<string, Record<string, unknown>[]>) {
  const db = createFakeDb(seed, { userId: 'A', membri: MEMBRI });
  const transactions = await getTransactions(db.client);
  const categories = await getCategories(db.client);
  return {
    transactions,
    aggregato: aggregateByCategory(transactions, categories),
    fatturato: computeFatturatoAnnuo(transactions, FATTURATO, 2026),
  };
}

describe('isolamento di Storico e P.IVA', () => {
  it('getTransactions ritorna solo le transazioni personali', async () => {
    const { transactions } = await calcola({
      transactions: [...personali.transactions, ...diCasa.transactions],
      categories: personali.categories,
    });
    expect(transactions.map((t) => t.id).sort()).toEqual(['t1', 't2', 't3']);
  });

  it('aggregazione per categoria e fatturato non cambiano con righe e trasferimenti di casa', async () => {
    const senza = await calcola(personali);
    const con = await calcola({
      transactions: [...personali.transactions, ...diCasa.transactions],
      categories: [...personali.categories, ...diCasa.categories],
      transfers: diCasa.transfers,
    });
    expect(senza.fatturato).toBe(6000);
    expect(con.fatturato).toBe(6000);
    expect(con.aggregato).toEqual(senza.aggregato);
    expect(con.transactions).toEqual(senza.transactions);
  });
});
