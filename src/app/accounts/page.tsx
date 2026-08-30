'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getAccounts, updateAccountBalance, createAccount } from '@/lib/data/accounts';
import { AccountRow } from './AccountRow';
import type { Account } from '@/lib/types';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [nome, setNome] = useState('');
  const [contaInDisponibile, setContaInDisponibile] = useState(true);

  async function refresh() {
    const supabase = createClient();
    setAccounts(await getAccounts(supabase));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleUpdateBalance(id: string, saldo: number) {
    const supabase = createClient();
    await updateAccountBalance(supabase, id, saldo);
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
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">Conti</h1>
      {accounts.map((a) => (
        <AccountRow key={a.id} account={a} onUpdateBalance={handleUpdateBalance} />
      ))}

      <h2 className="text-lg font-semibold">Nuovo conto</h2>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome conto"
        className="rounded border p-2"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={contaInDisponibile}
          onChange={(e) => setContaInDisponibile(e.target.checked)}
        />
        Conta nel disponibile libero
      </label>
      <button type="button" onClick={handleCreate} className="rounded bg-slate-900 p-2 text-white">
        Aggiungi conto
      </button>
    </main>
  );
}
