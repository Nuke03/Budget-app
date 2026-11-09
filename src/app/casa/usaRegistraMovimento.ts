'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { messaggioErroreTrasferimento, recordTransfer, type RecordTransferInput } from '@/lib/data/transfers';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';

// Quello che hanno in comune i moduli di versamento, rimborso e restituzione: l'importo scritto a mano
// (anche con la virgola), un solo invio per volta, e gli errori in una frase neutra con i campi che restano.
export function useRegistraMovimento({
  onDone,
  importoIniziale,
  max,
}: {
  onDone: () => void;
  importoIniziale?: number;
  max?: number;
}) {
  const [importoTesto, setImportoTesto] = useState(
    importoIniziale === undefined ? '' : String(importoIniziale).replace('.', ',')
  );
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // Il doppio tocco arriva prima che React ridisegni: lo blocca un ref, non lo stato.
  const occupato = useRef(false);

  const letto = parseImporto(importoTesto);
  const oltreMax = letto !== null && max !== undefined && letto > max + 0.001;
  const importo = letto !== null && letto > 0 && !oltreMax ? letto : null;

  async function registra(input: RecordTransferInput): Promise<boolean> {
    if (occupato.current) return false;
    occupato.current = true;
    setInCorso(true);
    setErrore(null);
    try {
      await recordTransfer(createClient(), input);
      onDone();
      return true;
    } catch (e) {
      setErrore(messaggioErroreTrasferimento(e));
      return false;
    } finally {
      occupato.current = false;
      setInCorso(false);
    }
  }

  return { importoTesto, setImportoTesto, importo, oltreMax, inCorso, errore, registra };
}
