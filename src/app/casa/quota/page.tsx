import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { getMyHousehold } from '@/lib/data/households';
import { getMaxSlotUsato, getPlansFromMonth } from '@/lib/data/householdPlans';
import { meseRomaISO } from '@/lib/calculations/casa/oggi';
import { loadProposteStime } from '@/lib/loadProposteStime';
import { QuotaClient } from './QuotaClient';

export default async function QuotaPage() {
  const supabase = await createClient();
  const user = await utenteOLogin(supabase);
  const casa = await getMyHousehold(supabase, user.id);
  if (!casa) redirect('/casa');

  const meseCorrente = meseRomaISO();
  const piani = await getPlansFromMonth(supabase, casa.household.id, meseCorrente);
  const slotUsati = await getMaxSlotUsato(supabase, casa.household.id);
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
