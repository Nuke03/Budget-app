import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { getSituazioneConApertura, getStatiVoci, segnaSezioneApertaDati } from '@/lib/data/agevolazioni';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { Situazione, StatoVoce } from '@/lib/agevolazioni/tipi';
import { AgevolazioniVista } from './AgevolazioniVista';

const VUOTA: Situazione = { isee: null, dsuData: null, comune: null, inAffitto: null, studente: null, piva: false };

export default async function AgevolazioniPage() {
  const supabase = await createClient();
  const { dati } = await conUtente(supabase, async () => {
    // Le due letture partono insieme; la situazione porta con sé se la sezione è già stata aperta.
    const [letta, stati] = await Promise.all([
      getSituazioneConApertura(supabase).catch(() => ({ situazione: VUOTA, aperta: false })),
      getStatiVoci(supabase).catch((): StatoVoce[] => []),
    ]);
    return { situazione: letta.situazione, aperta: letta.aperta, stati };
  });
  // Segna che la sezione è stata aperta (serve al promemoria di gennaio), una volta sola: se non riesce, non cambia
  // nulla. Col livello dati, non con l'azione: revalidatePath non è ammesso durante il render.
  if (!dati.aperta) await segnaSezioneApertaDati(supabase, oggiRomaISO()).catch(() => {});
  return <AgevolazioniVista situazione={dati.situazione} stati={dati.stati} oggi={oggiRomaISO()} />;
}
