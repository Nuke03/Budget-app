'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri.');
      return;
    }
    if (password !== confirm) {
      setError('Le due password non coincidono.');
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push('/');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Imposta una nuova password</h1>

      {!ready && (
        <p className="rounded bg-yellow-100 p-2 text-sm text-yellow-800">
          In attesa del link di recupero. Se sei arrivato qui direttamente (non da un'email di
          recupero), torna al{' '}
          <a href="/login" className="underline">
            login
          </a>
          .
        </p>
      )}

      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          placeholder="Nuova password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded border p-2"
        />
        <input
          type="password"
          placeholder="Conferma nuova password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="rounded border p-2"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 p-2 text-white disabled:opacity-60"
        >
          {submitting ? 'Salvataggio in corso...' : 'Salva nuova password'}
        </button>
      </form>
    </main>
  );
}
