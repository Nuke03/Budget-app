'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { nascondiScadenza, pagaScadenza, updateScadenza } from '@/lib/data/piva';
import { confrontoCumulativo, eIlPrimoAnno, prossimaScadenza } from '@/lib/calculations/pivaScadenze';
import { formatDataLunga, formatDateIt } from '@/lib/format';
import { useEliminaConAnnulla } from '../AnnullaProvider';
import { Campo, CLASSE_CAMPO, CLASSE_NEUTRO, CLASSE_PRIMARIO, CLASSE_SECONDARIO } from '../casa/CampiMovimento';
import { PercheScadenza } from './PerchePiva';
import { euroInFrase } from './PromptQuota';
import type { PivaScadenza } from '@/lib/types';

type Modulo = { id: string; modo: 'cifra' | 'paga' };

// Le scadenze dell'anno (F24 ed ENPAP): la cifra la dà il commercialista, qui si confronta col vaso.
export function ScadenzePiva({
  scadenze,
  saldoVaso,
  contoTasseId,
  guidataDal,
  anno,
  oggi,
  nonCaricate = false,
  apertaIniziale = false,
  onCambiato,
  onNascosta,
}: {
  scadenze: PivaScadenza[];
  saldoVaso: number;
  contoTasseId: string;
  guidataDal: string;
  anno: number;
  oggi: string;
  nonCaricate?: boolean;
  // La lista parte chiusa; l'anteprima la mostra già aperta.
  apertaIniziale?: boolean;
  onCambiato: () => void | Promise<void>;
  onNascosta?: (id: string) => void;
}) {
  const eliminaConAnnulla = useEliminaConAnnulla();
  const [aperta, setAperta] = useState(apertaIniziale);
  const [nascosti, setNascosti] = useState<Set<string>>(new Set());
  const [modulo, setModulo] = useState<Modulo | null>(null);
  const [importo, setImporto] = useState('');
  const [data, setData] = useState('');
  const [inCorso, setInCorso] = useState<Set<string>>(new Set());
  const [errore, setErrore] = useState<string | null>(null);

  const visibili = scadenze.filter((s) => !s.nascosta && !nascosti.has(s.id));
  const prossima = nonCaricate ? null : prossimaScadenza(visibili, oggi);

  function apri(s: PivaScadenza, modo: Modulo['modo']) {
    setErrore(null);
    setModulo({ id: s.id, modo });
    setImporto(s.importo != null ? String(s.importo) : '');
    // "Pagata" propone il giorno della scadenza se è già passata, altrimenti oggi.
    setData(modo === 'paga' ? (s.data < oggi ? s.data : oggi) : s.data);
  }

  async function esegui(id: string, lavoro: () => Promise<void>) {
    if (inCorso.has(id)) return;
    setErrore(null);
    setInCorso((p) => new Set(p).add(id));
    try {
      await lavoro();
    } catch {
      setErrore('Non è riuscito. Riprova.');
      setInCorso((p) => {
        const d = new Set(p);
        d.delete(id);
        return d;
      });
      return;
    }
    setModulo(null);
    try {
      // L'azione è riuscita: se la ricarica fallisce non è un errore dell'azione (la gestisce chi ricarica).
      await onCambiato();
    } catch {
      // niente
    } finally {
      setInCorso((p) => {
        const d = new Set(p);
        d.delete(id);
        return d;
      });
    }
  }

  const valore = Number(importo);
  const importoValido = importo.trim() !== '' && Number.isFinite(valore) && valore > 0;

  function salva(s: PivaScadenza) {
    if (!importoValido || !data) return;
    void esegui(s.id, () => updateScadenza(createClient(), s.id, { importo: valore, data }));
  }

  function paga(s: PivaScadenza, cifra: number, giorno: string) {
    void esegui(s.id, async () => {
      await pagaScadenza(createClient(), s.id, { importo: cifra, data: giorno, accountId: contoTasseId });
    });
  }

  function togli(s: PivaScadenza) {
    const cambia = (nascondi: boolean) =>
      setNascosti((prima) => {
        const dopo = new Set(prima);
        if (nascondi) dopo.add(s.id);
        else dopo.delete(s.id);
        return dopo;
      });
    eliminaConAnnulla({
      id: s.id,
      testo: 'Scadenza tolta.',
      nascondi: () => cambia(true),
      ripristina: () => cambia(false),
      esegui: async () => {
        await nascondiScadenza(createClient(), s.id, true);
        onNascosta?.(s.id);
      },
    });
  }

  const corpo = (
    <>
      {nonCaricate ? (
        <p className="text-[15px] text-ink-2">Le scadenze non si caricano ora.</p>
      ) : visibili.length === 0 ? (
        <p className="text-[15px] text-ink-2">Nessuna scadenza in vista.</p>
      ) : (
        <>
          <p className="text-[13px] text-ink-2">
            Un acconto è una parte delle tasse pagata in anticipo; il saldo è quello che resta a conti fatti.
          </p>
          <ul>
            {visibili.map((s) => {
              const lavorando = inCorso.has(s.id);
              const aperto = modulo?.id === s.id ? modulo : null;
              const confronto = s.importo != null && !s.pagataIl ? confrontoCumulativo(saldoVaso, visibili, s.id) : null;
              return (
                <li key={s.id} className="flex flex-col gap-2 border-t border-rule py-3 first:border-t-0">
                  <div>
                    <p className="num text-[13px] text-ink-2">{formatDateIt(s.data)}</p>
                    <p className="text-[15px] font-medium">{s.descrizione}</p>
                    {s.importo != null ? (
                      <p className="num font-serif text-[22px] font-semibold">{euroInFrase(s.importo)}</p>
                    ) : (
                      <p className="text-[15px] text-ink-2">cifra in arrivo dal commercialista</p>
                    )}
                  </div>

                  {s.pagataIl ? (
                    <p className="num text-[15px] text-ink-2">Pagata il {formatDateIt(s.pagataIl)}</p>
                  ) : (
                    <>
                      {confronto && s.importo != null ? (
                        <div>
                          <p className="text-[15px]">
                            {confronto.basta
                              ? `Nel vaso ci sono ${euroInFrase(saldoVaso)}, ne servono ${euroInFrase(confronto.totale)}.`
                              : confronto.conPrecedenti
                                ? `Con le scadenze prima di questa servono in tutto ${euroInFrase(confronto.totale)}: mancano ${euroInFrase(confronto.mancano)}. Spostali sul conto tasse prima della scadenza.`
                                : `Nel vaso ci sono ${euroInFrase(saldoVaso)}, ne servono ${euroInFrase(confronto.totale)}. Mancano ${euroInFrase(confronto.mancano)}: spostali sul conto tasse prima della scadenza.`}
                          </p>
                          {!confronto.basta ? <PercheScadenza /> : null}
                        </div>
                      ) : null}

                      {aperto ? (
                        <div className="flex flex-col gap-3">
                          <Campo etichetta="Importo (€)">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              value={importo}
                              onChange={(e) => setImporto(e.target.value)}
                              className={CLASSE_CAMPO}
                            />
                          </Campo>
                          <Campo etichetta="Data">
                            <input
                              type="date"
                              value={data}
                              onChange={(e) => setData(e.target.value)}
                              className={CLASSE_CAMPO}
                            />
                          </Campo>
                          {aperto.modo === 'cifra' ? (
                            <button
                              type="button"
                              onClick={() => salva(s)}
                              disabled={!importoValido || !data || lavorando}
                              className={CLASSE_PRIMARIO}
                            >
                              Salva
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => importoValido && data && paga(s, valore, data)}
                              disabled={!importoValido || !data || lavorando}
                              className={CLASSE_PRIMARIO}
                            >
                              Conferma il pagamento
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setModulo(null)}
                            disabled={lavorando}
                            className={CLASSE_NEUTRO}
                          >
                            Annulla
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => apri(s, 'cifra')} className={CLASSE_SECONDARIO}>
                            {s.importo != null ? 'Cambia la cifra' : 'Inserisci la cifra'}
                          </button>
                          <button
                            type="button"
                            onClick={() => apri(s, 'paga')}
                            disabled={lavorando}
                            className={CLASSE_SECONDARIO}
                          >
                            Pagata
                          </button>
                          <button
                            type="button"
                            onClick={() => togli(s)}
                            disabled={lavorando}
                            className={CLASSE_NEUTRO}
                          >
                            Togli
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {eIlPrimoAnno(guidataDal, anno) ? (
        <p className="text-[15px] text-ink-2">
          Gli acconti si calcolano sulle tasse dell&apos;anno prima: quest&apos;anno le cifre possono non coincidere
          con quanto hai messo da parte.
        </p>
      ) : null}
      {errore ? (
        <p role="alert" className="text-[15px] font-medium text-danger">
          {errore}
        </p>
      ) : null}
    </>
  );

  return (
    <>
      <button
        type="button"
        aria-expanded={aperta}
        onClick={() => setAperta((v) => !v)}
        className="flex min-h-11 w-full flex-col items-start justify-center text-left"
      >
        <span className="font-serif text-lg font-semibold">Scadenze dell&apos;anno</span>
        {prossima ? (
          <span className="num text-[15px] text-ink-2">
            Prossima: {prossima.descrizione.split(':')[0]}, {formatDataLunga(prossima.data)}
          </span>
        ) : null}
      </button>
      {aperta ? corpo : null}
    </>
  );
}
