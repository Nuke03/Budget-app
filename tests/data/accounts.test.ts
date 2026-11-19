import { describe, it, expect } from 'vitest';
import { getAccounts, createAccount, updateAccountBalance, updateAccountDetails, adjustAccountBalance } from '@/lib/data/accounts';
import { fakeRpcClient } from '../helpers/fakeRpc';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';
import { createRecordingClient, callsOf } from '../helpers/recordingSupabase';
import { casa } from '@/lib/data/scope';

describe('getAccounts', () => {
  it('mappa le righe snake_case in oggetti Account camelCase', async () => {
    const supabase = fakeSelectClient([
      {
        id: '1',
        nome: 'Conto corrente',
        saldo_attuale: 500,
        conta_in_disponibile: true,
        target_saldo: null,
      },
    ]);

    const result = await getAccounts(supabase);

    expect(result).toEqual([
      { id: '1', nome: 'Conto corrente', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null, archiviato: false },
    ]);
  });

  it('getAccounts personale esclude gli archiviati', async () => {
    const { client, calls } = createRecordingClient([]);
    await getAccounts(client);
    expect(callsOf(calls[0], 'eq')).toContainEqual(['archiviato', false]);
  });

  it('getAccounts casa non filtra per archiviato', async () => {
    const { client, calls } = createRecordingClient([]);
    await getAccounts(client, casa('h1'));
    expect(callsOf(calls[0], 'eq').some((a) => a[0] === 'archiviato')).toBe(false);
  });
});

describe('createAccount', () => {
  it('inserisce e ritorna il conto mappato', async () => {
    const supabase = fakeMutationClient({
      id: '2',
      nome: 'Fondo emergenza',
      saldo_attuale: 0,
      conta_in_disponibile: false,
      target_saldo: 3000,
    });

    const result = await createAccount(supabase, {
      nome: 'Fondo emergenza',
      saldoAttuale: 0,
      contaInDisponibile: false,
      targetSaldo: 3000,
    });

    expect(result).toEqual({
      id: '2',
      nome: 'Fondo emergenza',
      saldoAttuale: 0,
      contaInDisponibile: false,
      targetSaldo: 3000,
      archiviato: false,
    });
  });
});

describe('updateAccountBalance', () => {
  it('non lancia errori quando la scrittura va a buon fine', async () => {
    const supabase = fakeMutationClient(null);
    await expect(updateAccountBalance(supabase, '1', 750)).resolves.toBeUndefined();
  });
});

describe('updateAccountDetails', () => {
  it('aggiorna e ritorna il conto mappato', async () => {
    const supabase = fakeMutationClient({
      id: '1',
      nome: 'Fondo sicurezza',
      saldo_attuale: 500,
      conta_in_disponibile: true,
      target_saldo: 5000,
    });

    const result = await updateAccountDetails(supabase, '1', {
      nome: 'Fondo sicurezza',
      contaInDisponibile: true,
      targetSaldo: 5000,
    });

    expect(result).toEqual({
      id: '1',
      nome: 'Fondo sicurezza',
      saldoAttuale: 500,
      contaInDisponibile: true,
      targetSaldo: 5000,
      archiviato: false,
    });
  });
});

describe('adjustAccountBalance', () => {
  it('adjustAccountBalance chiama adjust_account_balance con p_account e p_delta', async () => {
    const { client, calls } = fakeRpcClient({ adjust_account_balance: {} });
    await adjustAccountBalance(client, 'acc-1', -25.5);
    expect(calls).toEqual([{ name: 'adjust_account_balance', args: { p_account: 'acc-1', p_delta: -25.5 } }]);
  });

  it('rilancia l errore della RPC', async () => {
    const { client } = fakeRpcClient({ adjust_account_balance: { error: { message: 'conto non trovato' } } });
    await expect(adjustAccountBalance(client, 'x', 1)).rejects.toMatchObject({ message: 'conto non trovato' });
  });
});
