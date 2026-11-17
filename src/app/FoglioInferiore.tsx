'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const FOCALIZZABILI = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Il foglio che sale dal basso: sfondo che chiude, maniglia, titolo e X.
export function FoglioInferiore({
  titolo,
  onClose,
  children,
}: {
  titolo: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const foglio = useRef<HTMLDivElement>(null);
  const alChiudi = useRef(onClose);
  alChiudi.current = onClose;

  useEffect(() => {
    const aperto = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const elenco = () => Array.from(foglio.current?.querySelectorAll<HTMLElement>(FOCALIZZABILI) ?? []);
    // Il primo controllo del contenuto; se non c'è, la X.
    (elenco().find((el) => el.getAttribute('aria-label') !== 'Chiudi') ?? elenco()[0])?.focus();
    function tasto(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        alChiudi.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const el = elenco();
      if (el.length === 0) return;
      const primo = el[0];
      const ultimo = el[el.length - 1];
      const attivo = document.activeElement;
      if (!foglio.current?.contains(attivo)) {
        e.preventDefault();
        primo.focus();
      } else if (e.shiftKey && attivo === primo) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && attivo === ultimo) {
        e.preventDefault();
        primo.focus();
      }
    }
    document.addEventListener('keydown', tasto);
    return () => {
      document.removeEventListener('keydown', tasto);
      aperto?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="animate-backdrop-in absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div ref={foglio} role="dialog" aria-modal="true" aria-label={titolo} className="animate-sheet-in relative w-full max-w-md rounded-t-[var(--radius-lg)] bg-surface pt-3 shadow-2xl">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-black/10" />
        <div className="flex items-center justify-between px-5 pb-2">
          <h2 className="text-lg font-bold">{titolo}</h2>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-surface-muted"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
