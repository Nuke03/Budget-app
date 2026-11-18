'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createAccount, updateAccountDetails } from '@/lib/data/accounts';
import { createCategory } from '@/lib/data/categories';
import type { PivaSettingsInput } from '@/lib/data/pivaSettings';
import { computeAliquotaSostitutiva, computePercentualeIncasso } from '@/lib/calculations/piva';
import { DOVE_TROVARLO, PRESET_ENPAP } from '@/lib/calculations/pivaPreset';
import { oggiRomaData, oggiRomaISO } from '@/lib/calculations/casa/oggi';
import { formatNumero } from '@/lib/format';
import { CoverHeader } from '../CoverHeader';
import { SceltePill } from '../casa/SceltePill';
import { CLASSE_CAMPO, CLASSE_PRIMARIO, CLASSE_SECONDARIO } from '../casa/CampiMovimento';
import type { Account, Category, PivaSettings } from '@/lib/types';

type Passo = 1 | 2 | 3 | 4;
type Preset = 'enpap' | 'altro';

const NUOVO = '__nuovo';
const NOME_CONTO_NUOVO = 'Conto tasse';
const NOME_CATEGORIA_NUOVA = 'Fatture';

// La categoria del fatturato che quasi certamente è quella giusta.
function categoriaProbabile(categorie: Category[]): Category | undefined {
  return categorie.find((c) => /fattur|lavoro/i.test(c.nome));
}

function contoProbabile(conti: Account[]): Account | undefined {
  return conti.find((c) => /tasse/i.test(c.nome));
}

