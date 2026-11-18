'use client';

import { useState } from 'react';
import { Campo, CLASSE_CAMPO, CLASSE_PRIMARIO, ErroreMovimento, SelezioneConto } from '../casa/CampiMovimento';

export interface ValoriFattura {
  cliente: string;
  importo: number;
  dataEmissione: string;
  nota: string | null;
  pagataAdesso: boolean;
  // Il conto su cui entra l'incasso: solo con "Pagata adesso".
  accountId: string | null;
}

// "90,5" e "90.5" valgono uguale.
function leggiImporto(testo: string): number {
  const t = testo.trim().replace(',', '.');
  return t === '' ? NaN : Number(t);
}

// Chi, quanto, quando. Con "Pagata adesso" fattura e incasso sono un'operazione sola.
export function NuovaFattura({
  onSalva,
  pagataAdessoIniziale,
  conti,
  contoIniziale,
  oggi,
  modifica,
}: {
  onSalva: (v: ValoriFattura) => Promise<void>;
  pagataAdessoIniziale: boolean;
  conti: { id: string; nome: string }[];
  contoIniziale: string | null;
  oggi: string;
  // Se c'è, si corregge una fattura in attesa: niente "Pagata adesso".
  modifica?: { cliente: string; importo: number; dataEmissione: string; nota: string | null };
}) {
  const [cliente, setCliente] = useState(modifica?.cliente ?? (pagataAdessoIniziale ? 'Incasso diretto' : ''));
  const [importo, setImporto] = useState(modifica ? String(modifica.importo) : '');
  const [data, setData] = useState(modifica?.dataEmissione ?? oggi);
  const [pagataAdesso, setPagataAdesso] = useState(modifica ? false : pagataAdessoIniziale);
  const [conto, setConto] = useState(contoIniziale ?? conti[0]?.id ?? '');
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const valore = leggiImporto(importo);
  const valido = cliente.trim() !== '' && Number.isFinite(valore) && valore > 0 && data !== '' && (!pagataAdesso || conto !== '');

  async function salva() {
    if (!valido || inCorso) return;
    setInCorso(true);
    setErrore(null);
    try {
      await onSalva({
        cliente: cliente.trim(),
        importo: valore,
        dataEmissione: data,
        nota: modifica?.nota ?? null,
        pagataAdesso,
        accountId: pagataAdesso ? conto : null,
      });
    } catch {
      setErrore('Non è riuscito. Riprova.');
      setInCorso(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salva();
      }}
      className="flex flex-col gap-4 px-5 pb-5"
    >
      <Campo etichetta="Chi">
        <input value={cliente} onChange={(e) => setCliente(e.target.value)} className={CLASSE_CAMPO} />
      </Campo>
      <Campo etichetta="Importo (€)">
        <input
          inputMode="decimal"
          placeholder="0"
          value={importo}
          onChange={(e) => setImporto(e.target.value)}
          className={CLASSE_CAMPO}
        />
      </Campo>
      <Campo etichetta="Data">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={CLASSE_CAMPO} />
      </Campo>
      {modifica ? null : (
        <>
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              checked={pagataAdesso}
              onChange={(e) => setPagataAdesso(e.target.checked)}
              className="size-5 accent-brand"
            />
            Pagata adesso
          </label>
          {pagataAdesso ? <SelezioneConto etichetta="Conto" conti={conti} valore={conto} onChange={setConto} /> : null}
        </>
      )}
      <ErroreMovimento testo={errore} />
      <button type="submit" disabled={!valido || inCorso} className={CLASSE_PRIMARIO}>
        Salva
      </button>
    </form>
  );
}
