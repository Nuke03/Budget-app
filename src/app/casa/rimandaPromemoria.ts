'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

// "Più tardi": un promemoria rimandato resta nascosto per la giornata, nello stesso posto per ogni
// vista che lo mostra (la striscia dei promemoria e la card Da fare).
const chiave = (id: string, oggi: string): string => `promemoria:${id}:${oggi}`;

// "Va bene così": il promemoria resta nascosto fino a una data (esclusa). Tutta la memoria passa da qui,
// così spostarla dal browser al database è un posto solo.
const chiaveFino = (id: string): string => `promemoria-fino:${id}`;

// La data `n` mesi dopo `oggi` (YYYY-MM-DD).
export function dataFraMesi(oggi: string, n: number): string {
  const d = new Date(`${oggi}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export function promemoriaRimandato(id: string, oggi: string): boolean {
  try {
    if (window.localStorage.getItem(chiave(id, oggi)) !== null) return true;
    const fino = window.localStorage.getItem(chiaveFino(id));
    return fino !== null && oggi < fino;
  } catch {
    return false;
  }
}

export function rimandaFinoAl(id: string, finoAl: string): void {
  try {
    window.localStorage.setItem(chiaveFino(id), finoAl);
  } catch {
    // Senza memoria il nascondimento vale solo per la sessione.
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
export function usePromemoriaRimandati(ids: string[], oggi: string): { rimandati: Set<string>; rimanda: (id: string) => void; rimandaFino: (ids: string[], finoAl: string) => void } {
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
  const rimandaFino = useCallback((idsDaNascondere: string[], finoAl: string) => {
    for (const id of idsDaNascondere) rimandaFinoAl(id, finoAl);
    setDaOra((prima) => new Set([...prima, ...idsDaNascondere]));
  }, []);
  return { rimandati: new Set([...daOra, ...(memoria ? memoria.split('|') : [])]), rimanda, rimandaFino };
}
