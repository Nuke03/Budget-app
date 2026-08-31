'use client';

import { useEffect, useState } from 'react';
import { Archive, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCategories, createCategory, updateCategory, archiveCategory } from '@/lib/data/categories';
import { CATEGORY_COLORS, CATEGORY_COLOR_FALLBACK } from '@/lib/categoryColors';
import type { Category, CategoriaTipo } from '@/lib/types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<CategoriaTipo>('expense');
  const [colore, setColore] = useState<string>(CATEGORY_COLORS[0].value);
  const [filtroTipo, setFiltroTipo] = useState<CategoriaTipo>('expense');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  async function refresh() {
    const supabase = createClient();
    setCategories(await getCategories(supabase));
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(c: Category) {
    setEditingCategory(c);
    setNome(c.nome);
    setColore(c.colore ?? CATEGORY_COLORS[0].value);
  }

  function cancelEdit() {
    setEditingCategory(null);
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
    await updateCategory(supabase, editingCategory.id, { nome, colore });
    cancelEdit();
    await refresh();
  }

  async function handleArchive(id: string) {
    const supabase = createClient();
    await archiveCategory(supabase, id);
    await refresh();
  }

  const attive = categories.filter((c) => !c.archiviata && c.tipo === filtroTipo);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <h1 className="text-2xl font-bold">Categorie</h1>

      <div className="flex gap-1.5 rounded-full bg-surface-muted p-1">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFiltroTipo(t)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors duration-150 ${
              filtroTipo === t ? 'bg-surface text-foreground shadow-[var(--shadow-card)]' : 'text-muted'
            }`}
          >
            {t === 'expense' ? 'Spesa' : 'Entrata'}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {attive.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-surface p-3 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center gap-3">
              <span
                className="h-8 w-8 shrink-0 rounded-full"
                style={{ backgroundColor: c.colore ?? CATEGORY_COLOR_FALLBACK }}
              />
              <div>
                <p className="font-medium">{c.nome}</p>
                <p className="text-xs text-muted">{c.tipo === 'expense' ? 'Spesa' : 'Entrata'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => startEdit(c)}
                aria-label={`Modifica ${c.nome}`}
                className="rounded-full p-2 text-muted hover:bg-surface-muted hover:text-foreground"
              >
                <Pencil size={18} />
              </button>
              <button
                type="button"
                onClick={() => handleArchive(c.id)}
                aria-label={`Archivia ${c.nome}`}
                className="rounded-full p-2 text-muted hover:bg-surface-muted hover:text-danger"
              >
                <Archive size={18} />
              </button>
            </div>
          </li>
        ))}
        {attive.length === 0 && (
          <p className="rounded-[var(--radius-md)] bg-surface p-4 text-center text-sm text-muted shadow-[var(--shadow-card)]">
            Nessuna categoria ancora — creane una qui sotto.
          </p>
        )}
      </ul>

      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-bold">
          {editingCategory ? 'Modifica categoria' : 'Nuova categoria'}
        </h2>

        {!editingCategory && (
          <div className="flex gap-1.5 rounded-full bg-surface-muted p-1">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors duration-150 ${
                  tipo === t ? 'bg-surface text-foreground shadow-[var(--shadow-card)]' : 'text-muted'
                }`}
              >
                {t === 'expense' ? 'Spesa' : 'Entrata'}
              </button>
            ))}
          </div>
        )}

        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome categoria"
          className="rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand"
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">Colore</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-label={c.name}
                onClick={() => setColore(c.value)}
                style={{ backgroundColor: c.value }}
                className={`h-9 w-9 rounded-full transition-transform duration-150 ${
                  colore === c.value ? 'ring-2 ring-offset-2 ring-offset-surface' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={editingCategory ? handleUpdate : handleCreate}
          disabled={!nome.trim()}
          className="rounded-[var(--radius-md)] bg-brand py-3 text-sm font-semibold text-brand-foreground disabled:opacity-40"
        >
          {editingCategory ? 'Salva modifiche' : 'Aggiungi categoria'}
        </button>

        {editingCategory && (
          <button
            type="button"
            onClick={cancelEdit}
            className="rounded-[var(--radius-md)] bg-surface-muted py-3 text-sm font-semibold text-foreground"
          >
            Annulla
          </button>
        )}
      </section>
    </main>
  );
}
