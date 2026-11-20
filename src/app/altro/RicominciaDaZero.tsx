'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ricominciaDaZero } from '@/lib/data/percorso';
import { azzeraFumetti } from '@/lib/fumetti/visti';
import { useUtenteId } from '@/lib/fumetti/ambiente';
import { euroInFrase } from '../piva/PromptQuota';
import { FoglioInferiore } from '../FoglioInferiore';
import { CLASSE_CAMPO, CLASSE_NEUTRO, CLASSE_PRIMARIO } from '../casa/CampiMovimento';

const PAROLA = 'RICOMINCIA';

// Cosa c'è di aperto nella casa per chi guarda: dirlo prima, senza bloccare. Il reset non tocca la casa.
export function RicominciaDaZero({ casa }: { casa: { credito: number; debito: number } | null }) {
  const router = useRouter();
  const utente = useUtenteId();
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(false);

  const pronto = testo.trim().toUpperCase() === PAROLA;

  function chiudi() {
    if (inCorso) return;
    setAperto(false);
    setTesto('');
    setErrore(false);
  }

  async function conferma() {
    if (!pronto || inCorso) return;
    setInCorso(true);
    setErrore(false);
    try {
      await ricominciaDaZero(createClient());
    } catch {
      setErrore(true);
      setInCorso(false);
      return;
    }
    if (utente) azzeraFumetti(utente);
    router.replace('/impara/primi-passi');
  }

  return (
    <section className="mt-8">
      <button type="button" onClick={() => setAperto(true)} className={`${CLASSE_NEUTRO} w-full`}>
        Ricomincia da zero
      </button>
      {aperto ? (
        <FoglioInferiore titolo="Ricomincia da zero" onClose={chiudi}>
          <div className="flex flex-col gap-4 px-5 pb-5">
            {casa && casa.debito > 0 ? (
              <p className="text-[15px]">
                {`Nella casa hai ancora ${euroInFrase(casa.debito)} da restituire. Il reset non lo tocca: resta com'è.`}
              </p>
            ) : null}
            {casa && casa.credito > 0 ? (
              <p className="text-[15px]">
                {`Nella casa hai un credito di ${euroInFrase(casa.credito)}. Il reset non lo tocca: resta com'è.`}
              </p>
            ) : null}
            <p className="text-[15px]">
              Cancella: movimenti, conti, obiettivi, categorie personali, dati P.IVA, progressi del percorso e lista
              d&apos;attesa. Gli obiettivi e le categorie che la casa usa restano, chiusi o archiviati.
            </p>
            <p className="text-[15px]">
              Resta: il login, le notifiche e i promemoria, l&apos;iscrizione alla casa e tutti i dati della casa. I conti
              che la casa usa restano, archiviati e a zero, così i numeri della casa non cambiano.
            </p>
            <p className="text-[15px] font-semibold">
              Il piano gratuito non ha copie di sicurezza: dopo la conferma questi dati non si recuperano.
            </p>
            <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
              Per confermare scrivi {PAROLA}
              <input
                type="text"
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className={CLASSE_CAMPO}
              />
            </label>
            {errore ? (
              <p role="alert" className="text-[15px] text-danger">
                Non sono riuscito a ricominciare. Non è stato cancellato niente. Riprova.
              </p>
            ) : null}
            <button type="button" onClick={conferma} disabled={!pronto || inCorso} className={CLASSE_PRIMARIO}>
              Cancella tutto e ricomincia
            </button>
            <button type="button" onClick={chiudi} disabled={inCorso} className={CLASSE_NEUTRO}>
              Annulla
            </button>
          </div>
        </FoglioInferiore>
      ) : null}
    </section>
  );
}
