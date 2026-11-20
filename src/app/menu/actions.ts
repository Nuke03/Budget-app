'use server';

import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { getOpenGoals } from '@/lib/data/goals';
import { getConfermePerObiettivi } from '@/lib/data/goalVersamenti';
import { computeQuotaMensile } from '@/lib/calculations/accantonato';
import { getMyHousehold } from '@/lib/data/households';

export interface CassettoARate {
  id: string;
  nome: string;
  quota: number;
  confermatoMese: number;
}

export interface VociMenu {
  cassettiARate: CassettoARate[];
  haCasa: boolean;
}

// Le voci del menu "Cosa vuoi fare?" che dipendono dai dati. Solo lettura.
export async function leggiVociMenu(): Promise<VociMenu> {
  const supabase = await createClient();
  const user = await utenteOLogin(supabase);
  const oggi = new Date();

  const aperti = await getOpenGoals(supabase);
  const candidati: { id: string; nome: string; quota: number }[] = [];
  for (const g of aperti) {
    if (g.modalita !== 'dilazionato') continue;
    try {
      const quota = computeQuotaMensile(g, oggi);
      if (quota == null || !(quota > 0)) continue;
      candidati.push({ id: g.id, nome: g.nome, quota: Math.round(quota * 100) / 100 });
    } catch {
      // dati incompleti (nessuna scadenza): quel cassetto non compare
    }
  }

  let conferme: Awaited<ReturnType<typeof getConfermePerObiettivi>> = {};
  if (candidati.length > 0) {
    try {
      conferme = await getConfermePerObiettivi(supabase, aperti, oggi);
    } catch {
      conferme = {};
    }
  }
  const cassettiARate = candidati.map((c) => ({ ...c, confermatoMese: conferme[c.id]?.mese ?? 0 }));

  let haCasa = false;
  try {
    haCasa = (await getMyHousehold(supabase, user.id)) !== null;
  } catch {
    haCasa = false;
  }

  return { cassettiARate, haCasa };
}
