'use client';

import { IconaApp } from '@/lib/iconaApp';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValid = email.trim() !== '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setStatus('sending');
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }

    setStatus('sent');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span aria-hidden="true" className="block h-16 w-16 overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-hero)]">
          <IconaApp lato={64} margine={0.1} />
        </span>
        <h1 className="text-2xl font-bold">Password dimenticata</h1>
        <p className="text-sm text-muted">
          Inserisci la tua email: se è registrata, ti mandiamo un link per reimpostare la
          password.
        </p>
      </div>

      {status === 'sent' ? (
        <p className="rounded-[var(--radius-md)] bg-brand-tint p-3 text-center text-sm text-brand-dark">
          Controlla la tua casella email per il link di recupero.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            aria-label="Email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand"
          />
          {errorMessage && (
            <p className="rounded-[var(--radius-md)] bg-danger-tint p-3 text-sm text-danger">
              {errorMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={!isValid || status === 'sending'}
            className="rounded-[var(--radius-md)] bg-brand py-3.5 text-base font-semibold text-brand-foreground shadow-[var(--shadow-fab)] disabled:opacity-60 disabled:shadow-none"
          >
            {status === 'sending' ? 'Invio in corso...' : 'Invia link di recupero'}
          </button>
        </form>
      )}

      <a href="/login" className="text-center text-sm font-semibold text-muted underline">
        Torna al login
      </a>
    </main>
  );
}
