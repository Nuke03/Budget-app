'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CheckinGiaFattoError, getCheckin, messaggioErroreCheckin, saveCheckin } from '@/lib/data/checkins';
import type { SaveCheckinInput } from '@/lib/data/checkins';
import { formatNumero, nomeMese } from '@/lib/format';
import type { CheckinCaricato } from '@/lib/loadCheckin';
import { CLASSE_CAMPO, ErroreMovimento } from '../CampiMovimento';
import { ComeSiCalcola } from '../ComeSiCalcola';
import { ControlloSaldo } from '../ControlloSaldo';

const CLASSE_PRIMARIO =
  'rounded-[var(--radius-md)] bg-brand py-3 text-center text-base font-semibold text-brand-foreground disabled:opacity-40';
const CLASSE_LINK = 'text-sm font-semibold text-brand-dark';
const CLASSE_SCHEDA = 'flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]';

const euro = (n: number): string => `${formatNumero(n)} €`;
const maiuscola = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// Il mese dopo, come YYYY-MM-01.
function meseSuccessivo(mese: string): string {
  const anno = Number(mese.slice(0, 4));
  const m = Number(mese.slice(5, 7));
  return m === 12 ? `${anno + 1}-01-01` : `${anno}-${String(m + 1).padStart(2, '0')}-01`;
}

// "2 novembre", nel giorno di Roma.
function giornoEMese(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', timeZone: 'Europe/Rome' }).format(new Date(iso));
}

function fraseEsito(avanzo: number, esito: 'in_pari' | 'avanzo' | 'ammanco'): string {
  if (esito === 'avanzo') return `In avanzo di ${euro(avanzo)}.`;
  if (esito === 'ammanco') return `Sono usciti ${euro(Math.abs(avanzo))} più del previsto. Li prendiamo dal cuscinetto.`;
  return 'Tutto è andato come previsto.';
}

type Scelta = 'cuscinetto' | 'fondo' | 'nuova';

export function CheckinMensile({ dati }: { dati: CheckinCaricato }) {
  // Il passo del controllo del saldo viene prima, ma si può saltare.
  const [passo0, setPasso0] = useState(dati.serveControllo);

  if (dati.stato === 'nessun_mese' || !dati.mese) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base">Il check-in parte dal primo mese intero con la quota attiva.</p>
        <Link href="/casa" className={CLASSE_LINK}>
          Torna alla casa
        </Link>
      </div>
    );
  }

  const nomeDelMese = maiuscola(nomeMese(dati.mese));

  if (dati.stato === 'fatto' && dati.fatto) {
    const f = dati.fatto;
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{`${nomeDelMese} in casa`}</h1>
        <p role="status" className="text-base font-semibold">
          {`Fatto da ${dati.chi ?? 'un altro membro'} il ${giornoEMese(f.createdAt)}.`}
        </p>
        <section className={CLASSE_SCHEDA}>
          <p className="text-sm">{`Versamenti: ${formatNumero(f.versatoTotale)} di ${euro(f.attesoTotale)}`}</p>
          <p className="text-sm">
            {`Spese del mese: previste ${euro(f.previstoMensili)}, registrate ${euro(f.spesoMensili)}, non registrate ${euro(f.nonRegistrate)}`}
          </p>
          <p className="text-sm font-semibold">{fraseEsito(f.avanzo, f.esito)}</p>
        </section>
        <Link href="/casa" className={CLASSE_LINK}>
          Torna alla casa
        </Link>
      </div>
    );
  }

  if (passo0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{`${nomeDelMese} in casa`}</h1>
        <p className="text-sm text-muted">Prima un controllo veloce del conto comune.</p>
        <ControlloSaldo conti={dati.conti} onFatto={() => setPasso0(false)} />
        <button type="button" onClick={() => setPasso0(false)} className={`${CLASSE_LINK} self-start`}>
          Salta
        </button>
      </div>
    );
  }

  return <Passo dati={dati} mese={dati.mese} nomeDelMese={nomeDelMese} />;
}

