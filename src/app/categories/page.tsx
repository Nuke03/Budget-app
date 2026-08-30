'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCategories, createCategory, archiveCategory } from '@/lib/data/categories';
import type { Category, CategoriaTipo } from '@/lib/types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<CategoriaTipo>('expense');

  async function refresh() {
    const supabase = createClient();
    setCategories(await getCategories(supabase));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    if (!nome.trim()) return;
    const supabase = createClient();
    await createCategory(supabase, { nome, tipo, colore: null });
    setNome('');
    await refresh();
  }

  async function handleArchive(id: string) {
    const supabase = createClient();
    await archiveCategory(supabase, id);
    await refresh();
  }

  const attive = categories.filter((c) => !c.archiviata);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">Categorie</h1>

      <ul className="flex flex-col gap-2">
        {attive.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded border p-2">
            <span>
              {c.nome} <span className="text-xs text-slate-400">({c.tipo})</span>
            </span>
            <button
              type="button"
              onClick={() => handleArchive(c.id)}
              className="text-sm text-slate-500 underline"
            >
              Archivia
            </button>
          </li>
        ))}
      </ul>

      <h2 className="text-lg font-semibold">Nuova categoria</h2>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome categoria"
        className="rounded border p-2"
      />
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value as CategoriaTipo)}
        className="rounded border p-2"
      >
        <option value="expense">Spesa</option>
        <option value="income">Entrata</option>
      </select>
      <button type="button" onClick={handleCreate} className="rounded bg-slate-900 p-2 text-white">
        Aggiungi categoria
      </button>
    </main>
  );
}
