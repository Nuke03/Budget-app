import Link from 'next/link';

export function CasaSenzaCasa() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-5 pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Casa</h1>
        <p className="text-base text-muted">Qui mettete insieme le spese di casa. Il resto resta solo vostro.</p>
      </header>

      <div className="flex flex-col gap-3">
        <Link
          href="/casa/inizia"
          className="rounded-[var(--radius-md)] bg-brand py-3 text-center text-sm font-semibold text-brand-foreground"
        >
          Creo la casa
        </Link>
        <Link
          href="/casa/inizia?modo=entra"
          className="rounded-[var(--radius-md)] border border-black/10 bg-surface py-3 text-center text-sm font-semibold"
        >
          Ho un codice di invito
        </Link>
      </div>

      <p className="text-sm text-muted">
        <span className="font-semibold text-foreground">Cosa vede l&apos;altro?</span> Solo conti, spese e
        obiettivi della casa. Le tue cose personali no, mai.
      </p>
    </main>
  );
}
