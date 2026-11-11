// PostgREST su Supabase restituisce al massimo 1000 righe per risposta (max-rows di default) e
// tronca in silenzio il resto. Per le letture che devono essere complete si chiede una pagina alla
// volta finché ne arriva una non piena. La query deve avere un ordine stabile (con un id per
// spareggio), altrimenti due pagine potrebbero sovrapporsi.
export const RIGHE_PER_PAGINA = 1000;

export async function leggiTutte<T>(
  pagina: (da: number, a: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const tutte: T[] = [];
  for (let da = 0; ; da += RIGHE_PER_PAGINA) {
    const { data, error } = await pagina(da, da + RIGHE_PER_PAGINA - 1);
    if (error) throw error;
    const righe = data ?? [];
    tutte.push(...righe);
    if (righe.length < RIGHE_PER_PAGINA) return tutte;
  }
}
