import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { loadPercorsoData } from '@/lib/loadPercorsoData';
import { LEZIONI, lezione } from '@/lib/percorso/lezioni';
import { numeriLezione } from '@/lib/calculations/percorso/numeri';
import type { ArgomentoId } from '@/lib/percorso/tipi';
import { CoverHeader } from '../../CoverHeader';
import { SchedaLezione } from '../SchedaLezione';

export default async function LezionePage({ params }: { params: Promise<{ argomento: string }> }) {
  const { argomento } = await params;
  if (!LEZIONI.some((l) => l.id === argomento)) notFound();
  const l = lezione(argomento as ArgomentoId);
  const supabase = await createClient();
  const { dati } = await conUtente(supabase, () => loadPercorsoData(supabase));
  return (
    <>
      <CoverHeader titolo="Impara" />
      <SchedaLezione lezione={l} numeri={numeriLezione(l.id, dati)} />
    </>
  );
}
