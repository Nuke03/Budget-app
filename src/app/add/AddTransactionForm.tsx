'use client';

import { useEffect, useState } from 'react';
import type { Account, Category, TransactionTipo } from '@/lib/types';

interface SubmitPayload {
  tipo: TransactionTipo;
  importo: number;
  categoriaId: string | null;
  accountId: string | null;
  descrizione: string;
}

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

  // Le liste di categorie/conti arrivano in modo asincrono dopo il mount (vedi page.tsx),
  // quindi lo stato iniziale (calcolato quando le liste erano ancora vuote) va sincronizzato
  // non appena i dati reali arrivano. Non tocchiamo una selezione dell'utente ancora valida:
  // ricalcoliamo il default solo se il valore corrente non esiste (più) tra le opzioni valide
  // (es. al primo caricamento, oppure quando cambia il tipo spesa/entrata).
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

    // Optimistic UI: mostriamo subito il salvataggio come riuscito, la scrittura
    // reale avviene in background; se fallisce lo segnaliamo ma non blocchiamo l'utente.
    setStatus('saved');
    setImporto('');
    setDescrizione('');

    onSubmit(payload).catch(() => setStatus('error'));
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-3 p-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTipo('expense')}
          className={tipo === 'expense' ? 'font-bold underline' : ''}
        >
          Spesa
        </button>
        <button
          type="button"
          onClick={() => setTipo('income')}
          className={tipo === 'income' ? 'font-bold underline' : ''}
        >
          Entrata
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Importo
        <input
          aria-label="Importo"
          type="number"
          inputMode="decimal"
          value={importo}
          onChange={(e) => setImporto(e.target.value)}
          className="rounded border p-2 text-lg"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Descrizione
        <input
          aria-label="Descrizione"
          type="text"
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          className="rounded border p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Categoria
        <select
          value={categoriaId ?? ''}
          onChange={(e) => setCategoriaId(e.target.value || null)}
          className="rounded border p-2"
        >
          {categorieDisponibili.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Conto
        <select
          value={accountId ?? ''}
          onChange={(e) => setAccountId(e.target.value || null)}
          className="rounded border p-2"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={!isValid}
        className="rounded bg-slate-900 p-3 text-white disabled:opacity-40"
      >
        Salva
      </button>

      {status === 'saved' && <p className="text-sm text-green-600">Salvata ✓</p>}
      {status === 'error' && (
        <p className="text-sm text-red-600">Salvataggio fallito, controlla la connessione e riprova.</p>
      )}
    </form>
  );
}
