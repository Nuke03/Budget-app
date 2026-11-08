import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyHousehold } from '@/lib/data/households';
import { InizioCasa } from './InizioCasa';

export default async function InizioCasaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const casa = await getMyHousehold(supabase, user.id);
  if (casa) redirect('/casa');

  const { modo } = await searchParams;

  return (
    <InizioCasa
      defaultDisplayName={(user.email ?? '').split('@')[0]}
      modoIniziale={modo === 'entra' ? 'entra' : 'crea'}
    />
  );
}
