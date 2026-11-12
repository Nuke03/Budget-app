import Link from 'next/link';
import { CoverHeader } from '../CoverHeader';
import { CLASSE_NEUTRO, CLASSE_PRIMARIO } from './CampiMovimento';

export function CasaSenzaCasa() {
  return (
    <>
      <CoverHeader titolo="Casa" />
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-3 pb-6 pt-3.5">
        <p className="text-[15px] text-ink-2">Qui mettete insieme le spese di casa. Il resto resta solo vostro.</p>

        <div className="flex flex-col gap-3">
          <Link href="/casa/inizia" className={CLASSE_PRIMARIO}>
            Creo la casa
          </Link>
          <Link href="/casa/inizia?modo=entra" className={CLASSE_NEUTRO}>
            Ho un codice di invito
          </Link>
        </div>

        <p className="text-[15px] text-ink-2">
          <span className="font-semibold text-foreground">Cosa vedono le altre persone di casa?</span> Solo conti, spese e
          obiettivi della casa. Le tue cose personali no, mai.
        </p>
      </main>
    </>
  );
}
