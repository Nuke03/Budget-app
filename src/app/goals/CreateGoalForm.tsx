'use client';

import { useState } from 'react';
import type { GoalModalita } from '@/lib/types';

interface GoalPayload {
  nome: string;
  importoTarget: number;
  modalita: GoalModalita;
  scadenza: string | null;
  ricorrente: boolean;
  frequenzaAnni: number | null;
}

const fieldClass =
  'rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand';

export function CreateGoalForm({ onSubmit }: { onSubmit: (payload: GoalPayload) => void }) {
  const [nome, setNome] = useState('');
  const [importoTarget, setImportoTarget] = useState('');
  const [modalita, setModalita] = useState<GoalModalita>('bloccato');
  const [scadenza, setScadenza] = useState('');
  const [ricorrente, setRicorrente] = useState(false);
  const [frequenzaAnni, setFrequenzaAnni] = useState('1');

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
      ricorrente,
      frequenzaAnni: ricorrente ? Number(frequenzaAnni) : null,
    });

    setNome('');
    setImportoTarget('');
    setScadenza('');
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
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Ogni quanti anni
          <input
            type="number"
            value={frequenzaAnni}
            onChange={(e) => setFrequenzaAnni(e.target.value)}
            className={fieldClass}
          />
        </label>
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
