'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { Account, BudgetGoal, Category, Transaction, TransactionTipo } from '@/lib/types';
import { testoSu } from '@/lib/categoryColors';
import { obiettivoDaCategoria } from '@/lib/calculations/casa/preselezioneObiettivo';
import { indovinaCategoria } from '@/lib/calculations/supporto/indovinaCategoria';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';

interface SubmitPayload {
  tipo: TransactionTipo;
  importo: number;
  categoriaId: string | null;
  accountId: string | null;
  goalId: string | null;
  descrizione: string;
}

export interface AddTransactionFormValues {
  tipo: TransactionTipo;
  importo: number;
  categoriaId: string | null;
  accountId: string | null;
  goalId?: string | null;
  descrizione: string;
}

interface NuovoGoalPayload {
  nome: string;
  importoTarget: number;
  categoriaId: string | null;
}

const CATEGORY_FALLBACK_COLOR = 'var(--cat-slate)';

// Riferimento stabile: un default parameter `= []` creerebbe un nuovo array
// ad ogni render quando il chiamante non passa `goals`, facendo scattare
// l'effect di sincronizzazione qui sotto ad ogni render (loop infinito).
const NESSUN_GOAL: BudgetGoal[] = [];
const NESSUN_ID: string[] = [];

type StoricoRiga = Pick<Transaction, 'descrizione' | 'categoriaId' | 'data' | 'tipo'>;
const NESSUNO_STORICO: StoricoRiga[] = [];

type Pezzo = 'tipo' | 'spazio' | 'conto' | 'categoria';

// Lo spazio (Personale o Casa) lo decide chi apre il modulo: qui si mostra e, se ce n'è più d'uno, si cambia.
export interface SpazioScelta {
  etichetta: string;
  opzioni?: { valore: string; etichetta: string }[];
  onScegli?: (valore: string) => void;
}

const CHIP_BASE =
  'min-h-11 shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors duration-150';
const CHIP_ATTIVO = 'border-brand bg-brand text-brand-foreground';
const CHIP_SPENTO = 'border-rule bg-surface text-foreground';

