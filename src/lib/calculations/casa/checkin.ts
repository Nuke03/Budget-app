import type { PlanBundle } from '../../data/householdPlans';
import type { EsitoCheckin, Transaction } from '../../types';
import type { Spiegazione } from './spiegazioni';
import type { RigaMese } from './versamenti';
import { meseRomaISO } from './oggi';

export interface CheckinCalcolato {
  mese: string;
  attesoTotale: number;
  versatoTotale: number;
  previstoMensili: number;
  spesoMensili: number;
  nonRegistrate: number;
  avanzo: number;
  esito: EsitoCheckin;
  secondoAmmanco: boolean;
  spiegazioneAvanzo: Spiegazione;
}

const arrotonda = (n: number): number => Math.round(n * 100) / 100;

// Il mese prima, come YYYY-MM-01.
export function mesePrecedente(mese: string): string {
  const anno = Number(mese.slice(0, 4));
  const m = Number(mese.slice(5, 7));
  return m === 1 ? `${anno - 1}-12-01` : `${anno}-${String(m - 1).padStart(2, '0')}-01`;
}

// Sotto un euro (in valore assoluto) il mese è in pari.
function esitoDi(avanzo: number): EsitoCheckin {
  if (Math.abs(avanzo) < 1) return 'in_pari';
  return avanzo > 0 ? 'avanzo' : 'ammanco';
}

// avanzo = (versato - atteso) + (previsto - speso - non registrate): chi ha versato meno del dovuto
// pesa, le spese mensili sotto il previsto avanzano, quelle non registrate si tolgono.
export function computeCheckin(input: {
  mese: string;
  righePerMembro: Record<string, RigaMese[]>;
  piano: PlanBundle | null;
  spese: Transaction[];
  precedente: { esito: EsitoCheckin } | null;
}): CheckinCalcolato {
  const { mese, piano, spese, precedente } = input;

  let attesoTotale = 0;
  let versatoTotale = 0;
  for (const righe of Object.values(input.righePerMembro)) {
    const riga = righe.find((r) => r.mese === mese);
    if (!riga) continue;
    attesoTotale += riga.atteso;
    versatoTotale += riga.versato;
  }
  attesoTotale = arrotonda(attesoTotale);
  versatoTotale = arrotonda(versatoTotale);

  const voci = piano?.items ?? [];
  const previstoMensili = arrotonda(voci.filter((v) => v.frequenzaMesi === 1).reduce((s, v) => s + v.importoMensile, 0));
  // Le spese collegate a un obiettivo contano qui solo se è quello di una voce mensile: i fondi
  // di una tantum (deposito, registro, arredo...) e quelli delle bollette non mensili sono già messi da parte.
  const obiettiviMensili = new Set(voci.filter((v) => v.frequenzaMesi === 1 && v.goalId).map((v) => v.goalId));

  let speso = 0;
  let nonRegistrate = 0;
  for (const s of spese) {
    if (s.tipo !== 'expense' || s.data.slice(0, 7) !== mese.slice(0, 7)) continue;
    if (s.origine === 'riconciliazione') {
      nonRegistrate += s.importo;
      continue;
    }
    if (s.goalId && !obiettiviMensili.has(s.goalId)) continue;
    speso += s.importo;
  }
  const spesoMensili = arrotonda(speso);
  nonRegistrate = arrotonda(nonRegistrate);

  const avanzo = arrotonda(versatoTotale - attesoTotale + previstoMensili - spesoMensili - nonRegistrate);
  const esito = esitoDi(avanzo);

  return {
    mese,
    attesoTotale,
    versatoTotale,
    previstoMensili,
    spesoMensili,
    nonRegistrate,
    avanzo,
    esito,
    secondoAmmanco: esito === 'ammanco' && precedente?.esito === 'ammanco',
    spiegazioneAvanzo: {
      valore: avanzo,
      formula: 'Versamenti ricevuti meno attesi, più spese previste meno registrate meno non registrate.',
      ingredienti: [
        { etichetta: 'Versamenti ricevuti', valore: versatoTotale },
        { etichetta: 'Versamenti attesi', valore: -attesoTotale },
        { etichetta: 'Spese previste', valore: previstoMensili },
        { etichetta: 'Spese registrate', valore: -spesoMensili },
        { etichetta: 'Spese non registrate', valore: -nonRegistrate },
      ],
    },
  };
}

// Il mese da controllare è l'ultimo mese chiuso, se ha una riga e non è già stato controllato.
// I mesi più vecchi non controllati si saltano.
export function meseDaControllare(input: {
  oggi: string;
  righe: RigaMese[];
  ultimoCheckinMese: string | null;
}): string | null {
  const ultimoChiuso = mesePrecedente(meseRomaISO(new Date(`${input.oggi}T12:00:00Z`)));
  if (!input.righe.some((r) => r.mese === ultimoChiuso)) return null;
  if (input.ultimoCheckinMese !== null && input.ultimoCheckinMese >= ultimoChiuso) return null;
  return ultimoChiuso;
}
