'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlanBundle } from '@/lib/data/householdPlans';
import type { HouseholdMember } from '@/lib/types';
import { PianoAttuale } from './PianoAttuale';
import { QuotaWizard } from './QuotaWizard';

export function QuotaClient({
  householdId,
  meUserId,
  meseCorrente,
  membri,
  pianoAttuale,
}: {
  householdId: string;
  meUserId: string;
  meseCorrente: string;
  membri: HouseholdMember[];
  pianoAttuale: PlanBundle | null;
}) {
  const router = useRouter();
  const [modifica, setModifica] = useState(false);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">Calcola la nostra quota</h1>
      {pianoAttuale && !modifica ? (
        <PianoAttuale bundle={pianoAttuale} meseCorrente={meseCorrente} onRivedi={() => setModifica(true)} />
      ) : (
        <QuotaWizard
          householdId={householdId}
          meUserId={meUserId}
          meseCorrente={meseCorrente}
          membri={membri}
          pianoAttuale={pianoAttuale}
          onSaved={() => {
            router.refresh();
            setModifica(false);
          }}
        />
      )}
    </main>
  );
}
