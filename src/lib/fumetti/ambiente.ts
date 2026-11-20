'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { leggiSessione } from '@/lib/utenteOLogin';

// L'utente della sessione per i fumetti. Null finché non letto, senza sessione o se Supabase
// non si inizializza: in quel caso i fumetti semplicemente non compaiono e la pagina resta com'è.
export function useUtenteId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    (async () => {
      try {
        const sessione = await leggiSessione(createClient());
        if (attivo) setUserId(sessione.userId);
      } catch {
        if (attivo) setUserId(null);
      }
    })();
    return () => {
      attivo = false;
    };
  }, []);

  return userId;
}

// Vero se c'è un foglio aperto sopra la pagina (un dialog modale che non è un fumetto)
// oppure l'avviso di annullamento. Con questo i fumetti stanno fermi e non si sovrappongono.
export function qualcosaAperto(doc?: Document): boolean {
  const d = doc ?? (typeof document === 'undefined' ? null : document);
  if (!d) return false;
  return (
    d.querySelector('[aria-modal="true"]:not([data-fumetto-giro])') !== null ||
    d.querySelector('[data-avviso-annulla]') !== null ||
    // il foglio dopo il salvataggio (avviso, lezione) non c'è ancora ma sta per arrivare
    d.body?.hasAttribute('data-dopo-in-attesa') === true
  );
}

// Lo stesso valore di qualcosaAperto, aggiornato a ogni cambiamento del body.
export function useQualcosaAperto(): boolean {
  const [aperto, setAperto] = useState(() => typeof document !== 'undefined' && qualcosaAperto());

  useEffect(() => {
    const aggiorna = () => setAperto(qualcosaAperto());
    aggiorna();
    const osservatore = new MutationObserver(aggiorna);
    osservatore.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => osservatore.disconnect();
  }, []);

  return aperto;
}
