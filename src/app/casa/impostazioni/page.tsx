import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { utenteECasa } from '@/lib/utenteOLogin';
import { getMyCalendarFeed } from '@/lib/data/calendarFeeds';
import { getSaldoIniziale } from '@/lib/data/transfers';
import { origineSito } from '@/lib/siteOrigin';
import { ImpostazioniCasa } from './ImpostazioniCasa';

export default async function ImpostazioniCasaPage() {
  const supabase = await createClient();
  const { casa } = await utenteECasa(supabase);
  if (!casa) redirect('/casa');

  const [feed, saldo] = await Promise.all([
    getMyCalendarFeed(supabase),
    getSaldoIniziale(supabase, casa.household.id).catch(() => null),
  ]);
  const saldoIniziale =
    saldo && saldo.beneficiarioUserId && saldo.perContoDiUserId
      ? { creditoreId: saldo.beneficiarioUserId, debitoreId: saldo.perContoDiUserId, importo: saldo.importo }
      : null;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const origin = origineSito(process.env.NEXT_PUBLIC_SITE_URL, host, h.get('x-forwarded-proto'));

  return <ImpostazioniCasa casa={casa} feedCalendario={feed} origin={origin} saldoIniziale={saldoIniziale} />;
}
