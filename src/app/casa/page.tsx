import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyHousehold } from '@/lib/data/households';
import { getAccounts } from '@/lib/data/accounts';
import { getPlanForMonth } from '@/lib/data/householdPlans';
import { loadCasaData } from '@/lib/loadCasaData';
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
  // Se i conti e le spese non si leggono, la quota e le impostazioni restano raggiungibili.
  const dati = await loadCasaData(supabase, casa).catch(() => null);
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
      }
    : undefined;
  return <CasaHome casa={casa} piano={piano} meseCorrente={meseCorrente} finanze={finanze} />;
}
