'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { creaFondoBolletta } from '@/lib/data/fondiCasa';
import { ultimaScadenza, type StatoVoceDaParte } from '@/lib/calculations/casa/fondi';
import type { PlanItem } from '@/lib/types';

export const ERRORE_DA_PARTE = 'Salvataggio fallito, controlla la connessione e riprova.';

// L'azione "Metti da parte": crea il fondo di ogni voce, una alla volta, senza rifare quelle già messe.
// La usano Da parte e la card "Da fare" della Casa.
export function useMettiDaParte({ householdId, oggi }: { householdId: string; oggi: string }) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatte, setFatte] = useState<string[]>([]);
  // Blocca il doppio tocco prima ancora che React ridisegni il pulsante.
  const occupato = useRef(false);
  const fatteRef = useRef<Set<string>>(new Set());

  async function metti(elenco: StatoVoceDaParte[], scadenzaDi: (item: PlanItem) => string = (i) => ultimaScadenza(i, oggi)) {
    if (occupato.current) return;
    occupato.current = true;
    setInCorso(true);
    setErrore(null);
    try {
      const supabase = createClient();
      for (const v of elenco) {
        // Una voce già messa (anche da un tentativo precedente) non si rifà.
        if (fatteRef.current.has(v.item.id)) continue;
        await creaFondoBolletta(supabase, {
          householdId,
          item: v.item,
          scadenza: scadenzaDi(v.item),
          oggi,
        });
        fatteRef.current.add(v.item.id);
        setFatte((f) => [...f, v.item.id]);
      }
    } catch {
      setErrore(ERRORE_DA_PARTE);
    } finally {
      occupato.current = false;
      setInCorso(false);
      router.refresh();
    }
  }

  return { metti, inCorso, errore, fatte };
}
