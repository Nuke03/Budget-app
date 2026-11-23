'use client';

import { useEffect, useState } from 'react';
import { useThrowToBoundary } from '@/lib/useThrowToBoundary';
import { Archive, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCategories, createCategory, updateCategory, archiveCategory } from '@/lib/data/categories';
import { CATEGORY_COLORS, CATEGORY_COLOR_FALLBACK } from '@/lib/categoryColors';
import { useEliminaConAnnulla } from '../AnnullaProvider';
import { CoverHeader } from '../CoverHeader';
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

export default function CategoriesPage() {
  const fail = useThrowToBoundary();
  const eliminaConAnnulla = useEliminaConAnnulla();
  // Categorie tolte alla vista in attesa della scrittura vera: Annulla le rimette al loro posto.
  const [nascoste, setNascoste] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<CategoriaTipo>('expense');
  const [colore, setColore] = useState<string>(CATEGORY_COLORS[0].value);
  const [filtroTipo, setFiltroTipo] = useState<CategoriaTipo>('expense');
  const [ruolo, setRuolo] = useState<Ruolo>('normale');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  async function refresh() {
    const supabase = createClient();
    setCategories(await getCategories(supabase));
  }

  useEffect(() => {
    refresh().catch(fail);
  }, [fail]);

  function startEdit(c: Category) {
    setEditingCategory(c);
    setNome(c.nome);
    setColore(c.colore ?? CATEGORY_COLORS[0].value);
    setRuolo(c.ruolo ?? 'normale');
  }

  function cancelEdit() {
    setEditingCategory(null);
    setRuolo('normale');
    setNome('');
    setColore(CATEGORY_COLORS[0].value);
  }

  async function handleCreate() {
    if (!nome.trim()) return;
    const supabase = createClient();
    await createCategory(supabase, { nome, tipo, colore });
    setNome('');
    await refresh();
  }

  async function handleUpdate() {
    if (!editingCategory || !nome.trim()) return;
    const supabase = createClient();
    const conRuolo = editingCategory.tipo === 'expense';
    await updateCategory(supabase, editingCategory.id, {
      nome,
      colore,
      ...(conRuolo ? { ruolo: ruolo === 'normale' ? null : ruolo } : {}),
    });
    cancelEdit();
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
                <PallinoCategoria colore={c.colore ?? CATEGORY_COLOR_FALLBACK} />
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
          <h2 className="font-serif text-lg font-semibold">
            {editingCategory ? 'Modifica categoria' : 'Nuova categoria'}
          </h2>

          {!editingCategory && (
            <SceltePill
              legenda="Tipo della nuova categoria"
              opzioni={TIPI}
              valore={tipo}
              onChange={(chiave) => setTipo(chiave as CategoriaTipo)}
            />
          )}

          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome categoria"
            aria-label="Nome categoria"
            className="min-h-12 rounded-[var(--radius-md)] border border-rule bg-page px-3 text-base text-foreground focus-visible:border-brand"
          />

          {editingCategory && editingCategory.tipo === 'expense' ? (
            <SceltePill legenda="Tipo" opzioni={RUOLI} valore={ruolo} onChange={(chiave) => setRuolo(chiave as Ruolo)} />
          ) : null}

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">Colore</span>
            <div className="flex flex-wrap gap-1">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={c.name}
                  aria-pressed={colore === c.value}
                  onClick={() => setColore(c.value)}
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                >
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: c.value }}
                    className={`h-8 w-8 rounded-full ${colore === c.value ? 'ring-2 ring-foreground ring-offset-2 ring-offset-page' : ''}`}
                  />
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={editingCategory ? handleUpdate : handleCreate}
            disabled={!nome.trim()}
            className="min-h-12 rounded-[var(--radius-md)] bg-brand py-3 text-base font-semibold text-brand-foreground disabled:opacity-40"
          >
            {editingCategory ? 'Salva modifiche' : 'Aggiungi categoria'}
          </button>

          {editingCategory && (
            <button
              type="button"
              onClick={cancelEdit}
              className="min-h-11 rounded-[var(--radius-md)] bg-brand-tint py-3 text-[15px] font-semibold text-foreground"
            >
              Annulla
            </button>
          )}
        </section>
      </main>
    </>
  );
}
