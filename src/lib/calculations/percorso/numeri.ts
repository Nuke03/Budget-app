// "Con i tuoi numeri": frasi pronte dai dati dell'utente.
import type { ArgomentoId } from '@/lib/percorso/tipi';
import type { Category, Transaction } from '@/lib/types';
import { euroInFrase } from '@/lib/format';
import { computeQuotaMensile } from '../accantonato';
import { PICCOLA_SPESA } from './soglie';
import type { DatiRegole } from './regole';
import { ruoloCategoria } from './ruoli';

export function piccoleSpese(t: Transaction[], mese: string): { numero: number; totale: number } {
  let numero = 0;
  let centesimi = 0;
  for (const x of t) {
    if (x.tipo !== 'expense' || !x.data.startsWith(mese) || x.importo >= PICCOLA_SPESA) continue;
    numero += 1;
    centesimi += Math.round(x.importo * 100);
  }
  return { numero, totale: centesimi / 100 };
}

export function divisioneMese(
  t: Transaction[],
  categorie: Category[],
  mese: string
): { certe: number; altre: number } {
  let certe = 0;
  let altre = 0;
  for (const x of t) {
    if (x.tipo !== 'expense' || !x.data.startsWith(mese)) continue;
    const c = categorie.find((k) => k.id === x.categoriaId);
    if (c && ruoloCategoria(c) === 'certa') certe += x.importo;
    else altre += x.importo;
  }
  return { certe, altre };
}

export function numeriLezione(id: ArgomentoId, d: DatiRegole): string | null {
  const mese = d.oggi.slice(0, 7);
  switch (id) {
    case 'dove-vanno': {
      const p = piccoleSpese(d.transazioni, mese);
      if (p.numero === 0) return null;
      return `Questo mese hai ${p.numero} spese sotto i ${PICCOLA_SPESA} €, in tutto ${euroInFrase(p.totale)}.`;
    }
    case 'bisogni-desideri': {
      const v = divisioneMese(d.transazioni, d.categorie, mese);
      if (v.certe + v.altre === 0) return null;
      return `Questo mese ${euroInFrase(v.certe)} sono andati in spese certe e ${euroInFrase(v.altre)} in tutto il resto.`;
    }
    case 'imprevisti': {
      const fondo = d.goals.find((g) => g.ruolo === 'imprevisti');
      if (!fondo) return 'Il cuscinetto per gli imprevisti non c’è ancora.';
      return `Nel cuscinetto per gli imprevisti ci sono ${euroInFrase(fondo.accantonato)}.`;
    }
    case 'spese-certe': {
      const fondi = d.goals.filter((g) => g.stato === 'aperto' && g.ruolo !== 'imprevisti');
      if (fondi.length === 0) return null;
      const oggi = new Date(`${d.oggi}T00:00:00`);
      let quota = 0;
      for (const g of fondi) {
        try {
          quota += computeQuotaMensile(g, oggi) ?? 0;
        } catch {
          // dati incompleti: quel fondo non entra nel conto
        }
      }
      return `Hai ${fondi.length} ${fondi.length === 1 ? 'fondo aperto' : 'fondi aperti'}, in tutto ${euroInFrase(Math.round(quota * 100) / 100)} al mese.`;
    }
    case 'piano':
      return `Adesso il tuo libero è ${euroInFrase(d.disponibileLibero)}.`;
    default:
      return null;
  }
}
