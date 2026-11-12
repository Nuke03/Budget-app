'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { revokeCalendarFeed, rotateCalendarFeed } from '@/lib/data/calendarFeeds';
import type { CalendarFeed } from '@/lib/types';
import { CLASSE_NEUTRO, CLASSE_PRIMARIO, CLASSE_SCHEDA, CLASSE_SECONDARIO } from '../CampiMovimento';

const ERRORE_GENERICO = 'Salvataggio fallito, controlla la connessione e riprova.';

type Conferma = 'rigenera' | 'revoca' | null;

export function CalendarioCasa({ feedIniziale, origin }: { feedIniziale: CalendarFeed | null; origin?: string }) {
  const [feed, setFeed] = useState<CalendarFeed | null>(feedIniziale);
  const [conferma, setConferma] = useState<Conferma>(null);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [daCopiareAMano, setDaCopiareAMano] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const link = feed ? `${base}/api/calendario/${feed.token}` : '';

  function nuovoFeed(token: string): CalendarFeed {
    return {
      id: '',
      householdId: feed?.householdId ?? '',
      userId: feed?.userId ?? '',
      token,
      createdAt: new Date().toISOString(),
      revocatoIl: null,
    };
  }

  async function crea() {
    setInCorso(true);
    setErrore(null);
    setConferma(null);
    setCopiato(false);
    setDaCopiareAMano(false);
    try {
      const token = await rotateCalendarFeed(createClient());
      setFeed(nuovoFeed(token));
    } catch {
      setErrore(ERRORE_GENERICO);
    } finally {
      setInCorso(false);
    }
  }

  async function revoca() {
    setInCorso(true);
    setErrore(null);
    setConferma(null);
    try {
      await revokeCalendarFeed(createClient());
      setFeed(null);
      setCopiato(false);
      setDaCopiareAMano(false);
    } catch {
      setErrore(ERRORE_GENERICO);
    } finally {
      setInCorso(false);
    }
  }

  async function copia() {
    setErrore(null);
    try {
      await navigator.clipboard.writeText(link);
      setCopiato(true);
      setDaCopiareAMano(false);
    } catch {
      setCopiato(false);
      setDaCopiareAMano(true);
      campo.current?.focus();
      campo.current?.select();
    }
  }

  async function scarica() {
    setErrore(null);
    try {
      const risposta = await fetch(link);
      if (!risposta.ok) throw new Error('scarico non riuscito');
      const blob = new Blob([await risposta.text()], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'casa.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErrore(ERRORE_GENERICO);
    }
  }

  return (
    <section className={CLASSE_SCHEDA}>
      <h2 className="font-serif text-lg font-semibold">Calendario</h2>
      <p className="text-[15px] text-ink-2">
        Un link privato per vedere nel tuo calendario il versamento, i controlli e le scadenze della casa.
      </p>

      {feed ? (
        <>
          <input
            ref={campo}
            readOnly
            aria-label="Link del calendario"
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 w-full rounded-[var(--radius-md)] border border-rule bg-surface px-3 py-2 text-[13px]"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copia} className={CLASSE_PRIMARIO}>
              Copia
            </button>
            <button type="button" onClick={() => setConferma('rigenera')} disabled={inCorso} className={CLASSE_SECONDARIO}>
              Rigenera
            </button>
            <button type="button" onClick={() => setConferma('revoca')} disabled={inCorso} className={CLASSE_SECONDARIO}>
              Revoca
            </button>
            <button type="button" onClick={scarica} className={CLASSE_SECONDARIO}>
              Scarica una volta
            </button>
          </div>
          {copiato && <p className="text-[13px] text-brand-dark">Link copiato.</p>}
          {daCopiareAMano && (
            <p className="text-[13px] text-ink-2">Non sono riuscito a copiare: il link è selezionato, copialo a mano.</p>
          )}
          {conferma && (
            <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-rule bg-brand-tint p-3">
              <p className="text-[15px]">
                {conferma === 'rigenera'
                  ? 'Il link attuale smette di funzionare e ne viene creato uno nuovo. Vuoi procedere?'
                  : 'Il link attuale smette di funzionare. Vuoi procedere?'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={conferma === 'rigenera' ? crea : revoca}
                  disabled={inCorso}
                  className={CLASSE_NEUTRO}
                >
                  {conferma === 'rigenera' ? 'Sì, rigenera' : 'Sì, revoca'}
                </button>
                <button type="button" onClick={() => setConferma(null)} className={CLASSE_NEUTRO}>
                  Annulla
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <button type="button" onClick={crea} disabled={inCorso} className={CLASSE_PRIMARIO}>
          Crea il link
        </button>
      )}

      <p className="text-[15px] font-semibold">Chiunque abbia questo link vede le scadenze della casa: non condividerlo.</p>
      <p className="text-[13px] text-ink-2">Può volerci qualche ora perché il calendario si aggiorni.</p>

      <div className="flex flex-col gap-1.5 text-[15px] text-ink-2">
        <p>
          <span className="font-semibold">Google Calendar.</span> Dal computer apri Altri calendari, poi Da URL, e
          incolla il link.
        </p>
        <p>
          <span className="font-semibold">iPhone.</span> Impostazioni, Calendario, Account, Aggiungi account, Altro,
          Aggiungi calendario con abbonamento, e incolla il link.
        </p>
      </div>

      {errore && (
        <p role="alert" className="text-[15px] text-danger">
          {errore}
        </p>
      )}
    </section>
  );
}
