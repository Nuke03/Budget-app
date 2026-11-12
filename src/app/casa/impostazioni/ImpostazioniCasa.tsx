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
import { CoverHeader } from '../../CoverHeader';
import { CLASSE_NEUTRO, CLASSE_PRIMARIO, CLASSE_SCHEDA, CLASSE_SECONDARIO } from '../CampiMovimento';
import { CodiceInvito } from '../CodiceInvito';
import { CalendarioCasa } from './CalendarioCasa';
import { SaldoTricount, type SaldoEsistente } from './SaldoTricount';
import type { CalendarFeed } from '@/lib/types';

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


export function ImpostazioniCasa({
  casa,
  feedCalendario = null,
  origin,
  saldoIniziale = null,
}: {
  casa: CasaCorrente;
  feedCalendario?: CalendarFeed | null;
  origin?: string;
  saldoIniziale?: SaldoEsistente | null;
}) {
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
    <>
    <CoverHeader titolo="Impostazioni della casa" />
    <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6 pt-3.5">

      <section className={CLASSE_SCHEDA}>
        <h2 className="font-serif text-lg font-semibold">Chi c&apos;è in casa</h2>
        <ul className="flex flex-col gap-1.5">
          {casa.members.map((m) => (
            <li key={m.userId} className="text-[15px]">
              {m.displayName}
              {m.userId === casa.me.userId ? <span className="text-ink-2"> (tu)</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className={CLASSE_SCHEDA}>
        <h2 className="font-serif text-lg font-semibold">Invito</h2>
        {codice ? (
          <CodiceInvito codice={codice} origin={origin}>
            <button type="button" onClick={genera} disabled={inCorso} className={CLASSE_SECONDARIO}>
              Rigenera
            </button>
            <button type="button" onClick={revoca} disabled={inCorso} className={CLASSE_SECONDARIO}>
              Revoca
            </button>
          </CodiceInvito>
        ) : (
          <>
            <p className="text-[15px] text-ink-2">Non c&apos;è un codice di invito attivo.</p>
            <button
              type="button"
              onClick={genera}
              disabled={inCorso}
              className={CLASSE_PRIMARIO}
            >
              Genera un codice di invito
            </button>
          </>
        )}
        {erroreInvito && (
          <p role="alert" className="text-[15px] text-danger">
            {erroreInvito}
          </p>
        )}
      </section>

      <CalendarioCasa feedIniziale={feedCalendario} origin={origin} />

      <SaldoTricount householdId={casa.household.id} members={casa.members} saldoEsistente={saldoIniziale} />

      <section className="flex flex-col gap-3 pt-2">
        {ultimo ? (
          confermaChiusura ? (
            <>
              <p className="text-[15px] text-ink-2">{CONFERMA_CHIUSURA}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => esci(closeHousehold)}
                  disabled={inCorso}
                  className={`${CLASSE_NEUTRO} text-danger`}
                >
                  Sì, chiudi la casa
                </button>
                <button type="button" onClick={() => setConfermaChiusura(false)} className={CLASSE_NEUTRO}>
                  Annulla
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfermaChiusura(true)}
              className={`${CLASSE_NEUTRO} self-start text-ink-2`}
            >
              Chiudi la casa
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => esci(leaveHousehold)}
            disabled={inCorso}
            className={`${CLASSE_NEUTRO} self-start text-ink-2`}
          >
            Esci dalla casa
          </button>
        )}
        {errore && (
          <p role="alert" className="text-[15px] text-danger">
            {errore}
          </p>
        )}
      </section>
    </main>
    </>
  );
}
