'use client';

import { useState } from 'react';
import type { RigaNeutra } from '@/lib/calculations/casa/righeNeutre';
import type { Periodo } from '@/lib/calculations/filterTransactionsByPeriodo';
import type { Account, Category, PivaScadenza, PivaSettings, Transaction } from '@/lib/types';
import { AvvisoAnnulla } from '../AvvisoAnnulla';
import { ContiVista } from '../accounts/ContiVista';
import { ObiettiviVista } from '../goals/ObiettiviVista';
import type { GoalWithQuotaMensile } from '../goals/GoalsList';
import { StoricoVista } from '../history/StoricoVista';
import { CLASSE_SCHEDA } from '../casa/CampiMovimento';
import { ImpostazioneGuidata } from '../piva/ImpostazioneGuidata';
import { PivaHub, type DatiPivaHub } from '../piva/PivaHub';
import { ScadenzePiva } from '../piva/ScadenzePiva';

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

export function PivaHubProva({ settings, dati }: { settings: PivaSettings; dati: DatiPivaHub }) {
  return (
    <PivaHub
      settings={settings}
      datiIniziali={dati}
      onModifica={niente}
      onDisattiva={async () => {}}
      onSalvaStipendio={async () => {}}
    />
  );
}

export function GuidaPivaProva({ conti, categorie }: { conti: Account[]; categorie: Category[] }) {
  return <ImpostazioneGuidata iniziale={null} conti={conti} categorie={categorie} onFatto={async () => {}} />;
}

export function ScadenzePivaProva({
  scadenze,
  saldoVaso,
  guidataDal,
  anno,
  oggi,
}: {
  scadenze: PivaScadenza[];
  saldoVaso: number;
  guidataDal: string;
  anno: number;
  oggi: string;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-28 pt-3.5">
      <section aria-label="Scadenze dell'anno" className={CLASSE_SCHEDA}>
        <ScadenzePiva
          scadenze={scadenze}
          saldoVaso={saldoVaso}
          contoTasseId="conto-tasse"
          guidataDal={guidataDal}
          anno={anno}
          oggi={oggi}
          apertaIniziale
          onCambiato={niente}
        />
      </section>
    </main>
  );
}
