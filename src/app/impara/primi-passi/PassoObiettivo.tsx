'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { obiettivoPiuAvanti } from './actions';
import { ERRORE_TESTO, PRIMARIO, SECONDARIO } from './stili';

export function PassoObiettivo() {
  const router = useRouter();
  const [inCorso, avvia] = useTransition();
  const [errore, setErrore] = useState(false);

  function piuAvanti() {
    setErrore(false);
    avvia(async () => {
      try {
        await obiettivoPiuAvanti();
        router.refresh();
      } catch {
        setErrore(true);
      }
    });
  }

  return (
    <div className="mt-5 flex flex-col gap-2">
      <Link href="/goals?nuovo=1" className={PRIMARIO}>
        Crea un cassetto
      </Link>
      <button type="button" disabled={inCorso} onClick={piuAvanti} className={SECONDARIO}>
        Più avanti
      </button>
      {errore ? <p role="alert" className="text-sm text-ink-2">{ERRORE_TESTO}</p> : null}
    </div>
  );
}
