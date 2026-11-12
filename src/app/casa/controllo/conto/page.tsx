import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { utenteECasa } from '@/lib/utenteOLogin';
import { getAccounts } from '@/lib/data/accounts';
import { casa as scopeCasa } from '@/lib/data/scope';
import { CoverHeader } from '../../../CoverHeader';
import { ControlloSaldo } from '../../ControlloSaldo';

export default async function ControlloContoPage() {
  const supabase = await createClient();
  const { casa } = await utenteECasa(supabase);
  if (!casa) redirect('/casa');
  // Servono solo i conti della casa: nessuna transazione.
  const conti = await getAccounts(supabase, scopeCasa(casa.household.id));

  return (
    <>
      <CoverHeader titolo="Controlla il conto" />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6 pt-3.5">
        <section className="rounded-[var(--radius-md)] border border-rule bg-surface p-4">
          <ControlloSaldo conti={conti} />
        </section>
      </main>
    </>
  );
}
