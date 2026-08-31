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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-brand text-3xl font-bold text-brand-foreground shadow-[var(--shadow-hero)]">
          €
        </span>
        <h1 className="text-2xl font-bold">Nuova password</h1>
      </div>

      {!ready && (
        <p className="rounded-[var(--radius-md)] bg-cat-amber/15 p-3 text-sm text-cat-amber">
          In attesa del link di recupero. Se sei arrivato qui direttamente (non da un&apos;email
          di recupero), torna al{' '}
          <a href="/login" className="font-semibold underline">
            login
          </a>
          .
        </p>
      )}

      {error && (
        <p className="rounded-[var(--radius-md)] bg-danger-tint p-3 text-sm text-danger">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          placeholder="Nuova password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand"
        />
        <input
          type="password"
          placeholder="Conferma nuova password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-[var(--radius-md)] bg-brand py-3.5 text-base font-semibold text-brand-foreground shadow-[var(--shadow-fab)] disabled:opacity-60 disabled:shadow-none"
        >
          {submitting ? 'Salvataggio in corso...' : 'Salva nuova password'}
        </button>
      </form>
    </main>
  );
}
