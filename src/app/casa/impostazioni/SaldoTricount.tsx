'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { registraSaldoIniziale } from '@/lib/data/transfers';
import { parseImporto } from '@/lib/calculations/casa/parseImporto';
import { formatNumero } from '@/lib/format';
import type { HouseholdMember } from '@/lib/types';
import { CampoImporto, CLASSE_CAMPO, CLASSE_PRIMARIO, CLASSE_SCHEDA } from '../CampiMovimento';

const ERRORE_GENERICO = 'Salvataggio fallito, controlla la connessione e riprova.';
const ERRORE_GIA_INSERITO = 'Il saldo da Tricount è già stato inserito.';
const MESSAGGIO_RPC_GIA_INSERITO = 'saldo iniziale gia registrato';

export interface SaldoEsistente {
  creditoreId: string;
  debitoreId: string;
  importo: number;
}

export function SaldoTricount({
  householdId,
  members,
  saldoEsistente,
}: {
  householdId: string;
  members: HouseholdMember[];
  saldoEsistente: SaldoEsistente | null;
}) {
  const router = useRouter();
  const [debitoreId, setDebitoreId] = useState('');
  const [creditoreId, setCreditoreId] = useState('');
  const [importoTesto, setImportoTesto] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (members.length < 2) return null;

  const nome = (id: string) => members.find((m) => m.userId === id)?.displayName ?? 'Un ex coinquilino';
  const letto = parseImporto(importoTesto);
  const importo = letto === null ? null : Math.round(letto * 100) / 100;
  const valido = debitoreId !== '' && creditoreId !== '' && debitoreId !== creditoreId && importo !== null && importo > 0;
  const soloDue = members.length === 2;

  async function salva() {
    if (!valido || importo === null) return;
    setInCorso(true);
    setErrore(null);
    try {
      await registraSaldoIniziale(createClient(), { householdId, creditoreId, debitoreId, importo });
      router.refresh();
    } catch (e) {
      const messaggio = (e as { message?: string } | null)?.message ?? '';
      if (messaggio.includes(MESSAGGIO_RPC_GIA_INSERITO)) {
        setErrore(ERRORE_GIA_INSERITO);
        router.refresh();
      } else {
        setErrore(ERRORE_GENERICO);
      }
    } finally {
      setInCorso(false);
    }
  }

  const sceltaPersona = (etichetta: string, valore: string, onChange: (v: string) => void) => (
    <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
      {etichetta}
      <select value={valore} onChange={(e) => onChange(e.target.value)} className={CLASSE_CAMPO}>
        <option value="">Scegli una persona</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.displayName}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section id="saldo-tricount" className={CLASSE_SCHEDA}>
      <h2 className="font-serif text-lg font-semibold">Saldo da Tricount</h2>
      {saldoEsistente ? (
        <p className="text-[15px]">
          Già inserito: {nome(saldoEsistente.debitoreId)} doveva{' '}
          <span className="num">{formatNumero(saldoEsistente.importo)} €</span> a {nome(saldoEsistente.creditoreId)}.
        </p>
      ) : (
        <>
          <p className="text-[15px] text-ink-2">Venite da Tricount? Scrivi il saldo di oggi e ripartite da qui.</p>
          {soloDue ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-[13px] text-ink-2">Chi deve dare soldi a chi</legend>
              {[
                [members[0], members[1]],
                [members[1], members[0]],
              ].map(([d, c]) => (
                <label
                  key={d.userId}
                  className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] border border-rule px-4 text-[15px] font-semibold"
                >
                  <input
                    type="radio"
                    name="saldo-tricount"
                    checked={debitoreId === d.userId}
                    onChange={() => {
                      setDebitoreId(d.userId);
                      setCreditoreId(c.userId);
                    }}
                    className="size-4 accent-brand"
                  />
                  {d.displayName} deve a {c.displayName}
                </label>
              ))}
            </fieldset>
          ) : (
            <>
              {sceltaPersona('Chi deve dare', debitoreId, setDebitoreId)}
              {sceltaPersona('A chi', creditoreId, setCreditoreId)}
            </>
          )}
          <CampoImporto valore={importoTesto} onChange={setImportoTesto} />
          <button
            type="button"
            onClick={salva}
            disabled={inCorso || !valido}
            className={CLASSE_PRIMARIO}
          >
            Salva il saldo
          </button>
          {errore && (
            <p role="alert" className="text-[15px] text-danger">
              {errore}
            </p>
          )}
        </>
      )}
    </section>
  );
}
