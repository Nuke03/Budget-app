import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { loadPercorsoData } from '@/lib/loadPercorsoData';
import { CoverHeader } from '../CoverHeader';
import { ElencoImpara } from './ElencoImpara';

export default async function ImparaPage() {
  const supabase = await createClient();
  const { dati } = await conUtente(supabase, (id) => loadPercorsoData(supabase, new Date(), id));
  return (
    <>
      <CoverHeader titolo="Impara" />
      <main className="mx-auto max-w-xl px-4 pb-28 pt-5">
        <ElencoImpara primiPassiVisibili={dati.primiPassi.visibile} lezioni={dati.lezioni} />
      </main>
    </>
  );
}
