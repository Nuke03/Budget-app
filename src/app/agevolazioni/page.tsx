import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { getSituazione, getStatiVoci, segnaSezioneApertaDati } from '@/lib/data/agevolazioni';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { Situazione, StatoVoce } from '@/lib/agevolazioni/tipi';
import { AgevolazioniVista } from './AgevolazioniVista';

const VUOTA: Situazione = { isee: null, dsuData: null, comune: null, inAffitto: null, studente: null, piva: false };

export default async function AgevolazioniPage() {
  const supabase = await createClient();
  const { dati } = await conUtente(supabase, async () => {
    const [situazione, stati] = await Promise.all([
      getSituazione(supabase).catch((): Situazione => VUOTA),
      getStatiVoci(supabase).catch((): StatoVoce[] => []),
    ]);
    return { situazione, stati };
  });
  // Segna che la sezione è stata aperta (serve al promemoria di gennaio): se non riesce, non cambia nulla.
  // Col livello dati, non con l'azione: revalidatePath non è ammesso durante il render.
  await segnaSezioneApertaDati(supabase, oggiRomaISO()).catch(() => {});
  return <AgevolazioniVista situazione={dati.situazione} stati={dati.stati} oggi={oggiRomaISO()} />;
}
