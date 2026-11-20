'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCasaAzioni } from './CasaAzioni';

// Da /casa?azione=versamento (menu "Cosa vuoi fare?"): apre il versamento una volta sola e pulisce l'indirizzo.
export function ApriDaIndirizzo(): null {
  const { apri } = useCasaAzioni();
  const router = useRouter();
  const fatto = useRef(false);

  useEffect(() => {
    if (fatto.current) return;
    if (new URLSearchParams(window.location.search).get('azione') !== 'versamento') return;
    fatto.current = true;
    apri({ tipo: 'versamento' });
    router.replace('/casa');
  }, [apri, router]);

  return null;
}
