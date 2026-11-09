import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { loadHomeData } from '@/lib/loadHomeData';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { HomeDashboard } from './HomeDashboard';

export default async function HomePage() {
  const supabase = await createClient();
  const user = await utenteOLogin(supabase);
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
