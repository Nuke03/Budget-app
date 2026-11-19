import { GIORNI_SETTIMANA } from './soglie';
import type { PassoId, PercorsoUtente } from '@/lib/percorso/tipi';
import type { Account, BudgetGoal } from '@/lib/types';

export interface StatoPasso { id: PassoId; fatto: boolean }
export interface PrimiPassi {
  passi: StatoPasso[];
  fatti: number;
  totale: number;
  prossimo: PassoId | null;
  visibile: boolean;
}

function giorniTra(da: string, a: string): number {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000;
}

// La settimana di prova è finita dopo 7 giorni dall'avvio.
export function settimanaFinita(percorso: PercorsoUtente | null, oggi: string): boolean {
  if (!percorso?.settimanaDal) return false;
  return giorniTra(percorso.settimanaDal, oggi) >= GIORNI_SETTIMANA;
}

// I primi passi di avvio. `goals` sono gli obiettivi personali aperti.
export function statoPrimiPassi(input: {
  conti: Account[];
  goals: BudgetGoal[];
  percorso: PercorsoUtente | null;
  pivaGuidata: boolean;
  oggi: string;
}): PrimiPassi {
  const { conti, percorso, pivaGuidata } = input;
  const goals = input.goals.filter((g) => g.stato === 'aperto');

  const passi: StatoPasso[] = [
    { id: 'conti', fatto: conti.some((c) => !c.archiviato) },
    { id: 'entrate', fatto: (percorso?.entrateTipo ?? null) !== null },
  ];
  if (percorso?.entrateTipo === 'piva') passi.push({ id: 'piva', fatto: pivaGuidata });
  passi.push(
    { id: 'settimana', fatto: (percorso?.settimanaFattaIl ?? null) !== null },
    {
      id: 'spese-certe',
      fatto: !!percorso?.speseCerteNessuna || goals.some((g) => g.modalita === 'dilazionato' && g.ricorrente && !g.ruolo),
    },
    { id: 'imprevisti', fatto: goals.some((g) => g.ruolo === 'imprevisti') },
    {
      id: 'obiettivo',
      fatto: !!percorso?.obiettivoPiuAvanti || goals.some((g) => !g.ricorrente && !g.ruolo),
    }
  );

  const fatti = passi.filter((p) => p.fatto).length;
  return {
    passi,
    fatti,
    totale: passi.length,
    prossimo: passi.find((p) => !p.fatto)?.id ?? null,
    visibile: !percorso?.nascosti && fatti < passi.length,
  };
}
