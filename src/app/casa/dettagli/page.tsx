import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { utenteECasa } from '@/lib/utenteOLogin';
import { getAccounts } from '@/lib/data/accounts';
import { getPlanForMonth } from '@/lib/data/householdPlans';
import { getSaldoIniziale } from '@/lib/data/transfers';
import { loadCasaData } from '@/lib/loadCasaData';
import { meseRomaISO } from '@/lib/calculations/casa/oggi';
import { pianoDelMese } from '@/lib/calculations/casa/versamenti';
import { origineSito } from '@/lib/siteOrigin';
import { chiGestisce } from '@/lib/calculations/supporto/gestore';
import { finanzeCasa } from '../finanzeCasa';
import { CasaDettagli } from './CasaDettagli';

export default async function CasaDettagliPage() {
  const supabase = await createClient();
  // I conti personali servono solo ai moduli di versamento: se non si leggono, la pagina si apre lo stesso.
  const contiInCorso = getAccounts(supabase).catch(() => []);
  const { casa } = await utenteECasa(supabase);
  if (!casa) redirect('/casa');

  const meseCorrente = meseRomaISO();
  const [dati, contiPersonali, saldoIniziale] = await Promise.all([
    loadCasaData(supabase, casa).catch(() => null),
    contiInCorso,
    getSaldoIniziale(supabase, casa.household.id).catch(() => undefined),
  ]);
  const piano = dati
    ? pianoDelMese(dati.piani, meseCorrente)
    : await getPlanForMonth(supabase, casa.household.id, meseCorrente);
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const origin = origineSito(process.env.NEXT_PUBLIC_SITE_URL, host, h.get('x-forwarded-proto'));

  return (
    <CasaDettagli
      casa={casa}
      piano={piano}
      meseCorrente={meseCorrente}
      finanze={dati ? finanzeCasa(dati, contiPersonali, meseCorrente) : undefined}
      origin={origin}
      mostraTricount={casa.members.length >= 2 && saldoIniziale === null}
      gestisce={chiGestisce(casa.household, casa.members) === casa.me.userId}
    />
  );
}
