import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyHousehold } from '@/lib/data/households';
import { getAccounts } from '@/lib/data/accounts';
import { getPlanForMonth, type PlanBundle } from '@/lib/data/householdPlans';
import { loadCasaData } from '@/lib/loadCasaData';
import { meseRomaISO } from '@/lib/calculations/casa/oggi';
import { CasaHome } from './CasaHome';
import { CasaSenzaCasa } from './CasaSenzaCasa';

// Come getPlanForMonth: la versione in vigore nel mese, altrimenti la prima futura.
function pianoDelMese(piani: PlanBundle[], mese: string): PlanBundle | null {
  let attuale: PlanBundle | null = null;
  for (const p of piani) if (p.plan.validoDal <= mese) attuale = p;
  return attuale ?? piani[0] ?? null;
}

export default async function CasaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const casa = await getMyHousehold(supabase, user.id);
  if (!casa) return <CasaSenzaCasa />;

  const meseCorrente = meseRomaISO();
  const dati = await loadCasaData(supabase, casa).catch(() => null);
  // I piani arrivano già con i dati della casa: si legge una volta sola.
  const piano = dati
    ? pianoDelMese(dati.piani, meseCorrente)
    : await getPlanForMonth(supabase, casa.household.id, meseCorrente);
  // Se i conti e le spese non si leggono, la quota e le impostazioni restano raggiungibili.
  // I conti personali servono solo a "Io, con carta": se non si leggono, la casa si apre lo stesso.
  const contiPersonali = dati ? await getAccounts(supabase).catch(() => []) : [];
  const finanze = dati
    ? {
        disponibile: dati.disponibile,
        conti: dati.aggiunta.conti,
        ultimeSpese: dati.transazioni.filter((t) => t.tipo === 'expense').slice(0, 5),
        nomi: Object.fromEntries(dati.aggiunta.nomi.map((n) => [n.userId, n.nome])),
        aggiunta: dati.aggiunta,
        contiPersonali,
        righe: dati.righe,
        debiti: dati.debiti,
        crediti: dati.crediti,
      }
    : undefined;
  return <CasaHome casa={casa} piano={piano} meseCorrente={meseCorrente} finanze={finanze} />;
}
