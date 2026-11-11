'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { rispondiNotifiche } from '@/lib/data/notifiche';
import { ambienteNotifiche, iscriviNotifiche, type AmbienteNotifiche } from '@/lib/iscriviNotifiche';

type Stato = 'pronta' | 'in_corso' | 'attive' | 'negate' | 'errore';

export const PULSANTE_PRIMARIO =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-brand px-4 text-[15px] font-semibold text-brand-foreground disabled:opacity-60';
export const PULSANTE_SECONDARIO =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] px-4 text-[15px] font-semibold text-brand-dark disabled:opacity-60';

export function IstruzioniInstallazione() {
  return (
    <p className="text-[15px]">
      Per ricevere i promemoria aggiungi l&apos;app alla schermata Home: tocca Condividi, poi &quot;Aggiungi alla schermata
      Home&quot;.
    </p>
  );
}

// Il permesso si chiede solo qui, al tocco su "Sì, avvisami". L'ambiente si legge dopo il montaggio:
// sul server non c'è il browser, e la prima resa deve coincidere.
export function useIscrizione(chiavePubblica: string | null) {
  const [ambiente, setAmbiente] = useState<AmbienteNotifiche | null>(null);
  const [stato, setStato] = useState<Stato>('pronta');
  useEffect(() => setAmbiente(ambienteNotifiche()), []);

  async function attiva() {
    if (!chiavePubblica) return;
    setStato('in_corso');
    try {
      const esito = await iscriviNotifiche(chiavePubblica);
      setStato(esito === 'attive' ? 'attive' : 'negate');
    } catch {
      setStato('errore');
    }
  }

  async function rifiuta() {
    setStato('in_corso');
    try {
      await rispondiNotifiche(createClient(), false);
      setStato('negate');
    } catch {
      setStato('errore');
    }
  }

  return { ambiente, stato, attiva, rifiuta };
}

export function SchedaNotifiche({
  chiavePubblica,
  notificheAttive,
}: {
  chiavePubblica: string | null;
  notificheAttive: boolean | null;
}) {
  const { ambiente, stato, attiva, rifiuta } = useIscrizione(chiavePubblica);

  if (notificheAttive !== null || stato === 'negate') return null;
  if (ambiente === null || ambiente === 'non_supportate' || !chiavePubblica) return null;

  const occupata = stato === 'in_corso';
  return (
    <section className="rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-card)]">
      {ambiente === 'ios_da_installare' ? (
        <IstruzioniInstallazione />
      ) : stato === 'attive' ? (
        <p role="status" className="text-[15px]">
          Fatto. Ti avviso se resti indietro con le spese.
        </p>
      ) : (
        <>
          <p className="text-[15px]">
            Vuoi che ti avvisi se resti indietro con le spese? Al massimo una volta ogni tre giorni, mai di notte.
          </p>
          {stato === 'errore' ? (
            <p role="alert" className="mt-2 text-sm text-foreground">
              Non sono riuscito ad attivare i promemoria. Riprova tra un attimo.
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={occupata} onClick={attiva} className={PULSANTE_PRIMARIO}>
              Sì, avvisami
            </button>
            <button type="button" disabled={occupata} onClick={rifiuta} className={PULSANTE_SECONDARIO}>
              No, grazie
            </button>
          </div>
        </>
      )}
    </section>
  );
}
