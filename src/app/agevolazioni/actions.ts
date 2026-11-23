'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { utenteOLogin } from '@/lib/utenteOLogin';
import { salvaSituazioneDati, segnaVoceDati, segnaSezioneApertaDati } from '@/lib/data/agevolazioni';
import { VOCI } from '@/lib/agevolazioni/voci';
import type { Situazione, VoceId } from '@/lib/agevolazioni/tipi';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function aggiorna(): void {
  revalidatePath('/agevolazioni');
  revalidatePath('/');
}

function dataEsiste(data: string): boolean {
  if (!DATA_ISO.test(data)) return false;
  const d = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}

function booleanoONull(v: unknown): boolean | null {
  if (v === null) return v;
  if (typeof v !== 'boolean') throw new Error('Valore non valido');
  return v;
}

export async function salvaSituazione(input: Omit<Situazione, 'piva'>): Promise<void> {
  let isee: number | null = null;
  if (input.isee !== null) {
    if (typeof input.isee !== 'number' || !Number.isFinite(input.isee)) throw new Error('ISEE non valido');
    // Ai centesimi, poi il controllo: 999999.996 fa 1.000.000 e non vale.
    isee = Math.round(input.isee * 100) / 100;
    if (isee < 0 || isee >= 1_000_000) throw new Error('ISEE non valido');
  }

  let dsuData: string | null = null;
  if (input.dsuData !== null) {
    if (typeof input.dsuData !== 'string' || !dataEsiste(input.dsuData) || input.dsuData > oggiRomaISO()) {
      throw new Error('Data non valida');
    }
    dsuData = input.dsuData;
  }

  let comune: string | null = null;
  if (input.comune !== null) {
    if (typeof input.comune !== 'string') throw new Error('Comune non valido');
    const pulito = input.comune.trim();
    if (pulito.length > 80) throw new Error('Comune non valido');
    comune = pulito === '' ? null : pulito;
  }

  const dati = {
    isee,
    dsuData,
    comune,
    inAffitto: booleanoONull(input.inAffitto),
    studente: booleanoONull(input.studente),
  };

  const supabase = await createClient();
  await utenteOLogin(supabase);
  await salvaSituazioneDati(supabase, dati, new Date().toISOString());
  aggiorna();
}

export async function segnaVoce(voceId: VoceId, stato: 'fatto' | 'non-mi-riguarda' | null): Promise<void> {
  if (typeof voceId !== 'string' || !VOCI.some((v) => v.id === voceId)) throw new Error('Voce non valida');
  if (stato !== null && stato !== 'fatto' && stato !== 'non-mi-riguarda') throw new Error('Scelta non valida');
  const supabase = await createClient();
  await utenteOLogin(supabase);
  await segnaVoceDati(supabase, voceId, stato, oggiRomaISO());
  aggiorna();
}

export async function segnaSezioneAperta(): Promise<void> {
  const supabase = await createClient();
  await utenteOLogin(supabase);
  await segnaSezioneApertaDati(supabase, oggiRomaISO());
  aggiorna();
}
