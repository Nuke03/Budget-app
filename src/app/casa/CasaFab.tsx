'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EVENTO_AGGIUNGI, segnaGestito } from '@/lib/eventoAggiungi';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Account } from '@/lib/types';
import { AddTransactionSheet } from '../add/AddTransactionSheet';

export function CasaFab({ aggiunta, contiPersonali }: { aggiunta: CasaAggiunta; contiPersonali?: Account[] }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);

  // Il + della barra apre il foglio in modo casa.
  useEffect(() => {
    const apri = (e: Event) => {
      segnaGestito(e);
      setAperto(true);
    };
    window.addEventListener(EVENTO_AGGIUNGI, apri);
    return () => window.removeEventListener(EVENTO_AGGIUNGI, apri);
  }, []);

  return (
    <>
      <AddTransactionSheet
        aperto={aperto}
        onClose={() => setAperto(false)}
        personale={null}
        casa={aggiunta}
        contiPersonali={contiPersonali}
        modoIniziale="casa"
        meUserId={aggiunta.meUserId}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
