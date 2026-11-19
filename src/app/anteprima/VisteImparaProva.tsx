'use client';

// Client: le viste con funzioni (come onChiudi) non possono passarle da un Server Component.
import type { AvvisoFondi } from '@/lib/calculations/percorso/avviso';
import type { PrimiPassi } from '@/lib/calculations/percorso/passi';
import { lezione } from '@/lib/percorso/lezioni';
import type { StatiLezioni, VoceAttesa } from '@/lib/percorso/tipi';
import { AvvisoFondiFoglio } from '../add/AvvisoFondiFoglio';
import { RicominciaDaZero } from '../altro/RicominciaDaZero';
import { CoverHeader } from '../CoverHeader';
import { PrimiPassiCard } from '../home/PrimiPassiCard';
import { ElencoImpara } from '../impara/ElencoImpara';
import { ListaAttesa } from '../impara/attesa/ListaAttesa';
import { PassoImprevisti } from '../impara/primi-passi/PassoImprevisti';
import { SchedaLezione } from '../impara/SchedaLezione';

// Le schermate del percorso con dati di prova: i componenti veri, nessuna scrittura (le azioni partono solo al clic).

const giorniFa = (oggi: string, n: number): string => {
  const d = new Date(`${oggi}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

const primiPassiProva: PrimiPassi = {
  passi: [
    { id: 'conti', fatto: true },
    { id: 'entrate', fatto: true },
    { id: 'settimana', fatto: false },
    { id: 'spese-certe', fatto: false },
    { id: 'imprevisti', fatto: false },
    { id: 'obiettivo', fatto: false },
  ],
  fatti: 2,
  totale: 6,
  prossimo: 'settimana',
  visibile: true,
};

export function ImparaProva({ oggi }: { oggi: string }) {
  const lezioni: StatiLezioni = {
    'dove-vanno': { vistaIl: giorniFa(oggi, 3), rimandataAl: null, azioneIl: null, propostaIl: null },
  };
  return (
    <>
      <CoverHeader titolo="Impara" />
      <main className="mx-auto max-w-xl px-4 pb-28 pt-5">
        <ElencoImpara primiPassiDaFinire lezioni={lezioni} />
      </main>
    </>
  );
}

export function LezioneProva() {
  const l = lezione('imprevisti');
  return (
    <>
      <CoverHeader titolo="Impara" />
      <SchedaLezione lezione={l} numeri="Il tuo cuscinetto è di 150 €: copre circa una settimana di spese." anteprima />
    </>
  );
}

export function PrimiPassiProva() {
  return (
    <main className="mx-auto max-w-md px-3 pb-28 pt-3.5">
      <PrimiPassiCard primiPassi={primiPassiProva} />
    </main>
  );
}

export function PassoImprevistiProva() {
  return (
    <>
      <CoverHeader titolo="Impara" />
      <main className="mx-auto max-w-xl px-4 pb-28 pt-5">
        <h2 className="font-serif text-xl font-semibold text-foreground">Il cuscinetto per gli imprevisti</h2>
        <PassoImprevisti giaCreato={false} />
      </main>
    </>
  );
}

const avvisoProva: AvvisoFondi = {
  buco: 85,
  toccati: ['obiettivi'],
  fondoImprevisti: { goalId: 'g-imprevisti', accantonato: 150 },
};

export function AvvisoFondiProva() {
  return <AvvisoFondiFoglio avviso={avvisoProva} transactionId="t-prova" lezione="imprevisti" onChiudi={() => {}} />;
}

export function AttesaProva({ oggi }: { oggi: string }) {
  const voci: VoceAttesa[] = [
    { id: 'a1', nome: 'Cuffie nuove', importo: 129, aggiuntoIl: giorniFa(oggi, 31), rivediIl: giorniFa(oggi, 1), stato: 'in_attesa' },
    { id: 'a2', nome: 'Giacca invernale', importo: 89.9, aggiuntoIl: giorniFa(oggi, 5), rivediIl: giorniFa(oggi, -25), stato: 'in_attesa' },
  ];
  return (
    <>
      <CoverHeader titolo="Lista d'attesa" />
      <main className="mx-auto max-w-xl px-4 pb-28 pt-5">
        <ListaAttesa voci={voci} oggi={oggi} />
      </main>
    </>
  );
}

export function RicominciaProva() {
  return (
    <>
      <CoverHeader titolo="Altro" />
      <main className="mx-auto max-w-md px-3 pb-28 pt-3.5">
        <RicominciaDaZero casa={{ credito: 42.5, debito: 0 }} />
      </main>
    </>
  );
}
