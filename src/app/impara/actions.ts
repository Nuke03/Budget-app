'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { segnaLezione } from '@/lib/data/percorso';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { ArgomentoId } from '@/lib/percorso/tipi';

const GIORNI_PIU_TARDI = 14;

// Giorni di calendario in UTC: nessun salto per l'ora legale.
function piuGiorni(giorno: string, n: number): string {
  const d = new Date(`${giorno}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function apriLezione(id: ArgomentoId): Promise<void> {
  await segnaLezione(await createClient(), id, { vistaIl: oggiRomaISO() });
  revalidatePath('/impara');
}

export async function rimandaLezione(id: ArgomentoId): Promise<void> {
  await segnaLezione(await createClient(), id, { rimandataAl: piuGiorni(oggiRomaISO(), GIORNI_PIU_TARDI) });
  revalidatePath('/impara');
}

export async function lezioneFatta(id: ArgomentoId): Promise<void> {
  await segnaLezione(await createClient(), id, { azioneIl: oggiRomaISO() });
  revalidatePath('/impara');
}
