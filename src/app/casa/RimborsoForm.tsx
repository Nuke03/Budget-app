'use client';

import { useState } from 'react';
import { formatNumero } from '@/lib/format';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { Account } from '@/lib/types';
import { useRegistraMovimento } from './usaRegistraMovimento';
import { Annulla, CampoImporto, ErroreMovimento, Registra, SelezioneConto, Spunta } from './CampiMovimento';

// Chi rimborsa lo fa dal conto comune; il conto di chi riceve non serve.
export function RimborsoForm({
  householdId,
  creditore,
  importoIniziale,
  contiCasa,
  onDone,
  onClose,
}: {
  householdId: string;
  creditore: { userId: string; nome: string };
  importoIniziale: number;
  contiCasa: Account[];
  onDone: () => void;
  onClose: () => void;
}) {
  const { importoTesto, setImportoTesto, importo, oltreMax, inCorso, errore, registra } = useRegistraMovimento({
    onDone,
    importoIniziale,
    max: importoIniziale,
  });
  const [conto, setConto] = useState(contiCasa[0]?.id ?? '');
  const [riflesso, setRiflesso] = useState(false);
  const valido = importo !== null && conto !== '';

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || importo === null) return;
    await registra({
      householdId,
      causale: 'rimborso',
      importo,
      data: oggiRomaISO(),
      daAccountId: conto,
      beneficiarioUserId: creditore.userId,
      soloRegistrazione: riflesso,
    });
  }

  return (
    <form onSubmit={invia} className="flex flex-col gap-3 px-5 pb-6">
      <p className="text-sm">
        A {creditore.nome} spettano {formatNumero(importoIniziale)} € per spese anticipate.
      </p>
      <CampoImporto valore={importoTesto} onChange={setImportoTesto} />
      {oltreMax ? <p className="text-sm text-muted">Il credito è di {formatNumero(importoIniziale)} €.</p> : null}
      <SelezioneConto etichetta="Dal conto comune" conti={contiCasa} valore={conto} onChange={setConto} />
      <Spunta etichetta="Già riflesso nei saldi" checked={riflesso} onChange={setRiflesso} />
      <ErroreMovimento testo={errore} />
      <Registra disabilitato={!valido || inCorso} />
      <Annulla onClose={onClose} />
    </form>
  );
}
