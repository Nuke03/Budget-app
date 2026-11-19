'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { piuGiorni, segnaLezione } from '@/lib/data/percorso';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { GIORNI_PIU_TARDI } from '@/lib/calculations/percorso/soglie';
import { LEZIONI } from '@/lib/percorso/lezioni';
import type { ArgomentoId, StatoLezione } from '@/lib/percorso/tipi';

async function scrivi(id: ArgomentoId, campi: Partial<StatoLezione>): Promise<void> {
  if (!LEZIONI.some((l) => l.id === id)) throw new Error('Lezione sconosciuta');
  const supabase = await createClient();
  await utenteOLogin(supabase);
  await segnaLezione(supabase, id, campi);
  revalidatePath('/impara');
}

export async function apriLezione(id: ArgomentoId): Promise<void> {
  await scrivi(id, { vistaIl: oggiRomaISO() });
}

export async function rimandaLezione(id: ArgomentoId): Promise<void> {
  await scrivi(id, { rimandataAl: piuGiorni(oggiRomaISO(), GIORNI_PIU_TARDI) });
}

export async function lezioneFatta(id: ArgomentoId): Promise<void> {
  await scrivi(id, { azioneIl: oggiRomaISO() });
}
