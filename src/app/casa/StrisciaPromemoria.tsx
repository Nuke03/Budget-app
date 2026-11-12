'use client';

import Link from 'next/link';
import { MASSIMO_PROMEMORIA, type AzionePromemoria, type Promemoria } from '@/lib/calculations/casa/promemoria';
import { usePromemoriaRimandati } from './rimandaPromemoria';

// I promemoria della casa: pochi, neutri, sempre rimandabili con "Più tardi" (per la giornata).
// compatta: una sola riga, il primo promemoria, che porta a /casa (al controllo o al check-in se è quello il promemoria).
export function StrisciaPromemoria({
  promemoria,
  oggi,
  onAzione,
  compatta = false,
}: {
  promemoria: Promemoria[];
  oggi: string;
  onAzione?: (azione: AzionePromemoria) => void;
  compatta?: boolean;
}) {
  const { rimandati: nascosti, rimanda } = usePromemoriaRimandati(promemoria.map((p) => p.id), oggi);

  const visibili = promemoria.filter((p) => !nascosti.has(p.id)).slice(0, MASSIMO_PROMEMORIA);
  if (visibili.length === 0) return null;

  if (compatta) {
    return (
      <Link
        href={(visibili[0].azione?.tipo === 'controllo' || visibili[0].azione?.tipo === 'checkin') && visibili[0].azione.href ? visibili[0].azione.href : '/casa'}
        className="block rounded-[var(--radius-md)] border border-rule bg-surface px-4 py-3 text-[15px]"
      >
        {visibili[0].testo}
      </Link>
    );
  }

  return (
    <section aria-label="Promemoria" className="flex flex-col gap-2">
      {visibili.map((p) => (
        <div
          key={p.id}
          className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-rule bg-surface p-4 text-[15px]"
        >
          <p>{p.testo}</p>
          <div className="flex gap-4">
            {p.azione?.href ? (
              <Link href={p.azione.href} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-brand-dark">
                {p.azione.etichetta}
              </Link>
            ) : p.azione ? (
              <button
                type="button"
                onClick={() => onAzione?.(p.azione as AzionePromemoria)}
                className="inline-flex min-h-11 items-center text-[15px] font-semibold text-brand-dark"
              >
                {p.azione.etichetta}
              </button>
            ) : null}
            <button type="button" onClick={() => rimanda(p.id)} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-ink-2">
              Più tardi
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
