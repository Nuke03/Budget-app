'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { formatNumero } from '@/lib/format';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { DebitoMembro } from '@/lib/calculations/casa/debitiMembri';
import type { AzionePromemoria, Promemoria } from '@/lib/calculations/casa/promemoria';
import type { Account } from '@/lib/types';
import { StrisciaPromemoria } from './StrisciaPromemoria';
import { FoglioInferiore } from '../FoglioInferiore';
import { Annulla, ErroreMovimento, Registra } from './CampiMovimento';
import { RestituisciForm } from './RestituisciForm';
import { RimborsoForm } from './RimborsoForm';
import { useRegistraMovimento } from './useRegistraMovimento';
import { VersamentoForm } from './VersamentoForm';

export type AzioneCasa =
  | { tipo: 'versamento' }
  | { tipo: 'rimborso'; creditore: { userId: string; nome: string }; importo: number }
  | { tipo: 'restituisci'; debito: DebitoMembro; nomeCreditore: string }
  | { tipo: 'rinuncia_credito'; importo: number }
  | { tipo: 'rinuncia_debito'; debito: DebitoMembro; nomeDebitore: string };

interface CasaAzioniContestoValore {
  apri: (azione: AzioneCasa) => void;
}

export const CasaAzioniContext = createContext<CasaAzioniContestoValore>({ apri: () => {} });

export function useCasaAzioni(): CasaAzioniContestoValore {
  return useContext(CasaAzioniContext);
}

// Dall'azione di un promemoria al modulo che si apre.
export function azioneDaPromemoria(
  az: AzionePromemoria,
  meUserId: string,
  debiti: DebitoMembro[],
  nomi: Record<string, string>
): AzioneCasa | null {
  if (az.tipo === 'versamento') return { tipo: 'versamento' };
  const altro = az.altroUserId ?? '';
  const nome = nomi[altro] ?? 'Un altro membro';
  if (az.tipo === 'rimborso') {
    if (az.importo === undefined) return null;
    return { tipo: 'rimborso', creditore: { userId: altro, nome }, importo: az.importo };
  }
  const debito = debiti.find((d) => d.debitoreId === meUserId && d.creditoreId === altro);
  return debito ? { tipo: 'restituisci', debito, nomeCreditore: nome } : null;
}

// La striscia dei promemoria dentro /casa: le azioni aprono gli stessi moduli dei pannelli.
export function StrisciaPromemoriaCasa({
  promemoria,
  oggi,
  meUserId,
  debiti,
  nomi,
}: {
  promemoria: Promemoria[];
  oggi: string;
  meUserId: string;
  debiti: DebitoMembro[];
  nomi: Record<string, string>;
}) {
  const { apri } = useCasaAzioni();
  return (
    <StrisciaPromemoria
      promemoria={promemoria}
      oggi={oggi}
      onAzione={(az) => {
        const azione = azioneDaPromemoria(az, meUserId, debiti, nomi);
        if (azione) apri(azione);
      }}
    />
  );
}

function Rinuncia({
  testo,
  conferma,
  onDone,
  onClose,
  input,
}: {
  testo: string;
  conferma: string;
  onDone: () => void;
  onClose: () => void;
  input: Parameters<ReturnType<typeof useRegistraMovimento>['registra']>[0];
}) {
  const { inCorso, errore, registra } = useRegistraMovimento({ onDone });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void registra(input);
      }}
      className="flex flex-col gap-3 px-5 pb-6"
    >
      <p className="text-sm">{testo}</p>
      <ErroreMovimento testo={errore} />
      <Registra disabilitato={inCorso} etichetta={conferma} />
      <Annulla onClose={onClose} />
    </form>
  );
}

// Tiene aperto un solo modulo alla volta in un foglio e lo offre ai figli (i pannelli, i promemoria).
export function CasaAzioni({
  householdId,
  meUserId,
  membri,
  contiPersonali,
  contiCasa,
  meseDefault,
  mesiArretrati,
  children,
}: {
  householdId: string;
  meUserId: string;
  membri: { userId: string; nome: string }[];
  contiPersonali: Account[];
  contiCasa: Account[];
  meseDefault: string;
  mesiArretrati?: string[];
  children?: ReactNode;
}) {
  const router = useRouter();
  const [azione, setAzione] = useState<AzioneCasa | null>(null);

  const chiudi = () => setAzione(null);
  const fatto = () => {
    router.refresh();
    setAzione(null);
  };

  let titolo = '';
  let corpo: ReactNode = null;
  if (azione?.tipo === 'versamento') {
    titolo = 'Registra un versamento';
    corpo = (
      <VersamentoForm
        householdId={householdId}
        membri={membri}
        meUserId={meUserId}
        contiPersonali={contiPersonali}
        contiCasa={contiCasa}
        meseDefault={meseDefault}
        mesiArretrati={mesiArretrati}
        onDone={fatto}
        onClose={chiudi}
      />
    );
  } else if (azione?.tipo === 'rimborso') {
    titolo = 'Rimborsa';
    corpo = (
      <RimborsoForm
        householdId={householdId}
        creditore={azione.creditore}
        importoIniziale={azione.importo}
        contiCasa={contiCasa}
        onDone={fatto}
        onClose={chiudi}
      />
    );
  } else if (azione?.tipo === 'restituisci') {
    titolo = 'Restituisci';
    corpo = (
      <RestituisciForm
        householdId={householdId}
        debito={azione.debito}
        nomeCreditore={azione.nomeCreditore}
        contiPersonali={contiPersonali}
        contiCasa={contiCasa}
        onDone={fatto}
        onClose={chiudi}
      />
    );
  } else if (azione?.tipo === 'rinuncia_credito') {
    titolo = 'Rinuncia al credito';
    corpo = (
      <Rinuncia
        testo={`Chiudi il credito di ${formatNumero(azione.importo)} € senza rimborso. Non cambia nessun saldo. Puoi annullarla dai movimenti della casa.`}
        conferma="Chiudi il credito"
        onDone={fatto}
        onClose={chiudi}
        input={{
          householdId,
          causale: 'rimborso',
          importo: azione.importo,
          data: oggiRomaISO(),
          beneficiarioUserId: meUserId,
          soloRegistrazione: true,
        }}
      />
    );
  } else if (azione?.tipo === 'rinuncia_debito') {
    titolo = 'Rinuncia';
    corpo = (
      <Rinuncia
        testo={`Chiudi i ${formatNumero(azione.debito.importo)} € che ${azione.nomeDebitore} ti deve, senza restituzione. Non cambia nessun saldo. Puoi annullarla dai movimenti della casa.`}
        conferma="Chiudi il debito"
        onDone={fatto}
        onClose={chiudi}
        input={{
          householdId,
          causale: 'restituzione',
          importo: azione.debito.importo,
          data: oggiRomaISO(),
          beneficiarioUserId: meUserId,
          perContoDiUserId: azione.debito.debitoreId,
          soloRegistrazione: true,
        }}
      />
    );
  }

  return (
    <CasaAzioniContext.Provider value={{ apri: setAzione }}>
      {children}
      {azione ? (
        <FoglioInferiore titolo={titolo} onClose={chiudi}>
          {corpo}
        </FoglioInferiore>
      ) : null}
    </CasaAzioniContext.Provider>
  );
}
