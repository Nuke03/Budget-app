'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus } from 'lucide-react';
import { formatEuro, formatDateIt } from '@/lib/format';
import { AddTransactionSheet } from './add/AddTransactionSheet';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Account, BudgetGoal, Category } from '@/lib/types';

// `accantonato` è l'importo effettivamente riservato per l'obiettivo alla data odierna
// (computeAccantonatoFinora): per gli obiettivi "bloccato" coincide con importoTarget,
// per quelli "dilazionato" è la quota maturata finora. È lo stesso valore che
// computeDisponibileLibero sottrae dal saldo, quindi è quello da mostrare nel dettaglio
// per far tornare i conti con la cifra principale.
export interface GoalWithAccantonato extends BudgetGoal {
  accantonato: number;
}

const GOAL_MODALITA_LABEL: Record<BudgetGoal['modalita'], string> = {
  bloccato: 'Bloccato',
  dilazionato: 'Dilazionato',
};

export function HomeDashboard({
  disponibileLibero,
  margineGiornaliero,
  dataTarget,
  accounts,
  categories,
  goals,
  casa = null,
  meUserId,
}: {
  disponibileLibero: number;
  margineGiornaliero: number;
  dataTarget: string;
  accounts: Account[];
  categories: Category[];
  goals: GoalWithAccantonato[];
  casa?: CasaAggiunta | null;
  meUserId?: string;
}) {
  const router = useRouter();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const accountsDisponibili = accounts.filter((a) => a.contaInDisponibile);
  const accountsEsclusi = accounts.filter((a) => !a.contaInDisponibile);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <section className="rounded-[var(--radius-lg)] bg-brand p-7 text-brand-foreground shadow-[var(--shadow-hero)]">
        <p className="text-sm font-medium text-brand-foreground/75">Disponibile libero</p>
        <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">
          {formatEuro(disponibileLibero)}
        </p>
        <div className="mt-5 h-px bg-brand-foreground/15" />
        <p className="mt-5 text-sm text-brand-foreground/85">
          Margine sicuro: <span className="font-semibold">{formatEuro(margineGiornaliero)}</span>
          /giorno fino al {formatDateIt(dataTarget)}
        </p>
      </section>

      <button
        type="button"
        className="flex items-center justify-center gap-1.5 text-sm font-semibold text-muted"
        onClick={() => setShowBreakdown((v) => !v)}
      >
        {showBreakdown ? 'Nascondi dettaglio' : 'Mostra dettaglio'}
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${showBreakdown ? 'rotate-180' : ''}`}
        />
      </button>

      {showBreakdown && (
        <section className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-surface p-4 text-sm shadow-[var(--shadow-card)]">
          {accountsDisponibili.map((a) => (
            <div key={a.id} className="flex justify-between py-1">
              <span className="font-medium">{a.nome}</span>
              <span className="tabular-nums">{formatEuro(a.saldoAttuale)}</span>
            </div>
          ))}
          {goals.map((g) => (
            <div key={g.id} className="flex justify-between py-1 text-muted">
              <span>
                {g.nome} ({GOAL_MODALITA_LABEL[g.modalita]})
              </span>
              <span className="tabular-nums">-{formatEuro(g.accantonato)}</span>
            </div>
          ))}
          {accountsEsclusi.length > 0 && (
            <div className="mt-1 flex flex-col gap-1 border-t border-black/5 pt-2">
              {accountsEsclusi.map((a) => (
                <div key={a.id} className="flex justify-between py-1 text-muted">
                  <span className="text-xs">{a.nome} (non conta nel disponibile)</span>
                  <span className="text-xs tabular-nums">{formatEuro(a.saldoAttuale)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsAddOpen(true)}
        aria-label="Aggiungi transazione"
        className="fixed bottom-28 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[var(--shadow-fab)]"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      <AddTransactionSheet
        aperto={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        personale={{ categories, accounts, goals }}
        casa={casa}
        contiPersonali={accounts}
        meUserId={meUserId}
        onSaved={() => router.refresh()}
      />
    </main>
  );
}
