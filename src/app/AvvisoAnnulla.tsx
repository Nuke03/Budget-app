'use client';

import { X } from 'lucide-react';

// L'avviso in basso, sopra la barra. La regione resta sempre nel documento:
// gli screen reader annunciano solo il testo che ci compare dentro.
export function AvvisoAnnulla({
  testo,
  onAnnulla,
  onChiudi,
}: {
  testo: string | null;
  onAnnulla: (() => void) | null;
  onChiudi: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-xl justify-center px-3"
    >
      {testo ? (
        <div className="pointer-events-auto flex w-full items-center gap-1 rounded-[var(--radius-md)] bg-foreground pl-4 text-background">
          <p className="flex-1 py-3 text-[15px]">{testo}</p>
          {onAnnulla ? (
            <button
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
