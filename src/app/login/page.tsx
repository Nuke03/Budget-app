import { login } from './actions';
import { SubmitButton } from './SubmitButton';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2">
        <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-brand text-3xl font-bold text-brand-foreground shadow-[var(--shadow-hero)]">
          €
        </span>
        <h1 className="text-2xl font-bold">Bentornato</h1>
        <p className="text-sm text-muted">Accedi per vedere il tuo disponibile</p>
      </div>

      {error && (
        <p className="rounded-[var(--radius-md)] bg-danger-tint p-3 text-sm text-danger">{error}</p>
      )}

      <form action={login} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="rounded-[var(--radius-md)] border border-black/5 bg-surface-muted px-4 py-3 text-base outline-none focus-visible:border-brand"
        />
        <SubmitButton />
      </form>

      <a href="/forgot-password" className="text-center text-sm font-semibold text-muted underline">
        Password dimenticata?
      </a>
    </main>
  );
}
