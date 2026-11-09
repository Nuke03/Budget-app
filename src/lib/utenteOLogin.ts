import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';

// Senza sessione (o con sessione non valida, errori 4xx) si va al login. Se Supabase non risponde
// (rete, pausa del servizio) l'errore sale alla pagina "Non riesco a raggiungere il database".
export async function utenteOLogin(supabase: SupabaseClient): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (user) return user;
  const status = (error as { status?: number } | null)?.status ?? 0;
  if (error && (status < 400 || status >= 500)) throw error;
  redirect('/login');
}
