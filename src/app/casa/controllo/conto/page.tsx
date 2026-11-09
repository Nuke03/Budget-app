import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { getMyHousehold } from '@/lib/data/households';
import { getAccounts } from '@/lib/data/accounts';
import { casa as scopeCasa } from '@/lib/data/scope';
import { ControlloSaldo } from '../../ControlloSaldo';

export default async function ControlloContoPage() {
  const supabase = await createClient();
  const user = await utenteOLogin(supabase);
  const casa = await getMyHousehold(supabase, user.id);
  if (!casa) redirect('/casa');
  // Servono solo i conti della casa: nessuna transazione.
  const conti = await getAccounts(supabase, scopeCasa(casa.household.id));

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">Controlla il conto</h1>
      <ControlloSaldo conti={conti} />
    </main>
  );
}
