import { describe, it, expect } from 'vitest';
import { getAccounts, createAccount, updateAccountBalance, updateAccountDetails } from '@/lib/data/accounts';
import { fakeSelectClient, fakeMutationClient } from '../helpers/fakeSupabase';

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
      { id: '1', nome: 'Conto corrente', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null },
    ]);
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
    });
  });
});
