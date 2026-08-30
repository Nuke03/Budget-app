'use client';

import { useState } from 'react';
import { formatEuro, formatDateIt } from '@/lib/format';
import type { Account, BudgetGoal } from '@/lib/types';

// `accantonato` è l'importo effettivamente riservato per l'obiettivo alla data odierna
// (computeAccantonatoFinora): per gli obiettivi "bloccato" coincide con importoTarget,
// per quelli "dilazionato" è la quota maturata finora. È lo stesso valore che
// computeDisponibileLibero sottrae dal saldo, quindi è quello da mostrare nel dettaglio
// per far tornare i conti con la cifra principale.
export interface GoalWithAccantonato extends BudgetGoal {
  accantonato: number;
}

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
  goals: GoalWithAccantonato[];
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Solo i conti che contano nel disponibile libero fanno parte della riconciliazione
  // di quella cifra; gli altri (es. un fondo emergenza) vengono mostrati a parte,
  // etichettati, per non farli sembrare parte dello stesso totale.
  const accountsDisponibili = accounts.filter((a) => a.contaInDisponibile);
  const accountsEsclusi = accounts.filter((a) => !a.contaInDisponibile);

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
          {accountsDisponibili.map((a) => (
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
              <span>{formatEuro(g.accantonato)}</span>
            </div>
          ))}
          {accountsEsclusi.length > 0 && (
            <div className="mt-2 flex flex-col gap-2 border-t pt-2">
              {accountsEsclusi.map((a) => (
                <div key={a.id} className="flex justify-between text-slate-400">
                  <span>{a.nome} (non conta nel disponibile)</span>
                  <span>{formatEuro(a.saldoAttuale)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <a href="/add" className="fixed bottom-6 right-6 rounded-full bg-slate-900 px-6 py-4 text-2xl text-white shadow-lg">
        +
      </a>
    </main>
  );
}
