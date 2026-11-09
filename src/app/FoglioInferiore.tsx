'use client';

import { X } from 'lucide-react';

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
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="animate-backdrop-in absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="animate-sheet-in relative w-full max-w-md rounded-t-[var(--radius-lg)] bg-surface pt-3 shadow-2xl">
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
