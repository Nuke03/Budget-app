import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { loadHomeData } from '@/lib/loadHomeData';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { HomeDashboard } from './HomeDashboard';

export default async function HomePage() {
  const supabase = await createClient();
  // I dati partono insieme alla verifica dell'utente, non dopo.
  const adesso = new Date();
  const { user, dati: data } = await conUtente(supabase, (id) => loadHomeData(supabase, adesso, id));

  return (
    <HomeDashboard
      disponibileLibero={data.disponibileLibero}
      margineGiornaliero={data.margineGiornaliero}
      dataTarget={data.dataTarget.toISOString()}
      accounts={data.accounts}
      categories={data.categories}
      goals={data.goals}
      casa={data.casa}
      righe={data.righe}
      storico={data.storico}
      andamento={data.andamento}
      consiglio={data.consiglio}
      prossimo={data.prossimo}
      notificheAttive={data.notificheAttive}
      meUserId={user.id}
      oggi={oggiRomaISO()}
    />
  );
}
