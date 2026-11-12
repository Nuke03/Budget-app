'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CheckinGiaFattoError, messaggioErroreCheckin, saveCheckin } from '@/lib/data/checkins';
import type { SaveCheckinInput } from '@/lib/data/checkins';
import { formatNumero, nomeMese } from '@/lib/format';
import type { CheckinCalcolato } from '@/lib/calculations/casa/checkin';
import type { CheckinCaricato } from '@/lib/loadCheckin';
import type { ReactNode } from 'react';
import { CoverHeader } from '../../CoverHeader';
import { CLASSE_CAMPO, CLASSE_LINK, CLASSE_PRIMARIO, CLASSE_SCHEDA, ErroreMovimento } from '../CampiMovimento';
import { SceltePill } from '../SceltePill';
import { CardStima } from '../CardStima';
import { ComeSiCalcola } from '../ComeSiCalcola';
import { ControlloSaldo } from '../ControlloSaldo';

// Cornice di ogni stato del check-in: copertina con il titolo e la colonna del libretto.
function Pagina({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <>
      <CoverHeader titolo={titolo} />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6 pt-3.5">{children}</main>
    </>
  );
}

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

// Nell'ammanco la frase dice la causa, senza colpe: versamenti mancanti, spese sopra il previsto, o tutte e due.
function fraseEsito(
  c: Pick<CheckinCalcolato, 'avanzo' | 'esito' | 'attesoTotale' | 'versatoTotale' | 'previstoMensili' | 'spesoMensili' | 'nonRegistrate'>
): string {
  if (c.esito === 'avanzo') return `In avanzo di ${euro(c.avanzo)}.`;
  if (c.esito === 'in_pari') return 'Tutto è andato come previsto.';
  const dalCuscinetto = Math.abs(c.avanzo);
  const mancanti = Math.round((c.attesoTotale - c.versatoTotale) * 100) / 100;
  const sopra = Math.round((c.spesoMensili + c.nonRegistrate - c.previstoMensili) * 100) / 100;
  const uguale = (n: number): boolean => Math.abs(n - dalCuscinetto) < 0.005;
  if (mancanti > 0 && sopra <= 0) {
    const causa = `Mancano ${euro(mancanti)} di versamenti.`;
    return uguale(mancanti)
      ? `${causa} Li prendiamo dal cuscinetto.`
      : `${causa} Il mese chiude ${euro(dalCuscinetto)} sotto il previsto: li prendiamo dal cuscinetto.`;
  }
  if (sopra > 0 && mancanti <= 0) {
    const causa = `Sono usciti ${euro(sopra)} più del previsto.`;
    return uguale(sopra)
      ? `${causa} Li prendiamo dal cuscinetto.`
      : `${causa} Il mese chiude ${euro(dalCuscinetto)} sotto il previsto: li prendiamo dal cuscinetto.`;
  }
  return `Il mese chiude ${euro(dalCuscinetto)} sotto il previsto. Li prendiamo dal cuscinetto.`;
}

type Scelta = 'cuscinetto' | 'fondo' | 'nuova';

export function CheckinMensile({ dati }: { dati: CheckinCaricato }) {
  // Il passo del controllo del saldo viene prima, ma si può saltare.
  const [passo0, setPasso0] = useState(dati.serveControllo);

  if (dati.stato === 'nessun_mese' || !dati.mese) {
    return (
      <Pagina titolo="Il mese in casa">
        <section className={CLASSE_SCHEDA}>
          <p className="text-[15px]">Il check-in parte dal primo mese intero con la quota attiva.</p>
        </section>
        <Link href="/casa" className={CLASSE_LINK}>
          Torna alla casa
        </Link>
      </Pagina>
    );
  }

  const nomeDelMese = maiuscola(nomeMese(dati.mese));

  if (dati.stato === 'fatto' && dati.fatto) {
    const f = dati.fatto;
    return (
      <Pagina titolo={`${nomeDelMese} in casa`}>
        <p role="status" className="text-[15px] font-semibold">
          {`Fatto da ${dati.chi ?? 'un altro membro'} il ${giornoEMese(f.createdAt)}.`}
        </p>
        <section className={CLASSE_SCHEDA}>
          <p className="text-[15px]">{`Versamenti: ${formatNumero(f.versatoTotale)} di ${euro(f.attesoTotale)}`}</p>
          <p className="text-[15px]">
            {`Spese del mese: previste ${euro(f.previstoMensili)}, registrate ${euro(f.spesoMensili)}, non registrate ${euro(f.nonRegistrate)}`}
          </p>
          <p className="text-[15px] font-semibold">{fraseEsito(f)}</p>
        </section>
        <CardStimaCheckin dati={dati} />
        <Link href="/casa" className={CLASSE_LINK}>
          Torna alla casa
        </Link>
      </Pagina>
    );
  }

  if (passo0) {
    return (
      <Pagina titolo={`${nomeDelMese} in casa`}>
        <section className={CLASSE_SCHEDA}>
          <p className="text-[15px] text-ink-2">Prima un controllo veloce del conto comune.</p>
          <p className="text-[15px] text-ink-2">{"Se c'è una differenza, la registriamo nel mese in corso, non in quello che state chiudendo."}</p>
          <ControlloSaldo conti={dati.conti} onFatto={() => setPasso0(false)} />
        </section>
        <button type="button" onClick={() => setPasso0(false)} className={`${CLASSE_LINK} self-start`}>
          Salta
        </button>
      </Pagina>
    );
  }

  return <Passo dati={dati} mese={dati.mese} nomeDelMese={nomeDelMese} />;
}

