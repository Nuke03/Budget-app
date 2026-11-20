'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createGoal } from '@/lib/data/goals';
import { casa as scopeCasa } from '@/lib/data/scope';
import { nomiAltri } from '@/lib/calculations/casa/etichette';
import { registraMovimento, type SpazioSpesa, type SpesaPayload } from '@/lib/registraSpesa';
import { accantonaTasse } from '@/lib/data/piva';
import { computeQuotaIncasso } from '@/lib/calculations/piva';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Account, BudgetGoal, Category, Transaction, TransactionTipo } from '@/lib/types';
import { FoglioInferiore } from '../FoglioInferiore';
import { PromptQuota, contoDaCuiSpostare } from '../piva/PromptQuota';
import { AddTransactionForm } from './AddTransactionForm';
import { AvvisoFondiFoglio } from './AvvisoFondiFoglio';
import { LezioneFoglio } from './LezioneFoglio';
import { valutaDopoSalvataggio, type DopoSalvataggio } from '../impara/dopoSalvataggio';

type Modo = 'personale' | 'casa';

const CHIAVE_MODO = 'aggiungiModo';

function leggiModoSalvato(): Modo {
  try {
    return window.localStorage.getItem(CHIAVE_MODO) === 'casa' ? 'casa' : 'personale';
  } catch {
    return 'personale';
  }
}

// Il conto dell'ultima volta, per spazio. undefined: mai usato.
function chiaveConto(modo: Modo): string {
  return `aggiungi:conto:${modo}`;
}

function leggiConto(modo: Modo): string | null | undefined {
  try {
    const v = window.localStorage.getItem(chiaveConto(modo));
    return v === null ? undefined : v === '' ? null : v;
  } catch {
    return undefined;
  }
}

function salvaConto(modo: Modo, accountId: string | null) {
  try {
    window.localStorage.setItem(chiaveConto(modo), accountId ?? '');
  } catch {
    // Solo una comodità.
  }
}

// L'id della riga appena creata: la Home lo legge per mettere il timbro.
function segnaRegistrato(id: string) {
  try {
    window.sessionStorage.setItem('libretto:registrato', id);
  } catch {
    // Senza memoria niente timbro, il salvataggio vale comunque.
  }
}

function salvaModo(modo: Modo) {
  try {
    window.localStorage.setItem(CHIAVE_MODO, modo);
  } catch {
    // La memoria dell'ultima scelta è solo una comodità.
  }
}

type Payload = SpesaPayload;

