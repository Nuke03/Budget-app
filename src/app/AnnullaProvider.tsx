'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { creaCodaRimandata } from '@/lib/eliminazioneRimandata';
import { riprendiEliminazioniInSospeso, salvaInSospeso, togliInSospeso } from '@/lib/eliminazioniInSospeso';
import { createClient } from '@/lib/supabase/client';
import { AvvisoAnnulla } from './AvvisoAnnulla';

const ATTESA_MS = 5000;
const ERRORE_MS = 6000;

export interface EliminaConAnnulla {
  id: string;
  testo: string;
  esegui: () => Promise<void>;
  // Solo per l'eliminazione di un movimento (elimina_movimento, idempotente): l'attesa si scrive in
  // localStorage, così se l'app viene chiusa prima della scrittura si ripete alla riapertura.
  riprendibile?: boolean;
  nascondi: () => void;
  ripristina: () => void;
}

const Contesto = createContext<((r: EliminaConAnnulla) => void) | null>(null);

export function AnnullaProvider({ children }: { children: ReactNode }) {
  const [pendente, setPendente] = useState<{ id: string; testo: string } | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [nascosto, setNascosto] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
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
      // Prima del timer: se l'app muore ora, l'eliminazione non si perde.
      if (r.riprendibile) salvaInSospeso(r.id);
      coda.current!.aggiungi({
        id: r.id,
        testo: r.testo,
        esegui: async () => {
          try {
            await r.esegui();
            if (r.riprendibile) togliInSospeso(r.id);
            // Le pagine del server (Home) mostrano i dati nuovi; un errore qui non rimette in gioco la scrittura.
            try {
              router.refresh();
            } catch {}
            setPendente((p) => (p && p.id === r.id ? null : p));
          } catch {
            // La riga torna com'era (la scrittura è atomica): niente da ripetere alla riapertura.
            if (r.riprendibile) togliInSospeso(r.id);
            r.ripristina();
            setPendente((p) => (p && p.id === r.id ? null : p));
            // Se c'è un'altra eliminazione in attesa, il suo Annulla resta: l'errore si aggiunge allo stesso avviso.
            const altra = coda.current!.inAttesa();
            mostraErrore(altra ? "Una cosa è andata, l'altra no: riprova." : 'Non è andata: riprova.');
          } finally {
            ripristini.current.delete(r.id);
          }
        },
      });
    },
    [mostraErrore, router],
  );

  // All'avvio dell'app: le eliminazioni rimaste a metà (app chiusa prima della scrittura) si ripetono.
  useEffect(() => {
    let vivo = true;
    void riprendiEliminazioniInSospeso(createClient, [coda.current!.inAttesa()?.id ?? '']).then((fatte) => {
      if (!vivo || fatte === 0) return;
      try {
        router.refresh();
      } catch {}
    });
    return () => {
      vivo = false;
    };
    // una volta sola, all'avvio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Cambio pagina: le scritture in attesa partono ora e l'avviso sparisce (resta valido solo dove è nato).
  const percorsoPrecedente = useRef(pathname);
  useEffect(() => {
    if (percorsoPrecedente.current === pathname) return;
    percorsoPrecedente.current = pathname;
    setPendente(null);
    setNascosto(false);
    void coda.current!.eseguiTutte();
  }, [pathname]);

  const annulla = useCallback(() => {
    if (!pendente) return;
    const ripristina = ripristini.current.get(pendente.id);
    if (coda.current!.annulla(pendente.id)) {
      ripristini.current.delete(pendente.id);
      togliInSospeso(pendente.id);
      ripristina?.();
      setPendente(null);
    }
  }, [pendente]);

  const testo = nascosto ? null : errore ? (pendente ? `${errore} ${pendente.testo}` : errore) : (pendente?.testo ?? null);

  return (
    <Contesto.Provider value={elimina}>
      {children}
      {/* La X nasconde soltanto: il timer corre e la cancellazione avviene lo stesso. */}
      <AvvisoAnnulla
        testo={testo}
        onAnnulla={pendente ? annulla : null}
        onChiudi={() => setNascosto(true)}
        onPausa={() => coda.current!.pausa()}
        onRiprendi={() => coda.current!.riprendi()}
        focalizza={pendente?.id ?? null}
      />
    </Contesto.Provider>
  );
}

export function useEliminaConAnnulla(): (r: EliminaConAnnulla) => void {
  const v = useContext(Contesto);
  if (!v) throw new Error('useEliminaConAnnulla va usato dentro AnnullaProvider');
  return v;
}
