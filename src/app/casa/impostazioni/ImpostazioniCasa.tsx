'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  CasaBloccataError,
  closeHousehold,
  createInvite,
  leaveHousehold,
  revokeInvite,
  type CasaCorrente,
  type MotivoBlocco,
} from '@/lib/data/households';
import { CodiceInvito } from '../CodiceInvito';

const ERRORE_GENERICO = 'Salvataggio fallito, controlla la connessione e riprova.';

const TESTI_BLOCCO: Record<MotivoBlocco, string> = {
  credito:
    'Prima di uscire serve chiudere i soldi che hai anticipato: fatti rimborsare dal conto comune o scegli di rinunciarvi.',
  debito:
    'Prima di uscire serve chiudere la quota versata per te o da te: restituitela, anche a rate, oppure rinunciate.',
  arretrati: 'Prima di uscire serve versare le quote del piano di questo mese e dei mesi passati.',
  ultimo_membro: 'Sei l’ultima persona rimasta: puoi chiudere la casa.',
  non_ultimo_membro: 'In casa ci sono ancora altre persone: ricarica la pagina.',
};

const CONFERMA_CHIUSURA =
  "Non vedrai più i dati della casa. I soldi sul conto comune non si muovono da soli: mettetevi d'accordo prima su come dividerli.";

const bottoneSecondario = 'rounded-[var(--radius-md)] border border-black/10 px-4 py-2.5 text-sm font-semibold';

export function ImpostazioniCasa({ casa }: { casa: CasaCorrente }) {
  const router = useRouter();
  const [codice, setCodice] = useState<string | null>(casa.invite?.codice ?? null);
  const [errore, setErrore] = useState<string | null>(null);
  const [erroreInvito, setErroreInvito] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [confermaChiusura, setConfermaChiusura] = useState(false);
  const ultimo = casa.members.length <= 1;

  async function genera() {
    setInCorso(true);
    setErroreInvito(null);
    try {
      const nuovo = await createInvite(createClient(), casa.household.id);
      setCodice(nuovo);
      router.refresh();
    } catch {
      setErroreInvito(ERRORE_GENERICO);
    } finally {
      setInCorso(false);
    }
  }

  async function revoca() {
    setInCorso(true);
    setErroreInvito(null);
    try {
      await revokeInvite(createClient(), casa.household.id);
      setCodice(null);
      router.refresh();
    } catch {
      setErroreInvito(ERRORE_GENERICO);
    } finally {
      setInCorso(false);
    }
  }

  async function esci(azione: typeof leaveHousehold) {
    setInCorso(true);
    setErrore(null);
    try {
      await azione(createClient());
      router.push('/casa');
      router.refresh();
    } catch (e) {
      setErrore(e instanceof CasaBloccataError ? TESTI_BLOCCO[e.reason] : ERRORE_GENERICO);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">Impostazioni della casa</h1>

      <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-bold">Chi c&apos;è in casa</h2>
        <ul className="flex flex-col gap-1.5">
          {casa.members.map((m) => (
            <li key={m.userId} className="text-sm">
              {m.displayName}
              {m.userId === casa.me.userId ? <span className="text-muted"> (tu)</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-bold">Invito</h2>
        {codice ? (
          <CodiceInvito codice={codice}>
            <button type="button" onClick={genera} disabled={inCorso} className={bottoneSecondario}>
              Rigenera
            </button>
            <button type="button" onClick={revoca} disabled={inCorso} className={bottoneSecondario}>
              Revoca
            </button>
          </CodiceInvito>
        ) : (
          <>
            <p className="text-sm text-muted">Non c&apos;è un codice di invito attivo.</p>
            <button
              type="button"
              onClick={genera}
              disabled={inCorso}
              className="rounded-[var(--radius-md)] bg-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-40"
            >
              Genera un codice di invito
            </button>
          </>
        )}
        {erroreInvito && (
          <p role="alert" className="text-sm text-danger">
            {erroreInvito}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 pt-4">
        {ultimo ? (
          confermaChiusura ? (
            <>
              <p className="text-sm text-muted">{CONFERMA_CHIUSURA}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => esci(closeHousehold)}
                  disabled={inCorso}
                  className={`${bottoneSecondario} text-danger`}
                >
                  Sì, chiudi la casa
                </button>
                <button type="button" onClick={() => setConfermaChiusura(false)} className={bottoneSecondario}>
                  Annulla
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfermaChiusura(true)}
              className={`${bottoneSecondario} self-start text-muted`}
            >
              Chiudi la casa
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => esci(leaveHousehold)}
            disabled={inCorso}
            className={`${bottoneSecondario} self-start text-muted`}
          >
            Esci dalla casa
          </button>
        )}
        {errore && (
          <p role="alert" className="text-sm text-danger">
            {errore}
          </p>
        )}
      </section>
    </main>
  );
}
