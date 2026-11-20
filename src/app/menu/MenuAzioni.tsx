'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownLeft, PiggyBank, Hourglass, CircleCheck, Building2, ChevronRight, ChevronLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FoglioInferiore } from '../FoglioInferiore';
import { EVENTO_AGGIUNGI, type DettaglioAggiungi } from '@/lib/eventoAggiungi';
import { formatEuro } from '@/lib/format';
import { leggiVociMenu, type VociMenu } from './actions';

function Riga({ icona: Icona, nome, sotto, onClick }: { icona: LucideIcon; nome: string; sotto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center gap-3 border-t border-rule px-5 py-2 text-left hover:bg-brand-tint"
    >
      <Icona size={20} className="shrink-0 text-brand-dark" aria-hidden="true" />
      <span className="flex-1">
        <span className="block text-base font-semibold">{nome}</span>
        <span className="block text-[13px] text-ink-2">{sotto}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-ink-2" aria-hidden="true" />
    </button>
  );
}

// Il menu del +: cosa si può fare adesso. Le voci che dipendono dai dati compaiono appena arrivano.
export function MenuAzioni({ aperto, onClose, inCasa }: { aperto: boolean; onClose: () => void; inCasa: boolean }) {
  const router = useRouter();
  const [voci, setVoci] = useState<VociMenu | null>(null);
  const [scegliCassetto, setScegliCassetto] = useState(false);
  const [apertoVisto, setApertoVisto] = useState(aperto);
  // Alla chiusura il passo torna al primo: si aggiorna durante il render, non in un effetto.
  if (aperto !== apertoVisto) {
    setApertoVisto(aperto);
    if (!aperto) setScegliCassetto(false);
  }
  const corpo = useRef<HTMLDivElement>(null);
  const passoVisto = useRef(false);

  // Cambiando passo il bottone premuto sparisce: il fuoco va al primo controllo del nuovo passo.
  useEffect(() => {
    if (!passoVisto.current) {
      passoVisto.current = true;
      return;
    }
    corpo.current?.querySelector<HTMLElement>('button')?.focus();
  }, [scegliCassetto]);

  useEffect(() => {
    if (!aperto) return;
    if (voci) return;
    let attivo = true;
    leggiVociMenu().then(
      (v) => {
        if (attivo) setVoci(v);
      },
      () => {
        // niente voci in più: il menu funziona lo stesso
      },
    );
    return () => {
      attivo = false;
    };
  }, [aperto, voci]);

  if (!aperto) return null;

  function vai(percorso: string) {
    onClose();
    router.push(percorso);
  }

  // Se la pagina ha un foglio di aggiunta lo apre, altrimenti porta alla Home che lo apre.
  function aggiungi(tipo: 'income' | undefined, ripiego: string) {
    onClose();
    const dettaglio: DettaglioAggiungi = tipo ? { gestito: false, tipo } : { gestito: false };
    window.dispatchEvent(new CustomEvent(EVENTO_AGGIUNGI, { detail: dettaglio }));
    if (!dettaglio.gestito) router.push(ripiego);
  }

  const cassetti = voci?.cassettiARate ?? [];
  const tuttiFatti = cassetti.length > 0 && cassetti.every((c) => c.confermatoMese > 0);

  function versa() {
    if (cassetti.length === 1) vai(`/goals?versa=${cassetti[0].id}`);
    else setScegliCassetto(true);
  }

  if (scegliCassetto) {
    return (
      <FoglioInferiore titolo="In quale cassetto?" onClose={onClose}>
        <div ref={corpo} className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          {cassetti.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => vai(`/goals?versa=${c.id}`)}
              className="flex min-h-[56px] w-full items-center justify-between gap-3 border-t border-rule px-5 py-2 text-left hover:bg-brand-tint"
            >
              <span className="text-base font-semibold">{c.nome}</span>
              <span className="num text-base text-ink-2">{formatEuro(c.quota)}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setScegliCassetto(false)}
            className="flex min-h-[48px] w-full items-center gap-2 border-t border-rule px-5 py-2 text-left text-sm font-semibold text-brand-dark"
          >
            <ChevronLeft size={18} aria-hidden="true" />
            Indietro
          </button>
        </div>
      </FoglioInferiore>
    );
  }

  return (
    <FoglioInferiore titolo="Cosa vuoi fare?" onClose={onClose}>
      <div ref={corpo} className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="px-5 pb-3">
          <button
            type="button"
            onClick={() => aggiungi(undefined, '/?aggiungi=1')}
            className="flex h-14 w-full items-center justify-center rounded-[var(--radius-md)] bg-brand text-base font-semibold text-brand-foreground"
          >
            {inCasa ? 'Registra una spesa di casa' : 'Registra una spesa'}
          </button>
        </div>
        <Riga icona={ArrowDownLeft} nome="Entrata" sotto="Uno stipendio, un rimborso" onClick={() => aggiungi('income', '/?aggiungi=entrata')} />
        <Riga icona={PiggyBank} nome="Metti da parte" sotto="Crea un cassetto per una cosa che arriva" onClick={() => vai('/goals?nuovo=1')} />
        <Riga icona={Hourglass} nome="Ci penso su" sotto="Lista d'attesa prima di comprare" onClick={() => vai('/impara/attesa?nuovo=1')} />
        {cassetti.length > 0 ? (
          <Riga
            icona={CircleCheck}
            nome="Versa nel cassetto"
            sotto={tuttiFatti ? 'Le rate di questo mese sono fatte' : 'Conferma la rata del mese'}
            onClick={versa}
          />
        ) : null}
        {voci?.haCasa ? (
          <Riga icona={Building2} nome="Versa la quota della casa" sotto="Quanto ti tocca questo mese" onClick={() => vai('/casa?azione=versamento')} />
        ) : null}
      </div>
    </FoglioInferiore>
  );
}
