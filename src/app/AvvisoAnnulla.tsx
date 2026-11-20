'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// L'avviso in basso, sopra la barra. La regione resta sempre nel documento:
// gli screen reader annunciano solo il testo che ci compare dentro.
export function AvvisoAnnulla({
  testo,
  onAnnulla,
  onChiudi,
  onPausa,
  onRiprendi,
  focalizza,
}: {
  testo: string | null;
  onAnnulla: (() => void) | null;
  onChiudi: () => void;
  // Mouse o tastiera sull'avviso: il conto alla rovescia si ferma (WCAG 2.2.1) e riparte quando se ne vanno.
  onPausa?: () => void;
  onRiprendi?: () => void;
  // Cambia a ogni nuova eliminazione: il fuoco passa ad Annulla, così non cade sul documento.
  focalizza?: string | null;
}) {
  const bottoneAnnulla = useRef<HTMLButtonElement>(null);
  const sopra = useRef({ mouse: false, fuoco: false });
  const fuocoProgrammatico = useRef(false);

  useEffect(() => {
    if (!focalizza || !bottoneAnnulla.current) return;
    // Il fuoco dato da noi non ferma il timer: altrimenti l'avviso non scadrebbe mai.
    fuocoProgrammatico.current = true;
    bottoneAnnulla.current.focus();
    fuocoProgrammatico.current = false;
  }, [focalizza]);

  // L'avviso sparisce mentre il mouse o il fuoco ci sono (X, scadenza): nessun blur arriverà, il timer riparte qui.
  useEffect(() => {
    if (testo) return;
    const erano = sopra.current.mouse || sopra.current.fuoco;
    sopra.current = { mouse: false, fuoco: false };
    if (erano) onRiprendi?.();
  });

  function aggiorna(prima: boolean) {
    const ora = sopra.current.mouse || sopra.current.fuoco;
    if (ora && !prima) onPausa?.();
    if (!ora && prima) onRiprendi?.();
  }
  function imposta(chi: 'mouse' | 'fuoco', valore: boolean) {
    const prima = sopra.current.mouse || sopra.current.fuoco;
    sopra.current[chi] = valore;
    aggiorna(prima);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-xl justify-center px-3"
    >
      {testo ? (
        <div
          data-avviso-annulla
          onMouseEnter={() => imposta('mouse', true)}
          onMouseLeave={() => imposta('mouse', false)}
          onFocus={() => {
            if (!fuocoProgrammatico.current) imposta('fuoco', true);
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) imposta('fuoco', false);
          }}
          className="pointer-events-auto flex w-full items-center gap-1 rounded-[var(--radius-md)] bg-foreground pl-4 text-background">
          <p className="flex-1 py-3 text-[15px]">{testo}</p>
          {onAnnulla ? (
            <button
              ref={bottoneAnnulla}
              type="button"
              onClick={onAnnulla}
              className="min-h-[44px] min-w-[44px] rounded-sm px-3 text-[15px] font-semibold underline underline-offset-4"
            >
              Annulla
            </button>
          ) : null}
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi l'avviso"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm"
          >
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
