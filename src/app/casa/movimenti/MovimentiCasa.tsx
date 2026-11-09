'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { deleteTransaction, updateTransaction } from '@/lib/data/transactions';
import { adjustAccountBalance } from '@/lib/data/accounts';
import { deltaPerModifica } from '@/lib/calculations/accountBalance';
import { etichettaChiHaPagato } from '@/lib/calculations/casa/etichette';
import { meseRomaISO } from '@/lib/calculations/casa/oggi';
import { formatDateIt, formatEuro } from '@/lib/format';
import type { CasaCorrente } from '@/lib/data/households';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Transaction, TransactionTipo } from '@/lib/types';
import { AddTransactionForm } from '../../add/AddTransactionForm';

const ERRORE_SALVATAGGIO = 'Salvataggio fallito, controlla la connessione e riprova.';

function etichettaMese(mese: string): string {
  return format(parseISO(`${mese}-01`), 'LLLL yyyy', { locale: it });
}

export function MovimentiCasa({
  casa,
  aggiunta,
  transazioni,
  meUserId,
}: {
  casa: CasaCorrente;
  aggiunta: CasaAggiunta;
  transazioni: Transaction[];
  meUserId: string;
}) {
  const router = useRouter();
  const [righe, setRighe] = useState<Transaction[]>(transazioni);
  const meseCorrente = meseRomaISO().slice(0, 7);
  const [mese, setMese] = useState(meseCorrente);
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [errore, setErrore] = useState(false);

  const nomi = Object.fromEntries(aggiunta.nomi.map((n) => [n.userId, n.nome]));
  const mesi = Array.from(new Set([meseCorrente, ...righe.map((t) => t.data.slice(0, 7))])).sort().reverse();
  const visibili = righe
    .filter((t) => t.data.startsWith(mese))
    .sort((a, b) => (a.data === b.data ? 0 : a.data < b.data ? 1 : -1));
  const categoria = (id: string | null) => aggiunta.categorie.find((c) => c.id === id)?.nome ?? '';
  const puoModificare = (t: Transaction) => !t.pagataDaUserId || t.pagataDaUserId === meUserId;

  async function elimina(t: Transaction) {
    const posizione = righe.findIndex((r) => r.id === t.id);
    setErrore(false);
    setRighe((r) => r.filter((x) => x.id !== t.id));
    let cancellata = false;
    try {
      const supabase = createClient();
      await deleteTransaction(supabase, t.id);
      cancellata = true;
      if (t.accountId) {
        await adjustAccountBalance(supabase, t.accountId, t.tipo === 'expense' ? t.importo : -t.importo);
      }
      router.refresh();
    } catch {
      setErrore(true);
      // Se la riga e gia stata cancellata e fallisce solo il saldo, non va rimessa.
      if (cancellata) return;
      setRighe((r) => {
        if (r.some((x) => x.id === t.id)) return r;
        const copia = [...r];
        copia.splice(Math.min(posizione, copia.length), 0, t);
        return copia;
      });
    }
  }

  async function salva(
    t: Transaction,
    payload: {
      tipo: TransactionTipo;
      importo: number;
      categoriaId: string | null;
      accountId: string | null;
      goalId: string | null;
      descrizione: string;
    }
  ) {
    const nuova: Transaction = { ...t, ...payload };
    setErrore(false);
    setRighe((r) => r.map((x) => (x.id === t.id ? nuova : x)));
    setInModifica(null);
    try {
      const supabase = createClient();
      await updateTransaction(supabase, t.id, {
        tipo: payload.tipo,
        importo: payload.importo,
        data: t.data,
        categoriaId: payload.categoriaId,
        accountId: payload.accountId,
        goalId: payload.goalId,
        descrizione: payload.descrizione,
        nota: t.nota,
      });
      for (const { accountId, delta } of deltaPerModifica(t, nuova)) {
        await adjustAccountBalance(supabase, accountId, delta);
      }
      router.refresh();
    } catch {
      setErrore(true);
      setRighe((r) => r.map((x) => (x.id === t.id ? t : x)));
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-5 pt-8">
      <div className="flex flex-col gap-1">
        <Link href="/casa" className="text-sm font-semibold text-brand-dark">
          {casa.household.nome}
        </Link>
        <h1 className="text-2xl font-bold">Movimenti di casa</h1>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Mese
        <select
          value={mese}
          onChange={(e) => setMese(e.target.value)}
          className="rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base text-foreground"
        >
          {mesi.map((m) => (
            <option key={m} value={m}>
              {etichettaMese(m)}
            </option>
          ))}
        </select>
      </label>

      {errore && (
        <p role="alert" className="text-sm font-medium text-danger">
          {ERRORE_SALVATAGGIO}
        </p>
      )}

      {visibili.length === 0 ? (
        <p className="text-sm text-muted">Nessun movimento in questo mese.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibili.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-card)]"
            >
              {inModifica === t.id ? (
                <div className="-mx-5">
                  <AddTransactionForm
                    categories={aggiunta.categorie}
                    accounts={aggiunta.conti}
                    goals={aggiunta.obiettivi}
                    initial={{
                      tipo: t.tipo,
                      importo: t.importo,
                      categoriaId: t.categoriaId,
                      accountId: t.accountId,
                      goalId: t.goalId,
                      descrizione: t.descrizione,
                    }}
                    contoEtichetta="Chi ha pagato"
                    obiettivoEtichetta="Da parte (opzionale)"
                    nascondiGestisciCategorie
                    submitLabel="Salva modifiche"
                    onCancel={() => setInModifica(null)}
                    onSubmit={(payload) => salva(t, payload)}
                  />
                </div>
              ) : (
                <>
                  <div className="flex justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{t.descrizione}</span>
                      <span className="text-xs text-muted">
                        {formatDateIt(t.data)}
                        {categoria(t.categoriaId) ? ` · ${categoria(t.categoriaId)}` : ''}
                      </span>
                      <span className="text-xs text-muted">
                        {etichettaChiHaPagato(t, aggiunta.conti, nomi)}
                      </span>
                    </div>
                    <span className="text-sm font-bold tabular-nums">
                      {t.tipo === 'expense' ? '-' : '+'}
                      {formatEuro(t.importo)}
                    </span>
                  </div>
                  {puoModificare(t) && (
                    <div className="flex gap-4 text-sm font-semibold">
                      <button type="button" onClick={() => setInModifica(t.id)} className="text-brand-dark">
                        Modifica
                      </button>
                      <button type="button" onClick={() => elimina(t)} className="text-danger">
                        Elimina
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
