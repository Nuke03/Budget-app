'use client';

import { useState } from 'react';
import { Wallet, PiggyBank, Pencil } from 'lucide-react';
import { formatEuro } from '@/lib/format';
import type { Account } from '@/lib/types';

const fieldClass =
  'rounded-[var(--radius-sm)] border border-black/5 bg-surface-muted px-3 py-2 text-sm outline-none focus-visible:border-brand';

export function AccountRow({
  account,
  onUpdateBalance,
  onUpdateDetails,
}: {
  account: Account;
  onUpdateBalance: (id: string, saldo: number) => void;
  onUpdateDetails?: (
    id: string,
    details: { nome: string; contaInDisponibile: boolean; targetSaldo: number | null }
  ) => void;
}) {
  const [saldo, setSaldo] = useState(String(account.saldoAttuale));
  const [isEditing, setIsEditing] = useState(false);
  const [editNome, setEditNome] = useState(account.nome);
  const [editContaInDisponibile, setEditContaInDisponibile] = useState(account.contaInDisponibile);
  const [editTargetSaldo, setEditTargetSaldo] = useState(
    account.targetSaldo !== null ? String(account.targetSaldo) : ''
  );

  const saldoNumerico = Number(saldo);
  const isValid = saldo.trim() !== '' && !Number.isNaN(saldoNumerico);

  const hasTarget = account.targetSaldo !== null;
  const progressPercent = hasTarget
    ? Math.min(100, Math.max(0, (account.saldoAttuale / account.targetSaldo!) * 100))
    : 0;

  const Icon = account.contaInDisponibile ? Wallet : PiggyBank;

  function startEdit() {
    setEditNome(account.nome);
    setEditContaInDisponibile(account.contaInDisponibile);
    setEditTargetSaldo(account.targetSaldo !== null ? String(account.targetSaldo) : '');
    setIsEditing(true);
  }

  function handleSaveDetails() {
    if (!onUpdateDetails || !editNome.trim()) return;
    onUpdateDetails(account.id, {
      nome: editNome,
      contaInDisponibile: editContaInDisponibile,
      targetSaldo: editTargetSaldo.trim() === '' ? null : Number(editTargetSaldo),
    });
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-card)]">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Nome conto
          <input
            aria-label="Nome conto"
            value={editNome}
            onChange={(e) => setEditNome(e.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            aria-label="Conta nel disponibile libero"
            type="checkbox"
            checked={editContaInDisponibile}
            onChange={(e) => setEditContaInDisponibile(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Conta nel disponibile libero
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Obiettivo di saldo (opzionale)
          <input
            aria-label="Obiettivo di saldo (opzionale)"
            type="number"
            inputMode="decimal"
            value={editTargetSaldo}
            onChange={(e) => setEditTargetSaldo(e.target.value)}
            className={fieldClass}
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={!editNome.trim()}
            onClick={handleSaveDetails}
            className="flex-1 rounded-[var(--radius-sm)] bg-brand py-2 text-sm font-semibold text-brand-foreground disabled:opacity-40"
          >
            Salva modifiche
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="flex-1 rounded-[var(--radius-sm)] bg-surface-muted py-2 text-sm font-semibold text-foreground"
          >
            Annulla
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-dark">
            <Icon size={18} />
          </span>
          <span className="font-semibold">{account.nome}</span>
          {onUpdateDetails && (
            <button
              type="button"
              onClick={startEdit}
              aria-label="Modifica conto"
              className="rounded-full p-1 text-muted hover:bg-surface-muted hover:text-foreground"
            >
              <Pencil size={14} />
            </button>
          )}
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