// Una sola card per volta, a check-in fatto: le altre arrivano alla prossima.
function CardStimaCheckin({ dati }: { dati: CheckinCaricato }) {
  const router = useRouter();
  const proposta = dati.proposte[0] ?? null;
  if (!proposta || !dati.pianoAttuale) return null;
  return (
    <CardStima
      proposta={proposta}
      bundle={dati.pianoAttuale}
      goal={dati.fondiPerVoce[proposta.itemId] ?? null}
      householdId={dati.householdId}
      validoDal={dati.validoDalStima}
      programmata={dati.pianiFuturi.length > 0}
      onFatto={() => router.refresh()}
    />
  );
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
        // Lo ha già fatto un altro: la pagina ricarica e mostra "Fatto da ...", senza messaggio.
        // Il pulsante resta bloccato: la pagina nuova sostituisce questo passo.
        router.refresh();
        return;
      }
      setErrore(messaggioErroreCheckin(e));
      occupato.current = false;
      setInCorso(false);
    }
  }

  const opzioni = [
    { chiave: 'cuscinetto', etichetta: 'Lasciamoli al cuscinetto' },
    ...(altro
      ? [
          ...dati.fondiPerAvanzo.map((g) => ({ chiave: `fondo:${g.id}`, etichetta: g.nome })),
          { chiave: 'nuova', etichetta: 'Una cosa nuova' },
        ]
      : []),
  ];
  const chiaveScelta = scelta === 'fondo' ? `fondo:${goalId}` : scelta;
  function scegli(chiave: string) {
    if (chiave.startsWith('fondo:')) {
      setScelta('fondo');
      setGoalId(chiave.slice('fondo:'.length));
    } else {
      setScelta(chiave as Scelta);
    }
  }

  return (
    <Pagina titolo={`${nomeDelMese} in casa`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void conferma();
        }}
        className="flex flex-col gap-3.5"
      >
        <section className={CLASSE_SCHEDA}>
          <ul className="flex flex-col gap-1">
            {dati.versamenti.map((v) => (
              <li key={v.userId} className="text-[15px]">
                {`${v.nome} ${formatNumero(v.versato)} di ${formatNumero(v.atteso)}`}
              </li>
            ))}
          </ul>
          <p className="text-[15px]">
            {`Spese del mese: previste ${euro(calcolo.previstoMensili)}, registrate ${euro(calcolo.spesoMensili)}, non registrate ${euro(calcolo.nonRegistrate)}`}
          </p>
          {dati.cuscinetto ? (
            <p className="text-[15px]">{`Cuscinetto ${formatNumero(dati.cuscinetto.attuale)} di ${euro(dati.cuscinetto.obiettivo)}`}</p>
          ) : null}
        </section>

        <section className={CLASSE_SCHEDA}>
          {calcolo.esito === 'in_pari' ? null : (
            <p aria-hidden="true" className="num font-serif text-[40px] font-bold leading-none">
              {`${calcolo.avanzo > 0 ? '+' : '−'}${euro(Math.abs(calcolo.avanzo))}`}
            </p>
          )}
          <p className="text-[15px] font-semibold">
            {conAvanzo ? `${fraseEsito(calcolo)} Cosa ne facciamo?` : fraseEsito(calcolo)}
          </p>
          <ComeSiCalcola spiegazione={calcolo.spiegazioneAvanzo} />
          {conAvanzo ? (
            <div className="flex flex-col gap-2">
              <SceltePill legenda="Cosa ne facciamo?" opzioni={opzioni} valore={chiaveScelta} onChange={scegli} />
              {altro && scelta === 'nuova' ? (
                <input
                  aria-label="Nome della cosa nuova"
                  placeholder="Come la chiamiamo?"
                  value={nuovaCosa}
                  onChange={(e) => setNuovaCosa(e.target.value)}
                  className={CLASSE_CAMPO}
                />
              ) : null}
              {altro ? null : (
                <button type="button" onClick={() => setAltro(true)} className={`${CLASSE_LINK} self-start`}>
                  Altro
                </button>
              )}
            </div>
          ) : null}
        </section>

        <ErroreMovimento testo={errore} />
        <button type="submit" disabled={!valido || !fondoValido || inCorso} className={CLASSE_PRIMARIO}>
          {`Fatto, a ${nomeMese(meseSuccessivo(mese))}`}
        </button>

        {calcolo.secondoAmmanco ? (
          <section className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-rule bg-brand-tint p-4">
            <p className="text-[15px]">
              {'È il secondo mese sotto il previsto: può darsi che la quota vada ritoccata. Le stime reali aiutano a deciderlo.'}
            </p>
            <Link href="/casa/quota" className={CLASSE_LINK}>
              Guarda le stime reali
            </Link>
          </section>
        ) : null}
      </form>
    </Pagina>
  );
}
