'use client';

import { useState, type ReactNode } from 'react';
import { formatCodiceInvito } from '@/lib/data/households';

// Unico blocco che mostra un codice di invito, ovunque compaia.
export function CodiceInvito({ codice, children }: { codice: string; children?: ReactNode }) {
  const [copiato, setCopiato] = useState(false);
  const mostrato = formatCodiceInvito(codice);
  const puoCondividere = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function copia() {
    try {
      await navigator.clipboard.writeText(mostrato);
      setCopiato(true);
    } catch {
      setCopiato(false);
    }
  }

  async function condividi() {
    try {
      await navigator.share({ text: `Il codice per entrare nella nostra casa: ${mostrato}` });
    } catch {
      // l'utente ha annullato la condivisione
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-muted">Codice di invito</p>
      <p className="text-3xl font-bold tracking-widest">{mostrato}</p>
      <p className="text-xs text-muted">
        Vale finché non lo revochi o ne generi un altro, al massimo 7 giorni; lo possono usare più persone.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copia}
          className="rounded-[var(--radius-md)] bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground"
        >
          Copia il codice
        </button>
        {puoCondividere && (
          <button
            type="button"
            onClick={condividi}
            className="rounded-[var(--radius-md)] border border-black/10 px-4 py-2.5 text-sm font-semibold"
          >
            Condividi
          </button>
        )}
        {children}
      </div>
      {copiato && <p className="text-xs text-brand-dark">Codice copiato.</p>}
      <p className="text-sm text-muted">
        Scrivilo alla persona con cui vivi: dovrà aprire Casa e scegliere &quot;Ho un codice di invito&quot;.
      </p>
    </div>
  );
}
