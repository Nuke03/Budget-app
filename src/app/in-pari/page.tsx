import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { loadHomeData } from '@/lib/loadHomeData';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { InPari } from './InPari';

export default async function InPariPage() {
  const supabase = await createClient();
  const adesso = new Date();
  const { dati } = await conUtente(supabase, (id) => loadHomeData(supabase, adesso, id));
  const aggiunta = dati.casa?.aggiunta ?? null;

  return (
    <InPari
      periodo={dati.inPari}
      conti={dati.accounts.map((a) => ({ id: a.id, nome: a.nome }))}
      casa={aggiunta ? { householdId: aggiunta.householdId, meUserId: aggiunta.meUserId } : null}
      andamento={dati.andamento}
      consiglio={dati.consiglio}
      oggi={oggiRomaISO(adesso)}
    />
  );
}
