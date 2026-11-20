'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Il puntino sulla scheda Casa della barra: Home e Casa dicono "c'è una cosa da fare" dopo aver caricato
// i loro promemoria, la barra lo legge. Nessuna lettura in più nel layout. Il valore resta finché
// un'altra pagina non lo cambia; due contesti, così chi pubblica non si ridisegna a ogni cambio.
const Valore = createContext<boolean>(false);
const Imposta = createContext<((v: boolean) => void) | null>(null);

export function CasaSegnaleProvider({ children }: { children: ReactNode }) {
  const [daFare, setDaFare] = useState(false);
  return (
    <Imposta.Provider value={setDaFare}>
      <Valore.Provider value={daFare}>{children}</Valore.Provider>
    </Imposta.Provider>
  );
}

export function useCasaDaFare(): boolean {
  return useContext(Valore);
}

// Per le pagine: pubblica se c'è un promemoria visibile. Senza provider (test, anteprime) non fa niente.
export function useSegnalaCasa(attivo: boolean): void {
  const imposta = useContext(Imposta);
  useEffect(() => {
    imposta?.(attivo);
  }, [imposta, attivo]);
}

// Per la Home: accende il puntino solo se sa che c'è un promemoria della casa, e non lo spegne mai. La Home non
// conosce tutti i promemoria della Casa ("Rivedi la quota" si calcola solo lì): tacere non vuol dire che non ce ne
// sono, quindi un puntino acceso dalla Casa non va spento da qui.
export function useSegnalaCasaSeCe(esiste: boolean): void {
  const imposta = useContext(Imposta);
  useEffect(() => {
    if (esiste) imposta?.(true);
  }, [imposta, esiste]);
}

// Per chi non ha un posto dove chiamare l'hook (ramo senza promemoria).
export function SegnalaCasa({ attivo }: { attivo: boolean }) {
  useSegnalaCasa(attivo);
  return null;
}
