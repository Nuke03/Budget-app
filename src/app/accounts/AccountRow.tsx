'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { formatEuro, formatNumero } from '@/lib/format';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';
import { RigaRientro } from '@/app/rientri/RigaRientro';
import type { SituazioneRientroConto } from '@/lib/calculations/rientri';
import type { Account } from '@/lib/types';

const fieldClass =
  'min-h-11 rounded-[var(--radius-sm)] border border-rule bg-page px-3 text-base text-foreground focus-visible:border-brand';

export function AccountRow({
  account,
  onUpdateBalance,
  onUpdateDetails,
  contoTasse = false,
  rientri = [],
  onFermaRientro,
  onLasciaStare,
}: {
  account: Account;
  // Il conto delle tasse della P.IVA: non conta mai nel disponibile, quindi niente interruttore.
  contoTasse?: boolean;
  // I rientri verso questo conto: sotto il saldo, la riga con "Ferma" e, se c'è da spostare, "Lascia stare".
  rientri?: SituazioneRientroConto[];
  onFermaRientro?: (id: string) => Promise<void>;
  onLasciaStare?: (id: string) => Promise<void>;
  onUpdateBalance: (id: string, saldo: number) => void;
  onUpdateDetails?: (
    id: string,
    details: { nome: string; contaInDisponibile: boolean; targetSaldo: number | null }
  ) => void;
}) {
  const [saldo, setSaldo] = useState(formatNumero(account.saldoAttuale));
  const [aggiornando, setAggiornando] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editNome, setEditNome] = useState(account.nome);
  const [editContaInDisponibile, setEditContaInDisponibile] = useState(account.contaInDisponibile);
  const [editTargetSaldo, setEditTargetSaldo] = useState(
    account.targetSaldo !== null ? String(account.targetSaldo) : ''
  );

  const negativo = saldo.trim().startsWith('-');
  const letto = parseImporto(negativo ? saldo.trim().slice(1) : saldo);
  const saldoNumerico = letto === null ? null : negativo ? -letto : letto;

  const hasTarget = account.targetSaldo !== null;
  const progressPercent = hasTarget
    ? Math.min(100, Math.max(0, (account.saldoAttuale / account.targetSaldo!) * 100))
    : 0;

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
      contaInDisponibile: contoTasse ? false : editContaInDisponibile,
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

        {contoTasse ? (
          <p className="text-[13px] text-ink-2">È il conto tasse: resta fuori dal disponibile.</p>
        ) : (
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
        )}

        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Saldo da raggiungere (opzionale)
          <input
            aria-label="Saldo da raggiungere (opzionale)"
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
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 break-words text-[15px] font-semibold">{account.nome}</span>
        <div className="flex shrink-0 items-center">
          <span className="num font-serif text-xl font-semibold">{formatEuro(account.saldoAttuale)}</span>
          {onUpdateDetails && (
            <button
              type="button"
              onClick={startEdit}
              aria-label="Modifica conto"
              className="ml-1 flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-brand-tint"
            >
              <Pencil size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {rientri
        .filter((s) => s.rientro.stato !== 'chiuso' && !s.finito && (s.rientro.stato === 'aperto' || s.daSpostare > 0))
        .map((s) => (
          <RigaRientro
            key={s.rientro.id}
            rientro={s.rientro}
            situazione={s}
            onFerma={() => onFermaRientro?.(s.rientro.id) ?? Promise.resolve()}
            onLasciaStare={onLasciaStare ? () => onLasciaStare(s.rientro.id) : undefined}
          />
        ))}

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

      {aggiornando ? (
        <div className="flex gap-2">
          <input
            aria-label="Nuovo saldo"
            type="text"
            inputMode="decimal"
            autoFocus
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
            className={`${fieldClass} w-full min-w-0`}
          />
          <button
            type="button"
            disabled={saldoNumerico === null}
            onClick={() => {
              if (saldoNumerico === null) return;
              onUpdateBalance(account.id, saldoNumerico);
              setAggiornando(false);
            }}
            className="min-h-11 shrink-0 rounded-[var(--radius-sm)] bg-brand px-4 py-2 text-[15px] font-semibold text-brand-foreground disabled:opacity-40"
          >
            Salva
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSaldo(formatNumero(account.saldoAttuale));
            setAggiornando(true);
          }}
          className="min-h-11 self-start rounded-[var(--radius-sm)] bg-brand-tint px-4 py-2 text-[15px] font-semibold text-brand-dark"
        >
          Aggiorna il saldo
        </button>
      )}
    </div>
  );
}
