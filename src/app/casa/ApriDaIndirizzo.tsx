'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCasaAzioni } from './CasaAzioni';

// Da /casa?azione=versamento (menu "Cosa vuoi fare?"): apre il versamento anche se la pagina è già aperta,
// poi pulisce l'indirizzo, così lo stesso ingresso si può usare di nuovo.
export function ApriDaIndirizzo(): null {
  const { apri } = useCasaAzioni();
  const router = useRouter();
  const azione = useSearchParams().get('azione');

  useEffect(() => {
    if (azione !== 'versamento') return;
    apri({ tipo: 'versamento' });
    router.replace('/casa');
  }, [azione, apri, router]);

  return null;
}
