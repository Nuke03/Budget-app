'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { createTransaction } from '@/lib/data/transactions';
import { createGoal } from '@/lib/data/goals';
import { adjustAccountBalance } from '@/lib/data/accounts';
import { casa as scopeCasa } from '@/lib/data/scope';
import { nomiAltri } from '@/lib/calculations/casa/etichette';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Account, BudgetGoal, Category, Transaction, TransactionTipo } from '@/lib/types';
import { FoglioInferiore } from '../FoglioInferiore';
import { AddTransactionForm } from './AddTransactionForm';

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

interface Payload {
  tipo: TransactionTipo;
  importo: number;
  categoriaId: string | null;
  accountId: string | null;
  goalId: string | null;
  descrizione: string;
}

export function AddTransactionSheet({
  aperto,
  onClose,
  personale,
  casa,
  contiPersonali = [],
  modoIniziale = 'ricorda',
  meUserId,
  storico,
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
  onSaved: (id: string) => void;
}) {
  const [modoScelto, setModoScelto] = useState<Modo | null>(null);
  // L'importo già scritto resta quando si cambia spazio (il modulo si ricrea).
  const [importoBozza, setImportoBozza] = useState('');

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

  async function salvaPersonale(payload: Payload): Promise<string | null> {
    if (!personale) return null;
    const supabase = createClient();
    const creata = await createTransaction(supabase, {
      ...payload,
      data: format(new Date(), 'yyyy-MM-dd'),
      nota: null,
    });

    if (payload.accountId) {
      // Per differenza: il saldo può essere cambiato altrove (casa, rimborsi) dopo che questa pagina l'ha letto.
      await adjustAccountBalance(
        supabase,
        payload.accountId,
        payload.tipo === 'income' ? payload.importo : -payload.importo
      );
    }
    return creata?.id ?? null;
  }

  async function salvaCasa(payload: Payload): Promise<string | null> {
    if (!casa) return null;
    const supabase = createClient();
    const conPersonale =
      payload.tipo === 'expense' &&
      !!payload.accountId &&
      contiPersonali.some((a) => a.id === payload.accountId);
    if (conPersonale && payload.accountId) {
      // Anticipata con la propria carta: il credito verso la casa nasce dalla spesa, il saldo scalato è quello personale.
      const anticipata = await createTransaction(
        supabase,
        { ...payload, data: oggiRomaISO(), nota: null, pagataDaUserId: meUserId ?? casa.meUserId },
        scopeCasa(casa.householdId)
      );
      await adjustAccountBalance(supabase, payload.accountId, -payload.importo);
      return anticipata?.id ?? null;
    }
    const creata = await createTransaction(
      supabase,
      { ...payload, data: oggiRomaISO(), nota: null },
      scopeCasa(casa.householdId)
    );
    if (payload.accountId) {
      await adjustAccountBalance(
        supabase,
        payload.accountId,
        payload.tipo === 'income' ? payload.importo : -payload.importo
      );
    }
    return creata?.id ?? null;
  }

  async function handleSubmit(payload: Payload) {
    const id = modo === 'casa' ? await salvaCasa(payload) : await salvaPersonale(payload);
    salvaConto(modo, payload.accountId);
    if (id) segnaRegistrato(id);
    onSaved(id ?? '');
    onClose();
  }

  async function handleCreateGoal(payload: {
    nome: string;
    importoTarget: number;
    categoriaId: string | null;
  }) {
    const supabase = createClient();
    return createGoal(supabase, {
      nome: payload.nome,
      importoTarget: payload.importoTarget,
      modalita: 'bloccato',
      scadenza: null,
      categoriaId: payload.categoriaId,
      ricorrente: false,
      frequenzaMesi: null,
    });
  }

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
    <FoglioInferiore titolo="Nuova transazione" onClose={onClose}>
      {modo === 'casa' && casa ? (
        <AddTransactionForm
          key="casa"
          categories={casa.categorie}
          accounts={contiCasaEPersonali}
          idContiSoloSpesa={contiPersonali.map((a) => a.id)}
          goals={casa.obiettivi}
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
