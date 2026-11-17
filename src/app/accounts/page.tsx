'use client';

import { useEffect, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { createClient } from '@/lib/supabase/client';
import { getAccounts, updateAccountBalance, updateAccountDetails, createAccount } from '@/lib/data/accounts';
import { ContiVista } from './ContiVista';
import type { Account } from '@/lib/types';

export default function AccountsPage() {
  const fail = useThrowToBoundary();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [nome, setNome] = useState('');
  const [contaInDisponibile, setContaInDisponibile] = useState(true);

  async function refresh() {
    const supabase = createClient();
    setAccounts(await getAccounts(supabase));
  }

  useEffect(() => {
    refresh().catch(fail);
  }, [fail]);

  async function handleUpdateBalance(id: string, saldo: number) {
    const supabase = createClient();
    await updateAccountBalance(supabase, id, saldo);
    await refresh();
  }

  async function handleUpdateDetails(
    id: string,
    details: { nome: string; contaInDisponibile: boolean; targetSaldo: number | null }
  ) {
    const supabase = createClient();
    await updateAccountDetails(supabase, id, details);
    await refresh();
  }

  async function handleCreate() {
    if (!nome.trim()) return;
    const supabase = createClient();
    await createAccount(supabase, {
      nome,
      saldoAttuale: 0,
      contaInDisponibile,
      targetSaldo: null,
    });
    setNome('');
    await refresh();
  }

  return (
    <>
      <ContiVista
        accounts={accounts}
        nome={nome}
        onNome={setNome}
        contaInDisponibile={contaInDisponibile}
        onContaInDisponibile={setContaInDisponibile}
        onUpdateBalance={handleUpdateBalance}
        onUpdateDetails={handleUpdateDetails}
        onCreate={handleCreate}
      />
    </>
  );
}
