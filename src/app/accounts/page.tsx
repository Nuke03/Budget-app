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
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">Conti</h1>

      <div className="flex flex-col gap-3">
        {accounts.map((a) => (
          <AccountRow key={a.id} account={a} onUpdateBalance={handleUpdateBalance} />
        ))}
      </div>

      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-bold">Nuovo conto</h2>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Es. Conto corrente"
          className="rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand"
        />
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            checked={contaInDisponibile}
            onChange={(e) => setContaInDisponibile(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Conta nel disponibile libero
        </label>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!nome.trim()}
          className="rounded-[var(--radius-md)] bg-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-40"
        >
          Aggiungi conto
        </button>
      </section>
    </main>
  );
}
