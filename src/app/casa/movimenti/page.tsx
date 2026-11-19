import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { utenteECasa } from '@/lib/utenteOLogin';
import { loadCasaData } from '@/lib/loadCasaData';
import { getAccounts } from '@/lib/data/accounts';
import { MovimentiCasa } from './MovimentiCasa';

export default async function MovimentiCasaPage() {
  const supabase = await createClient();
  const { user, casa } = await utenteECasa(supabase);
  if (!casa) redirect('/casa');

  // I conti personali di chi guarda (mai di altri: la RLS lo garantisce): servono a modificare una spesa pagata con la propria carta.
  const [dati, contiPersonali] = await Promise.all([loadCasaData(supabase, casa), getAccounts(supabase)]);
  return (
    <MovimentiCasa
      casa={casa}
      aggiunta={dati.aggiunta}
      transazioni={dati.transazioni}
      trasferimenti={dati.trasferimenti}
      meUserId={user.id}
      contiPersonali={contiPersonali}
    />
  );
}
