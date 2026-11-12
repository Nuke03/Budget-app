'use client';

import { useState } from 'react';
import { formatNumero } from '@/lib/format';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { DebitoMembro } from '@/lib/calculations/casa/debitiMembri';
import type { Account } from '@/lib/types';
import { useRegistraMovimento } from './useRegistraMovimento';
import { SceltePill } from './SceltePill';
import { Annulla, CampoImporto, ErroreMovimento, Registra, SelezioneConto, Spunta } from './CampiMovimento';

type Modo = 'diretto' | 'conto_comune';

// Restituire una parte o tutto il debito verso un altro membro: direttamente, oppure versando di più sul conto comune.
export function RestituisciForm({
  householdId,
  debito,
  nomeCreditore,
  contiPersonali,
  contiCasa,
  onDone,
  onClose,
}: {
  householdId: string;
  debito: DebitoMembro;
  nomeCreditore: string;
  contiPersonali: Account[];
  contiCasa: Account[];
  onDone: () => void;
  onClose: () => void;
}) {
  const { importoTesto, setImportoTesto, importo, oltreMax, inCorso, errore, registra } = useRegistraMovimento({
    onDone,
    importoIniziale: debito.importo,
    max: debito.importo,
  });
  const [modo, setModo] = useState<Modo>('diretto');
  const [da, setDa] = useState(contiPersonali[0]?.id ?? '');
  const [a, setA] = useState(contiCasa[0]?.id ?? '');
  const [riflesso, setRiflesso] = useState(false);
  // Con "già riflesso" nessun conto viene toccato: non servono.
  const valido = importo !== null && (riflesso || (da !== '' && (modo === 'diretto' || a !== '')));

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || importo === null) return;
    const comune = { householdId, importo, data: oggiRomaISO(), daAccountId: da || null, soloRegistrazione: riflesso };
    if (modo === 'diretto') {
      await registra({ ...comune, causale: 'restituzione', beneficiarioUserId: debito.creditoreId });
    } else {
      await registra({ ...comune, causale: 'versamento', aAccountId: a || null, beneficiarioUserId: debito.creditoreId });
    }
  }

  return (
    <form onSubmit={invia} className="flex flex-col gap-3 px-5 pb-6">
      <p className="text-[15px]">
        Devi {formatNumero(debito.importo)} € a {nomeCreditore}. Puoi restituirne anche solo una parte.
      </p>
      <SceltePill
        legenda="Come restituisci"
        valore={modo}
        onChange={(c) => setModo(c as Modo)}
        opzioni={[
          { chiave: 'diretto', etichetta: 'Restituisco direttamente' },
          { chiave: 'conto_comune', etichetta: 'Verso di più sul conto comune' },
        ]}
      />
      <CampoImporto valore={importoTesto} onChange={setImportoTesto} />
      {oltreMax ? <p className="text-[13px] text-ink-2">Il debito residuo è di {formatNumero(debito.importo)} €.</p> : null}
      <SelezioneConto etichetta="Dal tuo conto" conti={contiPersonali} valore={da} onChange={setDa} />
      {modo === 'conto_comune' ? (
        <SelezioneConto etichetta="Sul conto comune" conti={contiCasa} valore={a} onChange={setA} />
      ) : null}
      <Spunta etichetta="Già riflesso nei saldi" checked={riflesso} onChange={setRiflesso} />
      <ErroreMovimento testo={errore} />
      <Registra disabilitato={!valido || inCorso} />
      <Annulla onClose={onClose} />
    </form>
  );
}
