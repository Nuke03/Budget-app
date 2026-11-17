'use client';

import { useState } from 'react';
import type { RigaNeutra } from '@/lib/calculations/casa/righeNeutre';
import type { Periodo } from '@/lib/calculations/filterTransactionsByPeriodo';
import type { Account, Category, Transaction } from '@/lib/types';
import { AvvisoAnnulla } from '../AvvisoAnnulla';
import { ContiVista } from '../accounts/ContiVista';
import { ObiettiviVista } from '../goals/ObiettiviVista';
import type { GoalWithQuotaMensile } from '../goals/GoalsList';
import { StoricoVista } from '../history/StoricoVista';

// Involucri sottili per l'anteprima: dati dal server, azioni vuote, nessuna lettura.
const niente = () => {};

export function StoricoProva({
  transactions,
  categories,
  righeNeutre,
}: {
  transactions: Transaction[];
  categories: Category[];
  righeNeutre: RigaNeutra[];
}) {
  const [periodo, setPeriodo] = useState<Periodo>('mese');
  return (
    <StoricoVista
      transactionsFiltrate={transactions}
      transactionsTotali={transactions.length}
      righeNeutreFiltrate={righeNeutre}
      categories={categories}
      caricato
      erroreSaldo={false}
      periodo={periodo}
      rangePersonalizzato={{ da: '', a: '' }}
      onChangePeriodo={setPeriodo}
      onChangeRange={niente}
      onEdit={niente}
      onDelete={niente}
    />
  );
}

export function ObiettiviProva({ goals, categories }: { goals: GoalWithQuotaMensile[]; categories: Category[] }) {
  return <ObiettiviVista goals={goals} categories={categories} onNuovo={niente} onEdit={niente} onClose={niente} />;
}

export function ContiProva({ accounts }: { accounts: Account[] }) {
  const [nome, setNome] = useState('');
  const [inDisponibile, setInDisponibile] = useState(true);
  return (
    <ContiVista
      accounts={accounts}
      nome={nome}
      onNome={setNome}
      contaInDisponibile={inDisponibile}
      onContaInDisponibile={setInDisponibile}
      onUpdateBalance={niente}
      onUpdateDetails={niente}
      onCreate={niente}
    />
  );
}

export function AvvisoProva({ testo }: { testo: string }) {
  return <AvvisoAnnulla testo={testo} onAnnulla={niente} onChiudi={niente} />;
}
