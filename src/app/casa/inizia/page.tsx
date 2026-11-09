import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { getMyHousehold } from '@/lib/data/households';
import { origineSito } from '@/lib/siteOrigin';
import { normalizzaCodice } from '@/lib/invito';
import { InizioCasa } from './InizioCasa';

export default async function InizioCasaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const user = await utenteOLogin(supabase);
  const casa = await getMyHousehold(supabase, user.id);
  if (casa) redirect('/casa');

  const { modo, codice } = await searchParams;
  const codicePrecompilato = normalizzaCodice(typeof codice === 'string' ? codice : undefined);
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const origin = origineSito(process.env.NEXT_PUBLIC_SITE_URL, host, h.get('x-forwarded-proto'));

  return (
    <InizioCasa
      defaultDisplayName={(user.email ?? '').split('@')[0]}
      modoIniziale={modo === 'entra' || codicePrecompilato ? 'entra' : 'crea'}
      codiceIniziale={codicePrecompilato}
      origin={origin}
    />
  );
}
