'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { PropostaStima } from '@/lib/calculations/casa/stimaVsReale';
import type { BudgetGoal, HouseholdMember } from '@/lib/types';
import { CoverHeader } from '../../CoverHeader';
import { CardStima } from '../CardStima';
import { CLASSE_LINK } from '../CampiMovimento';
import { PianoAttuale } from './PianoAttuale';
import { QuotaWizard } from './QuotaWizard';

export function QuotaClient({
  householdId,
  meUserId,
  meseCorrente,
  membri,
  piani,
  slotMassimo,
  proposte = [],
  fondiPerVoce = {},
  validoDalStima = '',
  programmata = false,
}: {
  householdId: string;
  meUserId: string;
  meseCorrente: string;
  membri: HouseholdMember[];
  piani: PlanBundle[];
  slotMassimo: number;
  // Le voci che le spese reali smentiscono, con l'obiettivo collegato a ciascuna e il mese da cui parte la quota nuova.
  proposte?: PropostaStima[];
  fondiPerVoce?: Record<string, BudgetGoal>;
  validoDalStima?: string;
  programmata?: boolean;
}) {
  const pianoAttuale = piani[0] ?? null;
  const router = useRouter();
  const [modifica, setModifica] = useState(false);
  const [altre, setAltre] = useState(false);
  // Dopo un salvataggio le altre card non possono più applicare la loro stima: partirebbero dalla versione vecchia.
  const [salvata, setSalvata] = useState(false);

  return (
    <>
      <CoverHeader titolo="Calcola la nostra quota" />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6 pt-3.5">
      {pianoAttuale && !modifica ? (
        <>
          {(altre ? proposte : proposte.slice(0, 1)).map((p) => (
            <CardStima
              key={p.itemId}
              proposta={p}
              bundle={pianoAttuale}
              goal={fondiPerVoce[p.itemId] ?? null}
              householdId={householdId}
              validoDal={validoDalStima}
              programmata={programmata || salvata}
              onFatto={() => {
                setSalvata(true);
                router.refresh();
              }}
            />
          ))}
          {!altre && proposte.length > 1 ? (
            <button type="button" onClick={() => setAltre(true)} className={`${CLASSE_LINK} self-start`}>
              {`Altre ${proposte.length - 1} ${proposte.length - 1 === 1 ? 'stima' : 'stime'} da rivedere`}
            </button>
          ) : null}
          <PianoAttuale bundle={pianoAttuale} meseCorrente={meseCorrente} onRivedi={() => setModifica(true)} />
        </>
      ) : (
        <QuotaWizard
          householdId={householdId}
          meUserId={meUserId}
          meseCorrente={meseCorrente}
          membri={membri}
          piani={piani}
          slotMassimo={slotMassimo}
          onSaved={() => {
            router.refresh();
            setModifica(false);
          }}
        />
      )}
      </main>
    </>
  );
}
