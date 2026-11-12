'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

// "Più tardi": un promemoria rimandato resta nascosto per la giornata, nello stesso posto per ogni
// vista che lo mostra (la striscia dei promemoria e la card Da fare).
const chiave = (id: string, oggi: string): string => `promemoria:${id}:${oggi}`;

export function promemoriaRimandato(id: string, oggi: string): boolean {
  try {
    return window.localStorage.getItem(chiave(id, oggi)) !== null;
  } catch {
    return false;
  }
}

export function rimandaPromemoria(id: string, oggi: string): void {
  try {
    window.localStorage.setItem(chiave(id, oggi), '1');
  } catch {
    // Senza memoria il nascondimento vale solo per la sessione.
  }
}

// Gli id rimandati fra quelli dati. La memoria si legge solo nel browser: sul server (e nel primo
// render) non c'è, così l'HTML coincide.
export function usePromemoriaRimandati(ids: string[], oggi: string): { rimandati: Set<string>; rimanda: (id: string) => void } {
  const [daOra, setDaOra] = useState<Set<string>>(new Set());
  const memoria = useSyncExternalStore(
    () => () => {},
    () => ids.filter((id) => promemoriaRimandato(id, oggi)).join('|'),
    () => ''
  );
  const rimanda = useCallback(
    (id: string) => {
      rimandaPromemoria(id, oggi);
      setDaOra((prima) => new Set(prima).add(id));
    },
    [oggi]
  );
  return { rimandati: new Set([...daOra, ...(memoria ? memoria.split('|') : [])]), rimanda };
}
