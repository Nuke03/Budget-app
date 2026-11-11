import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { utenteECasa } from '@/lib/utenteOLogin';
import { dalMese, getPlanVersions, maxSlotDeiPiani } from '@/lib/data/householdPlans';
import { meseRomaISO } from '@/lib/calculations/casa/oggi';
import { loadProposteStime } from '@/lib/loadProposteStime';
import { QuotaClient } from './QuotaClient';

export default async function QuotaPage() {
  const supabase = await createClient();
  const { casa } = await utenteECasa(supabase);
  if (!casa) redirect('/casa');

  const meseCorrente = meseRomaISO();
  // Una sola lettura delle versioni: da lì il piano del mese con i successivi e la posizione più alta usata.
  const versioni = await getPlanVersions(supabase, casa.household.id);
  const piani = dalMese(versioni, meseCorrente);
  const slotUsati = maxSlotDeiPiani(versioni);
  const stime = await loadProposteStime(supabase, casa.household.id, piani);
  const slotMassimo = Math.max(slotUsati, ...casa.members.map((m) => m.slot));

  return (
    <QuotaClient
      householdId={casa.household.id}
      meUserId={casa.me.userId}
      meseCorrente={meseCorrente}
      membri={casa.members}
      piani={piani}
      slotMassimo={slotMassimo}
      proposte={stime.proposte}
      fondiPerVoce={stime.fondiPerVoce}
      validoDalStima={stime.validoDal}
      programmata={stime.programmata}
    />
  );
}
