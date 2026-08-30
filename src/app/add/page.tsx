'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { getCategories } from '@/lib/data/categories';
import { getAccounts } from '@/lib/data/accounts';
import { createTransaction } from '@/lib/data/transactions';
import { AddTransactionForm } from './AddTransactionForm';
import type { Account, Category } from '@/lib/types';

export default function AddTransactionPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([getCategories(supabase), getAccounts(supabase)]).then(([cats, accs]) => {
      setCategories(cats);
      setAccounts(accs);
    });
  }, []);

  async function handleSubmit(payload: {
    tipo: 'expense' | 'income';
    importo: number;
    categoriaId: string | null;
    accountId: string | null;
    descrizione: string;
  }) {
    const supabase = createClient();
    await createTransaction(supabase, {
      ...payload,
      data: format(new Date(), 'yyyy-MM-dd'),
      goalId: null,
      nota: null,
    });
    router.push('/');
  }

  return <AddTransactionForm categories={categories} accounts={accounts} onSubmit={handleSubmit} />;
}
