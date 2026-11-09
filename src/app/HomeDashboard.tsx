'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus } from 'lucide-react';
import { formatEuro, formatDateIt, nomeMese } from '@/lib/format';
import { AddTransactionSheet } from './add/AddTransactionSheet';
import { ComeSiCalcola } from './casa/ComeSiCalcola';
import { StrisciaPromemoria } from './casa/StrisciaPromemoria';
import { computeReminders, statoPromemoria } from '@/lib/calculations/casa/promemoria';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { spiegaRiserva } from '@/lib/calculations/casa/spiegazioni';
import type { CasaPerHome } from '@/lib/loadHomeData';
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

// Nelle frasi gli importi tondi si scrivono senza decimali: "45 €".
const euroInFrase = (n: number): string => formatEuro(n).replace(',00', '');

function elencoMesi(mesi: string[]): string {
  const nomi = mesi.map(nomeMese);
  return nomi.length <= 1 ? (nomi[0] ?? '') : `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
}

export function HomeDashboard({
  disponibileLibero,
  margineGiornaliero,
  dataTarget,
  accounts,
  categories,
  goals,
  casa = null,
  meUserId,
  oggi = oggiRomaISO(),
}: {
  disponibileLibero: number;
  margineGiornaliero: number;
  dataTarget: string;
  accounts: Account[];
  categories: Category[];
  goals: GoalWithAccantonato[];
  casa?: CasaPerHome | null;
  meUserId?: string;
  oggi?: string;
}) {
  const router = useRouter();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const accountsDisponibili = accounts.filter((a) => a.contaInDisponibile);
  const accountsEsclusi = accounts.filter((a) => !a.contaInDisponibile);

  const stato = casa?.stato ?? null;
  const nomeDi = (userId: string): string => stato?.membri.find((m) => m.userId === userId)?.displayName ?? 'un altro membro';
  const righeDaVersare = stato ? stato.righe.filter((r) => r.mancano > 0) : [];
  const debitiMiei = stato ? stato.debiti.filter((d) => d.debitoreId === stato.me.userId) : [];
  const debitiVersoDiMe = stato ? stato.debiti.filter((d) => d.creditoreId === stato.me.userId) : [];
  const creditoMio = stato ? (stato.crediti[stato.me.userId] ?? 0) : 0;
  const promemoria = stato
    ? computeReminders(
        statoPromemoria({
          piano: stato.piano,
          righe: stato.righe,
          oggi,
          nomi: Object.fromEntries(stato.membri.map((m) => [m.userId, m.displayName])),
          crediti: stato.crediti,
          debiti: stato.debiti,
        }),
        { userId: stato.me.userId },
        oggi
      )
    : [];
  const statoNonLetto = !!casa && !casa.stato;
  const haRiserva = righeDaVersare.length > 0 || debitiMiei.length > 0;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <StrisciaPromemoria promemoria={promemoria} oggi={oggi} compatta />

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
          {righeDaVersare.map((r) => (
            <div key={`versamento-${r.mese}`} className="flex justify-between py-1 text-muted">
              <span>Versamento alla casa, {nomeMese(r.mese)}</span>
              <span className="tabular-nums">-{formatEuro(r.mancano)}</span>
            </div>
          ))}
          {debitiMiei.map((d) => (
            <div key={`debito-${d.creditoreId}`} className="flex justify-between py-1 text-muted">
              <span>Da restituire a {nomeDi(d.creditoreId)}</span>
              <span className="tabular-nums">-{formatEuro(d.importo)}</span>
            </div>
          ))}
          {statoNonLetto && (
            <p className="mt-1 border-t border-black/5 pt-2 text-xs text-muted">
              Non riesco a leggere la casa: il disponibile non tiene conto della quota.
            </p>
          )}
          {haRiserva && stato && (
            <ComeSiCalcola
              spiegazione={spiegaRiserva({ righe: stato.righe, debitoDaRestituire: stato.debitoDaRestituire })}
            />
          )}
          {(creditoMio > 0 || debitiVersoDiMe.length > 0 || stato?.avvisoArretrati) && (
            <div className="mt-1 flex flex-col gap-1 border-t border-black/5 pt-2 text-xs text-muted">
              {creditoMio > 0 && <p>Dalla casa ti spettano {euroInFrase(creditoMio)}</p>}
              {debitiVersoDiMe.map((d) => (
                <p key={`credito-${d.debitoreId}`}>
                  {nomeDi(d.debitoreId)} deve a te {euroInFrase(d.importo)}, quota di {elencoMesi(d.mesi.map((m) => m.mese))}
                </p>
              ))}
              {stato?.avvisoArretrati && (
                <p>
                  Sono più di due mesi di versamenti da registrare. Se li hai già fatti, registrali con &quot;Già riflesso nei
                  saldi&quot;.
                </p>
              )}
            </div>
          )}
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
        casa={casa?.aggiunta ?? null}
        contiPersonali={accounts}
        meUserId={meUserId}
        onSaved={() => router.refresh()}
      />
    </main>
  );
}
