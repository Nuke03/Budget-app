import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { loadPercorsoLeggero } from '@/lib/loadPercorsoData';
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
  // Se i dati non si leggono la lezione si apre lo stesso, senza "Con i tuoi numeri".
  const { dati } = await conUtente(supabase, (id) =>
    loadPercorsoLeggero(supabase, new Date(), id).catch(() => null)
  );
  return (
    <>
      <CoverHeader titolo="Impara" />
      <SchedaLezione lezione={l} numeri={dati ? numeriLezione(l.id, dati) : null} />
    </>
  );
}
