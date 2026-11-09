import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyHousehold } from '@/lib/data/households';
import { loadCasaData } from '@/lib/loadCasaData';
import { MovimentiCasa } from './MovimentiCasa';

export default async function MovimentiCasaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const casa = await getMyHousehold(supabase, user.id);
  if (!casa) redirect('/casa');

  const dati = await loadCasaData(supabase, casa);
  return (
    <MovimentiCasa
      casa={casa}
      aggiunta={dati.aggiunta}
      transazioni={dati.transazioni}
      trasferimenti={dati.trasferimenti}
      meUserId={user.id}
    />
  );
}
