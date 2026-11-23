'use client';

import { useEffect, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { Archive, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCategories, createCategory, updateCategory, archiveCategory } from '@/lib/data/categories';
import { CATEGORY_COLORS, CATEGORY_COLOR_FALLBACK } from '@/lib/categoryColors';
import { CATEGORY_ICONS } from '@/lib/categoryIcons';
import { useEliminaConAnnulla } from '../AnnullaProvider';
import { CoverHeader } from '../CoverHeader';
import { FoglioInferiore } from '../FoglioInferiore';
import { SceltePill } from '../casa/SceltePill';
import { PallinoCategoria } from '../home/PallinoCategoria';
import type { Category, CategoriaTipo } from '@/lib/types';

const TIPI: { chiave: CategoriaTipo; etichetta: string }[] = [
  { chiave: 'expense', etichetta: 'Spesa' },
  { chiave: 'income', etichetta: 'Entrata' },
];

type Ruolo = 'normale' | 'certa' | 'svago';

const RUOLI: { chiave: Ruolo; etichetta: string }[] = [
  { chiave: 'normale', etichetta: 'Normale' },
  { chiave: 'certa', etichetta: 'Spesa certa' },
  { chiave: 'svago', etichetta: 'Svago e acquisti' },
];

const ANELLO = 'ring-2 ring-foreground ring-offset-2 ring-offset-page';

// Le due griglie di scelta, uguali nel foglio di modifica e nel modulo di creazione. Una sola voce è premuta.
function GrigliaColori({ valore, onChange }: { valore: string; onChange: (colore: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">Colore</span>
      <div role="group" aria-label="Colore" className="flex flex-wrap gap-1">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={c.name}
            aria-pressed={valore === c.value}
            onClick={() => onChange(c.value)}
            className="flex h-11 w-11 items-center justify-center rounded-full"
          >
            <span
              aria-hidden="true"
              style={{ backgroundColor: c.value }}
              className={`h-8 w-8 rounded-full ${valore === c.value ? ANELLO : ''}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function GrigliaIcone({
  valore,
  colore,
  onChange,
}: {
  valore: string | null;
  colore: string;
  onChange: (icona: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">Icona (facoltativa)</span>
      <div role="group" aria-label="Icona" className="flex flex-wrap gap-1">
        <button
          type="button"
          aria-pressed={valore === null}
          onClick={() => onChange(null)}
          className="flex h-11 items-center justify-center rounded-full px-1"
        >
          <span
            className={`flex h-8 items-center rounded-full border border-rule px-3 text-[13px] font-semibold ${valore === null ? ANELLO : ''}`}
          >
            Nessuna icona
          </span>
        </button>
        {CATEGORY_ICONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={valore === id}
            onClick={() => onChange(id)}
            className="flex h-11 w-11 items-center justify-center rounded-full"
          >
            <span
              aria-hidden="true"
              style={{ color: colore }}
              className={`flex h-8 w-8 items-center justify-center rounded-full border border-rule ${valore === id ? ANELLO : ''}`}
            >
              <Icon size={18} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const fail = useThrowToBoundary();
  const eliminaConAnnulla = useEliminaConAnnulla();
  // Categorie tolte alla vista in attesa della scrittura vera: Annulla le rimette al loro posto.
  const [nascoste, setNascoste] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  // Il modulo in fondo è solo "Nuova categoria".
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<CategoriaTipo>('expense');
  const [colore, setColore] = useState<string>(CATEGORY_COLORS[0].value);
  const [icona, setIcona] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<CategoriaTipo>('expense');
  // Il foglio di modifica ha i suoi campi.
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editColore, setEditColore] = useState<string>(CATEGORY_COLORS[0].value);
  const [editIcona, setEditIcona] = useState<string | null>(null);
  const [editRuolo, setEditRuolo] = useState<Ruolo>('normale');

  async function refresh() {
    const supabase = createClient();
    setCategories(await getCategories(supabase));
  }

  useEffect(() => {
    refresh().catch(fail);
  }, [fail]);

  function startEdit(c: Category) {
    setEditingCategory(c);
    setEditNome(c.nome);
    setEditColore(c.colore ?? CATEGORY_COLORS[0].value);
    setEditIcona(c.icona ?? null);
    setEditRuolo(c.ruolo ?? 'normale');
  }

  async function handleCreate() {
    if (!nome.trim()) return;
    const supabase = createClient();
    await createCategory(supabase, { nome, tipo, colore, icona });
    setNome('');
    setIcona(null);
    await refresh();
  }

  async function handleUpdate() {
    if (!editingCategory || !editNome.trim()) return;
    const supabase = createClient();
    const conRuolo = editingCategory.tipo === 'expense';
    // L'icona si scrive solo se c'è o se va tolta: prima della migrazione 0016 la colonna non esiste ancora.
    const iconaCambia = editIcona !== null || (editingCategory.icona ?? null) !== null;
    await updateCategory(supabase, editingCategory.id, {
      nome: editNome,
      colore: editColore,
      ...(conRuolo ? { ruolo: editRuolo === 'normale' ? null : editRuolo } : {}),
      ...(iconaCambia ? { icona: editIcona } : {}),
    });
    setEditingCategory(null);
    await refresh();
  }

  function handleArchive(id: string) {
    const cambia = (nascondi: boolean) =>
      setNascoste((prima) => {
        const dopo = new Set(prima);
        if (nascondi) dopo.add(id);
        else dopo.delete(id);
        return dopo;
      });
    eliminaConAnnulla({
      id,
      testo: 'Categoria archiviata.',
      nascondi: () => cambia(true),
      ripristina: () => cambia(false),
      esegui: async () => {
        const supabase = createClient();
        await archiveCategory(supabase, id);
        // Dopo la scrittura niente eccezioni: un nuovo tentativo ripeterebbe un'azione già fatta.
        await refresh().catch(() => {});
      },
    });
  }

  const attive = categories.filter((c) => !c.archiviata && c.tipo === filtroTipo && !nascoste.has(c.id));

  return (
    <>
      <CoverHeader titolo="Categorie" />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-28 pt-3.5">
        <SceltePill
          legenda="Tipo di categorie"
          opzioni={TIPI}
          valore={filtroTipo}
          onChange={(chiave) => setFiltroTipo(chiave as CategoriaTipo)}
        />

        {attive.length > 0 ? (
          <ul className="overflow-hidden rounded-[var(--radius-md)] border border-rule bg-page">
            {attive.map((c) => (
              <li key={c.id} className="flex min-h-14 items-center gap-3 border-b border-rule py-1 pl-4 pr-1 last:border-b-0">
                <PallinoCategoria colore={c.colore ?? CATEGORY_COLOR_FALLBACK} icona={c.icona} />
                <span className="min-w-0 flex-1 break-words text-[15px]">{c.nome}</span>
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  aria-label={`Modifica ${c.nome}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-brand-tint"
                >
                  <Pencil size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => handleArchive(c.id)}
                  aria-label={`Archivia ${c.nome}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-brand-tint hover:text-danger"
                >
                  <Archive size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[var(--radius-md)] border border-rule bg-page p-4 text-center text-[15px] text-ink-2">
            Nessuna categoria ancora: creane una qui sotto.
          </p>
        )}

        <section className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-rule bg-page p-4">
          <h2 className="font-serif text-lg font-semibold">Nuova categoria</h2>

          <SceltePill
            legenda="Tipo della nuova categoria"
            opzioni={TIPI}
            valore={tipo}
            onChange={(chiave) => setTipo(chiave as CategoriaTipo)}
          />

          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome categoria"
            aria-label="Nome categoria"
            className="min-h-12 rounded-[var(--radius-md)] border border-rule bg-page px-3 text-base text-foreground focus-visible:border-brand"
          />

          <GrigliaColori valore={colore} onChange={setColore} />
          <GrigliaIcone valore={icona} colore={colore} onChange={setIcona} />

          <button
            type="button"
            onClick={() => handleCreate().catch(fail)}
            disabled={!nome.trim()}
            className="min-h-12 rounded-[var(--radius-md)] bg-brand py-3 text-base font-semibold text-brand-foreground disabled:opacity-40"
          >
            Aggiungi categoria
          </button>
        </section>
      </main>

      {editingCategory && (
        <FoglioInferiore titolo="Modifica categoria" onClose={() => setEditingCategory(null)}>
          <div className="flex flex-col gap-4 px-5 pb-5">
            <input
              value={editNome}
              onChange={(e) => setEditNome(e.target.value)}
              placeholder="Nome categoria"
              aria-label="Nome categoria"
              className="min-h-12 rounded-[var(--radius-md)] border border-rule bg-page px-3 text-base text-foreground focus-visible:border-brand"
            />

            {editingCategory.tipo === 'expense' ? (
              <SceltePill legenda="Tipo" opzioni={RUOLI} valore={editRuolo} onChange={(chiave) => setEditRuolo(chiave as Ruolo)} />
            ) : null}

            <GrigliaColori valore={editColore} onChange={setEditColore} />
            <GrigliaIcone valore={editIcona} colore={editColore} onChange={setEditIcona} />

            <button
              type="button"
              onClick={() => handleUpdate().catch(fail)}
              disabled={!editNome.trim()}
              className="min-h-12 rounded-[var(--radius-md)] bg-brand py-3 text-base font-semibold text-brand-foreground disabled:opacity-40"
            >
              Salva
            </button>
            <button
              type="button"
              onClick={() => {
                const id = editingCategory.id;
                setEditingCategory(null);
                handleArchive(id);
              }}
              className="min-h-11 rounded-[var(--radius-sm)] text-[15px] font-semibold text-danger"
            >
              Archivia
            </button>
          </div>
        </FoglioInferiore>
      )}
    </>
  );
}
