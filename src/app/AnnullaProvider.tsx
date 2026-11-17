'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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

const Contesto = createContext<((r: EliminaConAnnulla) => void) | null>(null);

export function AnnullaProvider({ children }: { children: ReactNode }) {
  const [pendente, setPendente] = useState<{ id: string; testo: string } | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [nascosto, setNascosto] = useState(false);
  const coda = useRef<ReturnType<typeof creaCodaRimandata> | null>(null);
  const ripristini = useRef(new Map<string, () => void>());
  const timerErrore = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (coda.current === null) coda.current = creaCodaRimandata({ attesaMs: ATTESA_MS });

  const mostraErrore = useCallback((testo: string) => {
    if (timerErrore.current) clearTimeout(timerErrore.current);
    setErrore(testo);
    setNascosto(false);
    timerErrore.current = setTimeout(() => setErrore(null), ERRORE_MS);
  }, []);

  const elimina = useCallback(
    (r: EliminaConAnnulla) => {
      ripristini.current.set(r.id, r.ripristina);
      r.nascondi();
      if (timerErrore.current) clearTimeout(timerErrore.current);
      setErrore(null);
      setNascosto(false);
      setPendente({ id: r.id, testo: r.testo });
      coda.current!.aggiungi({
        id: r.id,
        testo: r.testo,
        esegui: async () => {
          try {
            await r.esegui();
            setPendente((p) => (p && p.id === r.id ? null : p));
          } catch {
            r.ripristina();
            setPendente((p) => (p && p.id === r.id ? null : p));
            // Se c'è un'altra eliminazione in attesa, il suo Annulla resta: l'errore si aggiunge allo stesso avviso.
            const altra = coda.current!.inAttesa();
            mostraErrore(altra ? "Non sono riuscito a eliminare l'altra: riprova." : 'Non sono riuscito a eliminarla: riprova.');
          } finally {
            ripristini.current.delete(r.id);
          }
        },
      });
    },
    [mostraErrore],
  );

  // Se la pagina si nasconde o si chiude, la scrittura parte comunque, una volta sola:
  // l'avviso sparisce subito, così Annulla non resta lì a non fare niente.
  useEffect(() => {
    const q = coda.current!;
    const subito = () => {
      setPendente(null);
      void q.eseguiTutte();
    };
    const alCambio = () => {
      if (document.visibilityState === 'hidden') subito();
    };
    window.addEventListener('pagehide', subito);
    document.addEventListener('visibilitychange', alCambio);
    return () => {
      window.removeEventListener('pagehide', subito);
      document.removeEventListener('visibilitychange', alCambio);
      if (timerErrore.current) clearTimeout(timerErrore.current);
      void q.eseguiTutte();
    };
  }, []);

  const annulla = useCallback(() => {
    if (!pendente) return;
    const ripristina = ripristini.current.get(pendente.id);
    if (coda.current!.annulla(pendente.id)) {
      ripristini.current.delete(pendente.id);
      ripristina?.();
      setPendente(null);
    }
  }, [pendente]);

  const testo = nascosto ? null : errore ? (pendente ? `${errore} ${pendente.testo}` : errore) : (pendente?.testo ?? null);

  return (
    <Contesto.Provider value={elimina}>
      {children}
      {/* La X nasconde soltanto: il timer corre e la cancellazione avviene lo stesso. */}
      <AvvisoAnnulla testo={testo} onAnnulla={pendente ? annulla : null} onChiudi={() => setNascosto(true)} />
    </Contesto.Provider>
  );
}

export function useEliminaConAnnulla(): (r: EliminaConAnnulla) => void {
  const v = useContext(Contesto);
  if (!v) throw new Error('useEliminaConAnnulla va usato dentro AnnullaProvider');
  return v;
}
