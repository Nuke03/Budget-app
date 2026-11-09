'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { createTransaction } from '@/lib/data/transactions';
import { createGoal } from '@/lib/data/goals';
import { adjustAccountBalance, updateAccountBalance } from '@/lib/data/accounts';
import { casa as scopeCasa } from '@/lib/data/scope';
import { computeNuovoSaldoConto } from '@/lib/calculations/accountBalance';
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
  // Riservato alla schermata dei trasferimenti verso il conto comune (T7.2).
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

    const account = payload.accountId
      ? personale.accounts.find((a) => a.id === payload.accountId)
      : undefined;
    if (account) {
      const nuovoSaldo = computeNuovoSaldoConto(account.saldoAttuale, payload.tipo, payload.importo);
      await updateAccountBalance(supabase, account.id, nuovoSaldo);
    }
  }

  async function salvaCasa(payload: Payload) {
    if (!casa) return;
    const supabase = createClient();
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
          accounts={casa.conti}
          goals={casa.obiettivi}
          contoEtichetta="Chi ha pagato"
          obiettivoEtichetta="Da parte (opzionale)"
          nascondiGestisciCategorie
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
