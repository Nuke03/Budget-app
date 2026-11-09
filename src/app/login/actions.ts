'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validateLoginInput } from './validation';
import { messaggioErroreLogin } from './errors';
import { nextPerLogin, percorsoInternoSicuro } from '@/lib/percorsoSicuro';

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const destinazione = percorsoInternoSicuro(String(formData.get('next') ?? ''));
  const next = nextPerLogin(destinazione);
  const coda = next ? `&${next}` : '';

  const validation = validateLoginInput(email, password);
  if (!validation.valid) {
    redirect(`/login?error=${encodeURIComponent(validation.error)}${coda}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(messaggioErroreLogin(error.message))}${coda}`);
  }

  redirect(destinazione);
}
