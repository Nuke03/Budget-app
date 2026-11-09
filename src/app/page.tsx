import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadHomeData } from '@/lib/loadHomeData';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { HomeDashboard } from './HomeDashboard';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
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
