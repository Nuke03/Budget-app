import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { getMyHousehold } from '@/lib/data/households';
import { getPlanForMonth } from '@/lib/data/householdPlans';
import { getOpenGoals } from '@/lib/data/goals';
import { getSpecoCollegatoPerObiettivi } from '@/lib/data/goalSpending';
import { casa as scopeCasa } from '@/lib/data/scope';
import { meseRomaISO, oggiRomaData, oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { obiettiviCasaConSpiegazione, statoVociDaParte } from '@/lib/calculations/casa/fondi';
import { DaParte } from './DaParte';

export default async function DaPartePage() {
  const supabase = await createClient();
  const user = await utenteOLogin(supabase);
  const casa = await getMyHousehold(supabase, user.id);
  if (!casa) redirect('/casa');

  const scope = scopeCasa(casa.household.id);
  const adesso = new Date();
  const today = oggiRomaData(adesso);
  // Letture mirate: il piano del mese, gli obiettivi aperti e il loro speso collegato.
  const [piano, obiettivi] = await Promise.all([
    getPlanForMonth(supabase, casa.household.id, meseRomaISO(adesso)),
    getOpenGoals(supabase, scope),
  ]);
  const speso = await getSpecoCollegatoPerObiettivi(supabase, obiettivi, today, scope);
  const conSpiegazione = obiettiviCasaConSpiegazione(obiettivi, speso, today);

  return (
    <DaParte
      householdId={casa.household.id}
      oggi={oggiRomaISO(adesso)}
      haPiano={piano !== null}
      voci={piano ? statoVociDaParte(piano.items, obiettivi) : []}
      fondi={conSpiegazione.filter((g) => g.ricorrente)}
      unaVolta={conSpiegazione.filter((g) => !g.ricorrente)}
    />
  );
}
