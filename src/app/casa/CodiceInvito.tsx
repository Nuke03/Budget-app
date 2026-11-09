'use client';

import { useState, type ReactNode } from 'react';
import { formatCodiceInvito } from '@/lib/data/households';
import { testoInvito } from '@/lib/invito';

// Unico blocco che mostra un codice di invito, ovunque compaia.
export function CodiceInvito({
  codice,
  origin,
  children,
}: {
  codice: string;
  origin?: string;
  children?: ReactNode;
}) {
  const [copiato, setCopiato] = useState(false);
  const [copiaFallita, setCopiaFallita] = useState(false);
  const mostrato = formatCodiceInvito(codice);
  const puoCondividere = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // L'indirizzo arriva dal server quando c'è; altrimenti è quello della pagina aperta.
  const indirizzo = () => origin || window.location.origin;

  async function copia() {
    try {
      await navigator.clipboard.writeText(testoInvito(indirizzo(), codice));
      setCopiato(true);
      setCopiaFallita(false);
    } catch {
      setCopiato(false);
      setCopiaFallita(true);
    }
  }

  async function condividi() {
    try {
      await navigator.share({ text: testoInvito(indirizzo(), codice) });
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
          Copia l&apos;invito
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
      {copiaFallita && (
        <p role="alert" className="text-xs text-danger">
          Non riesco a copiare: tieni premuto sul codice qui sopra per copiarlo.
        </p>
      )}
      {copiato && <p className="text-xs text-brand-dark">Invito copiato.</p>}
      <p className="text-sm text-muted">
        Chi lo riceve tocca il link ed entra; il codice serve solo se lo scrive a mano.
      </p>
    </div>
  );
}
