import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { utenteECasa } from '@/lib/utenteOLogin';
import { loadCheckin } from '@/lib/loadCheckin';
import { CheckinMensile } from './CheckinMensile';

export default async function CheckinPage() {
  const supabase = await createClient();
  const { casa } = await utenteECasa(supabase);
  if (!casa) redirect('/casa');
  const dati = await loadCheckin(supabase, casa);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <CheckinMensile dati={dati} />
    </main>
  );
}
