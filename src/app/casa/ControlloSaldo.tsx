'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { messaggioErroreControllo, recordBalanceCheck } from '@/lib/data/balanceChecks';
import { valutaControllo } from '@/lib/calculations/casa/controlloSaldo';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';
import { formatDateIt, formatNumero } from '@/lib/format';
import type { Account } from '@/lib/types';
import { Campo, CLASSE_CAMPO, ErroreMovimento, SelezioneConto } from './CampiMovimento';
import { ComeSiCalcola } from './ComeSiCalcola';

const CLASSE_PRIMARIO =
  'rounded-[var(--radius-md)] bg-brand py-3 text-center text-base font-semibold text-brand-foreground disabled:opacity-40';
const CLASSE_LINK = 'text-sm font-semibold text-brand-dark';

// Una domanda sola: quanto c'è davvero sul conto. La data è oggi, la conferma una sola.
export function ControlloSaldo({ conti, onFatto }: { conti: Account[]; onFatto?: () => void }) {
  const router = useRouter();
  const [contoId, setContoId] = useState(conti[0]?.id ?? '');
  const [testo, setTesto] = useState('');
  const [data, setData] = useState(() => oggiRomaISO());
  const [cambiaData, setCambiaData] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [saldoFinale, setSaldoFinale] = useState<number | null>(null);
  // Il doppio tocco arriva prima che React ridisegni: lo blocca un ref, non lo stato.
  const occupato = useRef(false);

  if (conti.length === 0) {
    return (
      <p className="text-sm">
        <Link href="/casa" className={CLASSE_LINK}>
          Aggiungete prima il conto comune dalla pagina Casa.
        </Link>
      </p>
    );
  }

  if (saldoFinale !== null) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-base font-semibold">
          {`Fatto. Il saldo ora è ${formatNumero(saldoFinale)} €.`}
        </p>
        <Link href="/casa" className={CLASSE_LINK}>
          Torna alla casa
        </Link>
      </div>
    );
  }

  const conto = conti.find((c) => c.id === contoId) ?? conti[0];
  const grezzo = parseImporto(testo);
  const dichiarato = grezzo === null ? null : Math.round(grezzo * 100) / 100;
  const esito = dichiarato === null ? null : valutaControllo(conto.saldoAttuale, dichiarato);
  const valido = dichiarato !== null && data !== '';

  async function conferma() {
    if (!valido || dichiarato === null || esito === null || occupato.current) return;
    occupato.current = true;
    setInCorso(true);
    setErrore(null);
    try {
      await recordBalanceCheck(createClient(), {
        accountId: conto.id,
        saldoDichiarato: dichiarato,
        data,
        // Decide la funzione del database: registra la differenza solo se è di almeno 1 euro.
        creaMovimento: true,
      });
      setSaldoFinale(dichiarato);
      router.refresh();
      onFatto?.();
    } catch (e) {
      setErrore(messaggioErroreControllo(e));
    } finally {
      occupato.current = false;
      setInCorso(false);
    }
  }

  const etichettaConferma =
    esito?.esito === 'mancano'
      ? 'Segna come spese non registrate'
      : esito?.esito === 'in_piu'
        ? 'Segna come entrata non registrata'
        : 'Fatto';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void conferma();
      }}
      className="flex flex-col gap-4"
    >
      {conti.length > 1 ? <SelezioneConto etichetta="Conto" conti={conti} valore={conto.id} onChange={setContoId} /> : null}
      <p className="text-sm text-muted">{`Per l'app c'è: ${formatNumero(conto.saldoAttuale)} €`}</p>
      <Campo etichetta="Quanto c'è davvero sul conto comune?">
        <input
          inputMode="decimal"
          placeholder="0"
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          className={CLASSE_CAMPO}
        />
      </Campo>
      {cambiaData ? (
        <Campo etichetta="Data">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={CLASSE_CAMPO} />
        </Campo>
      ) : (
        <p className="text-sm text-muted">
          {data === oggiRomaISO() ? 'Oggi' : formatDateIt(data)}{' '}
          <button type="button" onClick={() => setCambiaData(true)} className={CLASSE_LINK}>
            Cambia data
          </button>
        </p>
      )}

      {esito && dichiarato !== null ? (
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold">{esito.frase}</p>
          {esito.esito !== 'torna' ? (
            <ComeSiCalcola
              spiegazione={{
                valore: esito.differenza,
                formula: `In banca meno quello che risulta nell'app.
${
                  esito.esito === 'mancano'
                    ? "Se in banca c'è meno di quanto registrato, la differenza sono spese non registrate."
                    : "Se in banca c'è più di quanto registrato, la differenza è un'entrata non registrata."
                }`,
                ingredienti: [
                  { etichetta: "Saldo nell'app", valore: conto.saldoAttuale },
                  { etichetta: 'Saldo in banca', valore: dichiarato },
                  { etichetta: 'Differenza', valore: esito.differenza },
                ],
              }}
            />
          ) : null}
          {esito.esito === 'mancano' ? (
            <Link href="/casa" className={CLASSE_LINK}>
              Ho dimenticato di registrare qualcosa
            </Link>
          ) : null}
          {esito.esito === 'in_piu' ? (
            <Link href="/casa" className={CLASSE_LINK}>
              Ho dimenticato un versamento
            </Link>
          ) : null}
        </div>
      ) : null}

      <ErroreMovimento testo={errore} />
      <button type="submit" disabled={!valido || inCorso} className={CLASSE_PRIMARIO}>
        {etichettaConferma}
      </button>
    </form>
  );
}
