'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { revokeCalendarFeed, rotateCalendarFeed } from '@/lib/data/calendarFeeds';
import type { CalendarFeed } from '@/lib/types';

const ERRORE_GENERICO = 'Salvataggio fallito, controlla la connessione e riprova.';

const bottoneSecondario = 'rounded-[var(--radius-md)] border border-black/10 px-4 py-2.5 text-sm font-semibold';
const bottonePrimario =
  'rounded-[var(--radius-md)] bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-40';

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
    <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-bold">Calendario</h2>
      <p className="text-sm text-muted">
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
            className="w-full rounded-[var(--radius-md)] border border-black/10 bg-transparent px-3 py-2 text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copia} className={bottonePrimario}>
              Copia
            </button>
            <button type="button" onClick={() => setConferma('rigenera')} disabled={inCorso} className={bottoneSecondario}>
              Rigenera
            </button>
            <button type="button" onClick={() => setConferma('revoca')} disabled={inCorso} className={bottoneSecondario}>
              Revoca
            </button>
            <button type="button" onClick={scarica} className={bottoneSecondario}>
              Scarica una volta
            </button>
          </div>
          {copiato && <p className="text-xs text-brand-dark">Link copiato.</p>}
          {daCopiareAMano && (
            <p className="text-xs text-muted">Non sono riuscito a copiare: il link è selezionato, copialo a mano.</p>
          )}
          {conferma && (
            <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-black/10 p-3">
              <p className="text-sm">
                {conferma === 'rigenera'
                  ? 'Il link attuale smette di funzionare e ne viene creato uno nuovo. Vuoi procedere?'
                  : 'Il link attuale smette di funzionare. Vuoi procedere?'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={conferma === 'rigenera' ? crea : revoca}
                  disabled={inCorso}
                  className={bottoneSecondario}
                >
                  {conferma === 'rigenera' ? 'Sì, rigenera' : 'Sì, revoca'}
                </button>
                <button type="button" onClick={() => setConferma(null)} className={bottoneSecondario}>
                  Annulla
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <button type="button" onClick={crea} disabled={inCorso} className={bottonePrimario}>
          Crea il link
        </button>
      )}

      <p className="text-sm font-medium">Chiunque abbia questo link vede le scadenze della casa: non condividerlo.</p>
      <p className="text-xs text-muted">Può volerci qualche ora perché il calendario si aggiorni.</p>

      <div className="flex flex-col gap-1.5 text-sm text-muted">
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
        <p role="alert" className="text-sm text-danger">
          {errore}
        </p>
      )}
    </section>
  );
}
