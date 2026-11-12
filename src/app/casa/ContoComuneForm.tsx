'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { creaContoComune } from '@/lib/data/casaSetup';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';
import { CLASSE_CAMPO, CLASSE_PRIMARIO } from './CampiMovimento';

export function ContoComuneForm({ householdId }: { householdId: string }) {
  const router = useRouter();
  const [nome, setNome] = useState('Conto comune');
  const [saldo, setSaldo] = useState('');
  const [errore, setErrore] = useState(false);
  const [inCorso, setInCorso] = useState(false);

  const saldoNumero = saldo.trim() === '' ? 0 : parseImporto(saldo);
  const valido = nome.trim() !== '' && saldoNumero !== null;

  async function crea(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || saldoNumero === null) return;
    setErrore(false);
    setInCorso(true);
    try {
      await creaContoComune(createClient(), householdId, { nome: nome.trim(), saldoAttuale: saldoNumero });
      router.refresh();
    } catch {
      setErrore(true);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <form onSubmit={crea} className="flex flex-col gap-3">
      <p className="text-[15px]">Aprite il conto comune qui</p>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
        Nome del conto
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={CLASSE_CAMPO}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
        Saldo attuale
        <input
          inputMode="decimal"
          placeholder="0"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          className={CLASSE_CAMPO}
        />
      </label>
      <button
        type="submit"
        disabled={!valido || inCorso}
        className={CLASSE_PRIMARIO}
      >
        Apri il conto
      </button>
      {errore && (
        <p role="alert" className="text-sm font-medium text-danger">
          Non siamo riusciti a creare il conto, controlla la connessione e riprova.
        </p>
      )}
    </form>
  );
}
