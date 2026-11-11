import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getMyHousehold, type CasaCorrente } from '@/lib/data/households';

// Senza sessione (o con sessione non valida, errori 4xx) si va al login. Se Supabase non risponde
// (rete, pausa del servizio) l'errore sale alla pagina "Non riesco a raggiungere il database".
// Con il token in mano getUser non prende il lock interno del client: le letture in parallelo
// non restano in coda dietro la verifica.
export async function utenteOLogin(supabase: SupabaseClient, token?: string | null): Promise<User> {
  const {
    data: { user },
    error,
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
  if (user) return user;
  const status = (error as { status?: number } | null)?.status ?? 0;
  if (error && (status < 400 || status >= 500)) throw error;
  redirect('/login');
}

export interface Sessione {
  userId: string | null;
  token: string | null;
}

// L'utente scritto nel token dei cookie, senza chiamate di rete (getSession rinnova il token solo se
// sta per scadere). Non è una verifica: serve a far partire subito le letture, mentre utenteOLogin
// controlla l'utente in parallelo. I dati restano protetti dalla RLS, che verifica il token a ogni
// richiesta.
export async function leggiSessione(supabase: SupabaseClient): Promise<Sessione> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    if (!token) return { userId: null, token: null };
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const sub = (JSON.parse(atob(parte)) as { sub?: unknown }).sub;
    return { userId: typeof sub === 'string' ? sub : null, token };
  } catch {
    return { userId: null, token: null };
  }
}

// Le letture di una pagina partono insieme alla verifica dell'utente, non dopo. La verifica vince
// sempre: senza utente si va al login anche se le letture falliscono. Se l'utente verificato non è
// quello del token (non dovrebbe succedere), le letture si rifanno con quello giusto.
export async function conUtente<T>(
  supabase: SupabaseClient,
  carica: (userId: string | null) => Promise<T>
): Promise<{ user: User; dati: T }> {
  const sessione = await leggiSessione(supabase);
  const inCorso = sessione.userId ? carica(sessione.userId) : null;
  inCorso?.catch(() => {});
  const user = await utenteOLogin(supabase, sessione.token);
  if (inCorso && sessione.userId === user.id) return { user, dati: await inCorso };
  return { user, dati: await carica(user.id) };
}

// L'utente e la sua casa, letti insieme.
export async function utenteECasa(
  supabase: SupabaseClient
): Promise<{ user: User; casa: CasaCorrente | null }> {
  const { user, dati } = await conUtente(supabase, (id) =>
    id ? getMyHousehold(supabase, id) : Promise.resolve(null)
  );
  return { user, casa: dati };
}
