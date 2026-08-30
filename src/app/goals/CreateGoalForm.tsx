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
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Nome
        <input
          aria-label="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="rounded border p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Importo target
        <input
          aria-label="Importo target"
          type="number"
          value={importoTarget}
          onChange={(e) => setImportoTarget(e.target.value)}
          className="rounded border p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Modalità
        <select
          aria-label="Modalità"
          value={modalita}
          onChange={(e) => setModalita(e.target.value as GoalModalita)}
          className="rounded border p-2"
        >
          <option value="bloccato">Bloccato</option>
          <option value="dilazionato">Dilazionato</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Scadenza {modalita === 'bloccato' && '(opzionale)'}
        <input
          aria-label="Scadenza"
          type="date"
          value={scadenza}
          onChange={(e) => setScadenza(e.target.value)}
          className="rounded border p-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={ricorrente}
          onChange={(e) => setRicorrente(e.target.checked)}
        />
        Ricorrente
      </label>

      {ricorrente && (
        <label className="flex flex-col gap-1 text-sm">
          Ogni quanti anni
          <input
            type="number"
            value={frequenzaAnni}
            onChange={(e) => setFrequenzaAnni(e.target.value)}
            className="rounded border p-2"
          />
        </label>
      )}

      <button
        type="submit"
        disabled={!isValid}
        className="rounded bg-slate-900 p-3 text-white disabled:opacity-40"
      >
        Crea obiettivo
      </button>
    </form>
  );
}
