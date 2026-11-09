'use client';

import { useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { Account } from '@/lib/types';
import { useRegistraMovimento } from './usaRegistraMovimento';
import {
  Annulla,
  Campo,
  CampoImporto,
  CLASSE_CAMPO,
  ErroreMovimento,
  Registra,
  SelezioneConto,
  Spunta,
} from './CampiMovimento';

// Gli ultimi sei mesi e il prossimo, a partire dal mese di default.
function mesiProponibili(meseDefault: string): { valore: string; etichetta: string }[] {
  const base = parseISO(meseDefault);
  return Array.from({ length: 8 }, (_, i) => {
    const d = addMonths(base, i - 6);
    return { valore: format(d, 'yyyy-MM-01'), etichetta: format(d, 'LLLL yyyy', { locale: it }) };
  });
}

export function VersamentoForm({
  householdId,
  membri,
  meUserId,
  contiPersonali,
  contiCasa,
  meseDefault,
  onDone,
  onClose,
}: {
  householdId: string;
  membri: { userId: string; nome: string }[];
  meUserId: string;
  contiPersonali: Account[];
  contiCasa: Account[];
  meseDefault: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const { importoTesto, setImportoTesto, importo, inCorso, errore, registra } = useRegistraMovimento({ onDone });
  const [da, setDa] = useState(contiPersonali[0]?.id ?? '');
  const [a, setA] = useState(contiCasa[0]?.id ?? '');
  const [data, setData] = useState(oggiRomaISO());
  const [mese, setMese] = useState(meseDefault);
  const [perConto, setPerConto] = useState('');
  const [riflesso, setRiflesso] = useState(false);

  const altri = membri.filter((m) => m.userId !== meUserId);
  const valido = importo !== null && da !== '' && a !== '' && data !== '';

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || importo === null) return;
    await registra({
      householdId,
      causale: 'versamento',
      importo,
      data,
      daAccountId: da,
      aAccountId: a,
      meseCompetenza: mese,
      perContoDiUserId: perConto || null,
      soloRegistrazione: riflesso,
    });
  }

  return (
    <form onSubmit={invia} className="flex flex-col gap-3 px-5 pb-6">
      <SelezioneConto etichetta="Da" conti={contiPersonali} valore={da} onChange={setDa} />
      <SelezioneConto etichetta="A" conti={contiCasa} valore={a} onChange={setA} />
      <CampoImporto valore={importoTesto} onChange={setImportoTesto} />
      <Campo etichetta="Data">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={CLASSE_CAMPO} />
      </Campo>
      <Campo etichetta="Per il mese di">
        <select value={mese} onChange={(e) => setMese(e.target.value)} className={CLASSE_CAMPO}>
          {mesiProponibili(meseDefault).map((m) => (
            <option key={m.valore} value={m.valore}>
              {m.etichetta}
            </option>
          ))}
        </select>
      </Campo>
      {altri.length > 0 ? (
        <Campo etichetta="Per chi">
          <select value={perConto} onChange={(e) => setPerConto(e.target.value)} className={CLASSE_CAMPO}>
            <option value="">Per me</option>
            {altri.map((m) => (
              <option key={m.userId} value={m.userId}>
                Per conto di {m.nome}
              </option>
            ))}
          </select>
        </Campo>
      ) : null}
      <Spunta etichetta="Il bonifico l'ho già riflesso nei saldi" checked={riflesso} onChange={setRiflesso} />
      <ErroreMovimento testo={errore} />
      <Registra disabilitato={!valido || inCorso} />
      <Annulla onClose={onClose} />
    </form>
  );
}
