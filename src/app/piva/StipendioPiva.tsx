'use client';

import { useState } from 'react';
import { Campo, CLASSE_CAMPO, CLASSE_NEUTRO, CLASSE_PRIMARIO, CLASSE_SECONDARIO } from '../casa/CampiMovimento';
import { formatNumero, nomeMese } from '@/lib/format';
import { Perche } from './PerchePiva';
import { euroInFrase } from './PromptQuota';

export interface CalcoloStipendio {
  a: number | null;
  b: number;
  proposta: number | null;
  serveMeseMagro: boolean;
}

export interface RigaStipendio {
  rimasto: number;
  cuscinetto: number;
  mesiCoperti: number;
  // Se le spese hanno superato lo stipendio: la frase con l'eccedenza (la stessa della Home).
  frase: string | null;
}

export interface SalvaStipendio {
  stipendioMensile: number;
  stipendioRivistoIl: string;
}

// "550,50" o "550.5": un numero maggiore di zero, altrimenti null.
function numeroPositivo(testo: string): number | null {
  const n = Number(testo.trim().replace(',', '.'));
  return testo.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
}

function CampoNumero({
  etichetta,
  azione,
  onInvia,
  onAnnulla,
}: {
  etichetta: string;
  azione: string;
  onInvia: (n: number) => Promise<void>;
  onAnnulla?: () => void;
}) {
  const [testo, setTesto] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(false);
  const n = numeroPositivo(testo);

  async function invia() {
    if (n === null || inCorso) return;
    setInCorso(true);
    setErrore(false);
    try {
      await onInvia(n);
    } catch {
      setErrore(true);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Campo etichetta={etichetta}>
        <input
          inputMode="decimal"
          placeholder="0"
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          className={CLASSE_CAMPO}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={invia} disabled={n === null || inCorso} className={CLASSE_PRIMARIO}>
          {azione}
        </button>
        {onAnnulla ? (
          <button type="button" onClick={onAnnulla} disabled={inCorso} className={CLASSE_NEUTRO}>
            Annulla
          </button>
        ) : null}
      </div>
      {errore ? (
        <p role="alert" className="text-[15px] font-medium text-danger">
          Non è riuscito. Riprova.
        </p>
      ) : null}
    </div>
  );
}

// Lo stipendio fisso della P.IVA: prima la proposta (una volta), poi le due righe con quanto resta e il cuscinetto.
export function StipendioPiva({
  stipendio,
  oggi,
  calcolo,
  riga,
  onSalva,
  onMeseMagro,
}: {
  stipendio: number | null;
  oggi: string;
  // null: i dati per calcolare non si leggono ora.
  calcolo: CalcoloStipendio | null;
  // null: il cuscinetto non si calcola ora.
  riga: RigaStipendio | null;
  onSalva: (campi: SalvaStipendio) => Promise<void>;
  onMeseMagro: (incasso: number) => Promise<void>;
}) {
  const [cambia, setCambia] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(false);

  const salva = (n: number) => onSalva({ stipendioMensile: n, stipendioRivistoIl: oggi });

  async function vaBene(proposta: number) {
    if (inCorso) return;
    setInCorso(true);
    setErrore(false);
    try {
      await salva(proposta);
    } catch {
      setErrore(true);
    } finally {
      setInCorso(false);
    }
  }

  const campoCambia = (
    <CampoNumero
      etichetta="Stipendio al mese (€)"
      azione="Salva"
      onInvia={async (n) => {
        await salva(n);
        setCambia(false);
      }}
      onAnnulla={() => setCambia(false)}
    />
  );

  if (stipendio !== null) {
    return (
      <>
        <div>
          <h2 className="text-[13px] text-ink-2">Stipendio di {nomeMese(oggi)}</h2>
          <p className="num font-serif text-[40px] font-bold leading-none">{euroInFrase(stipendio)}</p>
          {riga ? (
            <p className="num mt-1 text-[15px] text-ink-2">Te ne restano {euroInFrase(Math.max(0, riga.rimasto))}</p>
          ) : null}
          {riga?.frase ? <p className="mt-1 text-[15px] text-ink-2">{riga.frase}</p> : null}
        </div>
        {riga ? (
          <div className="flex flex-col border-t border-rule pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px]">Cuscinetto</span>
              <span className="num font-serif text-[22px] font-semibold">{euroInFrase(riga.cuscinetto)}</span>
            </div>
            <p className="num text-[15px] text-ink-2">
              Copre {formatNumero(riga.mesiCoperti)} {riga.mesiCoperti === 1 ? 'mese' : 'mesi'}
            </p>
          </div>
        ) : (
          <p className="text-[15px] text-ink-2">Il cuscinetto non si calcola ora.</p>
        )}
        <Perche tema="lo stipendio">
          <p>
            Lo stipendio è la cifra fissa che puoi spendere ogni mese, anche quando gli incassi arrivano a strappi. Tra
            parentesi vedi quanto te ne resta dopo le spese di questo mese.
          </p>
          <p>
            Il cuscinetto è quello che hai sui conti oltre lo stipendio di questo mese: serve per i mesi con pochi
            incassi. «Copre {riga ? formatNumero(riga.mesiCoperti) : 'n'} mesi» vuol dire che potresti pagare{' '}
            {riga ? formatNumero(riga.mesiCoperti) : 'n'} stipendi anche senza incassare niente.
          </p>
        </Perche>
        {cambia ? (
          campoCambia
        ) : (
          <button type="button" onClick={() => setCambia(true)} className={`${CLASSE_SECONDARIO} self-start`}>
            Cambia lo stipendio
          </button>
        )}
      </>
    );
  }

  if (calcolo === null) {
    return (
      <>
        <h2 className="font-serif text-lg font-semibold">Stipendio</h2>
        <p className="text-[15px] text-ink-2">Lo stipendio non si calcola ora. Riprova tra poco.</p>
      </>
    );
  }

  if (calcolo.serveMeseMagro || calcolo.a === null || calcolo.proposta === null) {
    return (
      <>
        <h2 className="font-serif text-lg font-semibold">Stipendio</h2>
        <p className="text-[13px] text-ink-2">
          Mi serve per proporti uno stipendio: non ho ancora abbastanza mesi di incassi.
        </p>
        <CampoNumero etichetta="In un mese magro, quanto incassi più o meno?" azione="Continua" onInvia={onMeseMagro} />
      </>
    );
  }

  const { a, b, proposta } = calcolo;
  return (
    <>
      <h2 className="font-serif text-lg font-semibold">Stipendio</h2>
      <p className="text-[13px] text-ink-2">Lo stipendio è la cifra fissa che puoi spendere ogni mese.</p>
      <p className="num text-[15px]">
        Ti propongo <span className="font-serif text-[28px] font-bold">{euroInFrase(proposta)}</span> al mese.
      </p>
      <div className="flex flex-col">
        <div className="flex justify-between gap-3">
          <span className="text-ink-2">Incassi netti medi</span>
          <span className="num font-semibold">{euroInFrase(a)}</span>
        </div>
        <Perche tema="gli incassi netti">
          <p>È la media di quanto hai incassato negli ultimi mesi, tolto quello che metti da parte per le tasse.</p>
        </Perche>
      </div>
      {b > 0 ? (
        <div className="flex flex-col">
          <div className="flex justify-between gap-3">
            <span className="text-ink-2">Quanto ti serve al mese</span>
            <span className="num font-semibold">{euroInFrase(b)}</span>
          </div>
          <Perche tema="quanto ti serve">
            <p>È la media delle tue spese dei mesi scorsi, più la quota della casa se ce l&apos;hai.</p>
          </Perche>
        </div>
      ) : (
        <p className="text-[15px] text-ink-2">Non vedo ancora abbastanza spese: parto da quanto incassi.</p>
      )}
      {b > 0 ? <p className="text-[15px]">Ti propongo la più bassa delle due, per stare tranquilli.</p> : null}
      {a > proposta ? (
        <p className="num text-[15px]">
          Il resto, {euroInFrase(a - proposta)} al mese, va nel cuscinetto: una riserva per i mesi con pochi incassi.
        </p>
      ) : null}
      {cambia ? (
        campoCambia
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => vaBene(proposta)} disabled={inCorso} className={CLASSE_PRIMARIO}>
            Va bene
          </button>
          <button type="button" onClick={() => setCambia(true)} className={CLASSE_SECONDARIO}>
            Cambia
          </button>
        </div>
      )}
      {errore ? (
        <p role="alert" className="text-[15px] font-medium text-danger">
          Non è riuscito. Riprova.
        </p>
      ) : null}
    </>
  );
}
