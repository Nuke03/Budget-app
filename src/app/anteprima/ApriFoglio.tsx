'use client';

import { useEffect } from 'react';

// Solo per l'anteprima: apre il foglio di aggiunta della Home premendo il suo pulsante.
export function ApriFoglio() {
  useEffect(() => {
    document.querySelector<HTMLButtonElement>('button[aria-label="Aggiungi transazione"]')?.click();
  }, []);
  return null;
}
