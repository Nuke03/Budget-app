'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { Account, Category, TransactionTipo } from '@/lib/types';

interface SubmitPayload {
  tipo: TransactionTipo;
  importo: number;
  categoriaId: string | null;
  accountId: string | null;
  descrizione: string;
}

const CATEGORY_FALLBACK_COLOR = 'var(--cat-slate)';

export function AddTransactionForm({
  categories,
  accounts,
  onSubmit,
}: {
  categories: Category[];
  accounts: Account[];
  onSubmit: (payload: SubmitPayload) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<TransactionTipo>('expense');
  const [importo, setImporto] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(categories[0]?.id ?? null);
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const categorieDisponibili = categories.filter((c) => !c.archiviata && c.tipo === tipo);

  useEffect(() => {
    if (categoriaId !== null && categorieDisponibili.some((c) => c.id === categoriaId)) {
      return;
    }
    setCategoriaId(categorieDisponibili[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, categories]);

  useEffect(() => {
    if (accountId !== null && accounts.some((a) => a.id === accountId)) {
      return;
    }
    setAccountId(accounts[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  const importoNumerico = Number(importo);
  const isValid = importo.trim() !== '' && !Number.isNaN(importoNumerico) && descrizione.trim() !== '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const payload: SubmitPayload = { tipo, importo: importoNumerico, categoriaId, accountId, descrizione };

    setStatus('saved');
    setImporto('');
    setDescrizione('');

    onSubmit(payload).catch(() => setStatus('error'));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-5 pb-5">
      <div className="flex gap-1.5 rounded-full bg-surface-muted p-1">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors duration-150 ${
              tipo === t ? 'bg-surface text-foreground shadow-[var(--shadow-card)]' : 'text-muted'
            }`}
          >
            {t === 'expense' ? 'Spesa' : 'Entrata'}
          </button>
        ))}
      </div>

      <label className="flex flex-col items-center gap-1 py-2 text-center">
        <span className="text-xs font-medium text-muted">Importo</span>
        <div className="flex items-baseline gap-1">
          <input
            aria-label="Importo"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            className="w-40 bg-transparent text-center text-5xl font-bold tabular-nums text-foreground outline-none placeholder:text-muted/40"
          />
          <span className="text-2xl font-bold text-muted">€</span>
        </div>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Descrizione
        <input
          aria-label="Descrizione"
          type="text"
          placeholder="Es. Spesa al supermercato"
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          className="rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base text-foreground outline-none focus-visible:border-brand"
        />
      </label>

      {categorieDisponibili.length > 0 && (
        <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Categoria
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {categorieDisponibili.map((c) => {
              const color = c.colore ?? CATEGORY_FALLBACK_COLOR;
              const isSelected = categoriaId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoriaId(c.id)}
                  style={
                    isSelected
                      ? { backgroundColor: color, borderColor: color }
                      : { borderColor: color, color }
                  }
                  className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                    isSelected ? 'text-white' : 'bg-surface'
                  }`}
                >
                  {c.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Conto
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {accounts.map((a) => {
              const isSelected = accountId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccountId(a.id)}
                  className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                    isSelected
                      ? 'border-brand bg-brand text-white'
                      : 'border-black/10 bg-surface text-foreground'
                  }`}
                >
                  {a.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid}
        className="rounded-[var(--radius-md)] bg-brand py-3.5 text-base font-semibold text-brand-foreground shadow-[var(--shadow-fab)] disabled:opacity-40 disabled:shadow-none"
      >
        Salva
      </button>

      {status === 'saved' && (
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-brand-dark">
          <CheckCircle2 size={18} />
          <span>Salvata ✓</span>
        </p>
      )}
      {status === 'error' && (
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-danger">
          <AlertCircle size={18} />
          Salvataggio fallito, controlla la connessione e riprova.
        </p>
      )}
    </form>
  );
}
