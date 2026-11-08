import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyHousehold } from '@/lib/data/households';
import { getPlanForMonth } from '@/lib/data/householdPlans';
import { meseRomaISO } from '@/lib/calculations/casa/oggi';
import { CasaHome } from './CasaHome';
import { CasaSenzaCasa } from './CasaSenzaCasa';

export default async function CasaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const casa = await getMyHousehold(supabase, user.id);
  if (!casa) return <CasaSenzaCasa />;

  const meseCorrente = meseRomaISO();
  const piano = await getPlanForMonth(supabase, casa.household.id, meseCorrente);
  return <CasaHome casa={casa} piano={piano} meseCorrente={meseCorrente} />;
}
