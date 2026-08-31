'use client';

import { useState } from 'react';
import { Wallet, PiggyBank } from 'lucide-react';
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

  const saldoNumerico = Number(saldo);
  const isValid = saldo.trim() !== '' && !Number.isNaN(saldoNumerico);

  const hasTarget = account.targetSaldo !== null;
  const progressPercent = hasTarget
    ? Math.min(100, Math.max(0, (account.saldoAttuale / account.targetSaldo!) * 100))
    : 0;

  const Icon = account.contaInDisponibile ? Wallet : PiggyBank;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-dark">
            <Icon size={18} />
          </span>
          <span className="font-semibold">{account.nome}</span>
        </div>
        <span className="tabular-nums font-semibold">{formatEuro(account.saldoAttuale)}</span>
      </div>

      {hasTarget && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-sm text-muted">
            {formatEuro(account.saldoAttuale)} / {formatEuro(account.targetSaldo!)}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <input
          aria-label="Aggiorna saldo"
          type="number"
          inputMode="decimal"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          className="w-full min-w-0 rounded-[var(--radius-sm)] border border-black/5 bg-surface-muted px-3 py-2 text-sm outline-none focus-visible:border-brand"
        />
        <button
          type="button"
          disabled={!isValid}
          onClick={() => onUpdateBalance(account.id, saldoNumerico)}
          className="shrink-0 rounded-[var(--radius-sm)] bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-40"
        >
          Aggiorna
        </button>
      </div>
    </div>
  );
}
