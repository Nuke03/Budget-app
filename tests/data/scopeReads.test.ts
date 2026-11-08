/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { getAccounts, createAccount } from '@/lib/data/accounts';
import { getCategories, createCategory } from '@/lib/data/categories';
import { getOpenGoals, createGoal } from '@/lib/data/goals';
import {
  getTransactions,
  createTransaction,
  getLastIncomeDate,
  getRecentTransactionAmounts,
} from '@/lib/data/transactions';
import { casa } from '@/lib/data/scope';
import { createRecordingClient, callsOf } from '../helpers/recordingSupabase';

const reads: [string, (c: any, scope?: any) => Promise<unknown>][] = [
  ['getAccounts', (c, s) => getAccounts(c, s)],
  ['getCategories', (c, s) => getCategories(c, s)],
  ['getOpenGoals', (c, s) => getOpenGoals(c, s)],
  ['getTransactions', (c, s) => getTransactions(c, s)],
  ['getLastIncomeDate', (c, s) => getLastIncomeDate(c, s)],
  ['getRecentTransactionAmounts', (c, s) => getRecentTransactionAmounts(c, 'cat-1', 5, 'spesa', s)],
];

describe('letture con scope', () => {
  it.each(reads)('%s senza scope filtra household_id is null', async (_n, fn) => {
    const { client, calls } = createRecordingClient();
    await fn(client);
    expect(callsOf(calls[0], 'is')).toContainEqual(['household_id', null]);
    expect(callsOf(calls[0], 'eq').map((a) => a[0])).not.toContain('household_id');
  });

  it.each(reads)('%s con scope casa filtra eq(household_id, h1)', async (_n, fn) => {
    const { client, calls } = createRecordingClient();
    await fn(client, casa('h1'));
    expect(callsOf(calls[0], 'eq')).toContainEqual(['household_id', 'h1']);
    expect(callsOf(calls[0], 'is').map((a) => a[0])).not.toContain('household_id');
  });
});

const creates: [string, (c: any, scope?: any) => Promise<unknown>][] = [
  ['createAccount', (c, s) => createAccount(c, { nome: 'x', saldoAttuale: 1, contaInDisponibile: true, targetSaldo: null }, s)],
  ['createCategory', (c, s) => createCategory(c, { nome: 'x', tipo: 'expense', colore: null }, s)],
  [
    'createGoal',
    (c, s) =>
      createGoal(
        c,
        { nome: 'x', importoTarget: 1, modalita: 'bloccato', scadenza: null, categoriaId: null, ricorrente: false, frequenzaMesi: null },
        s
      ),
  ],
  [
    'createTransaction',
    (c, s) =>
      createTransaction(
        c,
        { tipo: 'expense', importo: 1, data: '2026-01-01', categoriaId: null, accountId: null, goalId: null, descrizione: 'x', nota: null },
        s
      ),
  ],
];

describe('create con scope', () => {
  it.each(creates)('%s con scope casa scrive household_id', async (_n, fn) => {
    const { client, calls } = createRecordingClient([{}]);
    await fn(client, casa('h1'));
    expect(callsOf(calls[0], 'insert')[0][0]).toMatchObject({ household_id: 'h1' });
  });

  it.each(creates)('%s senza scope scrive household_id null', async (_n, fn) => {
    const { client, calls } = createRecordingClient([{}]);
    await fn(client);
    expect(callsOf(calls[0], 'insert')[0][0]).toMatchObject({ household_id: null });
  });
});
