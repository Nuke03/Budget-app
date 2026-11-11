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
    <>
      <HomeDashboard
        disponibileLibero={data.disponibileLibero}
        margineGiornaliero={data.margineGiornaliero}
        dataTarget={data.dataTarget.toISOString()}
        accounts={data.accounts}
        categories={data.categories}
        goals={data.goals}
        casa={data.casa}
        meUserId={user.id}
        oggi={oggiRomaISO()}
      />
      {/* Temporaneo: dall'app installata non c'è la barra degli indirizzi. Si toglie con /prova-notifiche. */}
      <p className="mx-auto max-w-md px-5 pb-28 text-center text-xs text-muted">
        <a href="/prova-notifiche" className="underline">
          Prova le notifiche
        </a>
      </p>
    </>
  );
}
