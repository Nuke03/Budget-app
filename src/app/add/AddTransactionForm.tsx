'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { Account, BudgetGoal, Category, TransactionTipo } from '@/lib/types';

interface SubmitPayload {
  tipo: TransactionTipo;
  importo: number;
  categoriaId: string | null;
  accountId: string | null;
  goalId: string | null;
  descrizione: string;
}

export interface AddTransactionFormValues {
  tipo: TransactionTipo;
  importo: number;
  categoriaId: string | null;
  accountId: string | null;
  goalId?: string | null;
  descrizione: string;
}

interface NuovoGoalPayload {
  nome: string;
  importoTarget: number;
  categoriaId: string | null;
}

const CATEGORY_FALLBACK_COLOR = 'var(--cat-slate)';

// Riferimento stabile: un default parameter `= []` creerebbe un nuovo array
// ad ogni render quando il chiamante non passa `goals`, facendo scattare
// l'effect di sincronizzazione qui sotto ad ogni render (loop infinito).
const NESSUN_GOAL: BudgetGoal[] = [];

export function AddTransactionForm({
  categories,
  accounts,
  goals = NESSUN_GOAL,
  initial,
  submitLabel = 'Salva',
  onCancel,
  onCreateGoal,
  onSubmit,
}: {
  categories: Category[];
  accounts: Account[];
  goals?: BudgetGoal[];
  initial?: AddTransactionFormValues | null;
  submitLabel?: string;
  onCancel?: () => void;
  onCreateGoal?: (payload: NuovoGoalPayload) => Promise<BudgetGoal>;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<TransactionTipo>(initial?.tipo ?? 'expense');
  const [importo, setImporto] = useState(initial ? String(initial.importo) : '');
  const [descrizione, setDescrizione] = useState(initial?.descrizione ?? '');
  const [categoriaId, setCategoriaId] = useState<string | null>(
    initial?.categoriaId ?? categories[0]?.id ?? null
  );
  const [accountId, setAccountId] = useState<string | null>(
    initial?.accountId ?? accounts[0]?.id ?? null
  );
  const [goalId, setGoalId] = useState<string | null>(initial?.goalId ?? null);
  const [goalsDisponibili, setGoalsDisponibili] = useState<BudgetGoal[]>(goals);
  const [isCreatingGoal, setIsCreatingGoal] = useState(false);
  const [nuovoGoalNome, setNuovoGoalNome] = useState('');
  const [nuovoGoalImporto, setNuovoGoalImporto] = useState('');
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

  useEffect(() => {
    setGoalsDisponibili(goals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals]);

  // Collegare un obiettivo ha senso solo per una spesa: gli obiettivi
  // tracciano quanto è già stato speso su di loro (vedi getSpecoCollegato),
  // non un'entrata.
  useEffect(() => {
    if (tipo !== 'expense') {
      setGoalId(null);
      setIsCreatingGoal(false);
    }
  }, [tipo]);

  const importoNumerico = Number(importo);
  const isValid = importo.trim() !== '' && !Number.isNaN(importoNumerico) && descrizione.trim() !== '';

  const nuovoGoalImportoNumerico = Number(nuovoGoalImporto);
  const isNuovoGoalValido =
    !!onCreateGoal &&
    nuovoGoalNome.trim() !== '' &&
    nuovoGoalImporto.trim() !== '' &&
    !Number.isNaN(nuovoGoalImportoNumerico);

  async function handleCreateGoal() {
    if (!onCreateGoal || !isNuovoGoalValido) return;

    const nuovoGoal = await onCreateGoal({
      nome: nuovoGoalNome,
      importoTarget: nuovoGoalImportoNumerico,
      categoriaId,
    });

    setGoalsDisponibili((prev) => [...prev, nuovoGoal]);
    setGoalId(nuovoGoal.id);
    setIsCreatingGoal(false);
    setNuovoGoalNome('');
    setNuovoGoalImporto('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const payload: SubmitPayload = {
      tipo,
      importo: importoNumerico,
      categoriaId,
      accountId,
      goalId: tipo === 'expense' ? goalId : null,
      descrizione,
    };

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

      {tipo === 'expense' && (goalsDisponibili.length > 0 || onCreateGoal) && (
        <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Obiettivo (opzionale)
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {goalsDisponibili.map((g) => {
              const isSelected = goalId === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoalId(isSelected ? null : g.id)}
                  className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                    isSelected
                      ? 'border-brand bg-brand text-white'
                      : 'border-black/10 bg-surface text-foreground'
                  }`}
                >
                  {g.nome}
                </button>
              );
            })}
            {onCreateGoal && (
              <button
                type="button"
                onClick={() => setIsCreatingGoal((v) => !v)}
                className="shrink-0 rounded-full border-2 border-dashed border-black/20 bg-surface px-4 py-2 text-sm font-semibold text-muted"
              >
                + Nuovo obiettivo
              </button>
            )}
          </div>

          {isCreatingGoal && (
            <div className="mt-2 flex flex-col gap-2 rounded-[var(--radius-md)] bg-surface-muted p-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Nome
                <input
                  aria-label="Nome nuovo obiettivo"
                  value={nuovoGoalNome}
                  onChange={(e) => setNuovoGoalNome(e.target.value)}
                  placeholder="Es. Assicurazione auto"
                  className="rounded-[var(--radius-sm)] border border-black/5 bg-surface px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Importo target
                <input
                  aria-label="Importo nuovo obiettivo"
                  type="number"
                  inputMode="decimal"
                  value={nuovoGoalImporto}
                  onChange={(e) => setNuovoGoalImporto(e.target.value)}
                  placeholder="0"
                  className="rounded-[var(--radius-sm)] border border-black/5 bg-surface px-3 py-2 text-sm outline-none"
                />
              </label>
              <button
                type="button"
                disabled={!isNuovoGoalValido}
                onClick={handleCreateGoal}
                className="rounded-[var(--radius-sm)] bg-brand py-2 text-sm font-semibold text-brand-foreground disabled:opacity-40"
              >
                Crea e collega
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid}
        className="rounded-[var(--radius-md)] bg-brand py-3.5 text-base font-semibold text-brand-foreground shadow-[var(--shadow-fab)] disabled:opacity-40 disabled:shadow-none"
      >
        {submitLabel}
      </button>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[var(--radius-md)] bg-surface-muted py-3 text-sm font-semibold text-foreground"
        >
          Annulla
        </button>
      )}

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
