'use client';

import { useState } from 'react';
import type { Category, GoalModalita } from '@/lib/types';
import { SuggestAmountPanel } from './SuggestAmountPanel';

interface GoalPayload {
  nome: string;
  importoTarget: number;
  modalita: GoalModalita;
  scadenza: string | null;
  categoriaId: string | null;
  ricorrente: boolean;
  frequenzaMesi: number | null;
}

const FREQUENZA_PRESETS = [
  { label: 'Mensile', mesi: 1 },
  { label: 'Trimestrale', mesi: 3 },
  { label: 'Semestrale', mesi: 6 },
  { label: 'Annuale', mesi: 12 },
] as const;

const fieldClass =
  'rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand';

export function CreateGoalForm({
  categories,
  onSubmit,
}: {
  categories: Category[];
  onSubmit: (payload: GoalPayload) => void;
}) {
  const [nome, setNome] = useState('');
  const [importoTarget, setImportoTarget] = useState('');
  const [modalita, setModalita] = useState<GoalModalita>('bloccato');
  const [scadenza, setScadenza] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [ricorrente, setRicorrente] = useState(false);
  const [frequenzaPreset, setFrequenzaPreset] = useState<number | 'custom'>(1);
  const [frequenzaMesiCustom, setFrequenzaMesiCustom] = useState('2');

  const categorieDisponibili = categories.filter((c) => !c.archiviata && c.tipo === 'expense');

  const frequenzaMesi =
    frequenzaPreset === 'custom' ? Number(frequenzaMesiCustom) : frequenzaPreset;

  const isValid =
    nome.trim() !== '' &&
    importoTarget.trim() !== '' &&
    !Number.isNaN(Number(importoTarget)) &&
    (modalita === 'bloccato' || scadenza.trim() !== '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    onSubmit({
      nome,
      importoTarget: Number(importoTarget),
      modalita,
      scadenza: scadenza.trim() === '' ? null : scadenza,
      categoriaId,
      ricorrente,
      frequenzaMesi: ricorrente ? frequenzaMesi : null,
    });

    setNome('');
    setImportoTarget('');
    setScadenza('');
    setCategoriaId(null);
    setRicorrente(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Nome
        <input
          aria-label="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Es. Viaggio, Telepass..."
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Categoria (opzionale)
        <select
          aria-label="Categoria"
          value={categoriaId ?? ''}
          onChange={(e) => setCategoriaId(e.target.value || null)}
          className={fieldClass}
        >
          <option value="">Nessuna</option>
          {categorieDisponibili.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      {categoriaId && (
        <SuggestAmountPanel
          categoriaId={categoriaId}
          onUseAmount={(importo) => setImportoTarget(String(importo))}
        />
      )}

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Importo target
        <input
          aria-label="Importo target"
          type="number"
          inputMode="decimal"
          value={importoTarget}
          onChange={(e) => setImportoTarget(e.target.value)}
          placeholder="0"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Modalità
        <select
          aria-label="Modalità"
          value={modalita}
          onChange={(e) => setModalita(e.target.value as GoalModalita)}
          className={fieldClass}
        >
          <option value="bloccato">Bloccato</option>
          <option value="dilazionato">Dilazionato</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Scadenza {modalita === 'bloccato' && '(opzionale)'}
        <input
          aria-label="Scadenza"
          type="date"
          value={scadenza}
          onChange={(e) => setScadenza(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input
          type="checkbox"
          checked={ricorrente}
          onChange={(e) => setRicorrente(e.target.checked)}
          className="h-4 w-4 accent-brand"
        />
        Ricorrente
      </label>

      {ricorrente && (
        <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Frequenza
          <select
            aria-label="Frequenza"
            value={frequenzaPreset}
            onChange={(e) =>
              setFrequenzaPreset(e.target.value === 'custom' ? 'custom' : Number(e.target.value))
            }
            className={fieldClass}
          >
            {FREQUENZA_PRESETS.map((p) => (
              <option key={p.mesi} value={p.mesi}>
                {p.label}
              </option>
            ))}
            <option value="custom">Personalizzato</option>
          </select>
          {frequenzaPreset === 'custom' && (
            <input
              aria-label="Ogni quanti mesi"
              type="number"
              value={frequenzaMesiCustom}
              onChange={(e) => setFrequenzaMesiCustom(e.target.value)}
              placeholder="Numero di mesi"
              className={fieldClass}
            />
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid}
        className="rounded-[var(--radius-md)] bg-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-40"
      >
        Crea obiettivo
      </button>
    </form>
  );
}