export function ImpostazioneGuidata({
  iniziale,
  conti,
  categorie,
  onFatto,
  onAnnulla,
  passoIniziale = 1,
}: {
  iniziale: PivaSettings | null;
  conti: Account[];
  categorie: Category[];
  onFatto: (input: PivaSettingsInput) => Promise<void>;
  onAnnulla?: () => void;
  passoIniziale?: Passo;
}) {
  const categorieEntrate = categorie.filter((c) => !c.archiviata && c.tipo === 'income');

  const [passo, setPasso] = useState<Passo>(passoIniziale);
  const [preset, setPreset] = useState<Preset | null>(
    // Riga vecchia senza preset: si parte da "Altro", così i valori salvati restano intatti.
    iniziale ? (iniziale.preset ?? 'altro') : null
  );
  const [dataApertura, setDataApertura] = useState(iniziale?.dataApertura ?? '');
  const [nonRicordo, setNonRicordo] = useState(!!iniziale && iniziale.dataApertura === null);
  // Id di conto e categoria già creati: se il salvataggio fallisce a metà, il nuovo tentativo li riusa.
  const contoCreato = useRef<string | null>(null);
  const categoriaCreata = useRef<string | null>(null);
  const [coefficiente, setCoefficiente] = useState(iniziale ? String(iniziale.coefficienteRedditivita) : '');
  const [soggettivo, setSoggettivo] = useState(iniziale ? String(iniziale.aliquotaContributoSoggettivo) : '');
  const [integrativo, setIntegrativo] = useState(iniziale ? String(iniziale.aliquotaContributoIntegrativo) : '');
  const [minimale, setMinimale] = useState(iniziale ? String(iniziale.minimaleContributivoAnnuo) : '');
  // Resta vuota finché non la modifichi: così segue la data di apertura.
  const [aliquotaScelta, setAliquotaScelta] = useState<string | null>(
    iniziale?.aliquotaSostitutivaOverride != null ? String(iniziale.aliquotaSostitutivaOverride) : null
  );
  const [conto, setConto] = useState<string>(() => {
    if (iniziale?.contoTasseId && conti.some((c) => c.id === iniziale.contoTasseId)) return iniziale.contoTasseId;
    return contoProbabile(conti)?.id ?? NUOVO;
  });
  const [categoria, setCategoria] = useState<string>(() => {
    if (iniziale?.categoriaFatturatoId && categorieEntrate.some((c) => c.id === iniziale.categoriaFatturatoId)) {
      return iniziale.categoriaFatturatoId;
    }
    return categoriaProbabile(categorieEntrate)?.id ?? NUOVO;
  });
  const [cambiaCategoria, setCambiaCategoria] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const nomeCategoria =
    categoria === NUOVO
      ? `${NOME_CATEGORIA_NUOVA} (la creo io)`
      : (categorieEntrate.find((c) => c.id === categoria)?.nome ?? NOME_CATEGORIA_NUOVA);

  const oggi = oggiRomaData();
  const aliquotaAuto = dataApertura
    ? computeAliquotaSostitutiva(dataApertura, oggi, null)
    : nonRicordo
      ? computeAliquotaSostitutiva(null, oggi, null)
      : null;
  const aliquota = aliquotaScelta ?? (aliquotaAuto !== null ? String(aliquotaAuto) : '');

  const numero = (v: string) => (v.trim() === '' ? NaN : Number(v));
  const valoriValidi = [coefficiente, aliquota, soggettivo, integrativo, minimale].every(
    (v) => !Number.isNaN(numero(v))
  );
  const percentuale = valoriValidi
    ? computePercentualeIncasso(numero(coefficiente), numero(aliquota), numero(soggettivo), numero(integrativo))
    : null;

  function scegliPreset(chiave: string) {
    const p = chiave as Preset;
    setPreset(p);
    if (p === 'enpap') {
      setCoefficiente(String(PRESET_ENPAP.coefficienteRedditivita));
      setSoggettivo(String(PRESET_ENPAP.aliquotaContributoSoggettivo));
      setIntegrativo(String(PRESET_ENPAP.aliquotaContributoIntegrativo));
      setMinimale(String(PRESET_ENPAP.minimaleContributivoAnnuo));
      setAliquotaScelta(null);
    }
  }

  function indietro() {
    if (passo === 1) onAnnulla?.();
    else setPasso((passo - 1) as Passo);
  }

  async function conferma() {
    if (!preset || percentuale === null) return;
    setInCorso(true);
    setErrore(null);
    try {
      const supabase = createClient();

      let contoTasseId = conto;
      if (conto === NUOVO) {
        if (!contoCreato.current) {
          const nuovo = await createAccount(supabase, {
            nome: NOME_CONTO_NUOVO,
            saldoAttuale: 0,
            contaInDisponibile: false,
            targetSaldo: null,
          });
          contoCreato.current = nuovo.id;
        }
        contoTasseId = contoCreato.current;
      } else {
        const scelto = conti.find((c) => c.id === conto);
        if (scelto && scelto.contaInDisponibile) {
          await updateAccountDetails(supabase, scelto.id, {
            nome: scelto.nome,
            contaInDisponibile: false,
            targetSaldo: scelto.targetSaldo,
          });
        }
      }

      let categoriaFatturatoId = categoria;
      if (categoria === NUOVO) {
        if (!categoriaCreata.current) {
          const nuova = await createCategory(supabase, { nome: NOME_CATEGORIA_NUOVA, tipo: 'income', colore: null });
          categoriaCreata.current = nuova.id;
        }
        categoriaFatturatoId = categoriaCreata.current;
      }

      await onFatto({
        attivo: true,
        dataApertura: dataApertura || null,
        categoriaFatturatoId,
        coefficienteRedditivita: Number(coefficiente),
        aliquotaSostitutivaOverride: aliquotaAuto !== null && Number(aliquota) === aliquotaAuto ? null : Number(aliquota),
        aliquotaContributoSoggettivo: Number(soggettivo),
        aliquotaContributoIntegrativo: Number(integrativo),
        minimaleContributivoAnnuo: Number(minimale),
        contributiVersatiAnnoPrecedente: iniziale?.contributiVersatiAnnoPrecedente ?? 0,
        contoTasseId,
        preset,
        // Riattivando dopo una disattivazione si riparte da oggi: gli incassi di prima non generano quote.
        guidataDal: iniziale && iniziale.attivo && iniziale.guidataDal ? iniziale.guidataDal : oggiRomaISO(),
        stipendioMensile: iniziale?.stipendioMensile ?? null,
        stipendioRivistoIl: iniziale?.stipendioRivistoIl ?? null,
        incassoMeseMagro: iniziale?.incassoMeseMagro ?? null,
      });
    } catch {
      setErrore('Non è riuscito. Riprova.');
      setInCorso(false);
    }
  }

  const puoAndare =
    passo === 1 ? preset !== null : passo === 2 ? aliquotaAuto !== null : true;

  const campi: { id: string; etichetta: string; chiave: keyof typeof DOVE_TROVARLO; valore: string; set: (v: string) => void }[] = [
    { id: 'g-coefficiente', etichetta: 'Coefficiente di redditività (%)', chiave: 'coefficiente', valore: coefficiente, set: setCoefficiente },
    { id: 'g-aliquota', etichetta: 'Aliquota sostitutiva (%)', chiave: 'aliquota', valore: aliquota, set: setAliquotaScelta },
    { id: 'g-soggettivo', etichetta: 'Contributo soggettivo (%)', chiave: 'soggettivo', valore: soggettivo, set: setSoggettivo },
    { id: 'g-integrativo', etichetta: 'Contributo integrativo (%)', chiave: 'integrativo', valore: integrativo, set: setIntegrativo },
    { id: 'g-minimale', etichetta: 'Minimale contributivo annuo (€)', chiave: 'minimale', valore: minimale, set: setMinimale },
  ];

  return (
    <>
      <CoverHeader titolo="P.IVA" lato={`Passo ${passo} di 4`} />
      <main className="mx-auto flex max-w-md flex-col gap-5 px-3 pb-28 pt-5">
        {passo === 1 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-serif text-[22px] font-semibold">Che lavoro fai?</h2>
            <SceltePill
              legenda="Che lavoro fai?"
              opzioni={[
                { chiave: 'enpap', etichetta: 'Psicologa, ENPAP' },
                { chiave: 'altro', etichetta: 'Altro' },
              ]}
              valore={preset}
              onChange={scegliPreset}
            />
            <p className="text-[13px] text-ink-2">
              {preset === 'enpap'
                ? 'Ti proponiamo i valori della tua cassa: li rivedi all’ultimo passo.'
                : preset === 'altro'
                  ? 'Ti chiederemo i valori della tua cassa all’ultimo passo.'
                  : 'Serve a preparare i valori da cui calcolare le tasse.'}
            </p>
          </section>
        )}

        {passo === 2 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-serif text-[22px] font-semibold">
              <label htmlFor="g-data">Quando hai aperto la P.IVA?</label>
            </h2>
            <input
              id="g-data"
              type="date"
              value={dataApertura}
              onChange={(e) => {
                setDataApertura(e.target.value);
                if (e.target.value) setNonRicordo(false);
                setAliquotaScelta(null);
              }}
              className={CLASSE_CAMPO}
            />
            <button
              type="button"
              aria-pressed={nonRicordo && !dataApertura}
              onClick={() => {
                setDataApertura('');
                setNonRicordo(true);
                setAliquotaScelta(null);
              }}
              className={CLASSE_SECONDARIO}
            >
              Non ricordo
            </button>
            {aliquotaAuto !== null && (
              <div className="flex flex-col gap-1 border-t border-rule pt-3">
                <p className="text-[17px] font-semibold">
                  {!dataApertura
                    ? 'Senza la data: aliquota 15%'
                    : aliquotaAuto === 5
                      ? 'Primi 5 anni: aliquota 5%'
                      : 'Dopo i primi 5 anni: aliquota 15%'}
                </p>
                <p className="text-[13px] text-ink-2">
                  {!dataApertura
                    ? 'Uso il 15%, la più prudente. Controlla la data di apertura con il commercialista.'
                    : 'L’aliquota sostitutiva è la tassa fissa del forfettario: 5% per i primi 5 anni, poi 15%.'}
                </p>
              </div>
            )}
          </section>
        )}

        {passo === 3 && (
          <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <h2 className="font-serif text-[22px] font-semibold">Su quale conto metti da parte le tasse?</h2>
              <SceltePill
                legenda="Conto per le tasse"
                opzioni={[...conti.map((c) => ({ chiave: c.id, etichetta: c.nome })), { chiave: NUOVO, etichetta: 'Creane uno' }]}
                valore={conto}
                onChange={setConto}
              />
              {conto === NUOVO ? <p className="text-[13px] text-ink-2">{`Creiamo “${NOME_CONTO_NUOVO}”.`}</p> : null}
              <p className="text-[13px] text-ink-2">Lo tolgo dal disponibile: sono soldi delle tasse.</p>
            </div>
          </section>
        )}

        {passo === 4 && (
          <section className="flex flex-col gap-5">
            <h2 className="font-serif text-[22px] font-semibold">Controlla i valori</h2>
            <div className="flex flex-col">
              {campi.map((c) => (
                <div key={c.id} className="flex flex-col gap-1.5 border-t border-rule py-3">
                  <label htmlFor={c.id} className="text-[15px] font-semibold">
                    {c.etichetta}
                  </label>
                  <input
                    id={c.id}
                    type="number"
                    inputMode="decimal"
                    value={c.valore}
                    onChange={(e) => c.set(e.target.value)}
                    className={`${CLASSE_CAMPO} num`}
                  />
                  <p className="text-[13px] text-ink-2">{DOVE_TROVARLO[c.chiave]}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 border-t border-rule py-3">
              {cambiaCategoria ? (
                <>
                  <label htmlFor="g-categoria" className="text-[15px] font-semibold">
                    Dove registri i tuoi incassi?
                  </label>
                  <select
                    id="g-categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className={CLASSE_CAMPO}
                  >
                    {categorieEntrate.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                    <option value={NUOVO}>Creane una: “{NOME_CATEGORIA_NUOVA}”</option>
                  </select>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px]">
                    <span className="font-semibold">Incassi registrati in:</span> {nomeCategoria}
                  </p>
                  <button type="button" onClick={() => setCambiaCategoria(true)} className={CLASSE_SECONDARIO}>
                    Cambia
                  </button>
                </div>
              )}
            </div>
            {percentuale !== null && (
              <p className="num border-t border-rule pt-4 font-serif text-[22px] font-semibold">
                Metterai da parte il {formatNumero(percentuale)}% di ogni incasso.
              </p>
            )}
          </section>
        )}

        {errore && (
          <p role="alert" className="text-[13px] text-danger">
            {errore}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {passo < 4 ? (
            <button type="button" disabled={!puoAndare} onClick={() => setPasso((passo + 1) as Passo)} className={CLASSE_PRIMARIO}>
              Avanti
            </button>
          ) : (
            <button
              type="button"
              disabled={!valoriValidi || inCorso}
              onClick={conferma}
              className={CLASSE_PRIMARIO}
            >
              Confermo
            </button>
          )}
          {(passo > 1 || onAnnulla) && (
            <button type="button" onClick={indietro} disabled={inCorso} className={CLASSE_SECONDARIO}>
              {passo === 1 ? 'Annulla' : 'Indietro'}
            </button>
          )}
        </div>
      </main>
    </>
  );
}
