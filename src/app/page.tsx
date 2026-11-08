import { createClient } from '@/lib/supabase/server';
import { loadHomeData } from '@/lib/loadHomeData';
import { HomeDashboard } from './HomeDashboard';

export default async function HomePage() {
  const supabase = await createClient();
  const data = await loadHomeData(supabase);

  return (
    <HomeDashboard
      disponibileLibero={data.disponibileLibero}
      margineGiornaliero={data.margineGiornaliero}
      dataTarget={data.dataTarget.toISOString()}
      accounts={data.accounts}
      categories={data.categories}
      goals={data.goals}
    />
  );
}
