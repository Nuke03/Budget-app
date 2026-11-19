/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import {
  getTransactions,
  createTransaction,
  modificaMovimento,
  eliminaMovimento,
  getLastIncomeDate,
  getRecentTransactionAmounts,
  getTransactionAmountsForGoal,
  getSpeseCasaPerCategorie,
} from '@/lib/data/transactions';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';
import { fakeRpcClient } from '../helpers/fakeRpc';
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
  stima: false,
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
        stima: false,
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

describe('stima', () => {
  const base = {
    tipo: 'expense' as const,
    importo: 30,
    data: '2026-11-05',
    categoriaId: null as string | null,
    accountId: 'acc-1',
    goalId: null,
    descrizione: 'Spesa',
    nota: null,
  };

  it('createTransaction con stima true la scrive', async () => {
    const { client, calls } = createRecordingClient([row]);
    await createTransaction(client, { ...base, stima: true });
    expect(callsOf(calls[0], 'insert')[0][0]).toMatchObject({ stima: true });
  });

  it('createTransaction senza stima scrive false', async () => {
    const { client, calls } = createRecordingClient([row]);
    await createTransaction(client, base);
    expect(callsOf(calls[0], 'insert')[0][0]).toMatchObject({ stima: false });
  });
});

describe('modificaMovimento', () => {
  const input = {
    tipo: 'expense' as const,
    importo: 70,
    data: '2026-11-05',
    categoriaId: 'cat-1' as string | null,
    accountId: 'acc-1' as string | null,
    goalId: 'g-1' as string | null,
    descrizione: 'Luce',
    nota: 'bolletta' as string | null,
  };

  it('chiama modifica_movimento con TUTTI i campi (categoria, obiettivo e nota si sovrascrivono)', async () => {
    const { client, calls } = fakeRpcClient({ modifica_movimento: {} });
    await modificaMovimento(client, 'm1', input);
    expect(calls).toEqual([
      {
        name: 'modifica_movimento',
        args: {
          p_id: 'm1',
          p_tipo: 'expense',
          p_importo: 70,
          p_data: '2026-11-05',
          p_categoria: 'cat-1',
          p_account: 'acc-1',
          p_goal: 'g-1',
          p_descrizione: 'Luce',
          p_nota: 'bolletta',
          p_stima: false,
        },
      },
    ]);
  });

  it('con una categoria la stima si toglie; senza categoria resta com è (null)', async () => {
    const a = fakeRpcClient({ modifica_movimento: {} });
    await modificaMovimento(a.client, 'm1', { ...input, categoriaId: null, accountId: null, goalId: null, nota: null });
    expect(a.calls[0].args).toMatchObject({ p_categoria: null, p_account: null, p_goal: null, p_nota: null, p_stima: null });
  });

  it('rilancia l errore della rpc', async () => {
    const { client } = fakeRpcClient({ modifica_movimento: { error: { message: 'movimento non modificabile' } } });
    await expect(modificaMovimento(client, 'm1', input)).rejects.toMatchObject({ message: 'movimento non modificabile' });
  });
});

describe('eliminaMovimento', () => {
  it('chiama elimina_movimento con p_id', async () => {
    const { client, calls } = fakeRpcClient({ elimina_movimento: {} });
    await eliminaMovimento(client, 'm1');
    expect(calls).toEqual([{ name: 'elimina_movimento', args: { p_id: 'm1' } }]);
  });

  it('rilancia l errore della rpc', async () => {
    const { client } = fakeRpcClient({ elimina_movimento: { error: { message: 'rete' } } });
    await expect(eliminaMovimento(client, 'm1')).rejects.toMatchObject({ message: 'rete' });
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

  it('con inizio escluso usa gt, altrimenti gte', async () => {
    const escluso = createRecordingClient([{ importo: 1 }]);
    await getTransactionAmountsForGoal(escluso.client, 'goal-1', '2026-06-01', '2026-07-01', true);
    expect(callsOf(escluso.calls[0], 'gt')).toContainEqual(['data', '2026-06-01']);
    expect(callsOf(escluso.calls[0], 'gte')).toHaveLength(0);
    const incluso = createRecordingClient([{ importo: 1 }]);
    await getTransactionAmountsForGoal(incluso.client, 'goal-1', '2026-06-01', '2026-07-01');
    expect(callsOf(incluso.calls[0], 'gte')).toContainEqual(['data', '2026-06-01']);
    expect(callsOf(incluso.calls[0], 'gt')).toHaveLength(0);
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