function Passo({ dati, mese, nomeDelMese }: { dati: CheckinCaricato; mese: string; nomeDelMese: string }) {
  const router = useRouter();
  const calcolo = dati.calcolo!;
  const [scelta, setScelta] = useState<Scelta>('cuscinetto');
  const [altro, setAltro] = useState(false);
  const [goalId, setGoalId] = useState(dati.fondiPerAvanzo[0]?.id ?? '');
  const [nuovaCosa, setNuovaCosa] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // Il doppio tocco arriva prima che React ridisegni: lo blocca un ref, non lo stato.
  const occupato = useRef(false);

  const conAvanzo = calcolo.esito === 'avanzo';
  const valido = !conAvanzo || scelta !== 'nuova' || nuovaCosa.trim() !== '';
  const fondoValido = scelta !== 'fondo' || goalId !== '';

  async function conferma() {
    if (!valido || !fondoValido || occupato.current) return;
    occupato.current = true;
    setInCorso(true);
    setErrore(null);
    const input: SaveCheckinInput = {
      householdId: dati.householdId,
      mese,
      attesoTotale: calcolo.attesoTotale,
      versatoTotale: calcolo.versatoTotale,
      previstoMensili: calcolo.previstoMensili,
      spesoMensili: calcolo.spesoMensili,
      nonRegistrate: calcolo.nonRegistrate,
      avanzo: calcolo.avanzo,
      ...(conAvanzo && scelta === 'cuscinetto' ? { destinazione: 'cuscinetto' as const } : {}),
      ...(conAvanzo && scelta === 'fondo' ? { destinazione: 'da_parte' as const, goalId } : {}),
      ...(conAvanzo && scelta === 'nuova' ? { destinazione: 'da_parte' as const, nuovaCosa: nuovaCosa.trim() } : {}),
    };
    try {
      await saveCheckin(createClient(), input);
      router.push('/casa');
      router.refresh();
    } catch (e) {
      if (e instanceof CheckinGiaFattoError) {
        const chi = await getCheckin(createClient(), dati.householdId, mese)
          .then((c) => (c ? dati.nomi[c.userId] : undefined))
          .catch(() => undefined);
        setErrore(`Il check-in di ${nomeMese(mese)} è già stato fatto${chi ? ` da ${chi}` : ''}.`);
      } else {
        setErrore(messaggioErroreCheckin(e));
      }
      occupato.current = false;
      setInCorso(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void conferma();
      }}
      className="flex flex-col gap-5"
    >
      <h1 className="text-2xl font-bold">{`${nomeDelMese} in casa`}</h1>

      <section className={CLASSE_SCHEDA}>
        <ul className="flex flex-col gap-1">
          {dati.versamenti.map((v) => (
            <li key={v.userId} className="text-sm">
              {`${v.nome} ${formatNumero(v.versato)} di ${formatNumero(v.atteso)}`}
            </li>
          ))}
        </ul>
        <p className="text-sm">
          {`Spese del mese: previste ${euro(calcolo.previstoMensili)}, registrate ${euro(calcolo.spesoMensili)}, non registrate ${euro(calcolo.nonRegistrate)}`}
        </p>
        {dati.cuscinetto ? (
          <p className="text-sm">{`Cuscinetto ${formatNumero(dati.cuscinetto.attuale)} di ${euro(dati.cuscinetto.obiettivo)}`}</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-base font-semibold">
          {conAvanzo ? `${fraseEsito(calcolo.avanzo, calcolo.esito)} Cosa ne facciamo?` : fraseEsito(calcolo.avanzo, calcolo.esito)}
        </p>
        <ComeSiCalcola spiegazione={calcolo.spiegazioneAvanzo} />
      </section>

      {conAvanzo ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Cosa ne facciamo?</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="destinazione" checked={scelta === 'cuscinetto'} onChange={() => setScelta('cuscinetto')} />
            Lasciamoli al cuscinetto
          </label>
          {altro ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Mettiamoli da parte per…</p>
              {dati.fondiPerAvanzo.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="destinazione"
                    checked={scelta === 'fondo' && goalId === g.id}
                    onChange={() => {
                      setScelta('fondo');
                      setGoalId(g.id);
                    }}
                  />
                  {g.nome}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="destinazione" checked={scelta === 'nuova'} onChange={() => setScelta('nuova')} />
                Una cosa nuova
              </label>
              {scelta === 'nuova' ? (
                <input
                  aria-label="Nome della cosa nuova"
                  placeholder="Come la chiamiamo?"
                  value={nuovaCosa}
                  onChange={(e) => setNuovaCosa(e.target.value)}
                  className={CLASSE_CAMPO}
                />
              ) : null}
            </div>
          ) : (
            <button type="button" onClick={() => setAltro(true)} className={`${CLASSE_LINK} self-start`}>
              Altro
            </button>
          )}
        </fieldset>
      ) : null}

      <ErroreMovimento testo={errore} />
      <button type="submit" disabled={!valido || !fondoValido || inCorso} className={CLASSE_PRIMARIO}>
        {`Fatto, a ${nomeMese(meseSuccessivo(mese))}`}
      </button>

      {calcolo.secondoAmmanco ? (
        <section className={CLASSE_SCHEDA}>
          <p className="text-sm">{"È il secondo mese: forse la quota è un po' bassa. Non è colpa di nessuno."}</p>
          <Link href="/casa/quota" className={CLASSE_LINK}>
            Guarda le stime reali
          </Link>
        </section>
      ) : null}
    </form>
  );
}
