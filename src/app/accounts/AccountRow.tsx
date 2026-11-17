'use client';

import { useState } from 'react';
import { Wallet, PiggyBank, Pencil } from 'lucide-react';
import { formatEuro } from '@/lib/format';
import type { Account } from '@/lib/types';

const fieldClass =
  'min-h-11 rounded-[var(--radius-sm)] border border-rule bg-page px-3 text-[15px] text-foreground focus-visible:border-brand';

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
      <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-rule bg-surface p-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Nome conto
          <input
            aria-label="Nome conto"
            value={editNome}
            onChange={(e) => setEditNome(e.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="flex min-h-11 items-center gap-2.5 text-[15px] font-medium">
          <input
            aria-label="Conta nel disponibile libero"
            type="checkbox"
            checked={editContaInDisponibile}
            onChange={(e) => setEditContaInDisponibile(e.target.checked)}
            className="h-5 w-5 accent-brand"
          />
          Conta nel disponibile libero
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
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
            className="min-h-11 flex-1 rounded-[var(--radius-sm)] bg-brand py-2 text-[15px] font-semibold text-brand-foreground disabled:opacity-40"
          >
            Salva modifiche
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="min-h-11 flex-1 rounded-[var(--radius-sm)] bg-brand-tint py-2 text-[15px] font-semibold text-foreground"
          >
            Annulla
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-rule bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-dark">
            <Icon size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 break-words text-[15px] font-semibold">{account.nome}</span>
          {onUpdateDetails && (
            <button
              type="button"
              onClick={startEdit}
              aria-label="Modifica conto"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-brand-tint"
            >
              <Pencil size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <span className="num shrink-0 pl-2 font-serif text-xl font-semibold">{formatEuro(account.saldoAttuale)}</span>
      </div>

      {hasTarget && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-brand-tint">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="num text-[13px] text-ink-2">
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
          className={`${fieldClass} w-full min-w-0`}
        />
        <button
          type="button"
          disabled={!isValid}
          onClick={() => onUpdateBalance(account.id, saldoNumerico)}
          className="min-h-11 shrink-0 rounded-[var(--radius-sm)] bg-brand px-4 py-2 text-[15px] font-semibold text-brand-foreground disabled:opacity-40"
        >
          Aggiorna
        </button>
      </div>
    </div>
  );
}
