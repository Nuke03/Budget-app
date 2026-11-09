import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getLastIncomeDate,
  getRecentTransactionAmounts,
  getTransactionAmountsForGoal,
  getSpeseCasaPerCategorie,
} from '@/lib/data/transactions';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';
import { createRecordingClient, callsOf } from '../helpers/recordingSupabase';

const row = {
  id: '1',
  tipo: 'expense',
  importo: 26,
  data: '2026-02-14',
  categoria_id: 'cat-1',
  account_id: 'acc-1',
  goal_id: null,
  descrizione: 'Spesa',
  nota: null,
  created_at: '2026-02-14T10:00:00Z',
  user_id: 'u-1',
};

describe('getTransactions', () => {
  it('mapRow espone userId e mappa le righe in oggetti Transaction', async () => {
    const supabase = fakeSelectClient([row]);
    const result = await getTransactions(supabase);

    expect(result).toEqual([
      {
        id: '1',
        tipo: 'expense',
        importo: 26,
        data: '2026-02-14',
        categoriaId: 'cat-1',
        accountId: 'acc-1',
        goalId: null,
        descrizione: 'Spesa',
        nota: null,
        createdAt: '2026-02-14T10:00:00Z',
        userId: 'u-1',
      },
    ]);
  });
});

describe('createTransaction', () => {
  it('inserisce e ritorna la transazione mappata', async () => {
    const supabase = fakeMutationClient(row);
    const result = await createTransaction(supabase, {
      tipo: 'expense',
      importo: 26,
      data: '2026-02-14',
      categoriaId: 'cat-1',
      accountId: 'acc-1',
      goalId: null,
      descrizione: 'Spesa',
      nota: null,
    });

    expect(result.id).toBe('1');
  });
});

describe('createTransaction con casa', () => {
  const input = {
    tipo: 'expense' as const,
    importo: 30,
    data: '2026-11-05',
    categoriaId: 'cat-1',
    accountId: 'acc-personale',
    goalId: null,
    descrizione: 'Spesa',
    nota: null,
  };

  it('createTransaction scrive pagata_da_user_id con scope casa', async () => {
    const { client, calls } = createRecordingClient([row]);
    await createTransaction(client, { ...input, pagataDaUserId: 'u-1' }, { kind: 'casa', householdId: 'h1' });
    const [payload] = callsOf(calls[0], 'insert')[0] as [Record<string, unknown>];
    expect(payload).toMatchObject({ household_id: 'h1', pagata_da_user_id: 'u-1', account_id: 'acc-personale' });
  });

  it('senza pagataDaUserId o in personale non scrive pagata_da_user_id', async () => {
    const a = createRecordingClient([row]);
    await createTransaction(a.client, input, { kind: 'casa', householdId: 'h1' });
    expect(callsOf(a.calls[0], 'insert')[0][0]).not.toHaveProperty('pagata_da_user_id');
    const b = createRecordingClient([row]);
    await createTransaction(b.client, { ...input, pagataDaUserId: 'u-1' });
    expect(callsOf(b.calls[0], 'insert')[0][0]).not.toHaveProperty('pagata_da_user_id');
  });
});

describe('updateTransaction', () => {
  it('aggiorna e ritorna la transazione mappata', async () => {
    const supabase = fakeMutationClient(row);
    const result = await updateTransaction(supabase, '1', {
      tipo: 'expense',
      importo: 26,
      data: '2026-02-14',
      categoriaId: 'cat-1',
      accountId: 'acc-1',
      goalId: null,
      descrizione: 'Spesa',
      nota: null,
    });

    expect(result.id).toBe('1');
  });
});

describe('deleteTransaction', () => {
  it('non lancia errori quando la cancellazione va a buon fine', async () => {
    const supabase = fakeMutationClient(null);
    await expect(deleteTransaction(supabase, '1')).resolves.toBeUndefined();
  });
});

describe('getLastIncomeDate', () => {
  it('ritorna la data dell\'ultima entrata come oggetto Date', async () => {
    const supabase = fakeSelectClient([{ data: '2026-02-09' }]);
    const result = await getLastIncomeDate(supabase);
    expect(result).toEqual(parseISO('2026-02-09'));
  });

  it('ritorna null se non ci sono entrate', async () => {
    const supabase = fakeSelectClient([]);
    const result = await getLastIncomeDate(supabase);
    expect(result).toBeNull();
  });
});

describe('getRecentTransactionAmounts', () => {
  it('ritorna gli importi delle transazioni più recenti per categoria', async () => {
    const supabase = fakeSelectClient([{ importo: 60 }, { importo: 55 }, { importo: 58 }]);
    const result = await getRecentTransactionAmounts(supabase, 'cat-luce', 3);
    expect(result).toEqual([60, 55, 58]);
  });

  it('ritorna un array vuoto se non ci sono transazioni in quella categoria', async () => {
    const supabase = fakeSelectClient([]);
    const result = await getRecentTransactionAmounts(supabase, 'cat-luce', 3);
    expect(result).toEqual([]);
  });

  it('accetta una parola chiave opzionale per filtrare per descrizione', async () => {
    const supabase = fakeSelectClient([{ importo: 60 }]);
    const result = await getRecentTransactionAmounts(supabase, 'cat-luce', 3, 'enel');
    expect(result).toEqual([60]);
  });
});

describe('getTransactionAmountsForGoal', () => {
  it('ritorna gli importi delle spese collegate a un obiettivo nella finestra data', async () => {
    const supabase = fakeSelectClient([{ importo: 50 }, { importo: 30 }]);
    const result = await getTransactionAmountsForGoal(supabase, 'goal-1', '2026-01-01', '2026-02-01');
    expect(result).toEqual([50, 30]);
  });

  it('funziona anche senza una data di fine (finestra aperta)', async () => {
    const supabase = fakeSelectClient([{ importo: 50 }]);
    const result = await getTransactionAmountsForGoal(supabase, 'goal-1', '2026-01-01', null);
    expect(result).toEqual([50]);
  });

  it('ritorna un array vuoto se non ci sono spese collegate', async () => {
    const supabase = fakeSelectClient([]);
    const result = await getTransactionAmountsForGoal(supabase, 'goal-1', '2026-01-01', null);
    expect(result).toEqual([]);
  });
});

describe('getSpeseCasaPerCategorie', () => {
  it('legge solo le spese della casa nelle categorie e dal giorno dati, con un tetto', async () => {
    const { client, calls } = createRecordingClient([row]);
    const r = await getSpeseCasaPerCategorie(client, 'H1', ['c1', 'c2'], '2026-01-01');
    expect(r).toHaveLength(1);
    expect(r[0].categoriaId).toBe('cat-1');
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('transactions');
    expect(callsOf(calls[0], 'eq')).toEqual([['household_id', 'H1'], ['tipo', 'expense']]);
    expect(callsOf(calls[0], 'in')).toEqual([['categoria_id', ['c1', 'c2']]]);
    expect(callsOf(calls[0], 'gte')).toEqual([['data', '2026-01-01']]);
    expect(callsOf(calls[0], 'limit')).toHaveLength(1);
  });

  it('senza categorie non fa nessuna query', async () => {
    const { client, calls } = createRecordingClient([row]);
    expect(await getSpeseCasaPerCategorie(client, 'H1', [], '2026-01-01')).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