export function AddTransactionSheet({
  aperto,
  onClose,
  personale,
  casa,
  contiPersonali = [],
  modoIniziale = 'ricorda',
  meUserId,
  storico,
  piva = null,
  iniziale,
  onAccantonato,
  onSaved,
}: {
  aperto: boolean;
  onClose: () => void;
  personale: {
    categories: Category[];
    accounts: Account[];
    goals: (BudgetGoal & { accantonato: number })[];
  } | null;
  casa: CasaAggiunta | null;
  // I conti personali di chi scrive: in Casa permettono "Io, con <conto>" (spesa anticipata di tasca propria).
  contiPersonali?: Account[];
  modoIniziale?: 'ricorda' | 'personale' | 'casa';
  meUserId?: string;
  // Le spese passate, da cui indovinare la categoria. Dove non c'è, nessun suggerimento.
  storico?: Pick<Transaction, 'descrizione' | 'categoriaId' | 'data' | 'tipo'>[];
  // Solo per chi ha la P.IVA guidata: un'entrata nella categoria del fatturato propone la quota delle tasse.
  piva?: { categoriaFatturatoId: string; percentuale: number; contoTasseId: string } | null;
  // Punto di partenza del modulo personale (es. "+ Incasso" nella pagina P.IVA).
  iniziale?: { tipo: TransactionTipo; categoriaId: string | null };
  // Dopo che la quota è stata spostata sul conto tasse: chi apre il foglio aggiorna i suoi dati.
  onAccantonato?: () => void;
  onSaved: (id: string, spazio: Modo) => void;
}) {
  const [modoScelto, setModoScelto] = useState<Modo | null>(null);
  // L'importo già scritto resta quando si cambia spazio (il modulo si ricrea).
  const [importoBozza, setImportoBozza] = useState('');
  // L'incasso appena salvato di cui proporre la quota: sopravvive alla chiusura del foglio.
  const [quotaDaSpostare, setQuotaDaSpostare] = useState<{
    transactionId: string;
    importo: number;
    quota: number;
    daAccountId: string;
    aAccountId: string;
    nomeConto: string;
  } | null>(null);

  // L'avviso o la lezione dopo un salvataggio personale: come la quota, sopravvive alla chiusura del foglio.
  const [dopo, setDopo] = useState<DopoSalvataggio>(null);

  if (quotaDaSpostare) {
    return (
      <PromptQuota
        importo={quotaDaSpostare.importo}
        quota={quotaDaSpostare.quota}
        contoTasse={quotaDaSpostare.nomeConto}
        onPiuTardi={() => setQuotaDaSpostare(null)}
        onFatto={async (importoSpostato) => {
          await accantonaTasse(createClient(), {
            importo: importoSpostato,
            data: oggiRomaISO(),
            daAccountId: quotaDaSpostare.daAccountId,
            aAccountId: quotaDaSpostare.aAccountId,
            transactionId: quotaDaSpostare.transactionId,
          });
          setQuotaDaSpostare(null);
          onAccantonato?.();
        }}
      />
    );
  }

  // La quota P.IVA ha la precedenza: l'avviso o la lezione si vedono dopo.
  if (dopo) {
    const chiudiDopo = () => setDopo(null);
    return dopo.tipo === 'avviso' ? (
      <AvvisoFondiFoglio
        avviso={dopo.avviso}
        transactionId={dopo.transactionId}
        lezione={dopo.lezione}
        onChiudi={chiudiDopo}
      />
    ) : (
      <LezioneFoglio lezioneId={dopo.lezione} onChiudi={chiudiDopo} />
    );
  }

  if (!aperto) return null;

  const soloCasa = !personale && !!casa;
  const soloPersonale = !!personale && !casa;
  const haSelettore = !!personale && !!casa;
  const preferito: Modo =
    modoScelto ?? (modoIniziale === 'ricorda' ? leggiModoSalvato() : modoIniziale);
  const modo: Modo = soloCasa ? 'casa' : soloPersonale ? 'personale' : preferito;

  function scegli(m: Modo) {
    setModoScelto(m);
    salvaModo(m);
  }

  function spazioCorrente(): SpazioSpesa {
    return modo === 'casa' && casa
      ? {
          tipo: 'casa',
          householdId: casa.householdId,
          meUserId: meUserId ?? casa.meUserId,
          contiPersonaliIds: contiPersonali.map((a) => a.id),
        }
      : { tipo: 'personale' };
  }

  function chiudi() {
    setImportoBozza('');
    onClose();
  }

  // Una sola chiamata: movimento e saldo insieme. Se fallisce il foglio resta aperto con i campi.
  async function handleSubmit(payload: Payload) {
    if (modo === 'casa' ? !casa : !personale) return;
    const id = await registraMovimento(createClient(), payload, spazioCorrente());
    salvaConto(modo, payload.accountId);
    segnaRegistrato(id);
    // Un incasso del lavoro (spazio personale): si propone la quota delle tasse.
    if (
      piva &&
      personale &&
      modo === 'personale' &&
      payload.tipo === 'income' &&
      payload.categoriaId === piva.categoriaFatturatoId
    ) {
      const da = contoDaCuiSpostare(payload.accountId, personale.accounts, piva.contoTasseId);
      const conto = personale.accounts.find((a) => a.id === piva.contoTasseId);
      if (da && conto) {
        setQuotaDaSpostare({
          transactionId: id,
          importo: payload.importo,
          quota: computeQuotaIncasso(payload.importo, piva.percentuale),
          daAccountId: da,
          aAccountId: conto.id,
          nomeConto: conto.nome,
        });
      }
    }
    // Solo lo spazio personale. Non si aspetta: il foglio si chiude subito e l'esito arriva dopo.
    // Qualunque errore vale come "niente da dire": il salvataggio è già fatto.
    if (modo === 'personale') {
      // Finché l'esito non arriva il giro dei fumetti non parte: il foglio dopo il salvataggio non va coperto.
      document.body.setAttribute('data-dopo-in-attesa', '');
      valutaDopoSalvataggio(id)
        .then((r) => {
          if (r) setDopo(r);
        })
        .catch(() => {})
        .finally(() => document.body.removeAttribute('data-dopo-in-attesa'));
    }
    onSaved(id, modo);
    setImportoBozza('');
    onClose();
  }

  // Una nuova cosa da mettere da parte: personale, o della casa se si è nel modo Casa.
  async function creaObiettivo(
    payload: { nome: string; importoTarget: number; categoriaId: string | null },
    householdId?: string
  ) {
    const supabase = createClient();
    const input = {
      nome: payload.nome,
      importoTarget: payload.importoTarget,
      modalita: 'bloccato' as const,
      scadenza: null,
      categoriaId: payload.categoriaId,
      ricorrente: false,
      frequenzaMesi: null,
    };
    return householdId ? createGoal(supabase, input, scopeCasa(householdId)) : createGoal(supabase, input);
  }
  const handleCreateGoal = (payload: { nome: string; importoTarget: number; categoriaId: string | null }) =>
    creaObiettivo(payload);

  const spazio = {
    etichetta: modo === 'casa' ? 'Casa' : 'Personale',
    opzioni: haSelettore
      ? [
          { valore: 'personale', etichetta: 'Personale' },
          { valore: 'casa', etichetta: 'Casa' },
        ]
      : undefined,
    onScegli: (v: string) => scegli(v === 'casa' ? 'casa' : 'personale'),
  };

  const contiCasaEPersonali = [
    ...(casa?.conti ?? []),
    ...contiPersonali.map((a) => ({ ...a, nome: `Io, con ${a.nome}` })),
  ];
  const altri = casa && meUserId ? nomiAltri(casa.nomi, meUserId) : null;
  const quantiAltri = casa && meUserId ? casa.nomi.filter((n) => n.userId !== meUserId).length : 0;
  const notaCasa = altri
    ? quantiAltri > 1
      ? `Lo vedranno anche ${altri}`
      : `Lo vedrà anche ${altri}`
    : undefined;

  return (
    <FoglioInferiore titolo="Nuova transazione" onClose={chiudi}>
      {modo === 'casa' && casa ? (
        <AddTransactionForm
          key="casa"
          categories={casa.categorie}
          accounts={contiCasaEPersonali}
          idContiSoloSpesa={contiPersonali.map((a) => a.id)}
          goals={casa.obiettivi}
          onCreateGoal={(payload) => creaObiettivo(payload, casa.householdId)}
          contoEtichetta="Chi ha pagato"
          obiettivoEtichetta="Da parte (opzionale)"
          nascondiGestisciCategorie
          contoDaScegliere={casa.conti.length === 0 && contiPersonali.length > 0}
          preselezionaObiettivo
          nota={notaCasa}
          veloce
          storico={storico}
          contoIniziale={leggiConto('casa')}
          spazio={spazio}
          importoIniziale={importoBozza}
          onImportoChange={setImportoBozza}
          onSubmit={handleSubmit}
        />
      ) : personale ? (
        <AddTransactionForm
          key="personale"
          categories={personale.categories}
          accounts={personale.accounts}
          goals={personale.goals}
          onCreateGoal={handleCreateGoal}
          tipoIniziale={iniziale?.tipo}
          categoriaIniziale={iniziale?.categoriaId}
          veloce
          storico={storico}
          contoIniziale={leggiConto('personale')}
          spazio={spazio}
          importoIniziale={importoBozza}
          onImportoChange={setImportoBozza}
          onSubmit={handleSubmit}
        />
      ) : null}
    </FoglioInferiore>
  );
}
