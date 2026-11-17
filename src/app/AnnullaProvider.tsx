'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { creaCodaRimandata } from '@/lib/eliminazioneRimandata';
import { AvvisoAnnulla } from './AvvisoAnnulla';

const ATTESA_MS = 5000;
const ERRORE_MS = 6000;

export interface EliminaConAnnulla {
  id: string;
  testo: string;
  esegui: () => Promise<void>;
  nascondi: () => void;
  ripristina: () => void;
}

type Avviso = { id: string; testo: string } | { id: null; testo: string };

const Contesto = createContext<((r: EliminaConAnnulla) => void) | null>(null);

export function AnnullaProvider({ children }: { children: ReactNode }) {
  const [avviso, setAvviso] = useState<Avviso | null>(null);
  const coda = useRef<ReturnType<typeof creaCodaRimandata> | null>(null);
  const ripristini = useRef(new Map<string, () => void>());
  const timerErrore = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (coda.current === null) coda.current = creaCodaRimandata({ attesaMs: ATTESA_MS });

  const mostraErrore = useCallback(() => {
    if (timerErrore.current) clearTimeout(timerErrore.current);
    setAvviso({ id: null, testo: 'Non sono riuscito a eliminarla: riprova.' });
    timerErrore.current = setTimeout(() => setAvviso((a) => (a && a.id === null ? null : a)), ERRORE_MS);
  }, []);

  const elimina = useCallback(
    (r: EliminaConAnnulla) => {
      ripristini.current.set(r.id, r.ripristina);
      r.nascondi();
      if (timerErrore.current) clearTimeout(timerErrore.current);
      setAvviso({ id: r.id, testo: r.testo });
      coda.current!.aggiungi({
        id: r.id,
        testo: r.testo,
        esegui: async () => {
          try {
            await r.esegui();
            setAvviso((a) => (a && a.id === r.id ? null : a));
          } catch {
            r.ripristina();
            mostraErrore();
          } finally {
            ripristini.current.delete(r.id);
          }
        },
      });
    },
    [mostraErrore],
  );

  // Se la pagina si nasconde o si chiude, la scrittura parte comunque, una volta sola.
  useEffect(() => {
    const q = coda.current!;
    const subito = () => void q.eseguiTutte();
    const alCambio = () => {
      if (document.visibilityState === 'hidden') subito();
    };
    window.addEventListener('pagehide', subito);
    document.addEventListener('visibilitychange', alCambio);
    return () => {
      window.removeEventListener('pagehide', subito);
      document.removeEventListener('visibilitychange', alCambio);
      if (timerErrore.current) clearTimeout(timerErrore.current);
      subito();
    };
  }, []);

  const annulla = useCallback(() => {
    if (!avviso || avviso.id === null) return;
    const ripristina = ripristini.current.get(avviso.id);
    if (coda.current!.annulla(avviso.id)) {
      ripristini.current.delete(avviso.id);
      ripristina?.();
      setAvviso(null);
    }
  }, [avviso]);

  const chiudi = useCallback(() => {
    // Chiudere l'avviso non annulla: la cancellazione procede subito.
    void coda.current!.eseguiTutte();
    setAvviso(null);
  }, []);

  const valore = useMemo(() => elimina, [elimina]);

  return (
    <Contesto.Provider value={valore}>
      {children}
      <AvvisoAnnulla testo={avviso?.testo ?? null} onAnnulla={avviso && avviso.id !== null ? annulla : null} onChiudi={chiudi} />
    </Contesto.Provider>
  );
}

export function useEliminaConAnnulla(): (r: EliminaConAnnulla) => void {
  const v = useContext(Contesto);
  if (!v) throw new Error('useEliminaConAnnulla va usato dentro AnnullaProvider');
  return v;
}
