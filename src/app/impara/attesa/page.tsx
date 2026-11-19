import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { leggiListaAttesa } from '@/lib/data/percorso';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { VoceAttesa } from '@/lib/percorso/tipi';
import { CoverHeader } from '../../CoverHeader';
import { ListaAttesa } from './ListaAttesa';

export default async function AttesaPage() {
  const supabase = await createClient();
  const { dati } = await conUtente(supabase, () => leggiListaAttesa(supabase).catch(() => [] as VoceAttesa[]));
  return (
    <>
      <CoverHeader titolo="Lista d'attesa" />
      <main className="mx-auto max-w-xl px-4 pb-28 pt-5">
        <ListaAttesa voci={dati} oggi={oggiRomaISO()} />
      </main>
    </>
  );
}
