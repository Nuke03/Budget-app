'use client';

import { useEffect } from 'react';

// Solo per l'anteprima: apre il foglio di aggiunta della Home passando dal menu del +.
export function ApriFoglio() {
  useEffect(() => {
    document.querySelector<HTMLButtonElement>('button[aria-label="Cosa vuoi fare?"]')?.click();
    const t = setTimeout(() => {
      const voce = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(
        (b) => b.textContent?.trim() === 'Registra una spesa',
      );
      voce?.click();
    }, 0);
    return () => clearTimeout(t);
  }, []);
  return null;
}
