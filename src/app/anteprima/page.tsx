import { notFound } from 'next/navigation';
import { oggiRomaISO } from '@/lib/calculations/casa/oggi';
import type { Andamento } from '@/lib/calculations/supporto/andamento';
import type { Consiglio } from '@/lib/calculations/supporto/consiglio';
import type { RigaLibretto } from '@/lib/calculations/supporto/home';
import type { Account, Category } from '@/lib/types';
import { HomeDashboard } from '../HomeDashboard';
import { InPari } from '../in-pari/InPari';
import { ApriFoglio } from './ApriFoglio';

// Solo in sviluppo: Home e /in-pari con dati di prova, senza login né Supabase,
// per poterle fotografare. Fuori dallo sviluppo la pagina non esiste (404).

const giorniFa = (oggi: string, n: number): string => {
  const d = new Date(`${oggi}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

const conti: Account[] = [
  { id: 'c1', nome: 'Conto principale', saldoAttuale: 1890.5, contaInDisponibile: true, targetSaldo: null },
  { id: 'c2', nome: 'Risparmi', saldoAttuale: 650, contaInDisponibile: false, targetSaldo: null },
];

const categorie: Category[] = [
  { id: 'k1', nome: 'Spesa', tipo: 'expense', colore: null, archiviata: false },
  { id: 'k2', nome: 'Ristoranti', tipo: 'expense', colore: null, archiviata: false },
  { id: 'k3', nome: 'Trasporti', tipo: 'expense', colore: null, archiviata: false },
  { id: 'k4', nome: 'Stipendio', tipo: 'income', colore: null, archiviata: false },
];

function righe(oggi: string): RigaLibretto[] {
  return [
    { id: 'r1', data: oggi, descrizione: 'Caffè', importo: 1.4, tipo: 'expense', stima: false, nelMese: 412.9 },
    { id: 'r2', data: giorniFa(oggi, 1), descrizione: 'Spesa al supermercato', importo: 38.2, tipo: 'expense', stima: true, nelMese: 411.5 },
    { id: 'r3', data: giorniFa(oggi, 2), descrizione: 'Stipendio', importo: 1450, tipo: 'income', stima: false, nelMese: 373.3 },
    { id: 'r4', data: giorniFa(oggi, 3), descrizione: 'Abbonamento treno', importo: 27.5, tipo: 'expense', stima: false, nelMese: 373.3 },
  ];
}

function andamento(oggi: string, solito: number | null): Andamento {
  const giorno = Number(oggi.slice(8, 10));
  const curva = Array.from({ length: giorno }, (_, i) => ({
    giorno: i + 1,
    mese: Math.round(((412.9 * (i + 1)) / giorno) * 100) / 100,
    solito: solito === null ? null : Math.round(((solito * (i + 1)) / giorno) * 100) / 100,
  }));
  return {
    spesoFinora: 412.9,
    solito,
    mesiConfronto: solito === null ? 0 : 3,
    curva,
    perCategoria: [
      { categoriaId: 'k1', mese: 210, solito: solito === null ? null : 160 },
      { categoriaId: 'k2', mese: 120.9, solito: solito === null ? null : 110 },
      { categoriaId: 'k3', mese: 82, solito: solito === null ? null : 90 },
    ],
  };
}

const consiglio: Consiglio = {
  tipo: 'categoria_sopra',
  testo: 'Questo mese la spesa è un po’ sopra il solito.',
  perche: 'Finora hai speso 210 € in spesa, di solito a questo punto sei a 160 €.',
  categoriaId: 'k1',
};

const consiglioVuoto: Consiglio = {
  tipo: 'senza_dettaglio',
  testo: 'Segna qualche spesa: dopo qualche giorno ti dico come va.',
  perche: 'Non ci sono ancora abbastanza spese per un confronto.',
};

function Banner() {
  return (
    <p className="bg-surface-muted px-3 py-1 text-center text-xs font-semibold uppercase tracking-[0.1em] text-ink-2">
      Dati di prova
    </p>
  );
}

export default async function AnteprimaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();

  const { vista } = await searchParams;
  const scelta = typeof vista === 'string' ? vista : 'home';
  const oggi = oggiRomaISO();
  const dataTarget = `${giorniFa(oggi, -12)}T00:00:00.000Z`;

  if (scelta === 'in-pari') {
    return (
      <>
        <Banner />
        <InPari
          periodo={{ dal: giorniFa(oggi, 3), al: giorniFa(oggi, 1) }}
          conti={conti.map((c) => ({ id: c.id, nome: c.nome }))}
          casa={null}
          andamento={andamento(oggi, 380)}
          consiglio={consiglio}
          oggi={oggi}
        />
      </>
    );
  }

  const vuota = scelta === 'vuota';

  return (
    <>
      <Banner />
      <HomeDashboard
        disponibileLibero={vuota ? 0 : 1240.5}
        margineGiornaliero={vuota ? 0 : 45}
        dataTarget={dataTarget}
        accounts={vuota ? [] : conti}
        categories={categorie}
        goals={[]}
        righe={vuota ? [] : righe(oggi)}
        storico={[]}
        andamento={vuota ? { ...andamento(oggi, null), spesoFinora: 0, curva: [], perCategoria: [] } : andamento(oggi, 380)}
        consiglio={vuota ? consiglioVuoto : consiglio}
        prossimo={vuota ? null : { testo: 'Rimettiti in pari: dal 9 al 11 non hai segnato spese', href: '/in-pari', tipo: 'in_pari' }}
        notificheAttive={null}
        chiavePubblica={null}
        oggi={oggi}
      />
      {scelta === 'foglio' ? <ApriFoglio /> : null}
    </>
  );
}
