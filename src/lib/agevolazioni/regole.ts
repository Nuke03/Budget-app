// Regole pure: cosa mostrare, in che ordine, con quale frase; e il promemoria per la Home.
import { formatNumero } from '@/lib/format';
import { VOCI } from './voci';
import type { Situazione, StatoVoce, VoceId, VoceMostrata } from './tipi';

const anno = (d: string): number => Number(d.slice(0, 4));
const mese = (d: string): number => Number(d.slice(5, 7));

const euro = (n: number): string => `${formatNumero(n)} €`;

/** ISEE usabile: null se manca o se la DSU è di un anno precedente (scade il 31 dicembre). */
export function iseeValido(s: Situazione, oggi: string): number | null {
  if (s.isee === null) return null;
  if (s.dsuData !== null && anno(s.dsuData) < anno(oggi)) return null;
  return s.isee;
}

function statoValido(voceId: VoceId, stati: StatoVoce[], oggi: string): StatoVoce | null {
  const voce = VOCI.find((v) => v.id === voceId);
  const st = stati.find((x) => x.voceId === voceId);
  if (!voce || !st) return null;
  if (voce.annuale && st.stato === 'fatto' && anno(st.il) < anno(oggi)) return null;
  return st;
}

function piuDiDodiciMesi(controllatoIl: string, oggi: string): boolean {
  const limite = `${anno(controllatoIl) + 1}${controllatoIl.slice(4)}`;
  return oggi > limite;
}

export function vociDaMostrare(
  s: Situazione,
  stati: StatoVoce[],
  oggi: string,
): { daControllare: VoceMostrata[]; chiuse: VoceMostrata[] } {
  const isee = iseeValido(s, oggi);
  const comune = s.comune?.trim() ? s.comune.trim() : null;
  const sotto: VoceMostrata[] = [];
  const altre: VoceMostrata[] = [];
  const chiuse: VoceMostrata[] = [];

  for (const voce of VOCI) {
    if (voce.validaFinoAl !== null && oggi > voce.validaFinoAl) continue;
    if (!voce.mostra(s)) continue;

    const st = statoValido(voce.id, stati, oggi);
    let frase = voce.perche;
    let sottoSoglia = false;
    if (voce.soglia) {
      if (isee !== null && isee <= voce.soglia.valore) {
        frase = `Il tuo ISEE è sotto la soglia del ${voce.soglia.anno}: potrebbe riguardarti.`;
        sottoSoglia = true;
      } else {
        frase = `Nel ${voce.soglia.anno} la soglia è ${euro(voce.soglia.valore)}: controlla se è cambiata e se vale per te.`;
      }
    } else if (voce.id === 'isee-dsu' && s.dsuData !== null && anno(s.dsuData) < anno(oggi)) {
      frase = 'Il tuo ISEE è scaduto il 31 dicembre.';
    }

    const cercare =
      voce.cercare === null
        ? null
        : comune
          ? voce.cercare.replace('{comune}', () => comune)
          : voce.cercare.replace(' {comune}', '').replace('{comune}', '').trim();

    const m: VoceMostrata = {
      voce,
      frase,
      cercare,
      daRicontrollare: piuDiDodiciMesi(voce.controllatoIl, oggi),
      stato: st ? st.stato : null,
    };
    if (st) chiuse.push(m);
    else if (sottoSoglia) sotto.push(m);
    else altre.push(m);
  }
  return { daControllare: [...sotto, ...altre], chiuse };
}

// I mesi in cui promemoriaAgevolazioni può scattare: gennaio (la DSU) e il mese del bando di ogni voce a bando
// (febbraio se non indicato). Negli altri mesi la Home non deve leggere nulla.
export function mesiPromemoriaAgevolazioni(): number[] {
  const bandi = ['tari-comune', 'contributo-affitto'].map((id) => VOCI.find((v) => v.id === id)!.meseBando ?? 2);
  return [...new Set([1, ...bandi])];
}

export function promemoriaAgevolazioni(
  s: Situazione | null,
  stati: StatoVoce[],
  haApertoSezione: boolean,
  oggi: string,
): { id: string; testo: string; href: string; voceId: VoceId } | null {
  const m = mese(oggi);
  const giorno = Number(oggi.slice(8, 10));
  const chiusa = (id: VoceId) => statoValido(id, stati, oggi) !== null;

  // Gennaio, dal 2 al 31: rifare la DSU.
  if (m === 1 && giorno >= 2 && !chiusa('isee-dsu')) {
    const dsuQuestAnno = s?.dsuData != null && anno(s.dsuData) === anno(oggi);
    const indicato = s !== null && (s.isee !== null || s.dsuData !== null);
    if (!dsuQuestAnno && (indicato || haApertoSezione)) {
      return {
        id: `agevolazione-isee-dsu-${anno(oggi)}`,
        testo: "L'ISEE è scaduto il 31 dicembre: rifai la DSU.",
        href: '/agevolazioni#isee-dsu',
        voceId: 'isee-dsu',
      };
    }
  }

  if (s === null) return null;
  const bandi: { id: VoceId; attivo: boolean }[] = [
    { id: 'tari-comune', attivo: s.isee !== null || (s.comune !== null && s.comune.trim() !== '') },
    { id: 'contributo-affitto', attivo: s.inAffitto === true },
  ];
  for (const b of bandi) {
    const voce = VOCI.find((v) => v.id === b.id)!;
    if (!b.attivo || chiusa(b.id)) continue;
    if ((voce.meseBando ?? 2) !== m) continue;
    return {
      id: `agevolazione-${b.id}-${anno(oggi)}`,
      testo: `Controlla se il comune ha aperto il bando: ${voce.titolo}.`,
      href: `/agevolazioni#${b.id}`,
      voceId: b.id,
    };
  }
  return null;
}