export function AddTransactionForm({
  categories,
  accounts,
  goals = NESSUN_GOAL,
  initial,
  submitLabel = 'Salva',
  onCancel,
  onCreateGoal,
  onSubmit,
  contoEtichetta = 'Conto',
  nascondiGestisciCategorie = false,
  obiettivoEtichetta = 'Obiettivo (opzionale)',
  nota,
  idContiSoloSpesa = NESSUN_ID,
  contoDaScegliere = false,
  preselezionaObiettivo = false,
  veloce = false,
  storico = NESSUNO_STORICO,
  oggi = oggiRomaISO(),
  contoIniziale,
  spazio,
  importoIniziale = '',
  onImportoChange,
}: {
  categories: Category[];
  accounts: Account[];
  goals?: BudgetGoal[];
  initial?: AddTransactionFormValues | null;
  submitLabel?: string;
  onCancel?: () => void;
  onCreateGoal?: (payload: NuovoGoalPayload) => Promise<BudgetGoal>;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  contoEtichetta?: string;
  nascondiGestisciCategorie?: boolean;
  obiettivoEtichetta?: string;
  nota?: string;
  idContiSoloSpesa?: string[];
  // Nessun conto preselezionato: chi salva deve sceglierlo (es. "Chi ha pagato" senza conto comune).
  contoDaScegliere?: boolean;
  // Propone l'obiettivo aperto della categoria scelta; è solo un default, chi salva può cambiarlo.
  preselezionaObiettivo?: boolean;
  // Aggiunta veloce: basta l'importo, il resto parte da un valore e si cambia toccando il riepilogo.
  veloce?: boolean;
  // Le spese passate, da cui indovinare la categoria (solo in aggiunta veloce).
  storico?: StoricoRiga[];
  oggi?: string;
  // Aggiunta veloce: conto dell'ultima volta. undefined = mai usato (parte il primo conto); null o id sparito = nessun conto.
  contoIniziale?: string | null;
  spazio?: SpazioScelta;
  importoIniziale?: string;
  onImportoChange?: (importo: string) => void;
}) {
  const [tipo, setTipo] = useState<TransactionTipo>(initial?.tipo ?? 'expense');
  const [importo, setImporto] = useState(initial ? String(initial.importo) : importoIniziale);
  const [descrizione, setDescrizione] = useState(initial?.descrizione ?? '');
  const [categoriaId, setCategoriaId] = useState<string | null>(() => {
    if (initial?.categoriaId != null) return initial.categoriaId;
    if (veloce && !initial) {
      const guess = indovinaCategoria('', storico, oggi);
      return categories.some((c) => c.id === guess && !c.archiviata && c.tipo === 'expense') ? guess : null;
    }
    return categories[0]?.id ?? null;
  });
  const [categoriaToccata, setCategoriaToccata] = useState(initial != null);
  const [accountId, setAccountId] = useState<string | null>(() => {
    if (initial?.accountId != null) return initial.accountId;
    if (veloce && contoIniziale !== undefined) {
      return contoIniziale !== null && accounts.some((a) => a.id === contoIniziale) ? contoIniziale : null;
    }
    return contoDaScegliere ? null : (accounts[0]?.id ?? null);
  });
  const [pezzoAperto, setPezzoAperto] = useState<Pezzo | null>(null);
  const [notaAperta, setNotaAperta] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(initial?.goalId ?? null);
  // Diventa vero al primo tocco manuale sull'obiettivo: da lì in poi la preselezione non lo cambia più.
  // In modifica (initial) il valore salvato vale come scelta: non viene sovrascritto.
  const [goalToccato, setGoalToccato] = useState(initial != null);
  const [goalsDisponibili, setGoalsDisponibili] = useState<BudgetGoal[]>(goals);
  const [isCreatingGoal, setIsCreatingGoal] = useState(false);
  const [nuovoGoalNome, setNuovoGoalNome] = useState('');
  const [nuovoGoalImporto, setNuovoGoalImporto] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // I conti "solo spesa" (es. un conto di casa che non riceve entrate) non compaiono per le entrate.
  const contiVisibili = accounts.filter((a) => tipo === 'expense' || !idContiSoloSpesa.includes(a.id));

  const categorieDisponibili = categories.filter((c) => !c.archiviata && c.tipo === tipo);

  useEffect(() => {
    if (veloce) return;
    if (categoriaId !== null && categorieDisponibili.some((c) => c.id === categoriaId)) {
      return;
    }
    setCategoriaId(categorieDisponibili[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, categories]);

  // Aggiunta veloce: la categoria segue la descrizione finché non la scegli a mano.
  useEffect(() => {
    if (!veloce || categoriaToccata) return;
    const guess = tipo === 'expense' ? indovinaCategoria(descrizione, storico, oggi) : null;
    setCategoriaId(categorieDisponibili.some((c) => c.id === guess) ? guess : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descrizione, tipo, storico, categories, categoriaToccata]);

  // In veloce una categoria scelta a mano che non c'è più (es. cambio tipo) torna "Senza categoria".
  useEffect(() => {
    if (!veloce || !categoriaToccata) return;
    if (categoriaId !== null && !categorieDisponibili.some((c) => c.id === categoriaId)) {
      setCategoriaId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, categories]);

  useEffect(() => {
    if (accountId !== null && contiVisibili.some((a) => a.id === accountId)) {
      return;
    }
    // In veloce "nessun conto" (contanti) è una scelta valida: non si rimette il primo.
    if (veloce && accountId === null) return;
    setAccountId(contoDaScegliere || veloce ? null : (contiVisibili[0]?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, tipo, idContiSoloSpesa]);

  useEffect(() => {
    setGoalsDisponibili(goals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals]);

  // Collegare un obiettivo ha senso solo per una spesa: gli obiettivi
  // tracciano quanto è già stato speso su di loro (vedi getSpecoCollegato),
  // non un'entrata.
  useEffect(() => {
    if (tipo !== 'expense') {
      setGoalId(null);
      setIsCreatingGoal(false);
    }
  }, [tipo]);

  // Finché l'utente non ha scelto a mano, l'obiettivo è quello aperto della categoria (se ce n'è uno solo).
  const goalIdEffettivo =
    preselezionaObiettivo && !goalToccato
      ? tipo === 'expense'
        ? obiettivoDaCategoria(goalsDisponibili, categoriaId)
        : null
      : goalId;

  const importoNumerico = Number(importo);
  const contoMancante = contoDaScegliere && contiVisibili.length > 0 && accountId === null;
  const isValid = veloce
    ? importo.trim() !== '' && !Number.isNaN(importoNumerico) && importoNumerico > 0 && !contoMancante && !inCorso
    : importo.trim() !== '' && !Number.isNaN(importoNumerico) && descrizione.trim() !== '' && !contoMancante;

  const nuovoGoalImportoNumerico = Number(nuovoGoalImporto);
  const isNuovoGoalValido =
    !!onCreateGoal &&
    nuovoGoalNome.trim() !== '' &&
    nuovoGoalImporto.trim() !== '' &&
    !Number.isNaN(nuovoGoalImportoNumerico);

  async function handleCreateGoal() {
    if (!onCreateGoal || !isNuovoGoalValido) return;

    const nuovoGoal = await onCreateGoal({
      nome: nuovoGoalNome,
      importoTarget: nuovoGoalImportoNumerico,
      categoriaId,
    });

    setGoalsDisponibili((prev) => [...prev, nuovoGoal]);
    setGoalToccato(true);
    setGoalId(nuovoGoal.id);
    setIsCreatingGoal(false);
    setNuovoGoalNome('');
    setNuovoGoalImporto('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const payload: SubmitPayload = {
      tipo,
      importo: importoNumerico,
      categoriaId,
      accountId,
      goalId: tipo === 'expense' ? goalIdEffettivo : null,
      descrizione,
    };

    if (veloce) {
      // Il modulo resta com'è: se il salvataggio fallisce non si perde niente, se riesce chi lo apre lo chiude.
      setStatus('idle');
      setInCorso(true);
      onSubmit(payload)
        .catch(() => setStatus('error'))
        .finally(() => setInCorso(false));
      return;
    }

    setStatus('saved');
    setImporto('');
    setDescrizione('');

    onSubmit(payload).catch(() => setStatus('error'));
  }

  function cambiaImporto(valore: string) {
    setImporto(valore);
    onImportoChange?.(valore);
  }

  function apriPezzo(p: Pezzo) {
    setPezzoAperto((corrente) => (corrente === p ? null : p));
  }

  if (veloce) {
    const categoriaScelta = categorieDisponibili.find((c) => c.id === categoriaId) ?? null;
    const contoScelto = contiVisibili.find((a) => a.id === accountId) ?? null;
    const riepilogo: { id: Pezzo; testo: string; attivo: boolean }[] = [
      { id: 'tipo', testo: tipo === 'expense' ? 'Spesa' : 'Entrata', attivo: true },
      ...(spazio ? [{ id: 'spazio' as const, testo: spazio.etichetta, attivo: !!spazio.opzioni?.length }] : []),
      {
        id: 'conto',
        testo: contoScelto ? contoScelto.nome : contoMancante ? 'Scegli chi ha pagato' : 'Contanti',
        attivo: contiVisibili.length > 0,
      },
      {
        id: 'categoria',
        testo: categoriaScelta ? categoriaScelta.nome : 'Senza categoria',
        attivo: categorieDisponibili.length > 0,
      },
    ];

    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 pb-5">
        {nota && <p className="text-xs text-ink-2">{nota}</p>}

        <div className="flex items-baseline justify-center gap-1.5 pt-2">
          <input
            aria-label="Importo"
            type="number"
            inputMode="decimal"
            placeholder="0"
            step="any"
            autoFocus
            value={importo}
            onChange={(e) => cambiaImporto(e.target.value)}
            className="num w-44 bg-transparent text-center font-serif text-6xl font-bold text-foreground outline-none placeholder:text-ink-2/40"
          />
          <span className="font-serif text-3xl font-semibold text-ink-2">€</span>
        </div>

        <div className="flex flex-wrap items-center justify-center text-sm text-ink-2">
          {riepilogo.map((r, i) => (
            <span key={r.id} className="flex items-center">
              {i > 0 && <span aria-hidden="true">·</span>}
              {r.attivo ? (
                <button
                  type="button"
                  aria-expanded={pezzoAperto === r.id}
                  onClick={() => apriPezzo(r.id)}
                  className={`min-h-11 rounded-[var(--radius-sm)] px-2.5 font-semibold underline decoration-rule decoration-2 underline-offset-4 ${
                    pezzoAperto === r.id ? 'text-brand' : 'text-foreground'
                  }`}
                >
                  {r.testo}
                </button>
              ) : (
                <span className="px-2.5 font-semibold text-foreground">{r.testo}</span>
              )}
            </span>
          ))}
        </div>

        {pezzoAperto === 'tipo' && (
          <div role="group" aria-label="Tipo" className="flex flex-wrap justify-center gap-2">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tipo === t}
                onClick={() => {
                  setTipo(t);
                  setPezzoAperto(null);
                }}
                className={`${CHIP_BASE} ${tipo === t ? CHIP_ATTIVO : CHIP_SPENTO}`}
              >
                {t === 'expense' ? 'Spesa' : 'Entrata'}
              </button>
            ))}
          </div>
        )}

        {pezzoAperto === 'spazio' && spazio?.opzioni && (
          <div role="group" aria-label="Spazio" className="flex flex-wrap justify-center gap-2">
            {spazio.opzioni.map((o) => (
              <button
                key={o.valore}
                type="button"
                aria-pressed={spazio.etichetta === o.etichetta}
                onClick={() => {
                  spazio.onScegli?.(o.valore);
                  setPezzoAperto(null);
                }}
                className={`${CHIP_BASE} ${spazio.etichetta === o.etichetta ? CHIP_ATTIVO : CHIP_SPENTO}`}
              >
                {o.etichetta}
              </button>
            ))}
          </div>
        )}

        {pezzoAperto === 'conto' && contiVisibili.length > 0 && (
          <div role="group" aria-label={contoEtichetta} className="flex flex-col gap-1.5 text-sm text-ink-2">
            {contoMancante && <span className="text-center text-xs">Scegline uno per salvare</span>}
            <div className="flex flex-wrap justify-center gap-2">
              {!contoDaScegliere && (
                <button
                  type="button"
                  aria-pressed={accountId === null}
                  onClick={() => {
                    setAccountId(null);
                    setPezzoAperto(null);
                  }}
                  className={`${CHIP_BASE} ${accountId === null ? CHIP_ATTIVO : CHIP_SPENTO}`}
                >
                  Contanti
                </button>
              )}
              {contiVisibili.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={accountId === a.id}
                  onClick={() => {
                    setAccountId(a.id);
                    setPezzoAperto(null);
                  }}
                  className={`${CHIP_BASE} ${accountId === a.id ? CHIP_ATTIVO : CHIP_SPENTO}`}
                >
                  {a.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {pezzoAperto === 'categoria' && categorieDisponibili.length > 0 && (
          <div role="group" aria-label="Categoria" className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              aria-pressed={categoriaId === null}
              onClick={() => {
                setCategoriaToccata(true);
                setCategoriaId(null);
                setPezzoAperto(null);
              }}
              className={`${CHIP_BASE} ${categoriaId === null ? CHIP_ATTIVO : CHIP_SPENTO}`}
            >
              Senza categoria
            </button>
            {categorieDisponibili.map((c) => {
              const color = c.colore ?? CATEGORY_FALLBACK_COLOR;
              const isSelected = categoriaId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setCategoriaToccata(true);
                    setCategoriaId(c.id);
                    setPezzoAperto(null);
                  }}
                  style={
                    isSelected
                      ? { backgroundColor: color, borderColor: color, color: testoSu(color) }
                      : { borderColor: color, color: 'var(--foreground)' }
                  }
                  className={`${CHIP_BASE} ${isSelected ? '' : 'bg-surface'}`}
                >
                  {c.nome}
                </button>
              );
            })}
          </div>
        )}

        {!notaAperta ? (
          <button
            type="button"
            onClick={() => setNotaAperta(true)}
            className="min-h-11 self-center rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-ink-2 underline decoration-rule decoration-2 underline-offset-4"
          >
            Aggiungi una nota
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
              Descrizione
              <input
                aria-label="Descrizione"
                type="text"
                placeholder="Es. Spesa al supermercato"
                value={descrizione}
                onChange={(e) => setDescrizione(e.target.value)}
                className="min-h-11 rounded-[var(--radius-md)] border border-rule bg-surface px-4 py-3 text-base text-foreground outline-none focus-visible:border-brand"
              />
            </label>

            {tipo === 'expense' && goalsDisponibili.length > 0 && (
              <div className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
                {obiettivoEtichetta}
                <div className="flex flex-wrap gap-2">
                  {goalsDisponibili.map((g) => {
                    const isSelected = goalIdEffettivo === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setGoalToccato(true);
                          setGoalId(isSelected ? null : g.id);
                        }}
                        className={`${CHIP_BASE} ${isSelected ? CHIP_ATTIVO : CHIP_SPENTO}`}
                      >
                        {g.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid}
          className="min-h-12 rounded-[var(--radius-md)] bg-brand py-3.5 text-base font-semibold text-brand-foreground disabled:opacity-40"
        >
          {submitLabel}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-[var(--radius-md)] bg-surface-muted py-3 text-sm font-semibold text-foreground"
          >
            Annulla
          </button>
        )}

        {status === 'error' && (
          <p role="alert" className="flex items-center justify-center gap-2 text-sm font-medium text-danger">
            <AlertCircle size={18} />
            Salvataggio fallito, controlla la connessione e riprova.
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-5 pb-5">
      {nota && <p className="text-xs text-muted">{nota}</p>}

      <div className="flex gap-1.5 rounded-full bg-surface-muted p-1">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors duration-150 ${
              tipo === t ? 'bg-surface text-foreground shadow-[var(--shadow-card)]' : 'text-muted'
            }`}
          >
            {t === 'expense' ? 'Spesa' : 'Entrata'}
          </button>
        ))}
      </div>

      <label className="flex flex-col items-center gap-1 py-2 text-center">
        <span className="text-xs font-medium text-muted">Importo</span>
        <div className="flex items-baseline gap-1">
          <input
            aria-label="Importo"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            className="w-40 bg-transparent text-center text-5xl font-bold tabular-nums text-foreground outline-none placeholder:text-muted/40"
          />
          <span className="text-2xl font-bold text-muted">€</span>
        </div>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
        Descrizione
        <input
          aria-label="Descrizione"
          type="text"
          placeholder="Es. Spesa al supermercato"
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          className="rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base text-foreground outline-none focus-visible:border-brand"
        />
      </label>

      {categorieDisponibili.length > 0 && (
        <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Categoria
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {categorieDisponibili.map((c) => {
              const color = c.colore ?? CATEGORY_FALLBACK_COLOR;
              const isSelected = categoriaId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoriaId(c.id)}
                  style={
                    isSelected
                      ? { backgroundColor: color, borderColor: color, color: testoSu(color) }
                      : { borderColor: color, color }
                  }
                  className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                    isSelected ? '' : 'bg-surface'
                  }`}
                >
                  {c.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!nascondiGestisciCategorie && (
        <Link href="/categories" className="-mt-2 self-start text-xs font-semibold text-brand-dark">
          Gestisci categorie
        </Link>
      )}

      {contiVisibili.length > 0 && (
        <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          {contoEtichetta}
          {contoMancante && <span className="text-xs font-normal">Scegline uno per salvare</span>}
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {contiVisibili.map((a) => {
              const isSelected = accountId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccountId(a.id)}
                  className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                    isSelected
                      ? 'border-brand bg-brand text-brand-foreground'
                      : 'border-black/10 bg-surface text-foreground'
                  }`}
                >
                  {a.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tipo === 'expense' && (goalsDisponibili.length > 0 || onCreateGoal) && (
        <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          {obiettivoEtichetta}
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {goalsDisponibili.map((g) => {
              const isSelected = goalIdEffettivo === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setGoalToccato(true);
                    setGoalId(isSelected ? null : g.id);
                  }}
                  className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                    isSelected
                      ? 'border-brand bg-brand text-brand-foreground'
                      : 'border-black/10 bg-surface text-foreground'
                  }`}
                >
                  {g.nome}
                </button>
              );
            })}
            {onCreateGoal && (
              <button
                type="button"
                onClick={() => setIsCreatingGoal((v) => !v)}
                className="shrink-0 rounded-full border-2 border-dashed border-black/20 bg-surface px-4 py-2 text-sm font-semibold text-muted"
              >
                + Nuovo obiettivo
              </button>
            )}
          </div>

          {isCreatingGoal && (
            <div className="mt-2 flex flex-col gap-2 rounded-[var(--radius-md)] bg-surface-muted p-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Nome
                <input
                  aria-label="Nome nuovo obiettivo"
                  value={nuovoGoalNome}
                  onChange={(e) => setNuovoGoalNome(e.target.value)}
                  placeholder="Es. Assicurazione auto"
                  className="rounded-[var(--radius-sm)] border border-black/5 bg-surface px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Importo target
                <input
                  aria-label="Importo nuovo obiettivo"
                  type="number"
                  inputMode="decimal"
                  value={nuovoGoalImporto}
                  onChange={(e) => setNuovoGoalImporto(e.target.value)}
                  placeholder="0"
                  className="rounded-[var(--radius-sm)] border border-black/5 bg-surface px-3 py-2 text-sm outline-none"
                />
              </label>
              <button
                type="button"
                disabled={!isNuovoGoalValido}
                onClick={handleCreateGoal}
                className="rounded-[var(--radius-sm)] bg-brand py-2 text-sm font-semibold text-brand-foreground disabled:opacity-40"
              >
                Crea e collega
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid}
        className="rounded-[var(--radius-md)] bg-brand py-3.5 text-base font-semibold text-brand-foreground shadow-[var(--shadow-fab)] disabled:opacity-40 disabled:shadow-none"
      >
        {submitLabel}
      </button>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[var(--radius-md)] bg-surface-muted py-3 text-sm font-semibold text-foreground"
        >
          Annulla
        </button>
      )}

      {status === 'saved' && (
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-brand-dark">
          <CheckCircle2 size={18} />
          <span>Salvata ✓</span>
        </p>
      )}
      {status === 'error' && (
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-danger">
          <AlertCircle size={18} />
          Salvataggio fallito, controlla la connessione e riprova.
        </p>
      )}
    </form>
  );
}
