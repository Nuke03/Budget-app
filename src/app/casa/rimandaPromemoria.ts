'use client';

import { createContext, createElement, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { salvaRimandato, unisciRimandati, type Rimandati } from '@/lib/data/notifiche';

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

// Il giorno dopo `oggi` (YYYY-MM-DD): "Più tardi" nasconde fino a lì, escluso.
export function giornoDopo(oggi: string): string {
  const d = new Date(`${oggi}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
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

// I rimandati nel database ({ id: primo giorno in cui ricompaiono }), uguali su ogni telefono. Il server li legge
// con la Casa e li passa qui; se la lettura è fallita (iniziale null) non c'è contesto e vale solo localStorage.
// Il nascondimento è subito (ottimistico); se il salvataggio fallisce si ripiega su localStorage.
type Contesto = { mappa: Rimandati; imposta: (id: string, finoAl: string, oggi: string) => void };
const RimandatiContesto = createContext<Contesto | null>(null);

// Un salvataggio alla volta: ognuno rilegge la riga e unisce la sua chiave, senza pestare quello prima.
let codaSalvataggi: Promise<unknown> = Promise.resolve();

export function RimandatiProvider({ iniziale, children }: { iniziale: Rimandati | null; children: ReactNode }) {
  const [mappa, setMappa] = useState<Rimandati>(iniziale ?? {});
  // Quando il server manda dati nuovi (dopo un refresh) la mappa si riallinea.
  const [visto, setVisto] = useState(iniziale);
  if (iniziale !== visto) {
    setVisto(iniziale);
    setMappa(iniziale ?? {});
  }
  const imposta = useCallback((id: string, finoAl: string, oggi: string) => {
    setMappa((m) => unisciRimandati(m, id, finoAl, oggi));
    codaSalvataggi = codaSalvataggi.then(async () => {
      try {
        await salvaRimandato(createClient(), id, finoAl, oggi);
      } catch {
        rimandaFinoAl(id, finoAl);
      }
    });
  }, []);
  // Senza lettura (iniziale null) il contesto è vuoto e vale solo localStorage; la radice resta sempre la stessa.
  const valore = useMemo(() => (iniziale === null ? null : { mappa, imposta }), [iniziale, mappa, imposta]);
  return createElement(RimandatiContesto.Provider, { value: valore }, children);
}

// Gli id rimandati fra quelli dati. La memoria si legge solo nel browser: sul server (e nel primo
// render) non c'è, così l'HTML coincide.
export function usePromemoriaRimandati(ids: string[], oggi: string): { rimandati: Set<string>; rimanda: (id: string) => void; rimandaFino: (ids: string[], finoAl: string) => void } {
  const [daOra, setDaOra] = useState<Set<string>>(new Set());
  const db = useContext(RimandatiContesto);
  const memoria = useSyncExternalStore(
    () => () => {},
    () => ids.filter((id) => promemoriaRimandato(id, oggi)).join('|'),
    () => ''
  );
  const rimanda = useCallback(
    (id: string) => {
      if (db) db.imposta(id, giornoDopo(oggi), oggi);
      else rimandaPromemoria(id, oggi);
      setDaOra((prima) => new Set(prima).add(id));
    },
    [oggi, db]
  );
  const rimandaFino = useCallback(
    (idsDaNascondere: string[], finoAl: string) => {
      for (const id of idsDaNascondere) {
        if (db) db.imposta(id, finoAl, oggi);
        else rimandaFinoAl(id, finoAl);
      }
      setDaOra((prima) => new Set([...prima, ...idsDaNascondere]));
    },
    [oggi, db]
  );
  const nelDatabase = ids.filter((id) => db && (db.mappa[id] ?? '') > oggi);
  return { rimandati: new Set([...daOra, ...nelDatabase, ...(memoria ? memoria.split('|') : [])]), rimanda, rimandaFino };
}
