'use client';

import { useCallback, useState } from 'react';

// Gli error boundary di React (error.tsx) catturano solo errori lanciati
// durante il render, non quelli di una Promise in un useEffect. Questo hook
// restituisce una funzione da passare a `.catch()`: salva l'errore nello
// state e lo rilancia al render successivo, così arriva fino a error.tsx
// invece di lasciare la pagina silenziosamente vuota.
export function useThrowToBoundary(): (error: unknown) => void {
  const [error, setError] = useState<unknown>(null);
  if (error) throw error;
  return useCallback((e: unknown) => setError(e ?? new Error('Errore sconosciuto')), []);
}
