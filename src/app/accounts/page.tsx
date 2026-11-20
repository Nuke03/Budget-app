'use client';

import { useEffect, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { createClient } from '@/lib/supabase/client';
import { getAccounts, updateAccountBalance, updateAccountDetails, createAccount } from '@/lib/data/accounts';
import { getPivaSettings } from '@/lib/data/pivaSettings';
import { getRientri } from '@/lib/data/rientri';
import { getSpostamenti } from '@/lib/data/spostamenti';
import { situazioneRientriConti, type SituazioneRientroConto, type Rientro, type Spostamento } from '@/lib/calculations/rientri';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { ContiVista } from './ContiVista';
import type { Account } from '@/lib/types';

export default function AccountsPage() {
  const fail = useThrowToBoundary();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contoTasseId, setContoTasseId] = useState<string | null>(null);
  // I rientri verso i conti con quanto resta da spostare (Task 8 ne fa le righe); vuoti se non si leggono.
  const [rientriConti, setRientriConti] = useState<SituazioneRientroConto[]>([]);
  const [nome, setNome] = useState('');
  const [contaInDisponibile, setContaInDisponibile] = useState(true);

  async function refresh() {
    const supabase = createClient();
    const conti = await getAccounts(supabase);
    setAccounts(conti);
    // Se le impostazioni P.IVA non si leggono, i conti si vedono lo stesso: solo senza la riga del conto tasse.
    const piva = await getPivaSettings(supabase).catch(() => null);
    const tasse = piva?.attivo ? piva.contoTasseId : null;
    setContoTasseId(tasse);
    // I rientri non devono rompere la pagina: se non si leggono, nessuna riga.
    const rientri = await getRientri(supabase).catch(() => [] as Rientro[]);
    const inizi = rientri.filter((r) => r.accountId !== null).map((r) => r.creatoIl);
    const spostamenti =
      inizi.length === 0
        ? ([] as Spostamento[])
        : await getSpostamenti(supabase, inizi.reduce((min, d) => (d < min ? d : min))).catch(() => [] as Spostamento[]);
    // Come nella Home: pesano i conti del disponibile, senza il conto tasse.
    const chePesano = new Set(conti.filter((a) => a.contaInDisponibile && a.id !== tasse).map((a) => a.id));
    setRientriConti(situazioneRientriConti(rientri, spostamenti, chePesano, oggiRomaISO()));
  }

  useEffect(() => {
    refresh().catch(fail);
  }, [fail]);

  async function handleUpdateBalance(id: string, saldo: number) {
    const supabase = createClient();
    await updateAccountBalance(supabase, id, saldo);
    await refresh();
  }

  async function handleUpdateDetails(
    id: string,
    details: { nome: string; contaInDisponibile: boolean; targetSaldo: number | null }
  ) {
    const supabase = createClient();
    await updateAccountDetails(supabase, id, details);
    await refresh();
  }

  async function handleCreate() {
    if (!nome.trim()) return;
    const supabase = createClient();
    await createAccount(supabase, {
      nome,
      saldoAttuale: 0,
      contaInDisponibile,
      targetSaldo: null,
    });
    setNome('');
    await refresh();
  }

  return (
    <>
      <ContiVista
        accounts={accounts}
        contoTasseId={contoTasseId}
        rientriConti={rientriConti}
        nome={nome}
        onNome={setNome}
        contaInDisponibile={contaInDisponibile}
        onContaInDisponibile={setContaInDisponibile}
        onUpdateBalance={handleUpdateBalance}
        onUpdateDetails={handleUpdateDetails}
        onCreate={handleCreate}
      />
    </>
  );
}
