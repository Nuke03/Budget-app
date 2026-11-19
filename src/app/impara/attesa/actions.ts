'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { aggiungiAttesa, decidiAttesa } from '@/lib/data/percorso';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';

const ID = /^[0-9a-fA-F-]{8,64}$/;

function aggiorna(): void {
  revalidatePath('/');
  revalidatePath('/impara/attesa');
}

export async function aggiungiVoce(nome: string, importo: number): Promise<void> {
  const pulito = typeof nome === 'string' ? nome.trim() : '';
  if (!pulito || pulito.length > 80) throw new Error('Nome non valido');
  if (typeof importo !== 'number' || !Number.isFinite(importo) || importo <= 0 || importo >= 1e9) {
    throw new Error('Importo non valido');
  }
  const supabase = await createClient();
  await utenteOLogin(supabase);
  await aggiungiAttesa(supabase, pulito, importo, oggiRomaISO());
  aggiorna();
}

export async function decidiVoce(id: string, stato: 'voluto' | 'non_piu'): Promise<void> {
  if (typeof id !== 'string' || !ID.test(id)) throw new Error('Voce non valida');
  if (stato !== 'voluto' && stato !== 'non_piu') throw new Error('Scelta non valida');
  const supabase = await createClient();
  await utenteOLogin(supabase);
  await decidiAttesa(supabase, id, stato);
  aggiorna();
}
