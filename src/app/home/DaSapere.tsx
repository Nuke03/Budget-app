'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { lezione } from '@/lib/percorso/lezioni';
import type { ArgomentoId } from '@/lib/percorso/tipi';
import { proponiLezione } from '@/app/impara/primi-passi/actions';

// Una riga sotto il consiglio. Alla prima visualizzazione del giorno si ricorda che è stata proposta
// (da qui, non durante il rendering del server): le visite successive del giorno non la ripropongono.
export function DaSapere({ id }: { id: ArgomentoId }) {
  useEffect(() => {
    void proponiLezione(id).catch(() => {
      // ricordare la proposta è una comodità: la riga resta
    });
  }, [id]);

  return (
    <Link
      href={`/impara/${id}`}
      className="flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-rule bg-surface-muted px-4 py-2 text-[15px]"
    >
      <span className="flex-1">
        <b className="font-semibold text-brand-dark">Da sapere:</b> {lezione(id).titolo}
      </span>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-2" />
    </Link>
  );
}
