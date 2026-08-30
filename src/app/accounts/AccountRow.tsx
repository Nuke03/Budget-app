'use client';

import { useState } from 'react';
import { formatEuro } from '@/lib/format';
import type { Account } from '@/lib/types';

export function AccountRow({
  account,
  onUpdateBalance,
}: {
  account: Account;
  onUpdateBalance: (id: string, saldo: number) => void;
}) {
  const [saldo, setSaldo] = useState(String(account.saldoAttuale));

  return (
    <div className="rounded border p-3">
      <div className="flex justify-between font-medium">
        <span>{account.nome}</span>
        <span>{formatEuro(account.saldoAttuale)}</span>
      </div>

      {account.targetSaldo !== null && (
        <p className="text-sm text-slate-500">
          {formatEuro(account.saldoAttuale)} / {formatEuro(account.targetSaldo)}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <input
          aria-label="Aggiorna saldo"
          type="number"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          className="w-32 rounded border p-1"
        />
        <button
          type="button"
          onClick={() => onUpdateBalance(account.id, Number(saldo))}
          className="rounded bg-slate-900 px-3 py-1 text-sm text-white"
        >
          Aggiorna
        </button>
      </div>
    </div>
  );
}
