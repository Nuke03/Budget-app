import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyHousehold } from '@/lib/data/households';
import { getMaxSlotUsato, getPlansFromMonth } from '@/lib/data/householdPlans';
import { meseRomaISO } from '@/lib/calculations/casa/oggi';
import { QuotaClient } from './QuotaClient';

export default async function QuotaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const casa = await getMyHousehold(supabase, user.id);
  if (!casa) redirect('/casa');

  const meseCorrente = meseRomaISO();
  const piani = await getPlansFromMonth(supabase, casa.household.id, meseCorrente);
  const slotUsati = await getMaxSlotUsato(supabase, casa.household.id);
  const slotMassimo = Math.max(slotUsati, ...casa.members.map((m) => m.slot));

  return (
    <QuotaClient
      householdId={casa.household.id}
      meUserId={casa.me.userId}
      meseCorrente={meseCorrente}
      membri={casa.members}
      piani={piani}
      slotMassimo={slotMassimo}
    />
  );
}
