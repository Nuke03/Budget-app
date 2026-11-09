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
import type { Account, BudgetGoal, Category, TransactionTipo } from '@/lib/types';
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
  onSaved: () => void;
}) {
  const [modoScelto, setModoScelto] = useState<Modo | null>(null);

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

  async function salvaPersonale(payload: Payload) {
    if (!personale) return;
    const supabase = createClient();
    await createTransaction(supabase, {
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
  }

  async function salvaCasa(payload: Payload) {
    if (!casa) return;
    const supabase = createClient();
    const conPersonale =
      payload.tipo === 'expense' &&
      !!payload.accountId &&
      contiPersonali.some((a) => a.id === payload.accountId);
    if (conPersonale && payload.accountId) {
      // Anticipata con la propria carta: il credito verso la casa nasce dalla spesa, il saldo scalato è quello personale.
      await createTransaction(
        supabase,
        { ...payload, data: oggiRomaISO(), nota: null, pagataDaUserId: meUserId ?? casa.meUserId },
        scopeCasa(casa.householdId)
      );
      await adjustAccountBalance(supabase, payload.accountId, -payload.importo);
      return;
    }
    await createTransaction(
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
  }

  async function handleSubmit(payload: Payload) {
    if (modo === 'casa') await salvaCasa(payload);
    else await salvaPersonale(payload);
    onSaved();
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
      {haSelettore && (
        <div className="mx-5 mb-4 flex gap-1.5 rounded-full bg-surface-muted p-1">
          {(['personale', 'casa'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={modo === m}
              onClick={() => scegli(m)}
              className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors duration-150 ${
                modo === m ? 'bg-surface text-foreground shadow-[var(--shadow-card)]' : 'text-muted'
              }`}
            >
              {m === 'personale' ? 'Personale' : 'Casa'}
            </button>
          ))}
        </div>
      )}
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
          onSubmit={handleSubmit}
        />
      ) : personale ? (
        <AddTransactionForm
          key="personale"
          categories={personale.categories}
          accounts={personale.accounts}
          goals={personale.goals}
          onCreateGoal={handleCreateGoal}
          onSubmit={handleSubmit}
        />
      ) : null}
    </FoglioInferiore>
  );
}
