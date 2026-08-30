'use client';

import { useState } from 'react';
import { formatEuro, formatDateIt } from '@/lib/format';
import type { Account, BudgetGoal } from '@/lib/types';

export function HomeDashboard({
  disponibileLibero,
  margineGiornaliero,
  dataTarget,
  accounts,
  goals,
}: {
  disponibileLibero: number;
  margineGiornaliero: number;
  dataTarget: string;
  accounts: Account[];
  goals: BudgetGoal[];
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <section className="rounded-2xl bg-slate-900 p-6 text-white">
        <p className="text-sm text-slate-300">Disponibile libero</p>
        <p className="text-4xl font-bold">{formatEuro(disponibileLibero)}</p>
        <p className="mt-4 text-sm text-slate-300">
          Margine sicuro: {formatEuro(margineGiornaliero)}/giorno fino al{' '}
          {formatDateIt(dataTarget)}
        </p>
      </section>

      <button
        type="button"
        className="text-left text-sm text-slate-500 underline"
        onClick={() => setShowBreakdown((v) => !v)}
      >
        {showBreakdown ? 'Nascondi dettaglio' : 'Mostra dettaglio'}
      </button>

      {showBreakdown && (
        <section className="flex flex-col gap-2 text-sm">
          {accounts.map((a) => (
            <div key={a.id} className="flex justify-between">
              <span>{a.nome}</span>
              <span>{formatEuro(a.saldoAttuale)}</span>
            </div>
          ))}
          {goals.map((g) => (
            <div key={g.id} className="flex justify-between text-slate-500">
              <span>
                {g.nome} ({g.modalita})
              </span>
              <span>{formatEuro(g.importoTarget)}</span>
            </div>
          ))}
        </section>
      )}

      <a href="/add" className="fixed bottom-6 right-6 rounded-full bg-slate-900 px-6 py-4 text-2xl text-white shadow-lg">
        +
      </a>
    </main>
  );
}
