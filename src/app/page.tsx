import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadHomeData } from '@/lib/loadHomeData';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { HomeDashboard } from './HomeDashboard';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (!user) {
    // Senza sessione (o con sessione non valida, errori 4xx) si va al login. Se Supabase non risponde
    // (rete, pausa del servizio) l'errore sale alla pagina "Non riesco a raggiungere il database".
    const status = (error as { status?: number } | null)?.status ?? 0;
    if (error && (status < 400 || status >= 500)) throw error;
    redirect('/login');
  }
  const data = await loadHomeData(supabase, new Date(), user.id);

  return (
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
  );
}
