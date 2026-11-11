import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { utenteECasa } from '@/lib/utenteOLogin';
import { getPlanVersions } from '@/lib/data/householdPlans';
import { getOpenGoals } from '@/lib/data/goals';
import { getSpecoCollegatoPerObiettivi } from '@/lib/data/goalSpending';
import { casa as scopeCasa } from '@/lib/data/scope';
import { meseRomaISO, oggiRomaData, oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { pianoInVigore } from '@/lib/calculations/casa/versamenti';
import { obiettiviCasaConSpiegazione, statoVociDaParte } from '@/lib/calculations/casa/fondi';
import { canoneDaPiano } from '@/lib/calculations/casa/costiIngresso';
import { DaParte } from './DaParte';

export default async function DaPartePage() {
  const supabase = await createClient();
  const { casa } = await utenteECasa(supabase);
  if (!casa) redirect('/casa');

  const scope = scopeCasa(casa.household.id);
  const adesso = new Date();
  const today = oggiRomaData(adesso);
  // Letture mirate: il piano del mese, gli obiettivi aperti e il loro speso collegato.
  const [piani, obiettivi] = await Promise.all([
    getPlanVersions(supabase, casa.household.id),
    getOpenGoals(supabase, scope),
  ]);
  const piano = pianoInVigore(piani, meseRomaISO(adesso));
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
      canonePiano={
        piano ? canoneDaPiano(piano.items.map((i) => ({ nome: i.nome, importoMensile: i.importoMensile }))) : 0
      }
    />
  );
}
