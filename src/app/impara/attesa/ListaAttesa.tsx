'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatEuro, nomeMese } from '@/lib/format';
import { piuGiorni } from '@/lib/data/percorso';
import { GIORNI_ATTESA } from '@/lib/calculations/percorso/soglie';
import type { VoceAttesa } from '@/lib/percorso/tipi';
import { aggiungiVoce, decidiVoce } from './actions';
import { CAMPO, ETICHETTA, ERRORE_TESTO, PRIMARIO, SECONDARIO } from '../primi-passi/stili';

const giorno = (iso: string): string => `${Number(iso.slice(8, 10))} ${nomeMese(iso)}`;

export function ListaAttesa({ voci, oggi }: { voci: VoceAttesa[]; oggi: string }) {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [cifra, setCifra] = useState('');
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState(false);

  const importo = Number(cifra.replace(',', '.'));
  const valido = nome.trim().length > 0 && Number.isFinite(importo) && importo > 0;
  const inAttesa = voci.filter((v) => v.stato === 'in_attesa');

  async function esegui(lavoro: () => Promise<void>): Promise<boolean> {
    setOccupato(true);
    setErrore(false);
    try {
      await lavoro();
      return true;
    } catch {
      setErrore(true);
      return false;
    } finally {
      setOccupato(false);
    }
  }

  async function aggiungi(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    const ok = await esegui(() => aggiungiVoce(nome.trim(), importo));
    if (ok) {
      setNome('');
      setCifra('');
      router.refresh();
    }
  }

  async function decidi(id: string, stato: 'voluto' | 'non_piu') {
    const ok = await esegui(() => decidiVoce(id, stato));
    if (!ok) return;
    if (stato === 'voluto') router.push('/goals');
    else router.refresh();
  }

  return (
    <div className="space-y-5">
      <p className="text-[15px] text-ink-2">
        Un acquisto che non serve subito aspetta {GIORNI_ATTESA} giorni. Poi decidi.
      </p>
      <form onSubmit={aggiungi} className="space-y-3 rounded-[var(--radius-md)] border border-rule bg-surface p-4">
        <div className="space-y-1">
          <label htmlFor="attesa-nome" className={ETICHETTA}>Cosa</label>
          <input id="attesa-nome" className={CAMPO} value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="attesa-cifra" className={ETICHETTA}>Quanto</label>
          <input id="attesa-cifra" className={CAMPO} inputMode="decimal" value={cifra} onChange={(e) => setCifra(e.target.value)} />
        </div>
        {valido ? (
          <p className="text-sm text-ink-2">Ci ripensi il {giorno(piuGiorni(oggi, GIORNI_ATTESA))}.</p>
        ) : null}
        <button type="submit" disabled={!valido || occupato} className={PRIMARIO}>Aggiungi</button>
      </form>
      {errore ? <p role="alert" className="text-sm text-ink-2">{ERRORE_TESTO}</p> : null}
      {inAttesa.length > 0 ? (
        <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-surface">
          {inAttesa.map((v) => {
            const scaduta = v.rivediIl <= oggi;
            return (
              <li key={v.id} className="border-b border-rule px-4 py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-foreground">{v.nome}</span>
                  <span className="text-base text-foreground">{formatEuro(v.importo)}</span>
                </div>
                <p className="text-sm text-ink-2">Ci ripensi il {giorno(v.rivediIl)}</p>
                {scaduta ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" disabled={occupato} className={PRIMARIO} onClick={() => decidi(v.id, 'voluto')}>
                      Lo voglio ancora
                    </button>
                    <button type="button" disabled={occupato} className={SECONDARIO} onClick={() => decidi(v.id, 'non_piu')}>
                      Non più
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
