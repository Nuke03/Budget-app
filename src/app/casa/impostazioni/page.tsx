import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyHousehold } from '@/lib/data/households';
import { getMyCalendarFeed } from '@/lib/data/calendarFeeds';
import { origineSito } from '@/lib/siteOrigin';
import { ImpostazioniCasa } from './ImpostazioniCasa';

export default async function ImpostazioniCasaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const casa = await getMyHousehold(supabase, user.id);
  if (!casa) redirect('/casa');

  const feed = await getMyCalendarFeed(supabase);
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const origin = origineSito(process.env.NEXT_PUBLIC_SITE_URL, host, h.get('x-forwarded-proto'));

  return <ImpostazioniCasa casa={casa} feedCalendario={feed} origin={origin} />;
}
