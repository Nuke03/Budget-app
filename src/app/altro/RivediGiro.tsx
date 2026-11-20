'use client';

import { useRouter } from 'next/navigation';
import { azzeraFumetti } from '@/lib/fumetti/visti';
import { useUtenteId } from '@/lib/fumetti/ambiente';

export function RivediGiro() {
  const router = useRouter();
  const utente = useUtenteId();
  return (
    <section aria-labelledby="giro" className="mt-6 flex flex-col gap-2 border-t border-rule pt-4">
      <h2 id="giro" className="font-serif text-lg font-semibold">
        Il giro dell&apos;app
      </h2>
      <p className="text-[15px] text-ink-2">Rivedi i fumetti che spiegano dove sono le cose.</p>
      <button
        type="button"
        onClick={() => {
          if (!utente) return;
          azzeraFumetti(utente);
          router.push('/');
        }}
        className="inline-flex min-h-11 items-center self-start text-[15px] font-semibold text-brand-dark"
      >
        Rivedi il giro
      </button>
    </section>
  );
}
