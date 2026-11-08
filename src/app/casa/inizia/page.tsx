import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyHousehold } from '@/lib/data/households';
import { InizioCasa } from './InizioCasa';

export default async function InizioCasaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const casa = await getMyHousehold(supabase, user.id);
  if (casa) redirect('/casa');

  return <InizioCasa defaultDisplayName={(user.email ?? '').split('@')[0]} />;
}
