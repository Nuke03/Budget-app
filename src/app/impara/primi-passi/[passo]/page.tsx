import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { conUtente } from '@/lib/utenteOLogin';
import { loadPercorsoLeggero } from '@/lib/loadPercorsoData';
import { lezione } from '@/lib/percorso/lezioni';
import { PASSI_ID, PASSI_TESTI } from '@/lib/percorso/passiTesti';
import { faseSettimana, riepilogoSettimana } from '@/lib/calculations/percorso/primiPassiFondi';
import { SPESE_CERTE_PERSONALI } from '@/lib/percorso/speseCerte';
import type { PassoId } from '@/lib/percorso/tipi';
import { CoverHeader } from '../../../CoverHeader';
import { PassoEntrate } from '../PassoEntrate';
import { PassoImprevisti } from '../PassoImprevisti';
import { PassoObiettivo } from '../PassoObiettivo';
import { PassoSettimana } from '../PassoSettimana';
import { PassoSpeseCerte } from '../PassoSpeseCerte';
import { PRIMARIO } from '../stili';

export default async function PassoPage({ params }: { params: Promise<{ passo: string }> }) {
  const { passo } = await params;
  if (!PASSI_ID.includes(passo as PassoId)) notFound();
  const id = passo as PassoId;
  const supabase = await createClient();
  const { dati } = await conUtente(supabase, (u) => loadPercorsoLeggero(supabase, new Date(), u));
  const testo = PASSI_TESTI[id];
  const fase = faseSettimana(dati.percorso?.settimanaDal ?? null, dati.oggi);

  let azione;
  switch (id) {
    case 'conti':
      azione = (
        <Link href="/accounts" className={`${PRIMARIO} mt-5`}>
          Vai ai conti
        </Link>
      );
      break;
    case 'entrate':
      azione = <PassoEntrate iniziale={dati.percorso} />;
      break;
    case 'piva':
      azione = (
        <Link href="/piva" className={`${PRIMARIO} mt-5`}>
          Apri la guida P.IVA
        </Link>
      );
      break;
    case 'settimana':
      azione = (
        <PassoSettimana
          fase={fase}
          dal={dati.percorso?.settimanaDal ?? null}
          riepilogo={
            fase === 'finita' && dati.percorso?.settimanaDal
              ? riepilogoSettimana(dati.transazioni, dati.categorie, dati.percorso.settimanaDal, dati.oggi)
              : null
          }
        />
      );
      break;
    case 'spese-certe':
      azione = <PassoSpeseCerte
          oggi={dati.oggi}
          giaCreate={SPESE_CERTE_PERSONALI.filter((s) => dati.goals.some((g) => g.nome === s.nome)).map((s) => s.chiave)}
        />;
      break;
    case 'imprevisti':
      azione = <PassoImprevisti giaCreato={dati.goals.some((g) => g.ruolo === 'imprevisti')} />;
      break;
    case 'obiettivo':
      azione = <PassoObiettivo />;
      break;
  }

  return (
    <>
      <CoverHeader titolo="Impara" />
      <main className="mx-auto max-w-xl px-4 pb-28 pt-5">
        <h2 className="font-serif text-xl font-semibold text-foreground">{testo.titolo}</h2>
        {testo.lezioni.map((l) => (
          <section key={l} className="mt-4">
            <h3 className="text-sm font-semibold text-ink-2">{lezione(l).titolo}</h3>
            <p className="mt-1 text-[15px]">{lezione(l).inBreve}</p>
          </section>
        ))}
        {azione}
        <Link
          href="/impara/primi-passi"
          className="mt-4 inline-flex min-h-11 items-center text-[15px] text-brand-dark underline"
        >
          Tutti i primi passi
        </Link>
      </main>
    </>
  );
}
