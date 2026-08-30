'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export function validateLoginInput(
  email: string,
  password: string
): { valid: true } | { valid: false; error: string } {
  if (!email) return { valid: false, error: 'Email obbligatoria' };
  if (!password) return { valid: false, error: 'Password obbligatoria' };
  return { valid: true };
}

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const validation = validateLoginInput(email, password);
  if (!validation.valid) {
    redirect(`/login?error=${encodeURIComponent(validation.error)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/');
}
