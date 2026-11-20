'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CoverHeader } from '../CoverHeader';
import { FumettoPrimaVolta } from '@/app/fumetti/FumettoPrimaVolta';
import { AccountRow } from './AccountRow';
import type { Account } from '@/lib/types';
import type { SituazioneRientroConto } from '@/lib/calculations/rientri';

// Il corpo di Conti, senza letture né scritture: la pagina gli passa dati e azioni.
export function ContiVista({
  accounts,
  nome,
  onNome,
  contaInDisponibile,
  onContaInDisponibile,
  onUpdateBalance,
  onUpdateDetails,
  onCreate,
  contoTasseId = null,
  rientriConti = [],
  onFermaRientro,
  onLasciaStare,
}: {
  accounts: Account[];
  // I rientri verso i conti, con quanto resta da spostare: una riga sotto il conto.
  rientriConti?: SituazioneRientroConto[];
  onFermaRientro?: (id: string) => Promise<void>;
  onLasciaStare?: (id: string) => Promise<void>;
  // Il conto tasse della P.IVA guidata, se c'è.
  contoTasseId?: string | null;
  nome: string;
  onNome: (v: string) => void;
  contaInDisponibile: boolean;
  onContaInDisponibile: (v: boolean) => void;
  onUpdateBalance: (id: string, saldo: number) => void;
  onUpdateDetails: (id: string, details: { nome: string; contaInDisponibile: boolean; targetSaldo: number | null }) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <CoverHeader titolo="Conti" />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-28 pt-3.5">
        <div className="flex flex-col gap-3.5">
          {accounts.map((a, i) => (
            <div key={a.id} data-fumetto={i === 0 ? 'conti' : undefined}>
              <AccountRow
                account={a}
                contoTasse={a.id === contoTasseId}
                rientri={rientriConti.filter((s) => s.rientro.accountId === a.id)}
                onFermaRientro={onFermaRientro}
                onLasciaStare={onLasciaStare}
                onUpdateBalance={onUpdateBalance}
                onUpdateDetails={onUpdateDetails}
              />
            </div>
          ))}
          <FumettoPrimaVolta
            id="conti"
            ancora="conti"
            testo="Qui scrivi il saldo dei tuoi conti come lo vedi in banca. L'app non si collega alla banca."
          />
        </div>

        <section className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-rule bg-page p-4">
          <h2 className="font-serif text-lg font-semibold">Nuovo conto</h2>
          <input
            value={nome}
            onChange={(e) => onNome(e.target.value)}
            placeholder="Es. Conto corrente"
            aria-label="Nome del nuovo conto"
            className="min-h-12 rounded-[var(--radius-md)] border border-rule bg-page px-3 text-[15px] text-foreground focus-visible:border-brand"
          />
          <label className="flex min-h-11 items-center gap-2.5 text-[15px] font-medium">
            <input
              type="checkbox"
              checked={contaInDisponibile}
              onChange={(e) => onContaInDisponibile(e.target.checked)}
              className="h-5 w-5 accent-brand"
            />
            Conta nel disponibile libero
          </label>
          <button
            type="button"
            onClick={onCreate}
            disabled={!nome.trim()}
            className="min-h-12 rounded-[var(--radius-md)] bg-brand py-3 text-base font-semibold text-brand-foreground disabled:opacity-40"
          >
            Aggiungi conto
          </button>
        </section>

        <Link
          href="/categories"
          className="flex min-h-12 items-center justify-between rounded-[var(--radius-md)] border border-rule bg-page px-4 text-[15px] font-semibold text-brand-dark"
        >
          Gestisci categorie
          <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-2" />
        </Link>
      </main>
    </>
  );
}
