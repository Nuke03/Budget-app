'use client';

import { useEffect, useRef, useState } from 'react';

const MS_VISIBILE = 3000;

// "Salvato." per 3 secondi dopo un salvataggio riuscito. `mostra()` si chiama dopo l'azione.
export function useSalvato(): { salvato: boolean; mostra: () => void } {
  const [salvato, setSalvato] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  function mostra() {
    if (timer.current) clearTimeout(timer.current);
    setSalvato(true);
    timer.current = setTimeout(() => setSalvato(false), MS_VISIBILE);
  }
  return { salvato, mostra };
}

// Il paragrafo c'è sempre, vuoto: così il lettore di schermo annuncia il testo quando compare.
export function Salvato({ visibile }: { visibile: boolean }) {
  return (
    <p role="status" className="text-[15px] text-ink-2">
      {visibile ? 'Salvato.' : ''}
    </p>
  );
}
