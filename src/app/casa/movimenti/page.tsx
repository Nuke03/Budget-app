import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { utenteECasa } from '@/lib/utenteOLogin';
import { loadCasaData } from '@/lib/loadCasaData';
import { MovimentiCasa } from './MovimentiCasa';

export default async function MovimentiCasaPage() {
  const supabase = await createClient();
  const { user, casa } = await utenteECasa(supabase);
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
