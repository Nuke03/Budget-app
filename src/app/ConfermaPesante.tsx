'use client';

import { useState } from 'react';
import { nonAvvisarePiu, type TipoConferma } from '@/lib/conferme';
import { FoglioInferiore } from './FoglioInferiore';

// Il foglio che chiede conferma prima di un'azione pesante, con una frase su cosa succede.
// Senza `salta` non c'è "Non avvisarmi più": serve per le azioni che non si annullano.
export function ConfermaPesante({
  titolo,
  frase,
  tipo,
  salta = true,
  etichettaConferma = 'Elimina',
  onConferma,
  onChiudi,
}: {
  titolo: string;
  frase: string;
  tipo: TipoConferma;
  salta?: boolean;
  etichettaConferma?: string;
  onConferma: () => void;
  onChiudi: () => void;
}) {
  const [nonAvvisare, setNonAvvisare] = useState(false);

  function conferma() {
    if (salta && nonAvvisare) nonAvvisarePiu(tipo);
    onConferma();
  }

  return (
    <FoglioInferiore titolo={titolo} onClose={onChiudi}>
      <div className="flex flex-col gap-3 px-5 pb-6">
        <p className="text-[15px]">{frase}</p>
        {salta ? (
          <label className="flex min-h-11 items-center gap-3 border-t border-rule text-[15px] text-ink-2">
            <input
              type="checkbox"
              checked={nonAvvisare}
              onChange={(e) => setNonAvvisare(e.target.checked)}
              className="size-5 shrink-0 accent-[var(--color-brand)]"
            />
            Non avvisarmi più
          </label>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onChiudi}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-md)] bg-brand px-4 text-[15px] font-semibold text-brand-foreground"
          >
            Lascia stare
          </button>
          <button
            type="button"
            onClick={conferma}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-danger bg-surface px-4 text-[15px] font-semibold text-danger"
          >
            {etichettaConferma}
          </button>
        </div>
      </div>
    </FoglioInferiore>
  );
}
