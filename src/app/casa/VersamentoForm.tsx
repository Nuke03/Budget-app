'use client';

import { useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { Account } from '@/lib/types';
import { useRegistraMovimento } from './useRegistraMovimento';
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

// Gli ultimi sei mesi e il prossimo, a partire dal mese di default, più ogni mese più vecchio
// che ha ancora una quota da registrare (così anche gli arretrati si possono sistemare).
export function mesiProponibili(
  meseDefault: string,
  mesiArretrati: string[] = []
): { valore: string; etichetta: string }[] {
  const base = parseISO(meseDefault);
  const mesi = new Set(
    Array.from({ length: 8 }, (_, i) => format(addMonths(base, i - 6), 'yyyy-MM-01'))
  );
  for (const m of mesiArretrati) mesi.add(`${m.slice(0, 7)}-01`);
  return Array.from(mesi)
    .sort()
    .map((valore) => ({ valore, etichetta: format(parseISO(valore), 'LLLL yyyy', { locale: it }) }));
}

export function VersamentoForm({
  householdId,
  membri,
  meUserId,
  contiPersonali,
  contiCasa,
  meseDefault,
  mesiArretrati,
  onDone,
  onClose,
}: {
  householdId: string;
  membri: { userId: string; nome: string }[];
  meUserId: string;
  contiPersonali: Account[];
  contiCasa: Account[];
  meseDefault: string;
  // Mesi con una quota ancora da registrare per chi scrive (dai registri).
  mesiArretrati?: string[];
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
  // Se il versamento è già nei saldi, nessun conto viene toccato: i conti non servono.
  const valido = importo !== null && (riflesso || (da !== '' && a !== '')) && data !== '';

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || importo === null) return;
    await registra({
      householdId,
      causale: 'versamento',
      importo,
      data,
      daAccountId: da || null,
      aAccountId: a || null,
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
          {mesiProponibili(meseDefault, mesiArretrati).map((m) => (
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
      <Spunta etichetta="Il versamento l'ho già riflesso nei saldi" checked={riflesso} onChange={setRiflesso} />
      <ErroreMovimento testo={errore} />
      <Registra disabilitato={!valido || inCorso} />
      <Annulla onClose={onClose} />
    </form>
  );
}
